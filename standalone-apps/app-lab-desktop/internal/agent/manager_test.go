package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// The webview decides whether to swap the chat for a reconnect prompt from these keys, so the shape
// is a contract with the frontend mapper, not an implementation detail. Err stays host-side: an error
// interface marshals to an empty object at best, and to a dropped event at worst.
func TestRestartInfoWireShape(t *testing.T) {
	b, err := json.Marshal(RestartInfo{Attempt: 3, Max: 3, GaveUp: true, Err: errors.New("boom")})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if got, want := string(b), `{"attempt":3,"max":3,"gaveUp":true}`; got != want {
		t.Fatalf("wire shape = %s, want %s", got, want)
	}
}

// fakeConn drives the handler the way the real ACP adapter would, without the SDK.
type fakeConn struct {
	handler       ClientHandler
	permTimeoutMs int
	initErr       error
	methods       []AuthMethod
	authedWith    string
	lastOutcome   PermissionOutcome
	loaded        []SessionID
	permInput     any          // tool-call arguments carried on the permission request (nil → none)
	models        []AgentModel // advertised on session/new only, as the adapter does
	modes         []AgentMode
	modelID       string // the current model and mode session/new reports
	modeID        string
	// lingering: the turn ends with a request still queued on the engine, which sends it afterwards.
	lingering bool
	lingered  chan PermissionOutcome
	question  bool // the turn asks a question instead of a permission
	answers   []ChoiceSubmission
	noDelete  bool // an engine without session/delete, as OpenCode is
	cancels   atomic.Int32
	closes    atomic.Int32
	replay    []Update // what session/load sends back before it returns
}

func (f *fakeConn) DeletesSessions() bool { return !f.noDelete }

func (f *fakeConn) Initialize(context.Context) ([]AuthMethod, error) { return f.methods, f.initErr }
func (f *fakeConn) Authenticate(_ context.Context, methodID string) error {
	f.authedWith = methodID
	return nil
}
func (f *fakeConn) NewSession(context.Context, string, SessionWorkspace) (NewSessionResult, error) {
	return NewSessionResult{SessionID: "s1", Models: f.models, Modes: f.modes, CurrentModelID: f.modelID, CurrentModeID: f.modeID}, nil
}
func (f *fakeConn) LoadSession(_ context.Context, sid SessionID, _ string, _ SessionWorkspace) (NewSessionResult, error) {
	f.loaded = append(f.loaded, sid)
	for _, u := range f.replay {
		f.handler.HandleUpdate(sid, u)
	}
	return NewSessionResult{SessionID: sid}, nil
}
func (f *fakeConn) Cancel(context.Context, SessionID) error {
	f.cancels.Add(1)
	return nil
}
func (f *fakeConn) CloseSession(context.Context, SessionID) error {
	f.closes.Add(1)
	return nil
}
func (f *fakeConn) DeleteSession(context.Context, SessionID) error    { return nil }
func (f *fakeConn) SetModel(context.Context, SessionID, string) error { return nil }
func (f *fakeConn) SetMode(context.Context, SessionID, string) error  { return nil }
func (f *fakeConn) SetMCPServers([]MCPServer)                         {}
func (f *fakeConn) SetBoardName(string)                               {}
func (f *fakeConn) SetDialect(Dialect)                                {}
func (f *fakeConn) ListSessions(context.Context, string) ([]SessionSummary, error) {
	return nil, nil
}
func (f *fakeConn) Close() error { return nil }

// Prompt reports the turn cancelled, as an engine does, when Cancel reached it while the turn ran.
func (f *fakeConn) Prompt(ctx context.Context, sid SessionID, _ string, _ []string) (bool, error) {
	before := f.cancels.Load()
	f.handler.HandleUpdate(sid, Update{Type: "message_chunk", Delta: "Hello "})
	f.handler.HandleUpdate(sid, Update{Type: "message_chunk", Delta: "world"})
	tc := &ToolCall{ID: "t1", Title: "List boards", Status: "pending", Input: f.permInput}
	f.handler.HandleUpdate(sid, Update{Type: "tool_call", ToolCall: tc})
	if f.lingering {
		go func() {
			f.lingered <- f.handler.HandlePermission(context.Background(), PermissionRequest{
				ID: "p-late", SessionID: sid, ToolCall: tc,
				Options: []PermissionOption{{ID: "allow", Label: "Allow", Kind: "allow"}},
			})
		}()
		return f.cancels.Load() > before, nil
	}
	if f.question {
		f.answers = f.handler.HandleElicitation(ctx, sid, []ChoiceRequest{{ID: "q1", Title: "Which board?", Options: []ChoiceOption{{ID: "a", Label: "A"}}}})
		return f.cancels.Load() > before, nil
	}
	f.lastOutcome = f.handler.HandlePermission(ctx, PermissionRequest{
		ID: "p1", SessionID: sid, ToolCall: tc,
		Options:   []PermissionOption{{ID: "allow", Label: "Allow", Kind: "allow"}},
		TimeoutMs: f.permTimeoutMs,
	})
	f.handler.HandleUpdate(sid, Update{Type: "tool_call_update", ID: "t1", Status: "completed", Output: "2 boards"})
	return f.cancels.Load() > before, nil
}

// stayAlive is a real spawned process that idles while the fake conn does the talking.
func stayAlive() *Agent {
	return New(Config{Locator: StaticLocator{NodePath: "/bin/sh", AdapterEntry: "-c", ExtraArgs: []string{"cat"}}})
}

func TestManagerPromptFlowAllow(t *testing.T) {
	var mu sync.Mutex
	var updates []Update
	var m *Manager
	var fc *fakeConn

	m = NewManager(stayAlive(),
		func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
			fc = &fakeConn{handler: h, permTimeoutMs: 5000}
			return fc, nil
		},
		ManagerConfig{
			OnUpdate:     func(_ SessionID, u Update) { mu.Lock(); updates = append(updates, u); mu.Unlock() },
			OnPermission: func(req PermissionRequest) { m.ReplyPermission(req.ID, PermissionOutcome{OptionID: "allow"}) },
		})

	ctx := context.Background()
	if err := m.Start(ctx); err != nil {
		t.Fatalf("start: %v", err)
	}
	defer m.Stop()

	sid, err := m.NewSession(ctx, "/tmp", SessionWorkspace{})
	if err != nil {
		t.Fatalf("new session: %v", err)
	}
	if err := m.Prompt(ctx, sid, "hi", nil); err != nil {
		t.Fatalf("prompt: %v", err)
	}

	mu.Lock()
	got := len(updates)
	mu.Unlock()
	if got != 4 {
		t.Fatalf("expected 4 forwarded updates, got %d", got)
	}
	if fc.lastOutcome.OptionID != "allow" {
		t.Fatalf("permission not allowed: %+v", fc.lastOutcome)
	}
}

// startFake starts a manager on a fakeConn the test configures, with one session open.
func startFake(t *testing.T, fc *fakeConn, cfg ManagerConfig) (*Manager, SessionID) {
	t.Helper()
	m := NewManager(stayAlive(),
		func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
			fc.handler = h
			return fc, nil
		}, cfg)
	ctx := context.Background()
	if err := m.Start(ctx); err != nil {
		t.Fatalf("start: %v", err)
	}
	t.Cleanup(func() { _ = m.Stop() })
	sid, err := m.NewSession(ctx, "/tmp", SessionWorkspace{})
	if err != nil {
		t.Fatalf("new session: %v", err)
	}
	return m, sid
}

// A board switch or a restart can leave the UI on a session this engine never loaded; prompted as it is, the CLI answers "Session not found".
func TestAPromptLoadsASessionTheEngineDoesNotHold(t *testing.T) {
	var mu sync.Mutex
	var shown []string
	var m *Manager
	fc := &fakeConn{permTimeoutMs: 5000, replay: []Update{
		{Type: "user_message", Delta: "old question"},
		{Type: "message_chunk", Delta: "old answer"},
	}}
	m, created := startFake(t, fc, ManagerConfig{
		OnUpdate:     func(_ SessionID, u Update) { mu.Lock(); shown = append(shown, u.Delta); mu.Unlock() },
		OnPermission: func(req PermissionRequest) { m.ReplyPermission(req.ID, PermissionOutcome{OptionID: "allow"}) },
		SessionScope: func(SessionID) (string, SessionWorkspace, error) {
			return "/mirror", SessionWorkspace{AppID: "app"}, nil
		},
	})
	ctx := context.Background()

	if err := m.Prompt(ctx, created, "hi", nil); err != nil {
		t.Fatalf("prompt on a new session: %v", err)
	}
	if len(fc.loaded) != 0 {
		t.Errorf("engine loads = %v, want none for a session this engine created", fc.loaded)
	}
	for i := 0; i < 2; i++ {
		if err := m.Prompt(ctx, "s-left-behind", "hello", nil); err != nil {
			t.Fatalf("prompt %d on a session the engine does not hold: %v", i+1, err)
		}
	}
	if len(fc.loaded) != 1 || fc.loaded[0] != "s-left-behind" {
		t.Errorf("engine loads = %v, want that session loaded once, before its first prompt", fc.loaded)
	}
	mu.Lock()
	defer mu.Unlock()
	for _, delta := range shown {
		if delta == "old question" || delta == "old answer" {
			t.Errorf("the load's replay reached the UI (%q), which already shows that history", delta)
		}
	}
}

// Production waits on a permission with no timer, so the turn Stop ended must answer the card it left, or the engine's queue stays blocked.
func TestStopAnswersThePermissionItsTurnLeft(t *testing.T) {
	fc := &fakeConn{}
	var m *Manager
	m, sid := startFake(t, fc, ManagerConfig{
		OnPermission: func(req PermissionRequest) { _ = m.Cancel(context.Background(), req.SessionID) },
	})
	done := make(chan error, 1)
	go func() { done <- m.Prompt(context.Background(), sid, "hi", nil) }()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("the stopped turn still waits on its permission")
	}
	if !fc.lastOutcome.Cancelled {
		t.Errorf("outcome = %+v, want cancelled", fc.lastOutcome)
	}
}

// The engine sends a request it had queued even after the turn ended; it must be answered, never shown.
func TestAPermissionThatOutlivesItsTurnIsAnswered(t *testing.T) {
	fc := &fakeConn{lingering: true, lingered: make(chan PermissionOutcome, 1)}
	m, sid := startFake(t, fc, ManagerConfig{})
	if err := m.Prompt(context.Background(), sid, "hi", nil); err != nil {
		t.Fatalf("prompt: %v", err)
	}
	select {
	case out := <-fc.lingered:
		if !out.Cancelled {
			t.Errorf("outcome = %+v, want cancelled", out)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("the request the turn left behind was never answered")
	}
}

func TestAPermissionForAnIdleSessionIsAnsweredAtOnce(t *testing.T) {
	shown := false
	m, sid := startFake(t, &fakeConn{}, ManagerConfig{OnPermission: func(PermissionRequest) { shown = true }})
	out := m.HandlePermission(context.Background(), PermissionRequest{ID: "p-idle", SessionID: sid, Options: []PermissionOption{{ID: "allow", Kind: "allow_once"}}})
	if !out.Cancelled {
		t.Errorf("outcome = %+v, want cancelled", out)
	}
	if shown {
		t.Error("a request with no turn to serve was shown to the user")
	}
	if m.GetSessionState(sid).PendingPermission != nil {
		t.Error("a request with no turn to serve was left pending")
	}
}

func TestClosingASessionAnswersItsPermission(t *testing.T) {
	fc := &fakeConn{}
	var m *Manager
	m, sid := startFake(t, fc, ManagerConfig{
		OnPermission: func(req PermissionRequest) { _ = m.CloseSession(context.Background(), req.SessionID) },
	})
	done := make(chan error, 1)
	go func() { done <- m.Prompt(context.Background(), sid, "hi", nil) }()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("closing the session left its permission waiting")
	}
	if !fc.lastOutcome.Cancelled {
		t.Errorf("outcome = %+v, want cancelled", fc.lastOutcome)
	}
}

func TestStopSkipsTheQuestionItsTurnLeft(t *testing.T) {
	fc := &fakeConn{question: true}
	var m *Manager
	m, sid := startFake(t, fc, ManagerConfig{
		OnUpdate: func(sid SessionID, u Update) {
			if u.Type == "choices" {
				go func() { _ = m.Cancel(context.Background(), sid) }()
			}
		},
	})
	done := make(chan error, 1)
	go func() { done <- m.Prompt(context.Background(), sid, "hi", nil) }()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("the stopped turn still waits on its question")
	}
	if len(fc.answers) != 1 || !fc.answers[0].Cancelled {
		t.Errorf("answers = %+v, want the question skipped", fc.answers)
	}
}

// The refusal must come before the cancel and the close: those end the chat's turn and unload it, for a delete that never happens.
func TestAnUndeletableSessionIsLeftOpen(t *testing.T) {
	fc := &fakeConn{noDelete: true}
	m, sid := startFake(t, fc, ManagerConfig{OnPermission: func(PermissionRequest) {}})
	if err := m.DeleteSession(context.Background(), sid); !errors.Is(err, ErrDeleteSessionUnsupported) {
		t.Fatalf("DeleteSession = %v, want ErrDeleteSessionUnsupported", err)
	}
	if n, c := fc.cancels.Load(), fc.closes.Load(); n != 0 || c != 0 {
		t.Errorf("a refused delete cancelled %d and closed %d times", n, c)
	}
	fc.permTimeoutMs = 50
	if err := m.Prompt(context.Background(), sid, "still there?", nil); err != nil {
		t.Errorf("the chat no longer takes a prompt: %v", err)
	}
}

func TestManagerPermissionTimeoutDenies(t *testing.T) {
	var m *Manager
	var fc *fakeConn

	m = NewManager(stayAlive(),
		func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
			fc = &fakeConn{handler: h, permTimeoutMs: 50}
			return fc, nil
		},
		ManagerConfig{}) // no OnPermission reply -> must time out to deny

	ctx := context.Background()
	if err := m.Start(ctx); err != nil {
		t.Fatalf("start: %v", err)
	}
	defer m.Stop()

	sid, _ := m.NewSession(ctx, "/tmp", SessionWorkspace{})
	if err := m.Prompt(ctx, sid, "hi", nil); err != nil {
		t.Fatalf("prompt: %v", err)
	}
	if !fc.lastOutcome.Cancelled {
		t.Fatalf("expected timeout-to-deny (cancelled), got %+v", fc.lastOutcome)
	}
}

func TestManagerAutoRestartGivesUp(t *testing.T) {
	var mu sync.Mutex
	var attempts []RestartInfo
	gaveUp := make(chan struct{}, 1)

	// A process that comes up, then crashes — exercises restart after a clean start.
	agent := New(Config{Locator: StaticLocator{NodePath: "/bin/sh", AdapterEntry: "-c", ExtraArgs: []string{"sleep 0.1; exit 1"}}})
	m := NewManager(agent,
		func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) { return &fakeConn{handler: h}, nil },
		ManagerConfig{
			MaxRestarts:  2,
			RestartDelay: time.Millisecond,
			OnRestart: func(info RestartInfo) {
				if info.Resumed {
					return // each relaunch that came up says so too; only the attempts count here
				}
				mu.Lock()
				attempts = append(attempts, info)
				mu.Unlock()
				if info.GaveUp {
					gaveUp <- struct{}{}
				}
			},
		})

	if err := m.Start(context.Background()); err != nil {
		t.Fatalf("start: %v", err)
	}
	defer m.Stop()

	select {
	case <-gaveUp:
	case <-time.After(3 * time.Second):
		t.Fatal("agent never gave up restarting")
	}

	mu.Lock()
	defer mu.Unlock()
	if len(attempts) != 3 { // 2 retries + the give-up
		t.Fatalf("expected 3 OnRestart calls (2 retries + give-up), got %d: %+v", len(attempts), attempts)
	}
	if !attempts[len(attempts)-1].GaveUp {
		t.Fatalf("last OnRestart should be the give-up, got %+v", attempts[len(attempts)-1])
	}
}

// A restart reloads the open sessions without forwarding their history, so the UI hears it is over from this event alone.
func TestARestartThatCameBackSaysItResumed(t *testing.T) {
	marker := t.TempDir() + "/crashed"
	var mu sync.Mutex
	var events []RestartInfo
	resumed := make(chan struct{}, 1)
	// Crashes once, then stays up.
	ag := New(Config{Locator: StaticLocator{NodePath: "/bin/sh", AdapterEntry: "-c", ExtraArgs: []string{"if [ -e " + marker + " ]; then cat; else touch " + marker + "; sleep 0.1; exit 1; fi"}}})
	m := NewManager(ag,
		func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) { return &fakeConn{handler: h}, nil },
		ManagerConfig{
			RestartDelay: time.Millisecond,
			OnRestart: func(info RestartInfo) {
				mu.Lock()
				events = append(events, info)
				mu.Unlock()
				if info.Resumed {
					resumed <- struct{}{}
				}
			},
		})
	if err := m.Start(context.Background()); err != nil {
		t.Fatalf("start: %v", err)
	}
	defer m.Stop()
	select {
	case <-resumed:
	case <-time.After(3 * time.Second):
		t.Fatal("the restart never said it resumed")
	}
	mu.Lock()
	defer mu.Unlock()
	want := []RestartInfo{{Attempt: 1, Max: 3}, {Attempt: 1, Max: 3, Resumed: true}}
	if len(events) != 2 || events[0].Attempt != want[0].Attempt || events[0].Max != want[0].Max || events[0].Resumed ||
		events[1].Attempt != 1 || events[1].Max != 3 || !events[1].Resumed || events[1].GaveUp {
		t.Errorf("restart events = %+v, want %+v", events, want)
	}
	b, err := json.Marshal(RestartInfo{Attempt: 1, Max: 3, Resumed: true})
	if err != nil || string(b) != `{"attempt":1,"max":3,"gaveUp":false,"resumed":true}` {
		t.Errorf("wire shape = %s (%v)", b, err)
	}
}

// Cancelling the caller's ctx must not be mistaken for a crash: the process is
// tied to the Manager's lifetime, so it keeps running and nothing restarts.
func TestManagerCallerCtxCancelDoesNotRestart(t *testing.T) {
	var mu sync.Mutex
	var restarts int
	ag := stayAlive()
	m := NewManager(ag,
		func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
			return &fakeConn{handler: h}, nil
		},
		ManagerConfig{OnRestart: func(RestartInfo) { mu.Lock(); restarts++; mu.Unlock() }})

	ctx, cancel := context.WithCancel(context.Background())
	if err := m.Start(ctx); err != nil {
		t.Fatalf("start: %v", err)
	}
	defer m.Stop()

	cancel()
	time.Sleep(150 * time.Millisecond)

	mu.Lock()
	n := restarts
	mu.Unlock()
	if n != 0 {
		t.Fatalf("caller ctx cancel triggered %d restart(s)", n)
	}
	if !ag.Running() {
		t.Fatal("agent should still be running after the caller ctx was cancelled")
	}
}

// A failed initialize must tear the process down, not leave it running.
func TestManagerInitializeFailureStops(t *testing.T) {
	ag := stayAlive()
	wantErr := errors.New("init boom")
	m := NewManager(ag,
		func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
			return &fakeConn{handler: h, initErr: wantErr}, nil
		},
		ManagerConfig{})

	if err := m.Start(context.Background()); !errors.Is(err, wantErr) {
		t.Fatalf("expected the initialize error, got %v", err)
	}
	if ag.Running() {
		t.Fatal("agent process should be stopped after a failed initialize")
	}
}

// A second Start while already started must be rejected, not spawn a second agent.
func TestManagerStartTwiceFails(t *testing.T) {
	m := NewManager(stayAlive(),
		func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
			return &fakeConn{handler: h}, nil
		},
		ManagerConfig{})

	ctx := context.Background()
	if err := m.Start(ctx); err != nil {
		t.Fatalf("first start: %v", err)
	}
	defer m.Stop()
	if err := m.Start(ctx); err == nil {
		t.Fatal("second Start must fail (agent already started)")
	}
}

// resumeSessions re-loads the live sessions on the (relaunched) connection.
func TestManagerResumeSessions(t *testing.T) {
	var fc *fakeConn
	m := NewManager(stayAlive(),
		func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
			fc = &fakeConn{handler: h}
			return fc, nil
		},
		ManagerConfig{})
	ctx := context.Background()
	if err := m.Start(ctx); err != nil {
		t.Fatalf("start: %v", err)
	}
	defer m.Stop()
	sid, err := m.NewSession(ctx, "/tmp", SessionWorkspace{})
	if err != nil {
		t.Fatalf("new session: %v", err)
	}
	m.resumeSessions()
	if len(fc.loaded) != 1 || fc.loaded[0] != sid {
		t.Fatalf("expected resumeSessions to LoadSession %q, got %v", sid, fc.loaded)
	}
}

// updateRecorder keeps what reached the UI, in order.
type updateRecorder struct {
	mu  sync.Mutex
	got []Update
}

func (r *updateRecorder) add(_ SessionID, u Update) {
	r.mu.Lock()
	r.got = append(r.got, u)
	r.mu.Unlock()
}

// since returns the updates from index n on, as "type:delta" for text and the type alone otherwise.
func (r *updateRecorder) since(n int) []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []string
	for _, u := range r.got[n:] {
		if u.Delta != "" {
			out = append(out, u.Type+":"+u.Delta)
		} else {
			out = append(out, u.Type)
		}
	}
	return out
}

func (r *updateRecorder) len() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.got)
}

// A restarted engine replays the history the UI already shows: forwarded, every open chat shows it twice.
func TestAResumeForwardsOnlyTheSessionsState(t *testing.T) {
	rec := &updateRecorder{}
	fc := &fakeConn{replay: []Update{
		{Type: "user_message", Delta: "hi"},
		{Type: "message_chunk", Delta: "Hello"},
		{Type: "model_change", ModelID: "opus"},
	}}
	m, sid := startFake(t, fc, ManagerConfig{OnUpdate: rec.add})
	m.resumeSessions()
	got := rec.since(0)
	for _, u := range got {
		if u != "model_change" && u != "mode_change" {
			t.Errorf("forwarded during the resume = %v, want the session's model and mode alone", got)
			break
		}
	}
	if len(got) == 0 {
		t.Error("the resume forwarded nothing, not even the session's model")
	}
	if st := m.GetSessionState(sid); st.ModelID != "opus" {
		t.Errorf("model = %q, want the one the resume reported", st.ModelID)
	}
}

func joined(s []string) string { return strings.Join(s, " | ") }

// A reopen in the same run replays the log: the engine's own replay loses the text of a turn still running.
func TestAReopenReplaysTheLogWithoutTheEngine(t *testing.T) {
	rec := &updateRecorder{}
	fc := &fakeConn{permTimeoutMs: 20}
	m, sid := startFake(t, fc, ManagerConfig{OnUpdate: rec.add})
	if err := m.Prompt(context.Background(), sid, "hi", nil); err != nil {
		t.Fatalf("prompt: %v", err)
	}
	from := rec.len()
	if err := m.LoadSession(context.Background(), sid, "/tmp", SessionWorkspace{}); err != nil {
		t.Fatalf("load: %v", err)
	}
	want := "replay_start | user_message:hi | message_chunk:Hello world | tool_call | tool_call_update"
	if got := joined(rec.since(from)); got != want {
		t.Errorf("reopen sent %q, want %q", got, want)
	}
	if len(fc.loaded) != 0 {
		t.Errorf("the engine was asked to load %v", fc.loaded)
	}
}

func TestAnUnknownSessionLoadsFromTheEngineOnceThenFromTheLog(t *testing.T) {
	rec := &updateRecorder{}
	fc := &fakeConn{replay: []Update{{Type: "user_message", Delta: "earlier"}, {Type: "message_chunk", Delta: "answer"}}}
	m, _ := startFake(t, fc, ManagerConfig{OnUpdate: rec.add})
	for i := 0; i < 2; i++ {
		if err := m.LoadSession(context.Background(), "s-old", "/tmp", SessionWorkspace{}); err != nil {
			t.Fatalf("load %d: %v", i, err)
		}
	}
	if len(fc.loaded) != 1 {
		t.Errorf("engine loads = %v, want one", fc.loaded)
	}
	if got, want := joined(rec.since(0)), "user_message:earlier | message_chunk:answer | replay_start | user_message:earlier | message_chunk:answer"; got != want {
		t.Errorf("sent %q, want %q", got, want)
	}
}

// The replay holds the forwarding lock, so a live update lands after it, once: never inside the reset it follows.
func TestALiveUpdateDuringAReplayAppearsOnceAfterIt(t *testing.T) {
	rec := &updateRecorder{}
	done := make(chan struct{})
	var m *Manager
	var sid SessionID
	fc := &fakeConn{permTimeoutMs: 20}
	m, sid = startFake(t, fc, ManagerConfig{OnUpdate: func(s SessionID, u Update) {
		rec.add(s, u)
		if u.Type == "replay_start" {
			go func() {
				m.HandleUpdate(sid, Update{Type: "message_chunk", Delta: "live"})
				close(done)
			}()
			time.Sleep(20 * time.Millisecond) // the live update is waiting on the lock by now
		}
	}})
	if err := m.Prompt(context.Background(), sid, "hi", nil); err != nil {
		t.Fatalf("prompt: %v", err)
	}
	from := rec.len()
	if err := m.LoadSession(context.Background(), sid, "/tmp", SessionWorkspace{}); err != nil {
		t.Fatalf("load: %v", err)
	}
	<-done
	got := rec.since(from)
	if len(got) == 0 || got[len(got)-1] != "message_chunk:live" || strings.Count(joined(got), "live") != 1 {
		t.Errorf("sent %v, want the live chunk once, after the replay", got)
	}
}

func TestAnAnsweredQuestionLeavesTheLog(t *testing.T) {
	rec := &updateRecorder{}
	var m *Manager
	fc := &fakeConn{question: true}
	m, sid := startFake(t, fc, ManagerConfig{OnUpdate: func(s SessionID, u Update) {
		rec.add(s, u)
		if u.Type == "choices" {
			go m.ReplyChoices(u.Choices.ID, ChoiceSubmission{SelectedIDs: []string{"a"}})
		}
	}})
	if err := m.Prompt(context.Background(), sid, "hi", nil); err != nil {
		t.Fatalf("prompt: %v", err)
	}
	from := rec.len()
	if err := m.LoadSession(context.Background(), sid, "/tmp", SessionWorkspace{}); err != nil {
		t.Fatalf("load: %v", err)
	}
	if got := joined(rec.since(from)); strings.Contains(got, "choices") {
		t.Errorf("the replay asks an answered question again: %s", got)
	}
}

// A crash loses the text of the turn it ended on the engine side; the log is what still has it.
func TestAResumedSessionKeepsItsLog(t *testing.T) {
	rec := &updateRecorder{}
	var m *Manager
	fc := &fakeConn{}
	m, sid := startFake(t, fc, ManagerConfig{
		OnUpdate:     rec.add,
		OnPermission: func(req PermissionRequest) { _ = m.Cancel(context.Background(), req.SessionID) },
	})
	if err := m.Prompt(context.Background(), sid, "count", nil); err != nil {
		t.Fatalf("prompt: %v", err)
	}
	fc.replay = []Update{{Type: "user_message", Delta: "count"}} // the engine kept the prompt, not the reply
	m.resumeSessions()
	from := rec.len()
	if err := m.LoadSession(context.Background(), sid, "/tmp", SessionWorkspace{}); err != nil {
		t.Fatalf("load: %v", err)
	}
	if got := joined(rec.since(from)); !strings.Contains(got, "message_chunk:Hello world") || strings.Count(got, "user_message") != 1 {
		t.Errorf("reopen after the resume sent %q, want the stopped turn's text and the prompt once", got)
	}
}

// A session/load answers without the model selector; keeping what the session opened with is what stops
// GetSessionState from coming back empty, which is how the UI decides to hide the model and mode pickers.
func TestManagerLoadSessionKeepsAdvertisedModels(t *testing.T) {
	m := NewManager(stayAlive(),
		func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
			return &fakeConn{
				handler: h,
				models:  []AgentModel{{ID: "opus", Name: "Opus"}},
				modes:   []AgentMode{{ID: "default", Name: "Default"}},
			}, nil
		},
		ManagerConfig{})
	ctx := context.Background()
	if err := m.Start(ctx); err != nil {
		t.Fatalf("start: %v", err)
	}
	defer m.Stop()
	sid, err := m.NewSession(ctx, "/tmp", SessionWorkspace{})
	if err != nil {
		t.Fatalf("new session: %v", err)
	}
	if err := m.LoadSession(ctx, sid, "/tmp", SessionWorkspace{}); err != nil {
		t.Fatalf("load session: %v", err)
	}
	st := m.GetSessionState(sid)
	if len(st.Models) != 1 || len(st.Modes) != 1 {
		t.Fatalf("expected the session to keep its models and modes, got %d models, %d modes", len(st.Models), len(st.Modes))
	}
}

// Auth methods from initialize reach the manager (as a defensive copy), and
// Authenticate forwards the chosen method id to the connection.
func TestManagerAuthMethodsAndAuthenticate(t *testing.T) {
	var fc *fakeConn
	m := NewManager(stayAlive(),
		func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
			fc = &fakeConn{handler: h, methods: []AuthMethod{{ID: "login", Name: "Subscription login"}}}
			return fc, nil
		},
		ManagerConfig{})

	ctx := context.Background()
	if err := m.Start(ctx); err != nil {
		t.Fatalf("start: %v", err)
	}
	defer m.Stop()

	got := m.AuthMethods()
	if len(got) != 1 || got[0].ID != "login" {
		t.Fatalf("AuthMethods() = %+v, want one method with id \"login\"", got)
	}
	got[0].ID = "mutated" // must not leak into the manager's state
	if m.AuthMethods()[0].ID != "login" {
		t.Fatal("AuthMethods() must return a defensive copy")
	}

	if err := m.Authenticate(ctx, "login"); err != nil {
		t.Fatalf("authenticate: %v", err)
	}
	if fc.authedWith != "login" {
		t.Fatalf("Authenticate forwarded %q, want \"login\"", fc.authedWith)
	}
}

// The host enriches the permission request's Input map in place while GetSessionState hands the pending request to another goroutine to marshal — sharing that map is a fatal concurrent read+write, so the published request must be a deep copy that still carries the enrichment. Run with -race.
func TestManagerPendingPermissionIsNotSharedWithTheHost(t *testing.T) {
	input := map[string]any{"id": "user:blink", "nested": map[string]any{"a": 1}}
	enriched := make(chan map[string]any, 1)

	m := NewManager(stayAlive(),
		func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
			return &fakeConn{handler: h, permInput: input}, nil
		},
		ManagerConfig{
			OnPermission: func(req PermissionRequest) {
				in := req.ToolCall.Input.(map[string]any) // what enrichPermissionAppName does: mutate the shared input in place
				in["_targetName"] = "Blink Demo"
				enriched <- in
			},
		})

	ctx := context.Background()
	if err := m.Start(ctx); err != nil {
		t.Fatalf("start: %v", err)
	}
	defer m.Stop()
	sid, err := m.NewSession(ctx, "/tmp", SessionWorkspace{})
	if err != nil {
		t.Fatalf("new session: %v", err)
	}

	done := make(chan struct{})
	go func() {
		defer close(done)
		hostMap := <-enriched
		var published *PermissionRequest
		for i := 0; i < 2000 && published == nil; i++ { // wait until it's published, so the mutation races the reads, not the copy
			published = m.GetSessionState(sid).PendingPermission
			if published == nil {
				time.Sleep(time.Millisecond)
			}
		}
		if published == nil {
			t.Error("no pending permission was published")
			m.ReplyPermission("p1", PermissionOutcome{OptionID: "allow"})
			return
		}
		if got, _ := published.ToolCall.Input.(map[string]any)["_targetName"].(string); got != "Blink Demo" {
			t.Errorf("published input _targetName = %q, want the host's enrichment (it must run before publishing)", got)
		}
		var wg sync.WaitGroup
		wg.Add(2)
		go func() { // the host keeps touching its map…
			defer wg.Done()
			for i := 0; i < 500; i++ {
				hostMap["k"+strconv.Itoa(i)] = i
			}
		}()
		go func() { // …while the published one is marshalled, exactly as Wails does for GetSessionState
			defer wg.Done()
			for i := 0; i < 500; i++ {
				st := m.GetSessionState(sid)
				if st.PendingPermission != nil {
					if _, err := json.Marshal(st.PendingPermission); err != nil {
						t.Errorf("marshal pending permission: %v", err)
					}
				}
			}
		}()
		wg.Wait()
		if _, leaked := published.ToolCall.Input.(map[string]any)["k0"]; leaked {
			t.Error("the published request shares its input map with the host's copy")
		}
		m.ReplyPermission(published.ID, PermissionOutcome{OptionID: "allow"})
	}()

	if err := m.Prompt(ctx, sid, "hi", nil); err != nil {
		t.Fatalf("prompt: %v", err)
	}
	<-done
}

// openAtEndConn ends its turn while its permission is still on screen, as when one of two parallel calls is rejected.
type openAtEndConn struct {
	fakeConn
	shown   chan struct{}
	outcome chan PermissionOutcome
}

func (p *openAtEndConn) Prompt(_ context.Context, sid SessionID, _ string, _ []string) (bool, error) {
	go func() {
		p.outcome <- p.handler.HandlePermission(context.Background(), PermissionRequest{ID: "p-open", SessionID: sid, Options: []PermissionOption{{ID: "allow", Kind: "allow_once"}}})
	}()
	<-p.shown
	return false, nil
}

// The engine waits on a session's oldest request with no timer: a card the turn left open would block every later one.
func TestACardStillOpenWhenTheTurnEndsIsAnswered(t *testing.T) {
	p := &openAtEndConn{shown: make(chan struct{}), outcome: make(chan PermissionOutcome, 1)}
	var once sync.Once
	m := NewManager(stayAlive(), func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
		p.handler = h
		return p, nil
	}, ManagerConfig{OnPermission: func(PermissionRequest) { once.Do(func() { close(p.shown) }) }})
	if err := m.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = m.Stop() })
	sid, _ := m.NewSession(context.Background(), "/tmp", SessionWorkspace{})
	_ = m.Prompt(context.Background(), sid, "hi", nil)
	select {
	case out := <-p.outcome:
		if !out.Cancelled {
			t.Errorf("outcome = %+v, want cancelled", out)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("the card the turn left open was never answered")
	}
}

// gateConn holds its first loads open after their replay, until the test releases them.
type gateConn struct {
	fakeConn
	mu      sync.Mutex
	calls   int
	gated   int
	entered chan struct{}
	release chan struct{}
	turn    []Update // what a prompt streams
}

func (g *gateConn) LoadSession(_ context.Context, sid SessionID, _ string, _ SessionWorkspace) (NewSessionResult, error) {
	g.mu.Lock()
	g.calls++
	n := g.calls
	g.mu.Unlock()
	for _, u := range g.replay {
		g.handler.HandleUpdate(sid, u)
	}
	if n <= g.gated {
		g.entered <- struct{}{}
		<-g.release
	}
	return NewSessionResult{SessionID: sid}, nil
}

func (g *gateConn) Prompt(_ context.Context, sid SessionID, _ string, _ []string) (bool, error) {
	for _, u := range g.turn {
		g.handler.HandleUpdate(sid, u)
	}
	return false, nil
}

func startGate(t *testing.T, g *gateConn, rec *updateRecorder) *Manager {
	t.Helper()
	g.entered, g.release = make(chan struct{}, 2), make(chan struct{})
	m := NewManager(stayAlive(), func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
		g.handler = h
		return g, nil
	}, ManagerConfig{OnUpdate: rec.add})
	if err := m.Start(context.Background()); err != nil {
		t.Fatalf("start: %v", err)
	}
	t.Cleanup(func() { _ = m.Stop() })
	return m
}

// A prompt sent while a restart reloads its chat waits for the reload: run inside it, its reply was muted with the replay.
func TestAPromptDuringAResumeWaitsForIt(t *testing.T) {
	rec := &updateRecorder{}
	g := &gateConn{gated: 1, turn: []Update{{Type: "message_chunk", Delta: "live reply"}}}
	m := startGate(t, g, rec)
	ctx := context.Background()
	sid, err := m.NewSession(ctx, "/tmp", SessionWorkspace{})
	if err != nil {
		t.Fatal(err)
	}
	resumed := make(chan struct{})
	go func() { m.resumeSessions(); close(resumed) }()
	<-g.entered
	prompted := make(chan error, 1)
	go func() { prompted <- m.Prompt(ctx, sid, "hello", nil) }()
	select {
	case err := <-prompted:
		t.Fatalf("the prompt ran during the reload (%v)", err)
	case <-time.After(50 * time.Millisecond):
	}
	close(g.release)
	<-resumed
	if err := <-prompted; err != nil {
		t.Fatalf("prompt: %v", err)
	}
	if got := joined(rec.since(0)); !strings.Contains(got, "live reply") {
		t.Errorf("forwarded %q, want the reply of the prompt", got)
	}
}

// A Stop pressed while the prompt waits for its chat's reload has no turn to cancel yet: it must end the prompt unsent.
func TestAStopDuringTheWaitEndsThePromptUnsent(t *testing.T) {
	rec := &updateRecorder{}
	g := &gateConn{gated: 1, turn: []Update{{Type: "message_chunk", Delta: "live reply"}}}
	m := startGate(t, g, rec)
	ctx := context.Background()
	sid, err := m.NewSession(ctx, "/tmp", SessionWorkspace{})
	if err != nil {
		t.Fatal(err)
	}
	resumed := make(chan struct{})
	go func() { m.resumeSessions(); close(resumed) }()
	<-g.entered
	prompted := make(chan error, 1)
	go func() { prompted <- m.Prompt(ctx, sid, "hello", nil) }()
	for waiting := false; !waiting; {
		time.Sleep(5 * time.Millisecond)
		m.mu.Lock()
		waiting = m.unsent[sid] != nil
		m.mu.Unlock()
	}
	if err := m.Cancel(ctx, sid); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-prompted:
		if err != nil {
			t.Fatalf("prompt: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("the stopped prompt still waits for the reload")
	}
	close(g.release)
	<-resumed
	if got := joined(rec.since(0)); strings.Contains(got, "live reply") {
		t.Errorf("the prompt the user stopped was sent: %q", got)
	}
	if !m.TurnStopped(sid) {
		t.Error("the stopped prompt does not read as a stopped turn")
	}
}

// A prompt sent while a reopen loads its chat from the engine waits for that load: inside it, its board calls went unrecorded.
func TestAPromptDuringAReopenWaitsForTheLoad(t *testing.T) {
	rec := &updateRecorder{}
	g := &gateConn{gated: 1, turn: []Update{
		{Type: "tool_call", ToolCall: &ToolCall{ID: "c1", Title: "arduino-board_apps_start", Kind: "other", Input: map[string]any{"id": "app-x"}}},
		{Type: "message_chunk", Delta: "live answer"},
	}}
	g.replay = []Update{{Type: "user_message", Delta: "earlier"}, {Type: "message_chunk", Delta: "old answer"}}
	m := startGate(t, g, rec)
	ctx := context.Background()
	loaded := make(chan error, 1)
	go func() { loaded <- m.LoadSession(ctx, "s-old", "/tmp", SessionWorkspace{}) }()
	<-g.entered
	prompted := make(chan error, 1)
	go func() { prompted <- m.Prompt(ctx, "s-old", "new question", nil) }()
	select {
	case err := <-prompted:
		t.Fatalf("the prompt ran during the load (%v)", err)
	case <-time.After(50 * time.Millisecond):
	}
	close(g.release)
	if err := <-loaded; err != nil {
		t.Fatalf("load: %v", err)
	}
	if err := <-prompted; err != nil {
		t.Fatalf("prompt: %v", err)
	}
	if apps, _ := m.Touched("s-old"); len(apps) != 1 || apps[0] != "app-x" {
		t.Errorf("touched = %v, want the app the turn started", apps)
	}
	from := rec.len()
	if err := m.LoadSession(ctx, "s-old", "/tmp", SessionWorkspace{}); err != nil {
		t.Fatal(err)
	}
	want := "replay_start | user_message:earlier | message_chunk:old answer | user_message:new question | tool_call | message_chunk:live answer"
	if got := joined(rec.since(from)); got != want {
		t.Errorf("the next reopen sent %q, want %q", got, want)
	}
}

// A prompt that never reaches the engine leaves no stop and no record of the last turn: the host would take them for its own.
func TestAPromptThatNeverStartsKeepsNothingOfTheLastTurn(t *testing.T) {
	ctx := context.Background()
	stoppedTurn := func(t *testing.T) (*Manager, SessionID) {
		m, conn, sid := startRecording(t)
		conn.during = func() {
			m.HandleUpdate(sid, Update{Type: "tool_call", ToolCall: &ToolCall{ID: "c1", Title: "arduino-board_apps_start", Kind: "other", Input: map[string]any{"id": "app-old"}}})
			_ = m.Cancel(ctx, sid)
		}
		_ = m.Prompt(ctx, sid, "first", nil)
		conn.during = nil
		if apps, _ := m.Touched(sid); !m.TurnStopped(sid) || len(apps) != 1 {
			t.Fatalf("setup: stopped %v, touched %v", m.TurnStopped(sid), apps)
		}
		return m, sid
	}
	expectNothing := func(t *testing.T, m *Manager, sid SessionID) {
		if apps, paths := m.Touched(sid); m.TurnStopped(sid) || len(apps)+len(paths) != 0 {
			t.Errorf("stopped %v, touched %v / %v; want nothing of the last turn", m.TurnStopped(sid), apps, paths)
		}
	}

	t.Run("the caller gives up waiting for the load", func(t *testing.T) {
		m, sid := stoppedTurn(t)
		m.mu.Lock()
		m.sessions[sid].loadDone = make(chan struct{})
		m.mu.Unlock()
		gone, cancel := context.WithCancel(ctx)
		cancel()
		if err := m.Prompt(gone, sid, "second", nil); err == nil {
			t.Fatal("the prompt ran while its chat was loading")
		}
		expectNothing(t, m, sid)
	})
	t.Run("no engine", func(t *testing.T) {
		m, sid := stoppedTurn(t)
		m.mu.Lock()
		conn := m.conn
		m.conn = nil
		m.mu.Unlock()
		if err := m.Prompt(ctx, sid, "second", nil); err == nil {
			t.Fatal("a prompt with no engine reported success")
		}
		m.mu.Lock()
		m.conn = conn
		m.mu.Unlock()
		expectNothing(t, m, sid)
	})
}

// A reopen during the reload of a chat this run holds no whole log of waits for it, then asks the engine: its history stays.
func TestAReopenDuringAResumeKeepsTheHistory(t *testing.T) {
	rec := &updateRecorder{}
	g := &gateConn{gated: 1}
	g.replay = []Update{{Type: "user_message", Delta: "earlier"}, {Type: "message_chunk", Delta: "answer"}}
	m := startGate(t, g, rec)
	ctx := context.Background()
	m.mu.Lock()
	m.session("s-x").cwd = "/tmp" // live, with no whole log: an earlier load failed, or the log hit its cap
	m.mu.Unlock()
	resumed := make(chan struct{})
	go func() { m.resumeSessions(); close(resumed) }()
	<-g.entered
	reopened := make(chan error, 1)
	go func() { reopened <- m.LoadSession(ctx, "s-x", "/tmp", SessionWorkspace{}) }()
	time.Sleep(20 * time.Millisecond)
	close(g.release)
	<-resumed
	if err := <-reopened; err != nil {
		t.Fatalf("reopen: %v", err)
	}
	from := rec.len()
	if err := m.LoadSession(ctx, "s-x", "/tmp", SessionWorkspace{}); err != nil {
		t.Fatalf("second reopen: %v", err)
	}
	if got := joined(rec.since(from)); got != "replay_start | user_message:earlier | message_chunk:answer" {
		t.Errorf("the next reopen sent %q, want the history once", got)
	}
}

// Two panels can open one chat together; one engine load fills the log, so the history is never kept twice.
func TestOverlappingReopensLoadTheEngineOnce(t *testing.T) {
	rec := &updateRecorder{}
	g := &gateConn{gated: 1}
	g.replay = []Update{{Type: "user_message", Delta: "earlier"}, {Type: "message_chunk", Delta: "answer"}}
	m := startGate(t, g, rec)
	ctx := context.Background()
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _ = m.LoadSession(ctx, "s-old", "/tmp", SessionWorkspace{}) }()
	}
	<-g.entered
	time.Sleep(20 * time.Millisecond) // the second reopen is waiting by now
	close(g.release)
	wg.Wait()
	from := rec.len()
	if err := m.LoadSession(ctx, "s-old", "/tmp", SessionWorkspace{}); err != nil {
		t.Fatalf("load: %v", err)
	}
	if got := joined(rec.since(from)); got != "replay_start | user_message:earlier | message_chunk:answer" {
		t.Errorf("a later reopen sent %q, want the history once", got)
	}
	if g.calls != 1 {
		t.Errorf("engine loads = %d, want 1", g.calls)
	}
}

// lateStopConn completes its turn, and the Stop the user pressed while its last notifications were on their way reaches it then.
type lateStopConn struct {
	fakeConn
	stop func()
}

func (l *lateStopConn) Prompt(context.Context, SessionID, string, []string) (bool, error) {
	l.stop()
	return false, nil // the engine answered end_turn
}

// A Stop that lands after the engine finished must not mark the turn stopped, nor keep the notes it delivered.
func TestAStopAfterTheEngineFinishedChangesNothing(t *testing.T) {
	l := &lateStopConn{}
	m := NewManager(stayAlive(), func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
		l.handler = h
		return l, nil
	}, ManagerConfig{})
	ctx := context.Background()
	if err := m.Start(ctx); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = m.Stop() })
	sid, _ := m.NewSession(ctx, "/tmp", SessionWorkspace{})
	l.stop = func() {}
	_ = m.Prompt(ctx, sid, "hello", nil) // the first message, which titles the session
	m.Notify(sid, "a note")
	l.stop = func() { _ = m.Cancel(ctx, sid) }
	if err := m.Prompt(ctx, sid, "hi", nil); err != nil {
		t.Fatal(err)
	}
	if m.TurnStopped(sid) {
		t.Error("a turn the engine completed reads as stopped")
	}
	m.mu.Lock()
	left := len(m.notes[sid])
	m.mu.Unlock()
	if left != 0 {
		t.Errorf("%d notes still queued after the turn that delivered them", left)
	}
}

// Over the cap a session's log is dropped, and its next reopen goes to the engine instead of replaying part of it.
func TestALogOverItsCapFallsBackToTheEngine(t *testing.T) {
	old := maxLogBytes
	maxLogBytes = 8
	t.Cleanup(func() { maxLogBytes = old })
	fc := &fakeConn{permTimeoutMs: 20}
	m, sid := startFake(t, fc, ManagerConfig{})
	if err := m.Prompt(context.Background(), sid, "hi", nil); err != nil {
		t.Fatal(err)
	}
	if err := m.LoadSession(context.Background(), sid, "/tmp", SessionWorkspace{}); err != nil {
		t.Fatal(err)
	}
	if len(fc.loaded) != 1 {
		t.Errorf("engine loads = %v, want the reopen to ask the engine", fc.loaded)
	}
}

// Deleting a chat answers the card its turn still shows: the engine's queue for it would otherwise stay blocked.
func TestDeletingASessionAnswersItsPermission(t *testing.T) {
	fc := &fakeConn{}
	var m *Manager
	m, sid := startFake(t, fc, ManagerConfig{
		OnPermission: func(req PermissionRequest) { go func() { _ = m.DeleteSession(context.Background(), req.SessionID) }() },
	})
	done := make(chan error, 1)
	go func() { done <- m.Prompt(context.Background(), sid, "hi", nil) }()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("deleting the session left its permission waiting")
	}
	if !fc.lastOutcome.Cancelled {
		t.Errorf("outcome = %+v, want cancelled", fc.lastOutcome)
	}
}

// A failed turn's error is in the replay, where the engine's own replay has none, and a stopped turn's mark, as a Claude replay has.
func TestAFailedTurnsErrorIsReplayed(t *testing.T) {
	rec := &updateRecorder{}
	m, conn, sid := startRecording(t)
	m.cfg.OnUpdate = rec.add
	conn.err = errors.New("overloaded")
	_ = m.Prompt(context.Background(), sid, "first", nil)
	conn.during = func() { _ = m.Cancel(context.Background(), sid) }
	_ = m.Prompt(context.Background(), sid, "second", nil)
	from := rec.len()
	if err := m.LoadSession(context.Background(), sid, "/tmp", SessionWorkspace{}); err != nil {
		t.Fatal(err)
	}
	if got := joined(rec.since(from)); got != "replay_start | user_message:first | message_error:overloaded | user_message:second | turn_stopped" {
		t.Errorf("replay = %q, want the failed turn's error and the stopped turn's mark", got)
	}
}

// The UI drops a chunk that repeats its part's text so far; the replay must show the same text, so the log drops it too.
func TestTheLogDropsAChunkThatRepeatsTheTextSoFar(t *testing.T) {
	rec := &updateRecorder{}
	g := &gateConn{turn: []Update{
		{Type: "message_chunk", Delta: "Hello"},
		{Type: "message_chunk", Delta: "Hello"},
		{Type: "message_chunk", Delta: " world"},
		{Type: "tool_call", ToolCall: &ToolCall{ID: "t1", Title: "read"}},
		{Type: "message_chunk", Delta: "Hello world"},
	}}
	m := startGate(t, g, rec)
	ctx := context.Background()
	sid, _ := m.NewSession(ctx, "/tmp", SessionWorkspace{})
	if err := m.Prompt(ctx, sid, "hi", nil); err != nil {
		t.Fatal(err)
	}
	from := rec.len()
	if err := m.LoadSession(ctx, sid, "/tmp", SessionWorkspace{}); err != nil {
		t.Fatal(err)
	}
	if got, want := joined(rec.since(from)), "replay_start | user_message:hi | message_chunk:Hello world | tool_call | message_chunk:Hello world"; got != want {
		t.Errorf("replay = %q, want %q", got, want)
	}
}

// loadingConn notes what reaches the engine, in order; its session/load can be held open, and fail.
type loadingConn struct {
	fakeConn
	mu       sync.Mutex
	calls    []string
	hold     bool
	entered  chan struct{}
	release  chan struct{}
	released sync.Once
	loadErrs []error // returned by the loads in turn; nil once used up
	result   NewSessionResult
	noteEnd  bool             // notes "end:<sid>" when a held load returns
	listed   []SessionSummary // what session/list answers
	listErr  error
	listHang bool          // session/list answers only when its context ends
	listing  chan struct{} // gets a value, when it has room, as session/list is asked
	deletes  atomic.Int32
}

func (c *loadingConn) ListSessions(ctx context.Context, _ string) ([]SessionSummary, error) {
	c.mu.Lock()
	listed, err, hang := c.listed, c.listErr, c.listHang
	c.mu.Unlock()
	select {
	case c.listing <- struct{}{}:
	default:
	}
	if hang {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	return listed, err
}

func (c *loadingConn) DeleteSession(context.Context, SessionID) error {
	c.deletes.Add(1)
	return nil
}

func (c *loadingConn) note(call string) {
	c.mu.Lock()
	c.calls = append(c.calls, call)
	c.mu.Unlock()
}

func (c *loadingConn) noted() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return strings.Join(c.calls, " ")
}

func (c *loadingConn) open() { c.released.Do(func() { close(c.release) }) }

func (c *loadingConn) LoadSession(_ context.Context, sid SessionID, _ string, _ SessionWorkspace) (NewSessionResult, error) {
	c.note("load:" + string(sid))
	for _, u := range c.replay {
		c.handler.HandleUpdate(sid, u)
	}
	c.mu.Lock()
	hold, res := c.hold, c.result
	var err error
	if len(c.loadErrs) > 0 {
		err, c.loadErrs = c.loadErrs[0], c.loadErrs[1:]
	}
	c.mu.Unlock()
	if hold {
		c.entered <- struct{}{}
		<-c.release
		if c.noteEnd {
			c.note("end:" + string(sid))
		}
	}
	res.SessionID = sid
	return res, err
}

func (c *loadingConn) Prompt(_ context.Context, sid SessionID, text string, _ []string) (bool, error) {
	c.note("prompt:" + text)
	c.handler.HandleUpdate(sid, Update{Type: "message_chunk", Delta: "reply to " + text})
	return false, nil
}

func (c *loadingConn) SetModel(_ context.Context, _ SessionID, id string) error {
	c.note("model:" + id)
	return nil
}

func (c *loadingConn) SetMode(_ context.Context, _ SessionID, id string) error {
	c.note("mode:" + id)
	return nil
}

func (c *loadingConn) CloseSession(_ context.Context, sid SessionID) error {
	c.note("close:" + string(sid))
	return nil
}

// startLoading starts a manager on c; a chat it never loaded is found in /mirror unless cfg says otherwise.
func startLoading(t *testing.T, c *loadingConn, cfg ManagerConfig) *Manager {
	t.Helper()
	c.entered, c.release = make(chan struct{}, 4), make(chan struct{})
	if cfg.SessionScope == nil {
		cfg.SessionScope = func(SessionID) (string, SessionWorkspace, error) {
			return "/mirror", SessionWorkspace{AppID: "app"}, nil
		}
	}
	m := NewManager(stayAlive(), func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
		c.handler = h
		return c, nil
	}, cfg)
	if err := m.Start(context.Background()); err != nil {
		t.Fatalf("start: %v", err)
	}
	t.Cleanup(func() { _ = m.Stop() })
	t.Cleanup(c.open) // runs first: a load still held ends before the manager stops
	return m
}

func promptAsync(m *Manager, sid SessionID, text string) chan error {
	done := make(chan error, 1)
	go func() { done <- m.Prompt(context.Background(), sid, text, nil) }()
	return done
}

func within(t *testing.T, done chan error, what string) error {
	t.Helper()
	select {
	case err := <-done:
		return err
	case <-time.After(2 * time.Second):
		t.Fatalf("%s did not return", what)
		return nil
	}
}

func (m *Manager) entry(sid SessionID) *liveSession {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.sessions[sid]
}

func (m *Manager) loadedNow(sid SessionID) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.sessions[sid]
	return s != nil && s.loaded && s.loadDone == nil
}

// A Stop has no turn to cancel while the prompt loads the chat: the prompt ends at once, and the load still counts for the next one.
func TestAStopDuringTheLoadBeforeAPromptEndsItAtOnce(t *testing.T) {
	c := &loadingConn{hold: true}
	m := startLoading(t, c, ManagerConfig{})
	prompted := promptAsync(m, "s-old", "hello")
	<-c.entered
	if err := m.Cancel(context.Background(), "s-old"); err != nil {
		t.Fatal(err)
	}
	if err := within(t, prompted, "the stopped prompt"); err != nil {
		t.Fatalf("prompt: %v", err)
	}
	if !m.TurnStopped("s-old") {
		t.Error("the prompt does not read as stopped")
	}
	c.open()
	for i := 0; i < 200 && !m.loadedNow("s-old"); i++ {
		time.Sleep(5 * time.Millisecond)
	}
	if err := m.Prompt(context.Background(), "s-old", "again", nil); err != nil {
		t.Fatal(err)
	}
	if got := c.noted(); got != "load:s-old prompt:again" {
		t.Errorf("engine calls = %q, want one load and the second prompt only", got)
	}
}

// A Stop that lands before the load starts, while the chat's scope is read, ends the prompt too.
func TestAStopBeforeTheLoadStartsEndsThePrompt(t *testing.T) {
	reading, read := make(chan struct{}), make(chan struct{})
	c := &loadingConn{hold: true}
	m := startLoading(t, c, ManagerConfig{SessionScope: func(SessionID) (string, SessionWorkspace, error) {
		close(reading)
		<-read
		return "/mirror", SessionWorkspace{}, nil
	}})
	prompted := promptAsync(m, "s-old", "hello")
	<-reading
	if err := m.Cancel(context.Background(), "s-old"); err != nil {
		t.Fatal(err)
	}
	close(read)
	if err := within(t, prompted, "the stopped prompt"); err != nil {
		t.Fatalf("prompt: %v", err)
	}
	select {
	case <-c.entered: // the load runs on its own goroutine, so its start is waited for, not read at once
		t.Error("a load started after the Stop")
	case <-time.After(100 * time.Millisecond):
	}
	if got := c.noted(); got != "" {
		t.Errorf("engine calls = %q, want none", got)
	}
	if !m.TurnStopped("s-old") {
		t.Error("the prompt does not read as stopped")
	}
}

// Two prompts can wait on one load; the Stop is for the chat, so neither reaches the engine.
func TestAStopReachesEveryPromptWaitingOnTheLoad(t *testing.T) {
	c := &loadingConn{hold: true}
	m := startLoading(t, c, ManagerConfig{})
	first := promptAsync(m, "s-old", "one")
	<-c.entered
	second := promptAsync(m, "s-old", "two")
	for deadline := time.Now().Add(2 * time.Second); ; {
		m.mu.Lock()
		shared := m.unsent["s-old"] != nil && m.unsent["s-old"].count == 2
		m.mu.Unlock()
		if shared {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the two prompts never shared one stop: a Stop would reach only one of them")
		}
		time.Sleep(5 * time.Millisecond)
	}
	_ = m.Cancel(context.Background(), "s-old")
	for _, done := range []chan error{first, second} {
		if err := within(t, done, "a stopped prompt"); err != nil {
			t.Fatalf("prompt: %v", err)
		}
	}
	c.open()
	if got := c.noted(); strings.Contains(got, "prompt:") {
		t.Errorf("engine calls = %q, want no prompt after the Stop", got)
	}
}

// Deleting or closing a chat while its prompt loads it ends the prompt at once; the engine deletes or closes the chat only after the load.
func TestDeletingOrClosingAChatWhileItsPromptLoadsItSendsNothing(t *testing.T) {
	ctx := context.Background()
	for name, c := range map[string]struct {
		noDelete bool
		end      func(*Manager) error
	}{
		"delete": {false, func(m *Manager) error { return m.DeleteSession(ctx, "s-old") }},
		// OpenCode has no session/delete: the host deletes the chat through its CLI after the refusal, then closes it.
		"delete, refused by the engine": {true, func(m *Manager) error {
			if err := m.DeleteSession(ctx, "s-old"); !errors.Is(err, ErrDeleteSessionUnsupported) {
				return fmt.Errorf("delete = %v, want the refusal", err)
			}
			return nil
		}},
		"close": {false, func(m *Manager) error { return m.CloseSession(ctx, "s-old") }},
	} {
		t.Run(name, func(t *testing.T) {
			conn := &loadingConn{hold: true, noteEnd: true}
			conn.noDelete = c.noDelete
			m := startLoading(t, conn, ManagerConfig{})
			prompted := promptAsync(m, "s-old", "hello")
			<-conn.entered
			ended := make(chan error, 1)
			go func() { ended <- c.end(m) }()
			if err := within(t, prompted, "the prompt of the chat"); err != nil {
				t.Fatalf("prompt: %v", err)
			}
			select {
			case err := <-ended:
				t.Fatalf("returned (%v) while the engine still loaded the chat", err)
			case <-time.After(50 * time.Millisecond):
			}
			conn.open()
			if err := within(t, ended, name); err != nil {
				t.Fatal(err)
			}
			if c.noDelete {
				_ = m.CloseSession(ctx, "s-old")
			}
			if got := conn.noted(); got != "load:s-old end:s-old close:s-old" {
				t.Errorf("engine calls = %q, want the load to end before the close, and no prompt", got)
			}
			if m.entry("s-old") != nil || m.TurnStopped("s-old") {
				t.Error("the chat left an entry behind, or its prompt reads as a Stop")
			}
		})
	}
}

// The load before a prompt can fail: the user reads what to do, a chat that cannot come back is told apart, and an auth refusal stays the engine's.
func TestALoadBeforeAPromptThatFailsSaysWhatToDo(t *testing.T) {
	type rpc struct {
		Code    int               `json:"code"`
		Message string            `json:"message"`
		Data    map[string]string `json:"data"`
	}
	for name, c := range map[string]struct {
		err       error
		kind, say string
	}{
		"no history (Claude)":   {engineError(-32002, "Resource not found", map[string]any{"uri": "s-old"}), "session_gone", "Start a new chat"},
		"no session (OpenCode)": {engineError(-32602, "session not found: s-old", nil), "session_gone", "Start a new chat"},
		"the engine went down":  {engineError(-32603, "Internal error", map[string]any{"error": "peer disconnected before response"}), "session_load_failed", "Try again"},
		"the load ran too long": {errors.New("context deadline exceeded"), "session_load_failed", "Try again"},
	} {
		t.Run(name, func(t *testing.T) {
			conn := &loadingConn{loadErrs: []error{c.err}}
			m := startLoading(t, conn, ManagerConfig{})
			err := m.Prompt(context.Background(), "s-old", "hello", nil)
			var got rpc
			if err == nil || json.Unmarshal([]byte(err.Error()), &got) != nil {
				t.Fatalf("error = %v, want a JSON-RPC error the UI can read", err)
			}
			if got.Data["errorKind"] != c.kind || !strings.Contains(got.Message, c.say) || strings.Contains(got.Message, "{") {
				t.Errorf("error = %+v, want errorKind %q and a message saying %q", got, c.kind, c.say)
			}
			if m.entry("s-old") != nil {
				t.Error("a chat that could not be loaded left an entry behind")
			}
			if err := m.Prompt(context.Background(), "s-old", "again", nil); err != nil {
				t.Fatalf("retry: %v", err)
			}
			if got := conn.noted(); got != "load:s-old load:s-old prompt:again" {
				t.Errorf("engine calls = %q, want the retry to load again, then prompt", got)
			}
		})
	}

	auth := engineError(-32000, "Authentication required", nil)
	m := startLoading(t, &loadingConn{loadErrs: []error{auth}}, ManagerConfig{})
	if err := m.Prompt(context.Background(), "s-old", "hello", nil); !errors.Is(err, auth) {
		t.Errorf("error = %v, want the engine's auth refusal as it came", err)
	}
}

// A prompt that waited for another caller's load looks again: when that load failed, it loads the chat itself.
func TestAPromptAfterAFailedReopenLoadsTheChatItself(t *testing.T) {
	c := &loadingConn{hold: true, loadErrs: []error{errors.New("peer disconnected before response")}}
	m := startLoading(t, c, ManagerConfig{})
	reopened := make(chan error, 1)
	go func() { reopened <- m.LoadSession(context.Background(), "s-old", "/mirror", SessionWorkspace{}) }()
	<-c.entered
	prompted := promptAsync(m, "s-old", "hello")
	time.Sleep(20 * time.Millisecond) // the prompt waits on the reopen's load by now
	c.mu.Lock()
	c.hold = false
	c.mu.Unlock()
	c.open()
	if err := within(t, reopened, "the reopen"); err == nil {
		t.Fatal("the reopen should have failed")
	}
	if err := within(t, prompted, "the prompt"); err != nil {
		t.Fatalf("prompt: %v", err)
	}
	if got := c.noted(); got != "load:s-old load:s-old prompt:hello" {
		t.Errorf("engine calls = %q, want the failed load, the prompt's own, then the prompt", got)
	}
}

// No entry is left for a chat whose scope cannot be read: a later resume would load it with an empty cwd.
func TestAPromptWhoseChatCannotBeFoundLeavesNoEntry(t *testing.T) {
	m := startLoading(t, &loadingConn{}, ManagerConfig{SessionScope: func(SessionID) (string, SessionWorkspace, error) {
		return "", SessionWorkspace{}, errors.New("mirror root unavailable")
	}})
	if err := m.Prompt(context.Background(), "s-old", "hello", nil); err == nil {
		t.Fatal("the prompt reported success")
	}
	if m.entry("s-old") != nil {
		t.Error("an entry was left for the chat")
	}
}

// A reopen during the load before a prompt waits for it, then replays the log the load filled: one engine load, the history once and in order.
func TestAReopenDuringTheLoadBeforeAPromptWaitsForIt(t *testing.T) {
	rec := &updateRecorder{}
	c := &loadingConn{hold: true}
	c.replay = []Update{{Type: "user_message", Delta: "old q"}, {Type: "message_chunk", Delta: "old a"}}
	m := startLoading(t, c, ManagerConfig{OnUpdate: rec.add})
	prompted := promptAsync(m, "s-old", "hello")
	<-c.entered
	if got := joined(rec.since(0)); got != "" {
		t.Errorf("the muted load sent %q to the UI", got)
	}
	reopened := make(chan error, 1)
	go func() { reopened <- m.LoadSession(context.Background(), "s-old", "/mirror", SessionWorkspace{}) }()
	time.Sleep(20 * time.Millisecond) // the reopen waits on the load by now
	c.open()
	if err := within(t, reopened, "the reopen"); err != nil {
		t.Fatalf("reopen: %v", err)
	}
	if err := within(t, prompted, "the prompt"); err != nil {
		t.Fatalf("prompt: %v", err)
	}
	if got := c.noted(); got != "load:s-old prompt:hello" {
		t.Errorf("engine calls = %q, want one load", got)
	}
	// replay_start drops what the UI shows: a live update sent before it is in the replay too.
	got := joined(rec.since(0))
	_, replayed, ok := strings.Cut(got, "replay_start | ")
	if !ok || !strings.HasPrefix(replayed, "user_message:old q | message_chunk:old a | ") || !strings.Contains(replayed, "reply to hello") || strings.Count(got, "old q") != 1 {
		t.Errorf("the UI got %q, want one replay with the history once, before the new turn", got)
	}
}

// memPicks is a PickStore kept in memory.
type memPicks struct {
	mu    sync.Mutex
	picks map[SessionID]SessionPick
}

func (p *memPicks) Pick(sid SessionID) SessionPick {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.picks[sid]
}

func (p *memPicks) SavePick(sid SessionID, pick SessionPick) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.picks == nil {
		p.picks = map[SessionID]SessionPick{}
	}
	next := p.picks[sid]
	if pick.Model != "" {
		next.Model = pick.Model
	}
	if pick.Mode != "" {
		next.Mode = pick.Mode
	}
	p.picks[sid] = next
}

func (p *memPicks) DropPick(sid SessionID) {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.picks, sid)
}

// A load answered on the engine's default model and mode, whatever the chat ran on, as the Claude adapter can.
var loadedOnDefaults = NewSessionResult{
	CurrentModelID: "default", Models: []AgentModel{{ID: "default"}, {ID: "haiku"}},
	CurrentModeID: "default", Modes: []AgentMode{{ID: "default"}, {ID: "plan"}},
}

// After any load the chat runs on the model and mode last picked for it, and the pickers say so.
func TestALoadPutsTheChatBackOnItsModelAndMode(t *testing.T) {
	picked := func() *memPicks {
		return &memPicks{picks: map[SessionID]SessionPick{"s-old": {Model: "haiku", Mode: "plan"}, "s1": {Model: "haiku", Mode: "plan"}}}
	}
	expectState := func(t *testing.T, m *Manager, sid SessionID) {
		t.Helper()
		if st := m.GetSessionState(sid); st.ModelID != "haiku" || st.ModeID != "plan" {
			t.Errorf("state = %s / %s, want haiku / plan", st.ModelID, st.ModeID)
		}
	}
	expectShown := func(t *testing.T, rec *updateRecorder) {
		t.Helper()
		var model, mode string
		rec.mu.Lock()
		for _, u := range rec.got {
			switch u.Type {
			case "model_change":
				model = u.ModelID
				if len(u.Models) == 0 {
					t.Error("the model change lists no models: the picker stays empty")
				}
			case "mode_change":
				mode = u.ModeID
				if len(u.Modes) == 0 {
					t.Error("the mode change lists no modes: the Mode picker stays hidden")
				}
			}
		}
		rec.mu.Unlock()
		if model != "haiku" || mode != "plan" {
			t.Errorf("the UI was last told %q / %q, want haiku / plan", model, mode)
		}
	}

	t.Run("the load before a prompt", func(t *testing.T) {
		rec := &updateRecorder{}
		c := &loadingConn{result: loadedOnDefaults}
		m := startLoading(t, c, ManagerConfig{OnUpdate: rec.add, Picks: picked()})
		if err := m.Prompt(context.Background(), "s-old", "hi", nil); err != nil {
			t.Fatal(err)
		}
		if got := c.noted(); got != "load:s-old model:haiku mode:plan prompt:hi" {
			t.Errorf("engine calls = %q, want the model and mode put back before the prompt", got)
		}
		expectState(t, m, "s-old")
		expectShown(t, rec)
	})
	t.Run("a reopen", func(t *testing.T) {
		c := &loadingConn{result: loadedOnDefaults}
		m := startLoading(t, c, ManagerConfig{Picks: picked()})
		if err := m.LoadSession(context.Background(), "s-old", "/mirror", SessionWorkspace{}); err != nil {
			t.Fatal(err)
		}
		if got := c.noted(); got != "load:s-old model:haiku mode:plan" {
			t.Errorf("engine calls = %q", got)
		}
		expectState(t, m, "s-old")
	})
	t.Run("the resume after a crash", func(t *testing.T) {
		rec := &updateRecorder{}
		c := &loadingConn{result: loadedOnDefaults}
		m := startLoading(t, c, ManagerConfig{OnUpdate: rec.add, Picks: picked()})
		if _, err := m.NewSession(context.Background(), "/mirror", SessionWorkspace{}); err != nil {
			t.Fatal(err)
		}
		m.resumeSessions()
		if got := c.noted(); got != "load:s1 model:haiku mode:plan" {
			t.Errorf("engine calls = %q", got)
		}
		expectState(t, m, "s1")
		expectShown(t, rec)
	})
	t.Run("after an agent restart", func(t *testing.T) {
		dir := t.TempDir()
		file := pickFile{dir: func() (string, error) { return dir, nil }}
		before := startLoading(t, &loadingConn{}, ManagerConfig{Picks: file})
		ctx := context.Background()
		sid, err := before.NewSession(ctx, "/mirror", SessionWorkspace{})
		if err != nil {
			t.Fatal(err)
		}
		_ = before.SetModel(ctx, sid, "haiku")
		_ = before.SetMode(ctx, sid, "plan")
		_ = before.Stop()

		c := &loadingConn{result: loadedOnDefaults}
		after := startLoading(t, c, ManagerConfig{Picks: file})
		if err := after.Prompt(ctx, sid, "hi", nil); err != nil {
			t.Fatal(err)
		}
		if got := c.noted(); got != "load:s1 model:haiku mode:plan prompt:hi" {
			t.Errorf("engine calls = %q, want the picks of the run before put back", got)
		}
	})
	t.Run("a model the engine no longer offers", func(t *testing.T) {
		c := &loadingConn{result: loadedOnDefaults}
		m := startLoading(t, c, ManagerConfig{Picks: &memPicks{picks: map[SessionID]SessionPick{"s-old": {Model: "opus-3"}}}})
		if err := m.Prompt(context.Background(), "s-old", "hi", nil); err != nil {
			t.Fatal(err)
		}
		if got := c.noted(); got != "load:s-old prompt:hi" {
			t.Errorf("engine calls = %q, want no model set", got)
		}
		if st := m.GetSessionState("s-old"); st.ModelID != "default" {
			t.Errorf("model = %q, want the one the chat runs on", st.ModelID)
		}
	})
}

// A new chat starts on a provider's model, not the engine's free default, until the user switches; then on the user's.
func TestANewChatStartsOnAPaidModelOrTheUsersLastSwitch(t *testing.T) {
	picks := &memPicks{}
	c := &loadingConn{}
	c.models = []AgentModel{{ID: "opencode/big-pickle"}, {ID: "anthropic/sonnet"}, {ID: "anthropic/haiku"}}
	c.modelID = "opencode/big-pickle"
	m := startLoading(t, c, ManagerConfig{Picks: picks, FreeModels: func() map[string]bool { return map[string]bool{"opencode/big-pickle": true} }})
	ctx := context.Background()

	sid, err := m.NewSession(ctx, "/mirror", SessionWorkspace{})
	if err != nil {
		t.Fatal(err)
	}
	if got := m.GetSessionState(sid).ModelID; got != "anthropic/sonnet" {
		t.Errorf("new chat on %q, want the first paid model", got)
	}
	// A load opens a chat on the engine's model: the chat's own pick puts it back, and a chat with no pick reads the engine's.
	if got := picks.Pick(sid).Model; got != "anthropic/sonnet" {
		t.Errorf("new chat's pick = %q, want the model it started on", got)
	}
	if got := m.GetSessionState("s-old").ModelID; got != "opencode/big-pickle" {
		t.Errorf("a chat the engine has not shown reads %q, want the engine's model", got)
	}
	// The UI re-selects the current model to refresh the list: not a switch.
	if err := m.SetModel(ctx, sid, "anthropic/sonnet"); err != nil {
		t.Fatal(err)
	}
	if got := picks.Pick(NewChatPick).Model; got != "" {
		t.Errorf("a re-select was kept for new chats: %q", got)
	}
	// A chat whose model was never reported: its re-select cannot be told from a switch.
	if err := m.SetModel(ctx, "s-unread", "opencode/big-pickle"); err != nil {
		t.Fatal(err)
	}
	if got := picks.Pick(NewChatPick).Model; got != "" {
		t.Errorf("a pick on a chat with no known model was kept for new chats: %q", got)
	}

	for _, picked := range []string{"anthropic/haiku", "opencode/big-pickle"} {
		if err := m.SetModel(ctx, sid, picked); err != nil {
			t.Fatal(err)
		}
		if _, err := m.NewSession(ctx, "/mirror", SessionWorkspace{}); err != nil {
			t.Fatal(err)
		}
		if got := m.GetSessionState(sid).ModelID; got != picked {
			t.Errorf("new chat on %q, want %q, the model the user switched to", got, picked)
		}
	}
	want := "model:anthropic/sonnet model:anthropic/sonnet model:anthropic/haiku model:anthropic/haiku model:opencode/big-pickle"
	if got := c.noted(); got != want {
		t.Errorf("engine calls = %q, want %q", got, want)
	}
}

// A hidden chat stays on the engine's model, so its turn bills no provider; it still tells which model a new chat starts on.
func TestAProbeStaysOnTheEnginesModelAndReportsANewChats(t *testing.T) {
	picks := &memPicks{}
	c := &loadingConn{}
	c.models = []AgentModel{{ID: "opencode/big-pickle"}, {ID: "anthropic/sonnet"}, {ID: "anthropic/haiku"}}
	c.modelID = "opencode/big-pickle"
	m := startLoading(t, c, ManagerConfig{Picks: picks, FreeModels: func() map[string]bool { return map[string]bool{"opencode/big-pickle": true} }})

	for _, picked := range []string{"", "anthropic/haiku"} {
		if picked != "" {
			picks.SavePick(NewChatPick, SessionPick{Model: picked})
		}
		sid, err := m.NewProbeSession(context.Background(), "/mirror")
		if err != nil {
			t.Fatal(err)
		}
		st := m.GetSessionState(sid)
		if st.ModelID != "opencode/big-pickle" {
			t.Errorf("probe on %q, want the engine's own model", st.ModelID)
		}
		want := picked
		if want == "" {
			want = "anthropic/sonnet"
		}
		if got := m.NewChatModel(st.Models, st.ModelID); got != want {
			t.Errorf("a new chat would start on %q, want %q", got, want)
		}
	}
	if got := c.noted(); got != "" {
		t.Errorf("engine calls = %q, want none: a probe switches no model", got)
	}
}

// A pick is what the user set, or what the engine switched to in a live chat; a load's own report is not one.
func TestTheModelAndModeAChatRunsOnAreKept(t *testing.T) {
	picks := &memPicks{}
	c := &loadingConn{result: loadedOnDefaults}
	m := startLoading(t, c, ManagerConfig{Picks: picks})
	ctx := context.Background()
	sid, err := m.NewSession(ctx, "/mirror", SessionWorkspace{})
	if err != nil {
		t.Fatal(err)
	}
	if err := m.SetModel(ctx, sid, "haiku"); err != nil {
		t.Fatal(err)
	}
	if err := m.SetMode(ctx, sid, "plan"); err != nil {
		t.Fatal(err)
	}
	if got := picks.Pick(sid); got != (SessionPick{Model: "haiku", Mode: "plan"}) {
		t.Errorf("kept %+v after the picks", got)
	}
	m.HandleUpdate(sid, Update{Type: "mode_change", ModeID: "default"}) // a plan approved
	if got := picks.Pick(sid); got.Mode != "default" {
		t.Errorf("kept mode %q, want the one the engine switched to", got.Mode)
	}

	c.replay = []Update{{Type: "model_change", ModelID: "sonnet"}}
	if err := m.LoadSession(ctx, "s-other", "/mirror", SessionWorkspace{}); err != nil {
		t.Fatal(err)
	}
	if got := picks.Pick("s-other"); got.Model != "" {
		t.Errorf("a load's report was kept as a pick: %+v", got)
	}

	if err := m.DeleteSession(ctx, sid); err != nil {
		t.Fatal(err)
	}
	if got := picks.Pick(sid); got != (SessionPick{}) {
		t.Errorf("a deleted chat kept its pick: %+v", got)
	}
}

// startCrashingOnce starts a manager on c whose engine exits 0.3 s after its first start; exited fires as the restart begins its delay.
func startCrashingOnce(t *testing.T, c *loadingConn, delay time.Duration) (m *Manager, exited func()) {
	t.Helper()
	marker := t.TempDir() + "/crashed"
	ag := New(Config{Locator: StaticLocator{NodePath: "/bin/sh", AdapterEntry: "-c", ExtraArgs: []string{"if [ -e " + marker + " ]; then cat; else touch " + marker + "; sleep 0.3; exit 1; fi"}}})
	restarting := make(chan struct{}, 1)
	m = NewManager(ag, func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
		c.handler = h
		return c, nil
	}, ManagerConfig{
		RestartDelay: delay,
		SessionScope: func(SessionID) (string, SessionWorkspace, error) { return "/mirror", SessionWorkspace{}, nil },
		OnRestart: func(info RestartInfo) {
			if !info.Resumed && !info.GaveUp {
				select {
				case restarting <- struct{}{}:
				default:
				}
			}
		},
	})
	if err := m.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = m.Stop() })
	return m, func() {
		t.Helper()
		select {
		case <-restarting:
		case <-time.After(3 * time.Second):
			t.Fatal("the engine never exited")
		}
	}
}

// A prompt sent while the engine restarts after a crash waits for it, and is answered by the engine that comes back.
func TestAPromptDuringARestartWaitsForTheEngine(t *testing.T) {
	c := &loadingConn{}
	m, exited := startCrashingOnce(t, c, 200*time.Millisecond)
	ctx := context.Background()
	sid, err := m.NewSession(ctx, "/mirror", SessionWorkspace{})
	if err != nil {
		t.Fatal(err)
	}
	exited()
	if s := m.entry(sid); s == nil || s.loaded {
		t.Error("the chat still reads as loaded by the engine that exited")
	}
	if err := m.Prompt(ctx, sid, "hello", nil); err != nil {
		t.Fatalf("a prompt during the restart failed: %v", err)
	}
	if got := c.noted(); got != "load:s1 prompt:hello" {
		t.Errorf("engine calls = %q, want the resume's load, then the prompt", got)
	}
}

// A new chat's first prompt opens it, and a reopen loads it: during a crash restart both wait for the engine, as a prompt does.
func TestANewChatAndAReopenDuringARestartWaitForTheEngine(t *testing.T) {
	c := &loadingConn{}
	m, exited := startCrashingOnce(t, c, 200*time.Millisecond)
	ctx := context.Background()
	exited()
	opened, reopened := make(chan error, 1), make(chan error, 1)
	go func() {
		_, err := m.NewSession(ctx, "/mirror", SessionWorkspace{})
		opened <- err
	}()
	go func() { reopened <- m.LoadSession(ctx, "s-old", "/mirror", SessionWorkspace{}) }()
	if err := within(t, opened, "the new chat"); err != nil {
		t.Errorf("new chat during the restart: %v", err)
	}
	if err := within(t, reopened, "the reopen"); err != nil {
		t.Errorf("reopen during the restart: %v", err)
	}
	if got := c.noted(); got != "load:s-old" {
		t.Errorf("engine calls = %q, want the reopen's load on the engine that came back", got)
	}
}

// A Stop while a prompt waits for a crash restart ends it at once, and the Stop itself reports no error.
func TestAStopDuringARestartEndsThePromptWithoutAnError(t *testing.T) {
	c := &loadingConn{}
	m, exited := startCrashingOnce(t, c, 800*time.Millisecond)
	ctx := context.Background()
	sid, err := m.NewSession(ctx, "/mirror", SessionWorkspace{})
	if err != nil {
		t.Fatal(err)
	}
	exited()
	prompted := promptAsync(m, sid, "hello")
	for deadline := time.Now().Add(2 * time.Second); ; time.Sleep(5 * time.Millisecond) {
		m.mu.Lock()
		waiting := m.unsent[sid] != nil
		m.mu.Unlock()
		if waiting {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the prompt never started")
		}
	}
	if err := m.Cancel(ctx, sid); err != nil {
		t.Errorf("the Stop failed: %v", err)
	}
	if err := within(t, prompted, "the stopped prompt"); err != nil {
		t.Errorf("prompt: %v", err)
	}
	if !m.TurnStopped(sid) || strings.Contains(c.noted(), "prompt:") {
		t.Errorf("stopped %v, engine calls %q: want a stopped prompt that never reached the engine", m.TurnStopped(sid), c.noted())
	}
}

// A chat with no cwd has nothing to load it with: the resume leaves it alone instead of loading it with an empty cwd.
func TestTheResumeSkipsAChatItCannotLoad(t *testing.T) {
	c := &loadingConn{}
	m := startLoading(t, c, ManagerConfig{})
	m.mu.Lock()
	m.session("s-shell").stopped = true // what a prompt stopped before its chat was ever loaded leaves
	m.mu.Unlock()
	m.resumeSessions()
	if got := c.noted(); got != "" {
		t.Errorf("engine calls = %q, want none", got)
	}
}

// The history a load replays fills the log in order: a prompt stopped during that load is left out of it, not put inside it.
func TestAPromptStoppedDuringTheLoadIsNotLoggedIntoTheHistory(t *testing.T) {
	rec := &updateRecorder{}
	c := &loadingConn{hold: true}
	c.replay = []Update{{Type: "user_message", Delta: "old q"}, {Type: "message_chunk", Delta: "old a"}}
	m := startLoading(t, c, ManagerConfig{OnUpdate: rec.add})
	ctx := context.Background()
	prompted := promptAsync(m, "s-old", "hello")
	<-c.entered
	_ = m.Cancel(ctx, "s-old")
	if err := within(t, prompted, "the stopped prompt"); err != nil {
		t.Fatal(err)
	}
	c.open()
	for deadline := time.Now().Add(2 * time.Second); !m.loadedNow("s-old"); time.Sleep(5 * time.Millisecond) {
		if time.Now().After(deadline) {
			t.Fatal("the load never ended")
		}
	}
	from := rec.len()
	if err := m.LoadSession(ctx, "s-old", "/mirror", SessionWorkspace{}); err != nil {
		t.Fatal(err)
	}
	if got := joined(rec.since(from)); got != "replay_start | user_message:old q | message_chunk:old a" {
		t.Errorf("the reopen replayed %q, want the history alone", got)
	}
}

// A Stop that lands after the prompt's last wait, as its turn starts, still ends it: the check and the turn's start are one step.
func TestAStopAsTheTurnStartsEndsThePrompt(t *testing.T) {
	c := &loadingConn{}
	m := startLoading(t, c, ManagerConfig{})
	ctx := context.Background()
	sid, err := m.NewSession(ctx, "/mirror", SessionWorkspace{})
	if err != nil {
		t.Fatal(err)
	}
	beforeTurnStarts = func() { _ = m.Cancel(ctx, sid) }
	t.Cleanup(func() { beforeTurnStarts = func() {} })
	if err := m.Prompt(ctx, sid, "hello", nil); err != nil {
		t.Fatal(err)
	}
	if !m.TurnStopped(sid) || strings.Contains(c.noted(), "prompt:") {
		t.Errorf("stopped %v, engine calls %q: want a stopped prompt that never reached the engine", m.TurnStopped(sid), c.noted())
	}
}

// When the restart gives up, a prompt waiting for it fails as with no engine at all.
func TestAPromptWaitingForARestartThatGivesUpFails(t *testing.T) {
	ag := New(Config{Locator: StaticLocator{NodePath: "/bin/sh", AdapterEntry: "-c", ExtraArgs: []string{"sleep 0.3; exit 1"}}})
	launches := 0
	exited := make(chan struct{}, 1)
	m := NewManager(ag, func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
		if launches++; launches > 1 {
			return nil, errors.New("cannot come back")
		}
		return &fakeConn{handler: h}, nil
	}, ManagerConfig{
		MaxRestarts:  1,
		RestartDelay: 100 * time.Millisecond,
		OnRestart: func(info RestartInfo) {
			if !info.GaveUp {
				select {
				case exited <- struct{}{}:
				default:
				}
			}
		},
	})
	ctx := context.Background()
	if err := m.Start(ctx); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = m.Stop() })
	sid, _ := m.NewSession(ctx, "/mirror", SessionWorkspace{})
	<-exited
	start := time.Now()
	err := m.Prompt(ctx, sid, "hello", nil)
	if err == nil || !strings.Contains(err.Error(), "agent not started") {
		t.Errorf("error = %v, want agent not started", err)
	}
	if waited := time.Since(start); waited > 5*time.Second {
		t.Errorf("the prompt waited %s after the restart gave up", waited)
	}
}

// OpenCode answers a chat its store lost as it answers any failure of that store: the engine's own list tells the two apart.
func TestAChatOpenCodeLostReadsAsGone(t *testing.T) {
	lost := engineError(-32603, "Internal error: OpenCode service failure", map[string]any{"service": "session"})
	for name, c := range map[string]struct {
		listed  []SessionSummary
		listErr error
		kind    string
	}{
		"not in the engine's list": {nil, nil, "session_gone"},
		"still in it":              {[]SessionSummary{{ID: "s-old"}}, nil, "session_load_failed"},
		"a list that fails":        {nil, errors.New("database is locked"), "session_load_failed"},
	} {
		t.Run(name, func(t *testing.T) {
			conn := &loadingConn{loadErrs: []error{lost}, listed: c.listed, listErr: c.listErr}
			m := startLoading(t, conn, ManagerConfig{})
			err := m.Prompt(context.Background(), "s-old", "hello", nil)
			if err == nil || !strings.Contains(err.Error(), `"errorKind":"`+c.kind+`"`) {
				t.Errorf("error = %v, want errorKind %s", err, c.kind)
			}
		})
	}
}

// A Stop while the engine's list is read after a failed load ends the prompt at once, as a Stop during the load does.
func TestAStopDuringTheListCheckEndsThePrompt(t *testing.T) {
	lost := engineError(-32603, "Internal error: OpenCode service failure", map[string]any{"service": "session"})
	conn := &loadingConn{loadErrs: []error{lost}, listHang: true, listing: make(chan struct{}, 1)}
	m := startLoading(t, conn, ManagerConfig{})
	prompted := promptAsync(m, "s-old", "hello")
	<-conn.listing
	if err := m.Cancel(context.Background(), "s-old"); err != nil {
		t.Fatal(err)
	}
	if err := within(t, prompted, "the stopped prompt"); err != nil {
		t.Errorf("error = %v, want a stopped prompt", err)
	}
	if !m.TurnStopped("s-old") {
		t.Error("the prompt does not read as stopped")
	}
}

// earlyCancelConn gets a Stop in its turn stopIn before the run starts; the engine takes it (honours) or drops it, as OpenCode does, and runs.
type earlyCancelConn struct {
	fakeConn
	stopIn    int32
	honours   bool
	turns     atomic.Int32
	sent      chan struct{}
	cancelled chan struct{}
	atUsage   atomic.Int32 // the cancels sent once the run's first update, a usage one, was handled
}

func newEarlyCancelConn(stopIn int32, honours bool) *earlyCancelConn {
	return &earlyCancelConn{stopIn: stopIn, honours: honours, sent: make(chan struct{}, 1), cancelled: make(chan struct{}, 4)}
}

func (c *earlyCancelConn) Prompt(_ context.Context, sid SessionID, _ string, _ []string) (bool, error) {
	if c.turns.Add(1) != c.stopIn {
		c.handler.HandleUpdate(sid, Update{Type: "message_chunk", Delta: "a reply"})
		return false, nil
	}
	c.sent <- struct{}{} // the Stop comes now, before the run starts
	<-c.cancelled
	if c.honours {
		return true, nil
	}
	c.handler.HandleUpdate(sid, Update{Type: "usage", UsedTokens: 10, ContextSize: 100})
	c.atUsage.Store(c.cancels.Load())
	c.handler.HandleUpdate(sid, Update{Type: "thinking", Delta: "Let me write a story"})
	select {
	case <-c.cancelled: // a cancel sent again goes out while the update above is handled
		return true, nil
	case <-time.After(200 * time.Millisecond):
		return false, nil // the turn ran to its end
	}
}

func (c *earlyCancelConn) Cancel(context.Context, SessionID) error {
	c.cancels.Add(1)
	c.cancelled <- struct{}{}
	return nil
}

func startEarlyCancel(t *testing.T, c *earlyCancelConn, d Dialect) (*Manager, SessionID) {
	t.Helper()
	m := NewManager(stayAlive(), func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
		c.handler = h
		return c, nil
	}, ManagerConfig{Dialect: d})
	if err := m.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = m.Stop() })
	sid, err := m.NewSession(context.Background(), "/mirror", SessionWorkspace{})
	if err != nil {
		t.Fatal(err)
	}
	return m, sid
}

// logBuffer holds what the default logger writes during a test.
type logBuffer struct {
	mu sync.Mutex
	b  strings.Builder
}

func (l *logBuffer) Write(p []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.b.Write(p)
}

func (l *logBuffer) String() string {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.b.String()
}

func captureLog(t *testing.T) *logBuffer {
	t.Helper()
	l, old := &logBuffer{}, slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(l, nil)))
	t.Cleanup(func() { slog.SetDefault(old) })
	return l
}

// stopEarly sends a prompt and stops it before the engine runs it.
func stopEarly(t *testing.T, m *Manager, c *earlyCancelConn, sid SessionID) {
	t.Helper()
	prompted := promptAsync(m, sid, "write a story")
	<-c.sent
	if err := m.Cancel(context.Background(), sid); err != nil {
		t.Fatal(err)
	}
	if err := within(t, prompted, "the stopped turn"); err != nil {
		t.Fatal(err)
	}
}

// OpenCode drops a Stop that lands before it took the prompt: App Lab cancels again once the turn shows it runs, in any turn of the chat.
func TestAStopBeforeTheEngineTookThePromptIsSentAgain(t *testing.T) {
	for name, turn := range map[string]int32{"first turn": 1, "later turn": 2} {
		t.Run(name, func(t *testing.T) {
			c := newEarlyCancelConn(turn, false)
			m, sid := startEarlyCancel(t, c, openCodeDialect)
			logged := captureLog(t)
			for range turn - 1 {
				if err := m.Prompt(context.Background(), sid, "hello", nil); err != nil {
					t.Fatal(err)
				}
			}
			stopEarly(t, m, c, sid)
			if n := c.cancels.Load(); n != 2 || !m.TurnStopped(sid) {
				t.Errorf("cancels sent %d, stopped %v: want the cancel sent again and the turn stopped", n, m.TurnStopped(sid))
			}
			if n := c.atUsage.Load(); n != 1 {
				t.Errorf("cancels sent %d after a usage update, want 1: a usage update shows no run", n)
			}
			if n := strings.Count(logged.String(), "Stop sent again"); n != 1 {
				t.Errorf("dev-log lines about the second cancel: %d, want 1", n)
			}
		})
	}
}

// An early Stop the engine took leaves nothing behind: the next turn is not cancelled, even when a late update of the stopped turn comes in between.
func TestAnEarlyStopTheEngineTookDoesNotCancelTheNextTurn(t *testing.T) {
	for name, late := range map[string]bool{"no late update": false, "a late update": true} {
		t.Run(name, func(t *testing.T) {
			c := newEarlyCancelConn(1, true)
			m, sid := startEarlyCancel(t, c, openCodeDialect)
			stopEarly(t, m, c, sid)
			if late {
				c.handler.HandleUpdate(sid, Update{Type: "message_chunk", Delta: "late"})
			}
			if err := m.Prompt(context.Background(), sid, "two", nil); err != nil {
				t.Fatal(err)
			}
			if n := c.cancels.Load(); n != 1 || m.TurnStopped(sid) {
				t.Errorf("cancels sent %d, stopped %v: want the second turn left alone", n, m.TurnStopped(sid))
			}
		})
	}
}

// Claude takes a Stop whenever it comes, so it is never sent again.
func TestClaudeGetsAnEarlyStopOnce(t *testing.T) {
	c := newEarlyCancelConn(1, false)
	m, sid := startEarlyCancel(t, c, claudeDialect)
	stopEarly(t, m, c, sid)
	if n := c.cancels.Load(); n != 1 {
		t.Errorf("cancels sent %d, want 1", n)
	}
}

// A chat the running engine does not hold takes a pick without an engine call, which would fail; the load before its next prompt applies it.
func TestAPickForAChatTheEngineDoesNotHoldWaitsForItsLoad(t *testing.T) {
	picks := &memPicks{}
	c := &loadingConn{result: loadedOnDefaults}
	c.fakeConn.models, c.fakeConn.modes = loadedOnDefaults.Models, loadedOnDefaults.Modes
	m := startLoading(t, c, ManagerConfig{Picks: picks})
	ctx := context.Background()
	if _, err := m.NewSession(ctx, "/mirror", SessionWorkspace{}); err != nil { // the engine's lists come with it
		t.Fatal(err)
	}
	if err := m.SetModel(ctx, "s-old", "haiku"); err != nil {
		t.Fatalf("set model: %v", err)
	}
	if err := m.SetMode(ctx, "s-old", "plan"); err != nil {
		t.Fatalf("set mode: %v", err)
	}
	if got := c.noted(); got != "" {
		t.Errorf("engine calls = %q, want none for a chat the engine does not hold", got)
	}
	if st := m.GetSessionState("s-old"); st.ModelID != "haiku" || st.ModeID != "plan" || len(st.Modes) == 0 {
		t.Errorf("state = %s / %s with %d modes, want haiku / plan and the engine's modes", st.ModelID, st.ModeID, len(st.Modes))
	}
	if err := m.Prompt(ctx, "s-old", "hi", nil); err != nil {
		t.Fatal(err)
	}
	if got := c.noted(); got != "load:s-old model:haiku mode:plan prompt:hi" {
		t.Errorf("engine calls = %q, want the picks applied by the load, before the prompt", got)
	}
}

// A chat the running engine has not shown yet still reads with the engine's lists, so the UI does not lose its pickers.
func TestAChatTheEngineHasNotShownReadsWithTheEnginesLists(t *testing.T) {
	c := &loadingConn{}
	m := startLoading(t, c, ManagerConfig{Picks: &memPicks{picks: map[SessionID]SessionPick{"s-old": {Model: "gone-model", Mode: "plan"}}}})
	if st := m.GetSessionState("s-old"); len(st.Modes) != 0 || st.ModeID != "" {
		t.Errorf("before the engine listed anything: %+v, want no lists and no ids", st)
	}
	c.fakeConn.models = loadedOnDefaults.Models
	c.fakeConn.modes = loadedOnDefaults.Modes
	if _, err := m.NewSession(context.Background(), "/mirror", SessionWorkspace{}); err != nil {
		t.Fatal(err)
	}
	st := m.GetSessionState("s-old")
	if len(st.Models) != 2 || len(st.Modes) != 2 || st.ModeID != "plan" || st.ModelID != "" {
		t.Errorf("state = %+v, want the engine's lists, the stored mode, and no model the engine does not offer", st)
	}
}

// Before its first load a chat reads with the model and mode the load puts it on: its pick where the engine offers it, else the engine's default.
func TestAChatTheEngineHasNotShownReadsWithWhatItWillRunOn(t *testing.T) {
	picks := &memPicks{picks: map[SessionID]SessionPick{
		"s-both":  {Model: "haiku", Mode: "plan"},
		"s-model": {Model: "haiku"}, // the mode was never changed
		"s-gone":  {Model: "gone-model", Mode: "gone-mode"},
		"s-entry": {Mode: "plan"},
	}}
	c := &loadingConn{}
	c.fakeConn.models, c.fakeConn.modes = loadedOnDefaults.Models, loadedOnDefaults.Modes
	c.fakeConn.modelID, c.fakeConn.modeID = "default", "default"
	m := startLoading(t, c, ManagerConfig{Picks: picks})
	if _, err := m.NewSession(context.Background(), "/mirror", SessionWorkspace{}); err != nil {
		t.Fatal(err)
	}
	m.mu.Lock()
	m.session("s-entry").modelID = "haiku" // as a pick leaves a chat whose prompt was stopped before its first load
	m.mu.Unlock()
	for sid, want := range map[SessionID]string{
		"s-both": "haiku / plan", "s-model": "haiku / default", "s-gone": "default / default", "s-none": "default / default", "s-entry": "haiku / plan",
	} {
		if st := m.GetSessionState(sid); st.ModelID+" / "+st.ModeID != want {
			t.Errorf("%s reads %s / %s, want %s", sid, st.ModelID, st.ModeID, want)
		}
	}
}

// The Claude CLI that held a chat can write one more line after its delete: the chat is deleted once more, later.
func TestADeletedChatIsDeletedAgainForWhatItsCLIWroteAfter(t *testing.T) {
	c := &loadingConn{}
	m := startLoading(t, c, ManagerConfig{})
	m.stubDelay = 20 * time.Millisecond
	ctx := context.Background()
	sid, err := m.NewSession(ctx, "/mirror", SessionWorkspace{})
	if err != nil {
		t.Fatal(err)
	}
	if err := m.DeleteSession(ctx, sid); err != nil {
		t.Fatal(err)
	}
	if err := m.DeleteSession(ctx, "s-never-loaded"); err != nil {
		t.Fatal(err)
	}
	for deadline := time.Now().Add(2 * time.Second); c.deletes.Load() < 3 && time.Now().Before(deadline); {
		time.Sleep(5 * time.Millisecond)
	}
	time.Sleep(50 * time.Millisecond)
	if n := c.deletes.Load(); n != 3 {
		t.Errorf("deletes sent %d, want 3: the loaded chat twice, the other once", n)
	}
}

// The second delete belongs to the manager's life: a manager stopped before it sends none.
func TestAManagerStoppedAfterADeleteSendsNoSecondDelete(t *testing.T) {
	c := &loadingConn{}
	m := startLoading(t, c, ManagerConfig{})
	m.stubDelay = 50 * time.Millisecond
	ctx := context.Background()
	sid, err := m.NewSession(ctx, "/mirror", SessionWorkspace{})
	if err != nil {
		t.Fatal(err)
	}
	if err := m.DeleteSession(ctx, sid); err != nil {
		t.Fatal(err)
	}
	_ = m.Stop()
	time.Sleep(150 * time.Millisecond)
	if n := c.deletes.Load(); n != 1 {
		t.Errorf("deletes sent %d, want 1 after the manager stopped", n)
	}
}

// A prompt stopped before it was sent keeps its text and its stopped mark for a reopen, as a stopped turn does.
func TestAPromptStoppedBeforeItWasSentIsReplayedStopped(t *testing.T) {
	rec := &updateRecorder{}
	c := &loadingConn{}
	m := startLoading(t, c, ManagerConfig{OnUpdate: rec.add})
	ctx := context.Background()
	sid, err := m.NewSession(ctx, "/mirror", SessionWorkspace{})
	if err != nil {
		t.Fatal(err)
	}
	beforeTurnStarts = func() { _ = m.Cancel(ctx, sid) }
	t.Cleanup(func() { beforeTurnStarts = func() {} })
	if err := m.Prompt(ctx, sid, "hello", nil); err != nil {
		t.Fatal(err)
	}
	from := rec.len()
	if err := m.LoadSession(ctx, sid, "/mirror", SessionWorkspace{}); err != nil {
		t.Fatal(err)
	}
	if got := joined(rec.since(from)); got != "replay_start | user_message:hello | turn_stopped" {
		t.Errorf("the reopen replayed %q, want the prompt and its stopped mark", got)
	}
}

// A pick during a load of the chat waits for the load, then goes to the engine that holds the chat now.
func TestAPickDuringALoadWaitsForIt(t *testing.T) {
	c := &loadingConn{hold: true}
	m := startLoading(t, c, ManagerConfig{Picks: &memPicks{}})
	ctx := context.Background()
	loaded := make(chan error, 1)
	go func() { loaded <- m.LoadSession(ctx, "s-old", "/mirror", SessionWorkspace{}) }()
	<-c.entered
	picked := make(chan error, 1)
	go func() { picked <- m.SetModel(ctx, "s-old", "haiku") }()
	select {
	case err := <-picked:
		t.Fatalf("the pick returned during the load (%v)", err)
	case <-time.After(100 * time.Millisecond):
	}
	c.open()
	if err := within(t, loaded, "the load"); err != nil {
		t.Fatal(err)
	}
	if err := within(t, picked, "the pick"); err != nil {
		t.Fatal(err)
	}
	if got := c.noted(); got != "load:s-old model:haiku" {
		t.Errorf("engine calls = %q, want the pick sent after the load", got)
	}
}

// A pick during a crash restart waits for the engine that comes back, and for its resume of the chat.
func TestAPickDuringARestartWaitsForTheEngine(t *testing.T) {
	c := &loadingConn{}
	m, exited := startCrashingOnce(t, c, 200*time.Millisecond)
	ctx := context.Background()
	sid, err := m.NewSession(ctx, "/mirror", SessionWorkspace{})
	if err != nil {
		t.Fatal(err)
	}
	exited()
	if err := m.SetMode(ctx, sid, "plan"); err != nil {
		t.Fatalf("a pick during the restart failed: %v", err)
	}
	if got := c.noted(); got != "load:s1 mode:plan" {
		t.Errorf("engine calls = %q, want the resume's load, then the pick", got)
	}
}

// A pick for a chat the engine no longer holds shows at once in the chat's state, though only its next load applies it.
func TestAPickForAChatTheEngineNoLongerHoldsShowsAtOnce(t *testing.T) {
	c := &loadingConn{}
	c.fakeConn.models, c.fakeConn.modes = loadedOnDefaults.Models, loadedOnDefaults.Modes
	m := startLoading(t, c, ManagerConfig{Picks: &memPicks{}})
	ctx := context.Background()
	sid, err := m.NewSession(ctx, "/mirror", SessionWorkspace{})
	if err != nil {
		t.Fatal(err)
	}
	m.mu.Lock()
	m.sessions[sid].loaded = false // as a crash leaves it until the resume
	m.mu.Unlock()
	if err := m.SetModel(ctx, sid, "haiku"); err != nil {
		t.Fatal(err)
	}
	if err := m.SetMode(ctx, sid, "plan"); err != nil {
		t.Fatal(err)
	}
	if st := m.GetSessionState(sid); st.ModelID != "haiku" || st.ModeID != "plan" {
		t.Errorf("state = %s / %s, want haiku / plan", st.ModelID, st.ModeID)
	}
	if got := c.noted(); got != "" {
		t.Errorf("engine calls = %q, want none for a chat the engine does not hold", got)
	}
}

// A Stop that lands while the host's own work runs between the hold and the prompt ends the prompt unsent, on an engine that would drop it.
func TestAStopAfterThePromptWasHeldEndsItUnsent(t *testing.T) {
	c := &loadingConn{}
	m := startLoading(t, c, ManagerConfig{Dialect: openCodeDialect})
	ctx := context.Background()
	sid, err := m.NewSession(ctx, "/mirror", SessionWorkspace{})
	if err != nil {
		t.Fatal(err)
	}
	hold := m.HoldPrompt(sid)
	if err := m.Cancel(ctx, sid); err != nil {
		t.Fatal(err)
	}
	if err := hold.Prompt(ctx, "write a story", nil); err != nil {
		t.Fatal(err)
	}
	hold.Release()
	if !m.TurnStopped(sid) || strings.Contains(c.noted(), "prompt:") {
		t.Errorf("stopped %v, engine calls %q: want a stopped prompt that never reached the engine", m.TurnStopped(sid), c.noted())
	}
}

// A Stop that came before the prompt was held belongs to an earlier turn: the held prompt runs.
func TestAStopBeforeThePromptWasHeldLeavesItAlone(t *testing.T) {
	c := &loadingConn{}
	m := startLoading(t, c, ManagerConfig{Dialect: openCodeDialect})
	ctx := context.Background()
	sid, err := m.NewSession(ctx, "/mirror", SessionWorkspace{})
	if err != nil {
		t.Fatal(err)
	}
	if err := m.Cancel(ctx, sid); err != nil {
		t.Fatal(err)
	}
	hold := m.HoldPrompt(sid)
	defer hold.Release()
	if err := hold.Prompt(ctx, "next", nil); err != nil {
		t.Fatal(err)
	}
	if m.TurnStopped(sid) || !strings.Contains(c.noted(), "prompt:next") {
		t.Errorf("stopped %v, engine calls %q: want the prompt sent and run", m.TurnStopped(sid), c.noted())
	}
}
