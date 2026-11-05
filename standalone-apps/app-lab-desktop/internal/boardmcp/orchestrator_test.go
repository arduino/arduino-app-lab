package boardmcp

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// A normal end of stream arrives as an `error` event carrying SERVER_CLOSED: reading it as a failure would make
// every successful model install report an error, and missing a real one would report a download that never landed.
func TestScanSSEForError(t *testing.T) {
	cases := []struct {
		name, stream, want string
	}{
		{
			name:   "a clean close is not a failure",
			stream: "event: progress\ndata: {\"progress\":100}\n\nevent: error\ndata: {\"code\":\"SERVER_CLOSED\"}\n\n",
		},
		{
			name:   "a real error is reported by message",
			stream: "event: progress\ndata: {\"progress\":40}\n\nevent: error\ndata: {\"code\":\"NO_SPACE\",\"message\":\"insufficient space on the board\"}\n\n",
			want:   "insufficient space on the board",
		},
		{
			name:   "an error with no message falls back to its code",
			stream: "event: error\ndata: {\"code\":\"NO_SPACE\"}\n\n",
			want:   "NO_SPACE",
		},
		{
			name:   "data outside an error event is ignored",
			stream: "event: message\ndata: {\"message\":\"download complete\"}\n\n",
		},
		{
			name:   "heartbeats and unparseable payloads are ignored",
			stream: "event: heartbeat\n\nevent: error\ndata: not json\n\n",
		},
		{
			// A plain data-only event defaults to "message": carrying the previous event name over would read
			// ordinary progress as the failure that aborts the install.
			name:   "a nameless event after an error does not inherit its name",
			stream: "event: error\ndata: {\"code\":\"SERVER_CLOSED\"}\n\ndata: {\"message\":\"halfway there\"}\n\n",
		},
		{
			// Multi-line data must be joined, or the payload fails to unmarshal and the real error vanishes.
			name:   "an error split over several data lines is still read",
			stream: "event: error\ndata: {\"code\":\"NO_SPACE\",\n" + "data: \"message\":\"disk full\"}\n\n",
			want:   "disk full",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := scanSSEForError(context.Background(), strings.NewReader(c.stream), time.Minute, nil)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != c.want {
				t.Errorf("got %q, want %q", got, c.want)
			}
		})
	}
}

// A start or stop that worked still ends its stream with SERVER_CLOSED: read as a failure, apps_stop told the agent the app was still running.
func TestOrchestratorActionEndsOnServerClosed(t *testing.T) {
	cases := []struct {
		name, stream, wantErr string
	}{
		{
			name:   "a clean close after progress",
			stream: "event: message\ndata: {\"message\":\"stopping\"}\n\nevent: error\ndata: {\"code\":\"SERVER_CLOSED\"}\n\nevent: close\n\n",
		},
		{
			name:    "a real error before the close",
			stream:  "event: error\ndata: {\"code\":\"APP_NOT_FOUND\",\"message\":\"app not found\"}\n\nevent: error\ndata: {\"code\":\"SERVER_CLOSED\"}\n\n",
			wantErr: "app not found",
		},
		{
			name:    "an error with no message falls back to its code",
			stream:  "event: error\ndata: {\"code\":\"APP_BUSY\"}\n\n",
			wantErr: "APP_BUSY",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			board := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "text/event-stream")
				_, _ = io.WriteString(w, c.stream)
			}))
			defer board.Close()

			_, err := orchestratorAction(context.Background(), stubAccess{base: board.URL}, "/v1/apps/x/stop")
			switch {
			case c.wantErr == "" && err != nil:
				t.Errorf("a finished action reported %q", err)
			case c.wantErr != "" && (err == nil || !strings.Contains(err.Error(), c.wantErr)):
				t.Errorf("err = %v, want one naming %q", err, c.wantErr)
			}
		})
	}
}

// A board that goes quiet leaves a half-open socket that reads forever: without this bound the install sits on "Still downloading" until the hour cap.
func TestScanSSEForErrorStopsOnAStalledStream(t *testing.T) {
	// A reader that never returns, standing in for the half-open socket.
	stalled, done := io.Pipe()
	defer stalled.Close()
	defer done.Close()

	start := time.Now()
	_, err := scanSSEForError(context.Background(), stalled, 50*time.Millisecond, nil)
	if err == nil {
		t.Fatal("a stalled stream must fail, not block until the caller's cap")
	}
	if !strings.Contains(err.Error(), "stopped sending") {
		t.Errorf("error should name the stall, got %q", err)
	}
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Errorf("gave up after %s, expected roughly the stall timeout", elapsed)
	}
}

// Progress resets the clock: a slow but live download must not be cut off by the stall bound.
func TestScanSSEForErrorKeepsGoingWhileProgressArrives(t *testing.T) {
	r, w := io.Pipe()
	go func() {
		for i := 0; i < 4; i++ {
			time.Sleep(30 * time.Millisecond)
			_, _ = w.Write([]byte("event: progress\ndata: {\"current\":1,\"total\":100}\n\n"))
		}
		w.Close()
	}()

	seen := 0
	failure, err := scanSSEForError(context.Background(), r, 100*time.Millisecond, func(int64, int64) { seen++ })
	if err != nil {
		t.Fatalf("a stream still sending progress must not time out: %v", err)
	}
	if failure != "" {
		t.Errorf("unexpected failure %q", failure)
	}
	if seen != 4 {
		t.Errorf("got %d progress events, want 4", seen)
	}
}
