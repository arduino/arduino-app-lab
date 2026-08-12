package agent

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"strconv"
	"sync"
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
	permInput     any // tool-call arguments carried on the permission request (nil → none)
}

func (f *fakeConn) Initialize(context.Context) ([]AuthMethod, error) { return f.methods, f.initErr }
func (f *fakeConn) Authenticate(_ context.Context, methodID string) error {
	f.authedWith = methodID
	return nil
}
func (f *fakeConn) NewSession(context.Context, string) (NewSessionResult, error) {
	return NewSessionResult{SessionID: "s1"}, nil
}
func (f *fakeConn) LoadSession(_ context.Context, sid SessionID, _ string) (NewSessionResult, error) {
	f.loaded = append(f.loaded, sid)
	return NewSessionResult{SessionID: sid}, nil
}
func (f *fakeConn) Cancel(context.Context, SessionID) error           { return nil }
func (f *fakeConn) CloseSession(context.Context, SessionID) error     { return nil }
func (f *fakeConn) DeleteSession(context.Context, SessionID) error    { return nil }
func (f *fakeConn) SetModel(context.Context, SessionID, string) error { return nil }
func (f *fakeConn) SetMode(context.Context, SessionID, string) error  { return nil }
func (f *fakeConn) SetMCPServers([]MCPServer)                         {}
func (f *fakeConn) SetBoardName(string)                               {}
func (f *fakeConn) ListSessions(context.Context, string) ([]SessionSummary, error) {
	return nil, nil
}
func (f *fakeConn) Close() error { return nil }

func (f *fakeConn) Prompt(ctx context.Context, sid SessionID, _ string) error {
	f.handler.HandleUpdate(sid, Update{Type: "message_chunk", Delta: "Hello "})
	f.handler.HandleUpdate(sid, Update{Type: "message_chunk", Delta: "world"})
	tc := &ToolCall{ID: "t1", Title: "List boards", Status: "pending", Input: f.permInput}
	f.handler.HandleUpdate(sid, Update{Type: "tool_call", ToolCall: tc})
	f.lastOutcome = f.handler.HandlePermission(ctx, PermissionRequest{
		ID: "p1", SessionID: sid, ToolCall: tc,
		Options:   []PermissionOption{{ID: "allow", Label: "Allow", Kind: "allow"}},
		TimeoutMs: f.permTimeoutMs,
	})
	f.handler.HandleUpdate(sid, Update{Type: "tool_call_update", ID: "t1", Status: "completed", Output: "2 boards"})
	return nil
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

	sid, err := m.NewSession(ctx, "/tmp")
	if err != nil {
		t.Fatalf("new session: %v", err)
	}
	if err := m.Prompt(ctx, sid, "hi"); err != nil {
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

	sid, _ := m.NewSession(ctx, "/tmp")
	if err := m.Prompt(ctx, sid, "hi"); err != nil {
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
	sid, err := m.NewSession(ctx, "/tmp")
	if err != nil {
		t.Fatalf("new session: %v", err)
	}
	m.resumeSessions()
	if len(fc.loaded) != 1 || fc.loaded[0] != sid {
		t.Fatalf("expected resumeSessions to LoadSession %q, got %v", sid, fc.loaded)
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
	sid, err := m.NewSession(ctx, "/tmp")
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

	if err := m.Prompt(ctx, sid, "hi"); err != nil {
		t.Fatalf("prompt: %v", err)
	}
	<-done
}
