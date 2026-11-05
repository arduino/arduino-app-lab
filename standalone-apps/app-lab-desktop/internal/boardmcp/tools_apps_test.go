package boardmcp

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// A release listed among the user's apps reads as editable to the agent.
func TestShapeAppsListSplitsReleases(t *testing.T) {
	raw := `{"apps":[
		{"id":"u1","name":"Mine","status":"stopped","example":false,"release":false},
		{"id":"r1","name":"Shipped","status":"stopped","example":false,"release":true},
		{"id":"e1","name":"Blink","status":"stopped","example":true}
	]}`
	shaped, err := shapeAppsList(raw)
	if err != nil {
		t.Fatal(err)
	}
	var out struct {
		Apps, Releases, Examples []appEntry
	}
	if err := json.Unmarshal([]byte(shaped), &out); err != nil {
		t.Fatal(err)
	}
	if len(out.Apps) != 1 || out.Apps[0].ID != "u1" {
		t.Errorf("apps = %+v, want only u1", out.Apps)
	}
	if len(out.Releases) != 1 || out.Releases[0].ID != "r1" {
		t.Errorf("releases = %+v, want only r1", out.Releases)
	}
	if len(out.Examples) != 1 || out.Examples[0].ID != "e1" {
		t.Errorf("examples = %+v, want only e1", out.Examples)
	}
}

// A re-checkout that could not read the board hands back the old copy: the result must say it may be out of date, and why.
func TestCheckoutTextWarnsWhenTheBoardCouldNotBeRead(t *testing.T) {
	stale := checkoutText(Checkout{Path: "/mirror/demo", Stale: errors.New("list board files: connection refused")}, nil)
	for _, want := range []string{"may be out of date", "list board files: connection refused", "call apps_checkout again", "/mirror/demo"} {
		if !strings.Contains(strings.ToLower(stale), strings.ToLower(want)) {
			t.Errorf("result %q does not contain %q", stale, want)
		}
	}
	if fresh := checkoutText(Checkout{Path: "/mirror/demo"}, nil); fresh != "/mirror/demo" {
		t.Errorf("a refreshed checkout = %q, want the path alone", fresh)
	}
}

// The board ends a start without waiting for the app, so only an app that stayed up reads as started; the warnings are said once, so they stay in front.
func TestStartOutcomeTrustsTheAppStatus(t *testing.T) {
	const warn = "warning: your edits to app.yaml were NOT applied\n\n"
	_, err := startOutcome(appActionResult{out: "[+] Running 2/2", finished: true}, "failed", bootDown, nil, warn)
	if err == nil || !strings.Contains(err.Error(), "apps_logs") || !strings.HasPrefix(err.Error(), warn) {
		t.Errorf("a start that left the app failed returned %v, want the warnings, then an error pointing to apps_logs", err)
	}
	if _, err := startOutcome(appActionResult{finished: true}, "starting", bootPending, nil, warn); err == nil || !strings.Contains(err.Error(), "apps_wait_running") {
		t.Errorf("an app still starting returned %v, want an error pointing to apps_wait_running", err)
	}
	if text, err := startOutcome(appActionResult{finished: true}, "running", bootPending, nil, warn); err != nil || strings.Contains(text, "Started") || !strings.Contains(text, "apps_wait_running") {
		t.Errorf("an app up for less than the settle = %q, %v; want no success claim, and a pointer to apps_wait_running", text, err)
	}
	if text, err := startOutcome(appActionResult{err: errors.New("stream cut"), finished: true}, "running", bootUp, nil, warn); err != nil || !strings.HasPrefix(text, warn) || !strings.Contains(text, "running") {
		t.Errorf("a running app = %q, %v; want the warnings, then it reported started", text, err)
	}
	if _, err := startOutcome(appActionResult{err: errors.New("APP_BUSY"), finished: true}, "stopped", bootPending, nil, warn); err == nil || !strings.HasPrefix(err.Error(), warn) || !strings.Contains(err.Error(), "APP_BUSY") {
		t.Errorf("a stream error returned %v, want the warnings, then the error", err)
	}
	if text, err := startOutcome(appActionResult{out: "[+] Running 2/2", finished: true}, "", bootPending, errors.New("board unreachable"), warn); err != nil || strings.Contains(text, "Started") || !strings.Contains(text, "apps_wait_running") {
		t.Errorf("an unread status = %q, %v; want no success claim, and a pointer to apps_wait_running", text, err)
	}
}

// statusBoard is a board whose start stream ends at once, as the board ends it, and whose app reads each status in turn, the last one from then on.
func statusBoard(t *testing.T, statuses ...string) string {
	t.Helper()
	var mu sync.Mutex
	board := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = w.Write([]byte("event: error\ndata: {\"code\":\"SERVER_CLOSED\"}\n\n"))
			return
		}
		mu.Lock()
		status := statuses[0]
		if len(statuses) > 1 {
			statuses = statuses[1:]
		}
		mu.Unlock()
		_, _ = w.Write([]byte(`{"status":"` + status + `"}`))
	}))
	t.Cleanup(board.Close)
	return board.URL
}

// fastSettle shortens the settle so a test waits milliseconds for what the board takes seconds.
func fastSettle(t *testing.T) {
	t.Helper()
	settle, settlePoll, poll := runningSettle, settlePollInterval, waitPollInterval
	runningSettle, settlePollInterval, waitPollInterval = 100*time.Millisecond, 10*time.Millisecond, 10*time.Millisecond
	t.Cleanup(func() { runningSettle, settlePollInterval, waitPollInterval = settle, settlePoll, poll })
}

// startAccess answers what apps_start asks around the start itself.
type startAccess struct{ stubAccess }

func (startAccess) FlushMirrorEdits(string) (failed, conflicts, withheld map[string]error, notes []string) {
	return nil, nil, nil, nil
}
func (startAccess) PendingSyncIssues() []string { return nil }
func (startAccess) PendingGhostEdits() []string { return nil }
func (startAccess) RequestOpenAppUI(string)     {}

// callTool runs one tool of a server holding only it, over an in-memory MCP session.
func callTool(t *testing.T, register func(*mcp.Server), name string, args map[string]any) (text string, failed bool) {
	t.Helper()
	srv := mcp.NewServer(&mcp.Implementation{Name: "board", Version: "test"}, nil)
	register(srv)
	serverEnd, clientEnd := mcp.NewInMemoryTransports()
	ctx := context.Background()
	ss, err := srv.Connect(ctx, serverEnd, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer ss.Close()
	cs, err := mcp.NewClient(&mcp.Implementation{Name: "engine", Version: "test"}, nil).Connect(ctx, clientEnd, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer cs.Close()
	res, err := cs.CallTool(ctx, &mcp.CallToolParams{Name: name, Arguments: args})
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range res.Content {
		if tc, ok := c.(*mcp.TextContent); ok {
			text += tc.Text
		}
	}
	return text, res.IsError
}

// recordingAccess records the app id each App Lab call gets.
type recordingAccess struct {
	stubAccess
	mu  *sync.Mutex
	ids *[]string
}

func (r recordingAccess) note(method, id string) {
	r.mu.Lock()
	*r.ids = append(*r.ids, method+"="+id)
	r.mu.Unlock()
}
func (r recordingAccess) FlushMirrorEdits(id string) (failed, conflicts, withheld map[string]error, notes []string) {
	r.note("Flush", id)
	return nil, nil, nil, nil
}
func (recordingAccess) PendingSyncIssues() []string     { return nil }
func (recordingAccess) PendingGhostEdits() []string     { return nil }
func (r recordingAccess) RequestOpenAppUI(id string)    { r.note("OpenUI", id) }
func (r recordingAccess) ForgetWorkspaceApp(id string)  { r.note("Forget", id) }
func (r recordingAccess) RefreshManagedFiles(id string) { r.note("Refresh", id) }
func (r recordingAccess) CheckoutApp(_ context.Context, id string) (Checkout, error) {
	r.note("Checkout", id)
	return Checkout{Path: "/tmp/x"}, nil
}
func (r recordingAccess) RequestImportCustomModel(appID, _ string) { r.note("Import", appID) }
func (recordingAccess) SelectedBoard(context.Context) (BoardStatus, error) {
	return BoardStatus{Connected: true}, nil
}
func (r recordingAccess) RebindWorkspaceApp(oldID, _, _ string) string {
	r.note("Rebind", oldID)
	return ""
}
func (r recordingAccess) RenameAppFile(_ context.Context, appID, _, _ string) (string, error) {
	r.note("RenameFile", appID)
	return "", nil
}
func (r recordingAccess) DeleteAppFile(_ context.Context, appID, _ string) (string, error) {
	r.note("DeleteFile", appID)
	return "", nil
}

// A model passes the id decoded (user:<folder>), padded or with spaces: every app tool sends the board, and hands App Lab, the id the board gave out.
func TestEveryAppToolSendsTheBoardsOwnID(t *testing.T) {
	fastSettle(t)
	const want = "dXNlcjpibGluaw"
	var mu sync.Mutex
	var paths []string
	board := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		paths = append(paths, r.Method+" "+r.URL.Path)
		mu.Unlock()
		switch {
		case r.URL.Path == "/v1/config":
			_, _ = w.Write([]byte(`{"directories":{"apps":"/home/arduino/ArduinoApps"}}`))
		case strings.HasSuffix(r.URL.Path, "/start") || strings.HasSuffix(r.URL.Path, "/stop"):
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = w.Write([]byte("event: error\ndata: {\"code\":\"SERVER_CLOSED\"}\n\n"))
		case strings.HasSuffix(r.URL.Path, "/logs"):
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = w.Write([]byte("event: close\ndata: {}\n\n"))
		case strings.Contains(r.URL.Path, "/sketch/libraries"):
			_, _ = w.Write([]byte(`{"libraries":[]}`))
		case strings.HasSuffix(r.URL.Path, "/bricks") || strings.Contains(r.URL.Path, "/bricks/"):
			_, _ = w.Write([]byte(`{"bricks":[]}`))
		case r.Method == http.MethodPatch:
			_, _ = w.Write([]byte(`{"id":"` + want + `"}`))
		case strings.HasSuffix(r.URL.Path, "/clone"):
			_, _ = w.Write([]byte(`{"id":"dXNlcjpibGluay0y"}`))
		default:
			_, _ = w.Write([]byte(`{"id":"` + want + `","name":"Blink","status":"stopped","path":"/home/arduino/ArduinoApps/blink","bricks":[]}`))
		}
	}))
	defer board.Close()
	var ids []string
	access := recordingAccess{stubAccess: stubAccess{base: board.URL}, mu: &mu, ids: &ids}
	reg := func(f func(*mcp.Server, BoardAccess) string) func(*mcp.Server) {
		return func(s *mcp.Server) { f(s, access) }
	}
	regV := func(f func(*mcp.Server, BoardAccess)) func(*mcp.Server) { return func(s *mcp.Server) { f(s, access) } }
	for _, spelling := range []string{"user:blink", "dXNlcjpibGluaw==", " dXNlcjpibGluaw "} {
		mu.Lock()
		paths, ids = nil, nil
		mu.Unlock()
		for _, c := range []struct {
			register func(*mcp.Server)
			name     string
			args     map[string]any
		}{
			{reg(registerAppsGet), "apps_get", map[string]any{"id": spelling}},
			{reg(registerAppsCheckout), "apps_checkout", map[string]any{"id": spelling}},
			{reg(registerAppsLogs), "apps_logs", map[string]any{"id": spelling}},
			{reg(registerAppsStart), "apps_start", map[string]any{"id": spelling}},
			{reg(registerAppsStop), "apps_stop", map[string]any{"id": spelling}},
			{reg(registerAppsWaitRunning), "apps_wait_running", map[string]any{"id": spelling, "timeout_sec": 1}},
			{regV(registerAppsDelete), "apps_delete", map[string]any{"id": spelling}},
			{regV(registerAppsEdit), "apps_edit", map[string]any{"id": spelling, "description": "d"}},
			{regV(registerAppsClone), "apps_clone", map[string]any{"id": spelling}},
			{reg(registerAppBricksList), "app_bricks_list", map[string]any{"appId": spelling}},
			{regV(registerAppBricksAdd), "app_bricks_add", map[string]any{"appId": spelling, "brickId": "arduino:web_ui"}},
			{regV(registerAppBricksUpdate), "app_bricks_update", map[string]any{"appId": spelling, "brickId": "arduino:web_ui"}},
			{regV(registerAppBricksRemove), "app_bricks_remove", map[string]any{"appId": spelling, "brickId": "arduino:web_ui"}},
			{reg(registerSketchLibrariesList), "sketch_libraries_list", map[string]any{"id": spelling}},
			{regV(registerSketchLibrariesAdd), "sketch_libraries_add", map[string]any{"id": spelling, "library": "Servo"}},
			{regV(registerSketchLibrariesRemove), "sketch_libraries_remove", map[string]any{"id": spelling, "library": "Servo"}},
			{regV(registerModelsImportCustom), "models_import_custom", map[string]any{"appId": spelling, "brickId": "arduino:object_detection"}},
			{regV(registerAppFilesRename), "app_files_rename", map[string]any{"id": spelling, "from": "python/a.py", "to": "python/b.py"}},
			{regV(registerAppFilesDelete), "app_files_delete", map[string]any{"id": spelling, "path": "python/a.py"}},
		} {
			if text, failed := callTool(t, c.register, c.name, c.args); failed && strings.Contains(text, "invalid") {
				t.Errorf("%s(%q) failed: %s", c.name, spelling, text)
			}
		}
		mu.Lock()
		for _, p := range paths {
			if p != "GET /v1/config" && p != "GET /v1/bricks" && !strings.Contains(p, "/v1/apps/"+want) {
				t.Errorf("spelling %q: the board was asked %q, want the app's own id", spelling, p)
			}
		}
		for _, id := range ids {
			if !strings.HasSuffix(id, "="+want) {
				t.Errorf("spelling %q: App Lab got %q, want %q", spelling, id, want)
			}
		}
		if len(ids) == 0 {
			t.Errorf("spelling %q: no App Lab call was recorded", spelling)
		}
		mu.Unlock()
	}
}

// hangingBoard ends a start stream at once and answers each status read with answer(n); "" hangs the read until the caller gives up.
func hangingBoard(t *testing.T, answer func(n int) string) string {
	t.Helper()
	var reads atomic.Int32
	board := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = w.Write([]byte("event: error\ndata: {\"code\":\"SERVER_CLOSED\"}\n\n"))
			return
		}
		status := answer(int(reads.Add(1)))
		if status == "" {
			<-r.Context().Done()
			return
		}
		_, _ = w.Write([]byte(`{"status":"` + status + `"}`))
	}))
	t.Cleanup(board.Close)
	return board.URL
}

// A board that stops answering once the stream ended ends the check at startCheckCap: a read's own 30 s limit would take apps_start past the engine's 60 s.
func TestAStartCheckOnAHungBoardEndsAtItsCap(t *testing.T) {
	fastSettle(t)
	orig := startCheckCap
	startCheckCap = 500 * time.Millisecond
	t.Cleanup(func() { startCheckCap = orig })
	for name, answer := range map[string]func(int) string{
		"the first read hangs": func(int) string { return "" },
		"a read hangs once it is up": func(n int) string {
			if n <= 2 {
				return "running"
			}
			return ""
		},
	} {
		t.Run(name, func(t *testing.T) {
			access := startAccess{stubAccess{base: hangingBoard(t, answer)}}
			start := time.Now()
			text, _ := callTool(t, func(srv *mcp.Server) { registerAppsStart(srv, access) }, "apps_start", map[string]any{"id": "dXNlcjpibGluaw"})
			if elapsed := time.Since(start); elapsed > startCheckCap+time.Second {
				t.Errorf("apps_start took %s, want about %s", elapsed, startCheckCap)
			}
			if strings.Contains(text, "Started") {
				t.Errorf("reported started: %q", text)
			}
		})
	}
}

// apps_wait_running ends within its timeout: a read in flight is cut there, and no poll sleeps past it.
func TestAWaitEndsWithinItsTimeout(t *testing.T) {
	fastSettle(t)
	slow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(300 * time.Millisecond):
			_, _ = w.Write([]byte(`{"status":"starting"}`))
		case <-r.Context().Done():
		}
	}))
	defer slow.Close()
	for name, tc := range map[string]struct {
		base   string
		poll   time.Duration
		failed bool
	}{
		"slow reads":                 {slow.URL, 10 * time.Millisecond, false},
		"a poll longer than is left": {statusBoard(t, "starting"), 400 * time.Millisecond, false},
		"a board that never answers": {hangingBoard(t, func(int) string { return "" }), 10 * time.Millisecond, true},
	} {
		t.Run(name, func(t *testing.T) {
			waitPollInterval = tc.poll
			start := time.Now()
			text, failed := callTool(t, func(srv *mcp.Server) { registerAppsWaitRunning(srv, stubAccess{base: tc.base}) }, "apps_wait_running", map[string]any{"id": "dXNlcjpibGluaw", "timeout_sec": 1})
			if elapsed := time.Since(start); elapsed > time.Second+150*time.Millisecond {
				t.Errorf("the wait took %s for a one-second timeout", elapsed)
			}
			if failed != tc.failed {
				t.Errorf("result %q, error %v; want error %v", text, failed, tc.failed)
			}
		})
	}
}

// The board ends a start once the app's containers run: an app whose code exits at once reads "running" for a moment, and must not be reported started.
func TestAStartIsReportedByTheStatusTheAppKeeps(t *testing.T) {
	fastSettle(t)
	for name, tc := range map[string]struct {
		statuses []string
		started  bool
	}{
		"it exits right after starting": {[]string{"running", "failed"}, false},
		"it stops right after starting": {[]string{"running", "running", "stopped"}, false},
		"it stays up":                   {[]string{"running"}, true},
		"it comes up a moment later":    {[]string{"starting", "starting", "running"}, true},
	} {
		t.Run(name, func(t *testing.T) {
			access := startAccess{stubAccess{base: statusBoard(t, tc.statuses...)}}
			text, failed := callTool(t, func(srv *mcp.Server) { registerAppsStart(srv, access) }, "apps_start", map[string]any{"id": "dXNlcjpibGluaw"})
			if tc.started && (failed || !strings.Contains(text, "Started")) {
				t.Errorf("result %q (error %v), want it reported started", text, failed)
			}
			if !tc.started && (!failed || strings.Contains(text, "Started") || !strings.Contains(text, "apps_logs")) {
				t.Errorf("result %q (error %v), want an error that it is not running, pointing to apps_logs", text, failed)
			}
		})
	}
}

// apps_wait_running confirms an app the same way: up for the whole settle, within the timeout.
func TestAWaitReportsAnAppUpOnlyOnceItStayedUp(t *testing.T) {
	fastSettle(t)
	for name, tc := range map[string]struct {
		statuses []string
		timeout  time.Duration
		want     appBoot
		status   string
	}{
		"it fails once up":               {[]string{"starting", "running", "failed"}, time.Second, bootDown, "failed"},
		"it stops once up":               {[]string{"running", "stopped"}, time.Second, bootDown, "stopped"},
		"it restarts, then stays up":     {[]string{"running", "starting", "running"}, time.Second, bootUp, "running"},
		"the timeout ends in the settle": {[]string{"running"}, 50 * time.Millisecond, bootPending, "running"},
		"it never starts":                {[]string{"stopped"}, 50 * time.Millisecond, bootPending, "stopped"},
	} {
		t.Run(name, func(t *testing.T) {
			access := stubAccess{base: statusBoard(t, tc.statuses...)}
			status, boot, err := waitForAppRunning(context.Background(), access, "dXNlcjpibGluaw", tc.timeout)
			if err != nil || boot != tc.want || status != tc.status {
				t.Errorf("waitForAppRunning = %q, %v, %v; want %q, %v", status, boot, err, tc.status, tc.want)
			}
		})
	}
	// Up for 30 ms, then a restart that ends past the 100 ms settle: the time before it must not count.
	waitPollInterval = 80 * time.Millisecond
	access := stubAccess{base: statusBoard(t, "running", "running", "running", "running", "starting", "running", "running", "failed")}
	if status, boot, err := waitForAppRunning(context.Background(), access, "dXNlcjpibGluaw", time.Second); err != nil || boot != bootDown {
		t.Errorf("after a restart, waitForAppRunning = %q, %v, %v; want the failure that followed it", status, boot, err)
	}
	// A timeout shorter than the settle would end every call before the app is confirmed: the tool waits two settles at least.
	runningSettle = 1200 * time.Millisecond
	up := stubAccess{base: statusBoard(t, "running")}
	text, _ := callTool(t, func(srv *mcp.Server) { registerAppsWaitRunning(srv, up) }, "apps_wait_running", map[string]any{"id": "dXNlcjpibGluaw", "timeout_sec": 1})
	if !strings.Contains(text, "The app is running") {
		t.Errorf("a one-second wait on an app that stays up = %q, want it confirmed running", text)
	}
}

func TestRequireUserApp(t *testing.T) {
	userAppID := base64.RawURLEncoding.EncodeToString([]byte("user:mine"))
	for name, tc := range map[string]struct {
		status  int
		body    string
		appsDir string
		wantOK  bool
	}{
		"a user app":              {http.StatusOK, `{"path":"/home/arduino/ArduinoApps/mine"}`, "", true},
		"a release":               {http.StatusOK, `{"path":"/var/lib/arduino-app-cli/releases/r1","release":true}`, "", false},
		"an example":              {http.StatusOK, `{"path":"/var/lib/arduino-app-cli/examples/blink","example":true}`, "", false},
		"a path outside, no flag": {http.StatusOK, `{"path":"/var/lib/arduino-app-cli/releases/r1"}`, "", false},
		"the apps dir itself":     {http.StatusOK, `{"path":"/home/arduino/ArduinoApps"}`, "", false},
		"a custom apps dir":       {http.StatusOK, `{"path":"/data/apps/mine"}`, "/data/apps", true},
		"an unreadable detail":    {http.StatusNotFound, `{"details":"not found"}`, "", false},
	} {
		t.Run(name, func(t *testing.T) {
			board := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/v1/config" {
					_, _ = w.Write([]byte(`{"directories":{"apps":"` + tc.appsDir + `"}}`))
					return
				}
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.body))
			}))
			defer board.Close()

			err := requireUserApp(context.Background(), stubAccess{base: board.URL}, userAppID)
			if tc.wantOK && err != nil {
				t.Errorf("refused a writable app: %v", err)
			}
			if !tc.wantOK && err == nil {
				t.Error("allowed a write to a read-only app")
			}
			if err != nil && tc.status == http.StatusOK && !strings.Contains(err.Error(), "apps_clone") {
				t.Errorf("refusal %q does not name the way forward", err)
			}
		})
	}
}

// renameAccess answers what apps_edit asks before its PATCH and records the rebind after it.
type renameAccess struct {
	stubAccess
	rebound chan string
}

func (renameAccess) FlushMirrorEdits(string) (failed, conflicts, withheld map[string]error, notes []string) {
	return nil, nil, nil, nil
}
func (renameAccess) PendingSyncIssues() []string { return nil }
func (renameAccess) PendingGhostEdits() []string { return nil }
func (renameAccess) RefreshManagedFiles(string)  {}
func (a renameAccess) RebindWorkspaceApp(_, newID, _ string) string {
	a.rebound <- newID
	return ""
}

// A Stop of the turn cancels apps_edit's call: the PATCH, which may have moved the folder, must still be answered and followed by the rebind.
func TestARenameStoppedDuringItsPatchIsStillRebound(t *testing.T) {
	oldID := base64.RawURLEncoding.EncodeToString([]byte("user:blink"))
	newID := base64.RawURLEncoding.EncodeToString([]byte("user:blink-2"))
	patched, aborted, answer := make(chan struct{}), make(chan struct{}), make(chan struct{})
	board := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/v1/config":
			_, _ = w.Write([]byte(`{"directories":{"apps":""}}`))
		case r.Method == http.MethodPatch:
			close(patched)
			select {
			case <-r.Context().Done():
				close(aborted)
			case <-answer:
				_, _ = w.Write([]byte(`{"id":"` + newID + `"}`))
			}
		default:
			_, _ = w.Write([]byte(`{"path":"/home/arduino/ArduinoApps/blink","status":"stopped"}`))
		}
	}))
	defer board.Close()
	access := renameAccess{stubAccess: stubAccess{base: board.URL}, rebound: make(chan string, 1)}
	srv := mcp.NewServer(&mcp.Implementation{Name: "board", Version: "test"}, nil)
	registerAppsEdit(srv, access)
	serverEnd, clientEnd := mcp.NewInMemoryTransports()
	ctx := context.Background()
	ss, err := srv.Connect(ctx, serverEnd, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer ss.Close()
	cs, err := mcp.NewClient(&mcp.Implementation{Name: "engine", Version: "test"}, nil).Connect(ctx, clientEnd, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer cs.Close()

	call, stop := context.WithCancel(ctx)
	go func() {
		_, _ = cs.CallTool(call, &mcp.CallToolParams{Name: "apps_edit", Arguments: map[string]any{"id": oldID, "name": "Blink 2"}})
	}()
	select {
	case <-patched:
	case <-time.After(5 * time.Second):
		t.Fatal("the rename never reached the board")
	}
	stop()
	select {
	case <-aborted:
		t.Fatal("the Stop cut the PATCH, so App Lab never learns the new id")
	case <-time.After(300 * time.Millisecond):
	}
	close(answer)
	select {
	case got := <-access.rebound:
		if got != newID {
			t.Errorf("rebound onto %q, want %q", got, newID)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("no rebind after the stopped rename")
	}
}
