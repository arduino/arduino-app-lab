package agent

import (
	"context"
	"errors"
	"io"
	"strings"
	"sync"
	"testing"
	"time"

	acp "github.com/coder/acp-go-sdk"
)

func alwaysAndOnceOptions() []acp.PermissionOption {
	return []acp.PermissionOption{
		{OptionId: "allow_once", Name: "Allow", Kind: acp.PermissionOptionKind("allow_once")},
		{OptionId: "allow_always", Name: "Allow always", Kind: acp.PermissionOptionKind("allow_always")},
		{OptionId: "reject_once", Name: "Reject", Kind: acp.PermissionOptionKind("reject_once")},
	}
}

// board_exec runs an arbitrary board shell, and a persistent grant on it is keyed on the tool name alone with nothing in App Lab to revoke it — so that one prompt stays per-call.
func TestPerCallOptionsDropsPersistentGrantsForBoardExec(t *testing.T) {
	for _, title := range []string{"board_exec", "mcp__arduino-board__board_exec"} {
		req := toPermissionRequest(acp.RequestPermissionRequest{
			SessionId: "s1",
			ToolCall:  acp.ToolCallUpdate{ToolCallId: "t1", Title: &title},
			Options: append(alwaysAndOnceOptions(),
				acp.PermissionOption{OptionId: "yolo-always-allow", Name: "Sure", Kind: acp.PermissionOptionKind("allow_once")}, // persistence hidden in the id
			),
		})
		perCallOptions(&req)
		if len(req.Options) != 2 {
			t.Fatalf("%s: only the per-call options may survive, got %+v", title, req.Options)
		}
		for _, o := range req.Options {
			if isPersistentGrantOption(o.ID, o.Kind) {
				t.Errorf("%s: option %+v grants beyond this call and must not be offered", title, o)
			}
		}
	}
}

func TestIsPersistentGrantOption(t *testing.T) {
	cases := map[string]struct {
		id, kind string
		want     bool
	}{
		"allow once":        {"allow_once", "allow_once", false},
		"reject once":       {"reject_once", "reject_once", false},
		"allow always":      {"allow_always", "allow_always", true},
		"reject always":     {"reject_always", "reject_always", true},
		"always in the id":  {"ALLOW_ALWAYS", "", true},
		"kind only":         {"opt-7", "allow_always", true},
		"unrelated option":  {"cancel", "", false},
		"mixed-case suffix": {"x", "Allow_Always", true},
	}
	for name, c := range cases {
		if got := isPersistentGrantOption(c.id, c.kind); got != c.want {
			t.Errorf("%s: isPersistentGrantOption(%q, %q) = %v, want %v", name, c.id, c.kind, got, c.want)
		}
	}
}

// Modes arrive either as a top-level state or as a select; set_mode is the same call either way.
func TestModesReadFromTheConfigOptionWhenThereIsNoModeState(t *testing.T) {
	mode := acp.SessionConfigOptionCategoryMode
	opts := []acp.SessionConfigOption{{Select: &acp.SessionConfigOptionSelect{
		Id:           "mode",
		Category:     &mode,
		CurrentValue: "build",
		Options: acp.SessionConfigSelectOptions{Ungrouped: &acp.SessionConfigSelectOptionsUngrouped{
			{Value: "build", Name: "Build"},
			{Value: "plan", Name: "Plan"},
		}},
	}}}

	c := &sdkConn{modelCfg: map[SessionID]acp.SessionConfigId{}}
	res := c.sessionResult("s1", opts, nil) // nil: the engine advertised no mode state at all

	if res.CurrentModeID != "build" {
		t.Errorf("current mode = %q, want build", res.CurrentModeID)
	}
	if len(res.Modes) != 2 || res.Modes[0].ID != "build" || res.Modes[1].Name != "Plan" {
		t.Errorf("modes = %+v, want build and Plan", res.Modes)
	}
}

// The top-level state still wins where an engine sends one, so nothing changes for the engine that does.
func TestModeStateWinsOverTheConfigOption(t *testing.T) {
	mode := acp.SessionConfigOptionCategoryMode
	opts := []acp.SessionConfigOption{{Select: &acp.SessionConfigOptionSelect{
		Id: "mode", Category: &mode, CurrentValue: "from-option",
		Options: acp.SessionConfigSelectOptions{Ungrouped: &acp.SessionConfigSelectOptionsUngrouped{
			{Value: "from-option", Name: "From option"},
		}},
	}}}
	state := &acp.SessionModeState{
		CurrentModeId:  "from-state",
		AvailableModes: []acp.SessionMode{{Id: "from-state", Name: "From state"}},
	}

	c := &sdkConn{modelCfg: map[SessionID]acp.SessionConfigId{}}
	res := c.sessionResult("s1", opts, state)

	if res.CurrentModeID != "from-state" || len(res.Modes) != 1 {
		t.Errorf("mode state must win, got %q / %+v", res.CurrentModeID, res.Modes)
	}
}

// No request to an engine that never advertised delete, and the local bookkeeping survives to say so.
func TestDeleteSessionRefusedWhenNotAdvertised(t *testing.T) {
	c := &sdkConn{canDeleteSession: false, sessionWS: map[SessionID]string{"s1": "user:blink"}}
	if err := c.DeleteSession(context.Background(), "s1"); !errors.Is(err, ErrDeleteSessionUnsupported) {
		t.Fatalf("DeleteSession error = %v, want ErrDeleteSessionUnsupported", err)
	}
	if c.sessionWS["s1"] == "" {
		t.Error("nothing was attempted, so the session must still be known here")
	}
}

// Records the request the user would be shown, and answers nothing.
type permissionRecorder struct{ asked chan PermissionRequest }

func (h *permissionRecorder) HandleUpdate(SessionID, Update) {}
func (h *permissionRecorder) HandlePermission(_ context.Context, req PermissionRequest) PermissionOutcome {
	h.asked <- req
	return PermissionOutcome{Cancelled: true}
}
func (h *permissionRecorder) HandleElicitation(context.Context, SessionID, []ChoiceRequest) []ChoiceSubmission {
	return nil
}

func runningCall(callID string, input map[string]any) acp.SessionNotification {
	status := acp.ToolCallStatusInProgress
	return acp.SessionNotification{SessionId: "s1", Update: acp.SessionUpdate{ToolCallUpdate: &acp.SessionToolCallUpdate{
		ToolCallId: acp.ToolCallId(callID), Status: &status, RawInput: input,
	}}}
}

// OpenCode's shape: an MCP tool's permission request carries an empty input.
func bareAsk(callID, title string) acp.RequestPermissionRequest {
	return acp.RequestPermissionRequest{
		SessionId: "s1",
		ToolCall:  acp.ToolCallUpdate{ToolCallId: acp.ToolCallId(callID), Title: &title, RawInput: map[string]any{}},
		Options:   alwaysAndOnceOptions(),
	}
}

// Without the call's arguments the prompt shows no command and an "Always allow" has no app to be scoped to.
func TestAPermissionRequestGetsTheArgumentsItsCallAnnounced(t *testing.T) {
	ctx := context.Background()
	newConn := func(d Dialect) (*sdkConn, *permissionRecorder) {
		h := &permissionRecorder{asked: make(chan PermissionRequest, 1)}
		c := &sdkConn{dialect: d, handler: h}
		c.rememberSession("s1", "/mirror", SessionWorkspace{AppID: "dXNlcjpob21l"})
		return c, h
	}

	t.Run("announced before the request", func(t *testing.T) {
		c, h := newConn(openCodeDialect)
		_ = c.SessionUpdate(ctx, runningCall("call-1", map[string]any{"id": "dXNlcjpvdGhlcg"}))
		_, _ = c.RequestPermission(ctx, bareAsk("call-1", "arduino-board_apps_edit"))
		tc := (<-h.asked).ToolCall
		if id := tc.Input.(map[string]any)["id"]; id != "dXNlcjpvdGhlcg" {
			t.Errorf("the request names app %v, want the one the call announced", id)
		}
		if !tc.OutsideWorkspace {
			t.Error("an edit of another app was asked as if it stayed home")
		}
	})

	t.Run("announced while the request waits", func(t *testing.T) {
		c, h := newConn(openCodeDialect)
		go func() {
			time.Sleep(50 * time.Millisecond)
			_ = c.SessionUpdate(ctx, runningCall("call-2", map[string]any{"command": "ls /tmp"}))
		}()
		_, _ = c.RequestPermission(ctx, bareAsk("call-2", "arduino-board_board_exec"))
		if got := (<-h.asked).ToolCall.Input.(map[string]any)["command"]; got != "ls /tmp" {
			t.Errorf("the prompt shows command %v, want the one the call announced", got)
		}
	})

	t.Run("never announced", func(t *testing.T) {
		old := argumentsWait
		argumentsWait = 20 * time.Millisecond
		t.Cleanup(func() { argumentsWait = old })
		c, h := newConn(openCodeDialect)
		_, _ = c.RequestPermission(ctx, bareAsk("call-3", "arduino-board_board_exec"))
		if in := (<-h.asked).ToolCall.Input; hasArguments(in) {
			t.Errorf("input = %v, want the request's own empty one", in)
		}
	})

	t.Run("an engine that sends its arguments is not held", func(t *testing.T) {
		c, h := newConn(claudeDialect)
		start := time.Now()
		_, _ = c.RequestPermission(ctx, bareAsk("call-4", "mcp__arduino-board__wifi_disconnect"))
		<-h.asked
		if waited := time.Since(start); waited > argumentsWait/2 {
			t.Errorf("a Claude request waited %s for arguments it never lacks", waited)
		}
	})
}

// "Always allow" is offered only where the grant is as narrow as the call: what the user sees is what App Lab will answer for later.
func TestOnlyANarrowGrantIsOffered(t *testing.T) {
	old := argumentsWait
	argumentsWait = 20 * time.Millisecond // the cases with no announced arguments wait it out
	t.Cleanup(func() { argumentsWait = old })
	ctx := context.Background()
	offersAlways := func(d Dialect, announced map[string]any, ask acp.RequestPermissionRequest) bool {
		h := &permissionRecorder{asked: make(chan PermissionRequest, 1)}
		c := &sdkConn{dialect: d, handler: h}
		c.rememberSession("s1", "/mirror", SessionWorkspace{AppID: "dXNlcjpob21l"})
		if announced != nil {
			_ = c.SessionUpdate(ctx, runningCall(string(ask.ToolCall.ToolCallId), announced))
		}
		_, _ = c.RequestPermission(ctx, ask)
		for _, o := range (<-h.asked).Options {
			if isPersistentGrantOption(o.ID, o.Kind) {
				return true
			}
		}
		return false
	}
	doomLoop := bareAsk("call-3", "doom_loop")
	doomLoop.ToolCall.RawInput = map[string]any{"tool": "edit", "input": map[string]any{"filePath": "/mirror/a/x.py"}}

	for name, c := range map[string]struct {
		dialect   Dialect
		announced map[string]any
		ask       acp.RequestPermissionRequest
		want      bool
	}{
		"board_exec":                              {openCodeDialect, map[string]any{"command": "ls"}, bareAsk("call-1", "arduino-board_board_exec"), false},
		"doom_loop, whatever tool it repeats":     {openCodeDialect, nil, doomLoop, false},
		"an app tool whose call named its app":    {openCodeDialect, map[string]any{"id": "dXNlcjpob21l"}, bareAsk("call-4", "arduino-board_apps_start"), true},
		"a read whose call named its file":        {openCodeDialect, map[string]any{"filePath": "/mirror/a/.env"}, bareAsk("call-5", "read"), true},
		"a read with no file":                     {openCodeDialect, nil, bareAsk("call-6", "read"), false},
		"a mode switch, which names nothing else": {claudeDialect, nil, bareAsk("call-7", "switch_mode"), true},
		// Claude sends a call's own arguments, so {} is a call that has none; OpenCode's call announces them.
		"a board call that takes no arguments":       {claudeDialect, nil, bareAsk("call-8", "mcp__arduino-board__wifi_disconnect"), true},
		"a board call that announced no arguments":   {openCodeDialect, map[string]any{}, bareAsk("call-9", "arduino-board_wifi_disconnect"), true},
		"a board call whose arguments never arrived": {openCodeDialect, nil, bareAsk("call-10", "arduino-board_wifi_disconnect"), false},
	} {
		if got := offersAlways(c.dialect, c.announced, c.ask); got != c.want {
			t.Errorf("%s: offers Always allow = %v, want %v", name, got, c.want)
		}
	}
}

// enrichingHandler writes into the request's input as App Lab's OnPermission does for the card, then answers "Always allow".
type enrichingHandler struct{ asked int }

func (h *enrichingHandler) HandleUpdate(SessionID, Update) {}
func (h *enrichingHandler) HandlePermission(_ context.Context, req PermissionRequest) PermissionOutcome {
	h.asked++
	if in, ok := req.ToolCall.Input.(map[string]any); ok {
		in["_targetName"] = "Blink"
	}
	return PermissionOutcome{OptionID: "allow_always"}
}
func (h *enrichingHandler) HandleElicitation(context.Context, SessionID, []ChoiceRequest) []ChoiceSubmission {
	return nil
}

// The grant is keyed on the call as autoAllow reads it, before the host writes into its input.
func TestAGrantIsKeyedOnTheCallBeforeTheHostWritesIntoIt(t *testing.T) {
	h := &enrichingHandler{}
	c := &sdkConn{dialect: claudeDialect, handler: h}
	c.rememberSession("s1", "/mirror", SessionWorkspace{})
	ask := func() acp.RequestPermissionRequest {
		title := "mcp__arduino-board__models_delete"
		return acp.RequestPermissionRequest{
			SessionId: "s1",
			ToolCall:  acp.ToolCallUpdate{ToolCallId: "t1", Title: &title, RawInput: map[string]any{"id": "yolo"}},
			Options:   alwaysAndOnceOptions(),
		}
	}
	for i := 0; i < 2; i++ {
		if _, err := c.RequestPermission(context.Background(), ask()); err != nil {
			t.Fatal(err)
		}
	}
	if h.asked != 1 {
		t.Errorf("the user was asked %d times, want once: the second call is the one Always allow was given for", h.asked)
	}
}

// engineError is a JSON-RPC error as the SDK returns it from a request.
func engineError(code int, message string, data any) error {
	return &acp.RequestError{Code: code, Message: message, Data: data}
}

// What the engines answer a load with tells a chat that cannot come back from a failure worth trying again.
func TestALoadRefusalIsSortedByWhatTheEngineSaid(t *testing.T) {
	cases := map[string]struct {
		err  error
		want loadOutcome
	}{
		"Claude, no history":   {engineError(-32002, "Resource not found", map[string]any{"uri": "s1"}), chatGone},
		"OpenCode, no session": {engineError(-32602, "session not found: ses_1", map[string]any{"sessionId": "ses_1"}), chatGone},
		// What OpenCode 1.18.33 answers for a chat its store no longer has, and for any other failure of that store.
		"OpenCode, its store failed": {engineError(-32603, "Internal error: OpenCode service failure", map[string]any{"service": "session"}), chatMaybeGone},
		"OpenCode, another service":  {engineError(-32603, "Internal error: OpenCode service failure", map[string]any{"service": "directory"}), loadFailed},
		"other invalid params":       {engineError(-32602, "Invalid params", nil), loadFailed},
		"engine gone mid-load":       {engineError(-32603, "Internal error", map[string]any{"error": "peer disconnected before response"}), loadFailed},
		"auth required":              {engineError(-32000, "Authentication required", nil), authRefused},
		"login expired":              {engineError(-32603, "Internal error: Failed to authenticate", map[string]any{"errorKind": "authentication_failed"}), authRefused},
		"not from the engine":        {errors.New("context deadline exceeded"), loadFailed},
	}
	for name, c := range cases {
		if got := loadRefusal(c.err); got != c.want {
			t.Errorf("%s: outcome %v, want %v", name, got, c.want)
		}
	}
}

// An update with no rawInput at all did not bring the call's arguments, so the call is asked without "Always allow".
func TestACallAnnouncedWithoutItsInputOffersNoAlwaysAllow(t *testing.T) {
	ctx := context.Background()
	h := &permissionRecorder{asked: make(chan PermissionRequest, 1)}
	c := &sdkConn{dialect: openCodeDialect, handler: h}
	c.rememberSession("s1", "/mirror", SessionWorkspace{AppID: "dXNlcjpob21l"})
	status := acp.ToolCallStatusInProgress
	_ = c.SessionUpdate(ctx, acp.SessionNotification{SessionId: "s1", Update: acp.SessionUpdate{ToolCallUpdate: &acp.SessionToolCallUpdate{
		ToolCallId: "call-n", Status: &status,
	}}})
	_, _ = c.RequestPermission(ctx, bareAsk("call-n", "arduino-board_models_delete"))
	for _, o := range (<-h.asked).Options {
		if isPersistentGrantOption(o.ID, o.Kind) {
			t.Errorf("option %q offered for a call whose arguments are unknown", o.ID)
		}
	}
}

// updateCollector notes each update a connection hands on, as "type:delta".
type updateCollector struct {
	permissionRecorder
	mu  sync.Mutex
	got []string
}

func (u *updateCollector) HandleUpdate(_ SessionID, up Update) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.got = append(u.got, strings.TrimSuffix(up.Type+":"+up.Delta, ":"))
}

// joined waits, up to a second, for n updates, and returns them all.
func (u *updateCollector) joined(n int) string {
	for deadline := time.Now().Add(time.Second); ; time.Sleep(5 * time.Millisecond) {
		u.mu.Lock()
		got := strings.Join(u.got, " | ")
		count := len(u.got)
		u.mu.Unlock()
		if count >= n || time.Now().After(deadline) {
			return got
		}
	}
}

// replayAgent is an engine on the SDK's own pipes: its session/load sends the replay before its response, as the engines do.
type replayAgent struct {
	acp.Agent // nil: the tests call nothing else
	side      *acp.AgentSideConnection
	replay    []acp.SessionUpdate
}

func (a *replayAgent) LoadSession(ctx context.Context, p acp.LoadSessionRequest) (acp.LoadSessionResponse, error) {
	for _, u := range a.replay {
		if err := a.side.SessionUpdate(ctx, acp.SessionNotification{SessionId: p.SessionId, Update: u}); err != nil {
			return acp.LoadSessionResponse{}, err
		}
	}
	return acp.LoadSessionResponse{}, nil
}

func (a *replayAgent) send(t *testing.T, u acp.SessionUpdate) {
	t.Helper()
	if err := a.side.SessionUpdate(context.Background(), acp.SessionNotification{SessionId: "s1", Update: u}); err != nil {
		t.Fatal(err)
	}
}

// overPipes connects a real sdkConn to a.
func overPipes(t *testing.T, a *replayAgent, h ClientHandler) *sdkConn {
	t.Helper()
	clientIn, agentOut := io.Pipe()
	agentIn, clientOut := io.Pipe()
	conn, err := NewSDKConn(clientOut, clientIn, h)
	if err != nil {
		t.Fatal(err)
	}
	a.side = acp.NewAgentSideConnection(a, agentOut, agentIn)
	t.Cleanup(func() {
		_ = agentOut.Close()
		_ = clientOut.Close()
	})
	c := conn.(*sdkConn)
	c.canLoadSession = true
	return c
}

func replyChunk(text string) acp.SessionUpdate {
	return acp.SessionUpdate{AgentMessageChunk: &acp.SessionUpdateAgentMessageChunk{Content: acp.TextBlock(text)}}
}

func askedChunk(text string) acp.SessionUpdate {
	return acp.SessionUpdate{UserMessageChunk: &acp.SessionUpdateUserMessageChunk{Content: acp.TextBlock(text)}}
}

// A replayed Claude turn the user stopped keeps its stopped mark; the CLI's own reply to the interrupt, which nobody saw live, is left out.
func TestAReplayedStoppedTurnKeepsItsMarkWithoutTheCLIsReply(t *testing.T) {
	h := &updateCollector{}
	a := &replayAgent{replay: []acp.SessionUpdate{
		askedChunk("count to 200"), replyChunk("1 2 3"), askedChunk("[Request interrupted by user]"),
		replyChunk("No response requested."), askedChunk("say it"), replyChunk("No response requested."),
	}}
	c := overPipes(t, a, h)
	if _, err := c.LoadSession(context.Background(), "s1", "/mirror", SessionWorkspace{}); err != nil {
		t.Fatal(err)
	}
	want := "user_message:count to 200 | message_chunk:1 2 3 | turn_stopped | user_message:say it | message_chunk:No response requested."
	if got := h.joined(5); got != want {
		t.Errorf("replay = %q, want %q", got, want)
	}
}

// The filter ends with the replay: a live reply that reads the same is handed on.
func TestALiveReplyIsNeverTakenForTheCLIsReplyToAStop(t *testing.T) {
	for name, inLoad := range map[string]bool{"after a replay that ends on the mark": true, "after a mark outside a load": false} {
		t.Run(name, func(t *testing.T) {
			h := &updateCollector{}
			a := &replayAgent{}
			c := overPipes(t, a, h)
			mark := askedChunk("[Request interrupted by user]")
			if inLoad {
				a.replay = []acp.SessionUpdate{mark}
				if _, err := c.LoadSession(context.Background(), "s1", "/mirror", SessionWorkspace{}); err != nil {
					t.Fatal(err)
				}
			} else {
				a.send(t, mark)
			}
			a.send(t, replyChunk("No response requested."))
			if got, want := h.joined(2), "turn_stopped | message_chunk:No response requested."; got != want {
				t.Errorf("updates = %q, want %q", got, want)
			}
		})
	}
}
