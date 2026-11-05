// sdkConn is the AgentConn implementation backed by the pre-1.0 coder/acp-go-sdk.
package agent

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"

	acp "github.com/coder/acp-go-sdk"
)

type sdkConn struct {
	conn    *acp.ClientSideConnection
	handler ClientHandler

	mu       sync.Mutex                        // guards modelCfg, mcpServers, allowedTools, boardName and dirOfWorkspace
	modelCfg map[SessionID]acp.SessionConfigId // per-session id of the "model" config option, for SetModel

	elicitTags     *elicitationTags // sessionIds sniffed off the wire, because the SDK drops them (see elicitationtag.go)
	canLoadSession bool             // agent advertised session/load at initialize
	// Optional in ACP and absent on OpenCode: asking anyway answers "method not found".
	canDeleteSession bool
	mcpServers       []acp.McpServer // MCP servers advertised on every session (board tools)
	allowedTools     []string        // read-only MCP tools auto-approved (no permission prompt), stored bare
	dialect          Dialect         // engine-specific session envelope and tool naming (set before Start)
	boardName        string          // connected board's display name, stated in every session's system prompt
	grants           toolGrants      // "Always allow" answers, honoured here because the engine drops them (see toolgrants.go)
	wsMu             sync.Mutex      // guards sessionWS: sessions open on one goroutine and permissions arrive on another
	sessionWS        map[SessionID]string
	// The scope paragraph a new session's first prompt must carry; drained by it, so it is sent once.
	pendingFocus   map[SessionID]string
	sessionCwd     map[SessionID]string
	replaying      map[SessionID]bool // a load in flight; true right after its replay's interrupt mark
	dirOfWorkspace func(appID string) string
	calls          callInputs // what each running call announced, for an engine whose permission requests lack it
	todos          todoCalls  // OpenCode's todo list, sent as tool calls, shown as the checklist
}

// boardMCPServerName is the MCP server name the agent sees; MCP tools are namespaced mcp__<name>__<tool>.
const boardMCPServerName = "arduino-board"

// SetMCPServers records the MCP servers to advertise on NewSession/LoadSession (set before Start).
func (c *sdkConn) SetMCPServers(servers []MCPServer) {
	out := make([]acp.McpServer, 0, len(servers))
	var allowed []string
	for _, s := range servers {
		out = append(out, acp.McpServer{Http: &acp.McpServerHttpInline{
			Type:    "http",
			Name:    boardMCPServerName,
			Url:     s.URL,
			Headers: []acp.HttpHeader{{Name: "Authorization", Value: "Bearer " + s.Token}},
		}})
		for _, t := range s.ReadOnlyTools {
			if isNeverAutoApprovable(t) { // auto-approval is granted only here → enforce the never-auto-approve rule on tool identity
				slog.Error("[tools] refusing to auto-approve a tool that always requires the user", "tool", t)
				continue
			}
			allowed = append(allowed, t) // bare: the engine's naming is applied at session time, by the dialect
		}
	}
	c.mu.Lock()
	c.mcpServers = out
	c.allowedTools = allowed
	c.mu.Unlock()
}

func (c *sdkConn) SetDialect(d Dialect) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.dialect = d
}

func (c *sdkConn) hasMCPServers() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.mcpServers) > 0
}

// acpMcpServers returns a copy of the configured MCP servers for a session request.
func (c *sdkConn) acpMcpServers() []acp.McpServer {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.mcpServers) == 0 || c.dialect.MCPInLaunchConfig {
		return []acp.McpServer{}
	}
	return append([]acp.McpServer(nil), c.mcpServers...)
}

// acpAllowedTools returns a copy of the auto-approved read-only tool names for a session request.
func (c *sdkConn) acpAllowedTools() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.dialect.QualifyTool == nil {
		return nil
	}
	out := make([]string, 0, len(c.allowedTools))
	for _, t := range c.allowedTools {
		out = append(out, c.dialect.QualifyTool(boardMCPServerName, t))
	}
	return out
}

func (c *sdkConn) acpSessionMeta(ws SessionWorkspace) map[string]any {
	c.mu.Lock()
	build := c.dialect.SessionMeta
	c.mu.Unlock()
	if build == nil {
		return nil
	}
	return build(c.acpAllowedTools(), c.acpBoardName(), ws)
}

// SetBoardName records the connected board's display name for the session system prompt (set before Start).
func (c *sdkConn) SetBoardName(name string) {
	c.mu.Lock()
	c.boardName = name
	c.mu.Unlock()
}

func (c *sdkConn) acpBoardName() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.boardName
}

// init registers the SDK factory so the host gets a real ACP connection.
func init() { DefaultConnFactory = NewSDKConn }

// NewSDKConn wires the SDK connection onto the agent process stdio (the ConnFactory for NewManager).
func NewSDKConn(stdin io.Writer, stdout io.Reader, handler ClientHandler) (AgentConn, error) {
	c := &sdkConn{handler: handler, modelCfg: map[SessionID]acp.SessionConfigId{}, sessionWS: map[SessionID]string{}, elicitTags: &elicitationTags{}}
	// Tee the agent's output through the tagger so an elicitation's sessionId is recorded before the SDK — which drops
	// that field — dispatches the request (see elicitationtag.go).
	c.conn = acp.NewClientSideConnection(c, stdin, io.TeeReader(stdout, c.elicitTags))
	return c, nil
}

// ---- AgentConn: outbound calls to the agent ----

func (c *sdkConn) Initialize(ctx context.Context) ([]AuthMethod, error) {
	resp, err := c.conn.Initialize(ctx, acp.InitializeRequest{
		ProtocolVersion: acp.ProtocolVersionNumber,
		ClientCapabilities: acp.ClientCapabilities{
			// Not advertised: claiming them invites file I/O the handlers below refuse.
			Fs:          acp.FileSystemCapabilities{},
			Auth:        acp.AuthCapabilities{Terminal: true},                                   // lets the agent offer terminal-based login
			Elicitation: &acp.ElicitationCapabilities{Form: &acp.ElicitationFormCapabilities{}}, // form elicitation: Claude's AskUserQuestion → Choices
		},
	})
	if err != nil {
		return nil, err
	}
	c.canLoadSession = resp.AgentCapabilities.LoadSession
	c.canDeleteSession = resp.AgentCapabilities.SessionCapabilities.Delete != nil
	// An agent that cannot take an HTTP MCP server drops it silently, and every session opens with no board.
	if c.hasMCPServers() && !resp.AgentCapabilities.McpCapabilities.Http {
		return nil, errors.New("this agent does not support HTTP MCP servers, so App Lab cannot give it the board's tools")
	}
	methods := make([]AuthMethod, 0, len(resp.AuthMethods))
	for _, m := range resp.AuthMethods {
		if am, ok := toAuthMethod(m); ok {
			methods = append(methods, am)
		}
	}
	return methods, nil
}

func (c *sdkConn) Authenticate(ctx context.Context, methodID string) error {
	_, err := c.conn.Authenticate(ctx, acp.AuthenticateRequest{MethodId: methodID})
	return err
}

// policySettingSources: the only sources the engine loads its permission policy from — never <cwd>/.claude/settings*.json (agent-writable cwd → permissions.allow/bypassPermissions/hooks escalation); belt-and-braces in sessionCwd's hardenAgentPolicyDir.
var policySettingSources = []string{"user"}

// claudeSessionMeta carries Claude-Code session options the adapter reads from _meta (matching CLI flags ignored): disallow native mutating tools, pin the setting sources, auto-approve read-only MCP tools, append the chat output style + board knowledge.
func claudeSessionMeta(allowedTools []string, boardName string, ws SessionWorkspace) map[string]any {
	opts := map[string]any{
		"disallowedTools": nativeMutatingTools,
		"settingSources":  policySettingSources, // adapter spreads caller options over its default, so this overrides it
		"strictMcpConfig": true,                 // use only the board MCP we pass explicitly — ignore any .mcp.json in the agent-writable cwd
	}
	if len(allowedTools) > 0 {
		opts["allowedTools"] = allowedTools
	}
	return map[string]any{
		"claudeCode":   map[string]any{"options": opts},
		"systemPrompt": map[string]any{"append": chatOutputStyle + "\n\n" + boardKnowledgeFor(boardName) + workspaceFocus(ws)},
	}
}

func (c *sdkConn) NewSession(ctx context.Context, cwd string, ws SessionWorkspace) (NewSessionResult, error) {
	resp, err := c.conn.NewSession(ctx, acp.NewSessionRequest{Cwd: cwd, McpServers: c.acpMcpServers(), Meta: c.acpSessionMeta(ws)})
	if err != nil {
		return NewSessionResult{}, err
	}
	sid := SessionID(resp.SessionId)
	c.rememberSession(sid, cwd, ws)
	c.armFocus(sid, ws) // new session only: a loaded one replays the paragraph with its history
	return c.sessionResult(sid, resp.ConfigOptions, resp.Modes), nil
}

// workspaceDir resolves the mirror directory of a session's workspace app; "" when there is none, which leaves every call in scope.
func (c *sdkConn) workspaceDir(appID string) string {
	if appID == "" {
		return ""
	}
	// Read under the lock, called outside it: permissions arrive on the SDK's read goroutine while a restart
	// re-attaches, and the host's mapping reaches back into App state that takes locks of its own.
	c.mu.Lock()
	dirOf := c.dirOfWorkspace
	c.mu.Unlock()
	if dirOf == nil {
		return ""
	}
	return dirOf(appID)
}

// attachWorkspaceDirs gives the connection the appID → mirror dir mapping only the host can compute.
func (c *sdkConn) attachWorkspaceDirs(f func(appID string) string) {
	c.mu.Lock()
	c.dirOfWorkspace = f
	c.mu.Unlock()
}

// attachGrants hands the registry its persistence; called once, right after the connection is built.
func (c *sdkConn) attachGrants(store GrantStore) { c.grants.attach(store) }

// rememberSession records a session's workspace, which decides the grants, and its cwd, which anchors the agent's relative paths.
func (c *sdkConn) rememberSession(sid SessionID, cwd string, ws SessionWorkspace) {
	c.wsMu.Lock()
	defer c.wsMu.Unlock()
	if c.sessionWS == nil {
		c.sessionWS = map[SessionID]string{}
	}
	if c.sessionCwd == nil {
		c.sessionCwd = map[SessionID]string{}
	}
	c.sessionWS[sid], c.sessionCwd[sid] = ws.AppID, cwd
}

// New sessions only: a loaded one already carries the paragraph in the history the engine replays.
func (c *sdkConn) armFocus(sid SessionID, ws SessionWorkspace) {
	c.mu.Lock()
	focus := c.dialect.PromptFocus
	c.mu.Unlock()
	if focus == nil {
		return
	}
	text := focus(ws)
	if text == "" {
		return // a general session is scoped to the whole board, which the rest of the prompt describes
	}
	c.wsMu.Lock()
	defer c.wsMu.Unlock()
	if c.pendingFocus == nil {
		c.pendingFocus = map[SessionID]string{}
	}
	c.pendingFocus[sid] = text
}

func (c *sdkConn) peekFocus(sid SessionID) string {
	c.wsMu.Lock()
	defer c.wsMu.Unlock()
	return c.pendingFocus[sid]
}

func (c *sdkConn) takeFocus(sid SessionID) string {
	c.wsMu.Lock()
	defer c.wsMu.Unlock()
	text := c.pendingFocus[sid]
	delete(c.pendingFocus, sid)
	return text
}

// forgetSession drops what a closed session left here, so neither map grows for the life of the process.
func (c *sdkConn) forgetSession(sid SessionID) {
	c.wsMu.Lock()
	defer c.wsMu.Unlock()
	delete(c.sessionWS, sid)
	delete(c.sessionCwd, sid)
	delete(c.pendingFocus, sid)
	delete(c.replaying, sid)
	c.calls.forget(sid)
	c.todos.forget(sid)
}

// RebindWorkspace moves live sessions off a renamed app's old id, and writes again a scope paragraph not sent yet: both name the app by its id.
func (c *sdkConn) RebindWorkspace(oldID, newID, newName string) {
	c.mu.Lock()
	focus := c.dialect.PromptFocus
	c.mu.Unlock()
	c.wsMu.Lock()
	defer c.wsMu.Unlock()
	for sid, ws := range c.sessionWS {
		if ws != oldID {
			continue
		}
		c.sessionWS[sid] = newID
		if _, armed := c.pendingFocus[sid]; armed && focus != nil {
			c.pendingFocus[sid] = focus(SessionWorkspace{AppID: newID, Name: newName})
		}
	}
}

// noResponseAfterInterrupt reports, in a replay, the reply the Claude CLI writes to an interrupt mark: nobody saw it live, and the UI would add it to the stopped reply.
func (c *sdkConn) noResponseAfterInterrupt(sid SessionID, u Update) bool {
	c.wsMu.Lock()
	defer c.wsMu.Unlock()
	afterMark, loading := c.replaying[sid]
	if !loading {
		return false
	}
	c.replaying[sid] = u.Type == "turn_stopped"
	return afterMark && u.Type == "message_chunk" && strings.TrimSpace(u.Delta) == claudeNoResponse
}

// markReplay marks the load of sid in flight, or over; the SDK hands on a load's replay before its response.
func (c *sdkConn) markReplay(sid SessionID, inFlight bool) {
	c.wsMu.Lock()
	defer c.wsMu.Unlock()
	if !inFlight {
		delete(c.replaying, sid)
		return
	}
	if c.replaying == nil {
		c.replaying = map[SessionID]bool{}
	}
	c.replaying[sid] = false
}

// cwdOf reports the working directory a session was opened with.
func (c *sdkConn) cwdOf(sid SessionID) string {
	c.wsMu.Lock()
	defer c.wsMu.Unlock()
	return c.sessionCwd[sid]
}

// workspaceOf reports the workspace a session was opened in; an unknown one reads as the general workspace.
func (c *sdkConn) workspaceOf(sid SessionID) string {
	c.wsMu.Lock()
	defer c.wsMu.Unlock()
	return c.sessionWS[sid]
}

// sessionResult builds a NewSessionResult from a session response's config options + modes (shared by
// NewSession and LoadSession), capturing the model config id for later SetModel.
func (c *sdkConn) sessionResult(sid SessionID, configOptions []acp.SessionConfigOption, modes *acp.SessionModeState) NewSessionResult {
	res := NewSessionResult{SessionID: sid}
	if sel, ok := modelOption(configOptions); ok {
		c.mu.Lock()
		c.modelCfg[sid] = sel.Id
		c.mu.Unlock()
		res.CurrentModelID = string(sel.CurrentValue)
		res.Models = toAgentModels(sel.Options)
	}
	switch sel, ok := modeOption(configOptions); {
	case modes != nil:
		res.CurrentModeID = string(modes.CurrentModeId)
		res.Modes = toAgentModes(modes.AvailableModes)
	case ok:
		// OpenCode sends no top-level `modes`: they arrive as a select of category "mode", same set_mode call.
		res.CurrentModeID = string(sel.CurrentValue)
		res.Modes = toAgentModesFromOptions(sel.Options)
	}
	// Diagnostic: which models the adapter advertised — spots an intermittently missing one (cold catalog after first login).
	slog.Info("[models] advertised at session open", "session", string(sid), "current", res.CurrentModelID, "count", len(res.Models), "ids", modelIDs(res.Models))
	return res
}

// ListSessions returns the agent's persisted sessions for cwd (paginated internally into one slice).
func (c *sdkConn) ListSessions(ctx context.Context, cwd string) ([]SessionSummary, error) {
	var out []SessionSummary
	var cursor *string
	for {
		resp, err := c.conn.ListSessions(ctx, acp.ListSessionsRequest{Cwd: &cwd, Cursor: cursor})
		if err != nil {
			return nil, err
		}
		for _, s := range resp.Sessions {
			out = append(out, SessionSummary{ID: string(s.SessionId), Title: strDeref(s.Title), UpdatedAt: strDeref(s.UpdatedAt)})
		}
		if resp.NextCursor == nil || *resp.NextCursor == "" {
			break
		}
		cursor = resp.NextCursor
	}
	return out, nil
}

// toAgentModes flattens the ACP session modes to AgentModes.
func toAgentModes(modes []acp.SessionMode) []AgentMode {
	out := make([]AgentMode, 0, len(modes))
	for _, m := range modes {
		out = append(out, AgentMode{ID: string(m.Id), Name: m.Name, Description: strDeref(m.Description)})
	}
	return out
}

// modelOption finds the advertised select option of category "model", if any.
func modelOption(opts []acp.SessionConfigOption) (*acp.SessionConfigOptionSelect, bool) {
	return optionOfCategory(opts, acp.SessionConfigOptionCategoryModel)
}

// For an engine that advertises its modes as a select rather than as a top-level mode state.
func modeOption(opts []acp.SessionConfigOption) (*acp.SessionConfigOptionSelect, bool) {
	return optionOfCategory(opts, acp.SessionConfigOptionCategoryMode)
}

func optionOfCategory(opts []acp.SessionConfigOption, want acp.SessionConfigOptionCategory) (*acp.SessionConfigOptionSelect, bool) {
	for _, o := range opts {
		if s := o.Select; s != nil && s.Category != nil && *s.Category == want {
			return s, true
		}
	}
	return nil, false
}

// Both shapes are handled: which one a mode select uses is the engine's choice.
func toAgentModesFromOptions(opts acp.SessionConfigSelectOptions) []AgentMode {
	var out []AgentMode
	add := func(o acp.SessionConfigSelectOption) {
		out = append(out, AgentMode{ID: string(o.Value), Name: o.Name, Description: strDeref(o.Description)})
	}
	if opts.Ungrouped != nil {
		for _, o := range *opts.Ungrouped {
			add(o)
		}
	}
	if opts.Grouped != nil {
		for _, g := range *opts.Grouped {
			for _, o := range g.Options {
				add(o)
			}
		}
	}
	return out
}

// toAgentModels flattens the option's choices (grouped or ungrouped) to AgentModels.
func toAgentModels(opts acp.SessionConfigSelectOptions) []AgentModel {
	var out []AgentModel
	add := func(o acp.SessionConfigSelectOption) {
		out = append(out, AgentModel{ID: string(o.Value), Name: o.Name, Description: strDeref(o.Description)})
	}
	if opts.Ungrouped != nil {
		for _, o := range *opts.Ungrouped {
			add(o)
		}
	}
	if opts.Grouped != nil {
		for _, g := range *opts.Grouped {
			for _, o := range g.Options {
				add(o)
			}
		}
	}
	return out
}

// modelIDs extracts model ids for diagnostic logging.
func modelIDs(models []AgentModel) []string {
	ids := make([]string, len(models))
	for i, m := range models {
		ids[i] = m.ID
	}
	return ids
}

// What a failed session/load says about the chat.
type loadOutcome int

const (
	loadFailed    loadOutcome = iota // worth trying again
	chatGone                         // the engine has no such chat
	chatMaybeGone                    // the answer the engine gives a missing chat among other failures: only its list tells
	authRefused                      // the UI answers it with a sign-in
)

// loadRefusal reads a failed load: Claude -32002 for a chat it has no history of, OpenCode -32602 "session not found" for one its ACP layer lost.
func loadRefusal(err error) loadOutcome {
	var re *acp.RequestError
	if !errors.As(err, &re) {
		return loadFailed
	}
	data, _ := re.Data.(map[string]any)
	switch {
	case re.Code == -32000 || data["errorKind"] == "authentication_failed":
		return authRefused
	case re.Code == -32002 || (re.Code == -32602 && strings.HasPrefix(strings.ToLower(re.Message), "session not found")):
		return chatGone
	case re.Code == -32603 && strings.TrimPrefix(re.Message, "Internal error: ") == "OpenCode service failure" && data["service"] == "session":
		// OpenCode 1.18.33 wraps its store's 404 for the chat this way, as it does any other failure of that store.
		return chatMaybeGone
	}
	return loadFailed
}

// LoadSession re-establishes sid on a relaunched agent and re-captures its model option.
func (c *sdkConn) LoadSession(ctx context.Context, sid SessionID, cwd string, ws SessionWorkspace) (NewSessionResult, error) {
	if !c.canLoadSession {
		return NewSessionResult{}, errors.New("agent does not support session/load")
	}
	c.markReplay(sid, true)
	resp, err := c.conn.LoadSession(ctx, acp.LoadSessionRequest{
		SessionId:  acp.SessionId(sid),
		Cwd:        cwd,
		McpServers: c.acpMcpServers(),
		Meta:       c.acpSessionMeta(ws),
	})
	c.markReplay(sid, false)
	if err != nil {
		return NewSessionResult{}, err
	}
	c.rememberSession(sid, cwd, ws)
	return c.sessionResult(sid, resp.ConfigOptions, resp.Modes), nil
}

// focusFor peeks, not drains, so a prompt that never lands keeps it for the retry; a command keeps it too, as the engine runs the command instead of sending the text.
func (c *sdkConn) focusFor(sid SessionID, text string) string {
	if _, isCommand := slashCommand(text); isCommand {
		return ""
	}
	return c.peekFocus(sid)
}

func (c *sdkConn) Prompt(ctx context.Context, sid SessionID, text string, before []string) (bool, error) {
	focus := c.focusFor(sid, text)
	blocks := make([]acp.ContentBlock, 0, len(before)+1)
	for _, b := range before {
		blocks = append(blocks, acp.TextBlock(b))
	}
	resp, err := c.conn.Prompt(ctx, acp.PromptRequest{
		SessionId: acp.SessionId(sid),
		Prompt:    append(blocks, acp.TextBlock(text+focus)),
	})
	cancelled := err == nil && resp.StopReason == acp.StopReasonCancelled
	if err == nil && !cancelled && focus != "" {
		c.takeFocus(sid)
	}
	return cancelled, err
}

func (c *sdkConn) Cancel(ctx context.Context, sid SessionID) error {
	return c.conn.Cancel(ctx, acp.CancelNotification{SessionId: acp.SessionId(sid)})
}

// CloseSession frees the session on the agent and drops what this connection kept for it.
func (c *sdkConn) CloseSession(ctx context.Context, sid SessionID) error {
	c.forgetSession(sid)
	c.mu.Lock()
	delete(c.modelCfg, sid)
	c.mu.Unlock()
	_, err := c.conn.CloseSession(ctx, acp.CloseSessionRequest{SessionId: acp.SessionId(sid)})
	return err
}

func (c *sdkConn) DeletesSessions() bool { return c.canDeleteSession }

// DeleteSession permanently removes a persisted session (ACP session/unstable/delete).
func (c *sdkConn) DeleteSession(ctx context.Context, sid SessionID) error {
	if !c.canDeleteSession {
		// Nothing local changes: forgetting a session still live on the agent would strand it.
		return ErrDeleteSessionUnsupported
	}
	c.forgetSession(sid)
	c.mu.Lock()
	delete(c.modelCfg, sid)
	c.mu.Unlock()
	_, err := c.conn.UnstableDeleteSession(ctx, acp.UnstableDeleteSessionRequest{SessionId: acp.SessionId(sid)})
	return err
}

// SetModel selects a model via session/set_config_option using the id captured at NewSession (UNSTABLE).
func (c *sdkConn) SetModel(ctx context.Context, sid SessionID, modelID string) error {
	c.mu.Lock()
	configID, ok := c.modelCfg[sid]
	c.mu.Unlock()
	if !ok {
		return errors.New("set model: this session advertises no model option")
	}
	resp, err := c.conn.SetSessionConfigOption(ctx, acp.SetSessionConfigOptionRequest{
		ValueId: &acp.SetSessionConfigOptionValueId{
			ConfigId:  configID,
			SessionId: acp.SessionId(sid),
			Value:     acp.SessionConfigValueId(modelID),
		},
	})
	if err != nil {
		return err
	}
	// The response carries the full current config options; surface freshly-available models (e.g. Fable 5) via model_change — re-selecting the current model is a cheap refresh.
	if sel, ok := modelOption(resp.ConfigOptions); ok {
		models := toAgentModels(sel.Options)
		slog.Info("[models] re-read via set-config response", "session", string(sid), "current", string(sel.CurrentValue), "count", len(models), "ids", modelIDs(models))
		c.handler.HandleUpdate(sid, Update{Type: "model_change", ModelID: string(sel.CurrentValue), Models: models})
	}
	return nil
}

// SetMode switches the session's operating mode via session/set_mode (ACP first-class session modes).
func (c *sdkConn) SetMode(ctx context.Context, sid SessionID, modeID string) error {
	_, err := c.conn.SetSessionMode(ctx, acp.SetSessionModeRequest{
		SessionId: acp.SessionId(sid),
		ModeId:    acp.SessionModeId(modeID),
	})
	return err
}

func (c *sdkConn) Close() error { return nil }

// ---- acp.Client: inbound callbacks from the agent ----

func (c *sdkConn) SessionUpdate(_ context.Context, n acp.SessionNotification) error {
	u, ok := toUpdate(n.Update)
	if !ok {
		return nil
	}
	sid := SessionID(n.SessionId)
	if c.noResponseAfterInterrupt(sid, u) {
		return nil
	}
	c.markOutsideWorkspace(sid, u.ToolCall)
	if c.asksWithoutArguments() {
		if tc := n.Update.ToolCall; tc != nil {
			c.calls.announce(sid, string(tc.ToolCallId), tc.RawInput, string(tc.Status))
		}
		if tcu := n.Update.ToolCallUpdate; tcu != nil {
			c.calls.announce(sid, string(tcu.ToolCallId), tcu.RawInput, toolStatus(tcu.Status))
		}
	}
	// A tool call is announced bare, so the row is judged again on the update; only a true ever travels, so a thinner update cannot clear the badge.
	if tcu := n.Update.ToolCallUpdate; tcu != nil {
		tc := &ToolCall{ID: string(tcu.ToolCallId), Input: tcu.RawInput, Paths: locationPaths(tcu.Locations)}
		if tcu.Title != nil {
			tc.Title = *tcu.Title
		}
		if tcu.Kind != nil {
			tc.Kind = string(*tcu.Kind)
		}
		c.markOutsideWorkspace(sid, tc)
		u.OutsideWorkspace = tc.OutsideWorkspace
		u.Call = tc
	}
	c.handler.HandleUpdate(sid, u)
	if list, ok := c.todos.checklist(sid, n.Update); ok {
		c.handler.HandleUpdate(sid, Update{Type: "checklist", Checklist: list})
	}
	return nil
}

// markOutsideWorkspace flags a call acting on another app, so the chat row says so as it happens, not only when a permission is asked.
func (c *sdkConn) markOutsideWorkspace(sid SessionID, tc *ToolCall) {
	if tc == nil {
		return
	}
	ws := c.workspaceOf(sid)
	tc.OutsideWorkspace = actsOutsideWorkspace(tc, ws, c.workspaceDir(ws), c.cwdOf(sid))
}

func (c *sdkConn) RequestPermission(ctx context.Context, p acp.RequestPermissionRequest) (acp.RequestPermissionResponse, error) {
	req := toPermissionRequest(p)
	c.addAnnouncedArguments(ctx, req)
	ws := c.workspaceOf(req.SessionID)
	// Marked before the grant lookup: leaving the workspace is part of the grant's identity, so an allow given inside the app cannot cover it.
	c.markOutsideWorkspace(req.SessionID, req.ToolCall)
	// Only now: before its arguments arrive an OpenCode app tool names no app, and would lose an "Always allow" it may keep.
	perCallOptions(&req)
	opt, ok, opened := c.grants.autoAllow(ws, req)
	if ok { // the user already answered "Always allow" for this exact call
		slog.Info("[permission] auto-allowed by an earlier always-allow", "tool", req.ToolCall.Title, "session", string(p.SessionId))
		return acp.RequestPermissionResponse{
			Outcome: acp.NewRequestPermissionOutcomeSelected(acp.PermissionOptionId(opt)),
		}, nil
	}
	// A copy: the host writes into the call's input for the card, and the grant must be keyed on what autoAllow read.
	out := c.handler.HandlePermission(ctx, req.clone())
	if out.Cancelled || out.OptionID == "" {
		return acp.RequestPermissionResponse{Outcome: acp.NewRequestPermissionOutcomeCancelled()}, nil
	}
	c.grants.record(ws, req, out.OptionID, opened)
	return acp.RequestPermissionResponse{
		Outcome: acp.NewRequestPermissionOutcomeSelected(acp.PermissionOptionId(engineAnswer(req, out.OptionID))),
	}, nil
}

// addAnnouncedArguments gives a request the arguments its call announced: they name the app a grant is scoped to, and the command the prompt shows.
func (c *sdkConn) addAnnouncedArguments(ctx context.Context, req PermissionRequest) {
	tc := req.ToolCall
	if tc == nil || hasArguments(tc.Input) {
		return
	}
	if !c.asksWithoutArguments() {
		_, tc.noArguments = tc.Input.(map[string]any) // this engine sends the call's own arguments, so {} is a call that has none
		return
	}
	if tc.ID == "" {
		return
	}
	announced, ok := c.calls.wait(ctx, req.SessionID, tc.ID)
	if !ok {
		slog.Warn("[permission] the call's arguments never arrived; asking without them", "tool", tc.Title, "session", string(req.SessionID))
		return
	}
	tc.Input = withArguments(tc.Input, announced)
	explicit, _ := announced.(map[string]any)
	tc.noArguments = explicit != nil && !hasArguments(tc.Input) // an update with no rawInput at all did not bring the arguments
}

func (c *sdkConn) asksWithoutArguments() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.dialect.AsksWithoutArguments
}

// engineAnswer downgrades "Always allow" to a one-off: the engine's own rule is per tool for the whole session, so the scoped decision stays here (a reject is forwarded as chosen).
func engineAnswer(req PermissionRequest, optionID string) string {
	if !isAlwaysAllowOption(req.Options, optionID) {
		return optionID
	}
	if once, ok := allowOptionID(req.Options); ok {
		return once
	}
	// No one-off to answer with: the user said allow and only the widening option exists, so it goes through as chosen.
	slog.Warn("[permission] no one-off allow to downgrade to; the engine gets the persistent answer", "tool", req.ToolCall.Title)
	return optionID
}

// UnstableCreateElicitation renders the agent's form elicitation (Claude's AskUserQuestion, gated on our elicitation
// capability) as Choices in the UI, blocks for the user's answer, then returns it as the elicitation content.
func (c *sdkConn) UnstableCreateElicitation(ctx context.Context, req acp.UnstableCreateElicitationRequest) (acp.UnstableCreateElicitationResponse, error) {
	if req.Form == nil { // url-mode elicitation isn't rendered as Choices; decline so the turn proceeds
		return acp.NewUnstableCreateElicitationResponseDecline(), nil
	}
	questions := parseElicitation(req.Form)
	if len(questions) == 0 {
		return acp.NewUnstableCreateElicitationResponseDecline(), nil
	}
	sid := c.elicitTags.take(req) // the session ACP named on the wire; "" leaves the Manager to fall back
	if sid == "" {
		// The digest relies on the SDK decoding the params as the sniffer did; an upgrade past v0.13.5 could break that silently, so say it out loud.
		slog.Warn("[elicitation] no session recovered from the wire; routing falls back to a guess")
	}
	slog.Info("[elicitation] rendering", "questions", len(questions), "session", sid)
	reqs := make([]ChoiceRequest, len(questions))
	for i := range questions {
		reqs[i] = questions[i].req
	}
	subs := c.handler.HandleElicitation(ctx, sid, reqs)
	content := map[string]any{}
	for i := range questions {
		if i >= len(subs) || subs[i].Cancelled {
			continue
		}
		q, sub := questions[i], subs[i]
		if q.req.Kind == ChoiceKindText {
			if sub.Other != "" {
				content[q.fieldKey] = sub.Other // the field IS the text, with no options beside it
			}
			continue
		}
		if len(sub.SelectedIDs) > 0 {
			if q.multiple {
				content[q.fieldKey] = sub.SelectedIDs
			} else {
				content[q.fieldKey] = sub.SelectedIDs[0]
			}
		}
		if sub.Other != "" {
			content[q.fieldKey+"_custom"] = sub.Other
		}
	}
	if len(content) == 0 { // nothing picked → the user skipped every question
		return acp.NewUnstableCreateElicitationResponseDecline(), nil
	}
	resp := acp.NewUnstableCreateElicitationResponseAccept()
	resp.Accept.Content = content
	return resp, nil
}

// parsedQuestion is one elicitation question translated for the UI plus what's needed to build the reply content.
type parsedQuestion struct {
	req      ChoiceRequest
	fieldKey string // schema key, e.g. "question_0"; the answer goes back under this key (+ "_custom")
	multiple bool
}

// Reads the JSON Schema, not one engine's field names: options are a choice, a plain string is text.
func parseElicitation(form *acp.UnstableCreateElicitationForm) []parsedQuestion {
	props := form.RequestedSchema.Properties
	out := make([]parsedQuestion, 0, len(props))
	for _, key := range elicitationFieldOrder(props) {
		field, ok := props[key].(map[string]any)
		if !ok {
			continue
		}
		multiple := asString(field["type"]) == "array"
		options := parseOptions(field, multiple)
		// A companion "<key>_custom" is how Claude spells "and you may answer something else".
		_, hasCustom := props[key+"_custom"]
		q := parsedQuestion{
			req: ChoiceRequest{
				ID:         newChoiceID(),
				Title:      questionTitle(form, field),
				Options:    options,
				Multiple:   multiple,
				AllowOther: hasCustom,
			},
			fieldKey: key,
			multiple: multiple,
		}
		if len(options) == 0 {
			// No options: the engine wants text, and the choices card would put a checkbox before it.
			if asString(field["type"]) != "string" {
				continue // neither a choice nor a string: nothing we can render honestly
			}
			q.req.Kind = ChoiceKindText
			q.req.AllowOther = true
		}
		out = append(out, q)
	}
	return out
}

// A map has no order, so without this one form's questions come out shuffled between runs.
func elicitationFieldOrder(props map[string]any) []string {
	numbered := map[string]int{}
	var rest []string
	for k := range props {
		if strings.HasSuffix(k, "_custom") {
			continue // the companion of another field, never a question of its own
		}
		if n, err := strconv.Atoi(strings.TrimPrefix(k, "question_")); err == nil && strings.HasPrefix(k, "question_") {
			numbered[k] = n
			continue
		}
		rest = append(rest, k)
	}
	keys := make([]string, 0, len(numbered)+len(rest))
	for k := range numbered {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return numbered[keys[i]] < numbered[keys[j]] })
	sort.Strings(rest)
	return append(keys, rest...)
}

// parseOptions reads a field's choices from any of the shapes JSON Schema offers for them.
func parseOptions(field map[string]any, multiple bool) []ChoiceOption {
	out := make([]ChoiceOption, 0)
	for _, raw := range optionList(field, multiple) {
		switch v := raw.(type) {
		case map[string]any:
			label := asString(v["const"])
			if label == "" {
				label = asString(v["title"])
			}
			if label == "" {
				continue
			}
			out = append(out, ChoiceOption{ID: label, Label: label, Description: optionDescription(v)})
		case string:
			out = append(out, ChoiceOption{ID: v, Label: v}) // a bare enum entry carries no detail
		}
	}
	return out
}

// optionList returns a field's options, from whichever of JSON Schema's spellings the engine used.
func optionList(field map[string]any, multiple bool) []any {
	if multiple {
		items, ok := field["items"].(map[string]any)
		if !ok {
			return nil
		}
		field = items
	}
	for _, key := range []string{"oneOf", "anyOf", "enum"} {
		if list, ok := field[key].([]any); ok && len(list) > 0 {
			return list
		}
	}
	return nil
}

// optionDescription reads the option's clean detail from its _meta, falling back to the "label — detail" title.
func optionDescription(opt map[string]any) string {
	if meta, ok := opt["_meta"].(map[string]any); ok {
		if detail, ok := meta["_claude/askUserQuestionOption"].(map[string]any); ok {
			if d := asString(detail["description"]); d != "" {
				return d
			}
		}
	}
	if title := asString(opt["title"]); strings.Contains(title, " — ") {
		return strings.TrimSpace(title[strings.Index(title, " — ")+len(" — "):])
	}
	return ""
}

// questionTitle is the card heading: the field's own description (multi-question forms) or the form message (single).
func questionTitle(form *acp.UnstableCreateElicitationForm, field map[string]any) string {
	if d := asString(field["description"]); d != "" {
		return d
	}
	return form.Message
}

// asString returns v as a string when it is one, else "".
func asString(v any) string { s, _ := v.(string); return s }

// fs sandboxing and terminals come later; the capability is unadvertised, so only a misbehaving agent asks.
func (c *sdkConn) ReadTextFile(context.Context, acp.ReadTextFileRequest) (acp.ReadTextFileResponse, error) {
	return acp.ReadTextFileResponse{}, errors.New("readTextFile: not implemented")
}
func (c *sdkConn) WriteTextFile(context.Context, acp.WriteTextFileRequest) (acp.WriteTextFileResponse, error) {
	return acp.WriteTextFileResponse{}, errors.New("writeTextFile: not implemented")
}
func (c *sdkConn) CreateTerminal(context.Context, acp.CreateTerminalRequest) (acp.CreateTerminalResponse, error) {
	return acp.CreateTerminalResponse{}, errors.New("terminal: not implemented")
}
func (c *sdkConn) KillTerminal(context.Context, acp.KillTerminalRequest) (acp.KillTerminalResponse, error) {
	return acp.KillTerminalResponse{}, errors.New("terminal: not implemented")
}
func (c *sdkConn) ReleaseTerminal(context.Context, acp.ReleaseTerminalRequest) (acp.ReleaseTerminalResponse, error) {
	return acp.ReleaseTerminalResponse{}, errors.New("terminal: not implemented")
}
func (c *sdkConn) TerminalOutput(context.Context, acp.TerminalOutputRequest) (acp.TerminalOutputResponse, error) {
	return acp.TerminalOutputResponse{}, errors.New("terminal: not implemented")
}
func (c *sdkConn) WaitForTerminalExit(context.Context, acp.WaitForTerminalExitRequest) (acp.WaitForTerminalExitResponse, error) {
	return acp.WaitForTerminalExitResponse{}, errors.New("terminal: not implemented")
}

// ---- translation: SDK types -> our domain types ----

// Claude Code records a stopped turn as a user message with this text ("… for tool use" mid-call), which the replay sends back.
var claudeInterruptMark = regexp.MustCompile(`^\[Request interrupted by user[^\]]*\]$`)

// The reply the Claude CLI writes after an interrupt mark when it next resumes the chat; nobody saw it live.
const claudeNoResponse = "No response requested."

func toUpdate(u acp.SessionUpdate) (Update, bool) {
	switch {
	case u.AgentMessageChunk != nil:
		return Update{Type: "message_chunk", Delta: blockText(u.AgentMessageChunk.Content)}, true
	case u.UserMessageChunk != nil:
		// Only seen during loadSession history replay; live user prompts are sent by us, not echoed.
		text := typedText(blockText(u.UserMessageChunk.Content))
		if text == "" {
			return Update{}, false // a block App Lab sent on its own
		}
		if claudeInterruptMark.MatchString(strings.TrimSpace(text)) {
			return Update{Type: "turn_stopped"}, true // the engine's mark of a turn the user stopped
		}
		return Update{Type: "user_message", Delta: text}, true
	case u.AgentThoughtChunk != nil:
		return Update{Type: "thinking", Delta: blockText(u.AgentThoughtChunk.Content)}, true
	case u.ToolCall != nil:
		return Update{Type: "tool_call", ToolCall: toToolCall(u.ToolCall)}, true
	case u.ToolCallUpdate != nil:
		tc := u.ToolCallUpdate
		return Update{Type: "tool_call_update", ID: string(tc.ToolCallId), Status: toolStatus(tc.Status), Output: contentText(tc.Content), Input: tc.RawInput}, true
	case u.Plan != nil:
		return Update{Type: "checklist", Checklist: toChecklist(u.Plan.Entries)}, true
	case u.ConfigOptionUpdate != nil:
		if sel, ok := modelOption(u.ConfigOptionUpdate.ConfigOptions); ok {
			models := toAgentModels(sel.Options)
			slog.Info("[models] re-advertised via config update", "current", string(sel.CurrentValue), "count", len(models), "ids", modelIDs(models))
			return Update{Type: "model_change", ModelID: string(sel.CurrentValue), Models: models}, true
		}
		return Update{}, false
	case u.CurrentModeUpdate != nil:
		return Update{Type: "mode_change", ModeID: string(u.CurrentModeUpdate.CurrentModeId)}, true
	case u.UsageUpdate != nil:
		return Update{Type: "usage", UsedTokens: u.UsageUpdate.Used, ContextSize: u.UsageUpdate.Size}, true
	default:
		return Update{}, false // unstable plan updates, available commands, effort, session info: not modelled yet
	}
}

// toChecklist flattens an ACP plan snapshot to our Checklist; the id is fixed so re-emits replace it in place.
func toChecklist(entries []acp.PlanEntry) *Checklist {
	items := make([]ChecklistItem, 0, len(entries))
	for _, e := range entries {
		items = append(items, ChecklistItem{Label: e.Content, Status: string(e.Status)})
	}
	return &Checklist{ID: "plan", Title: "Plan", Items: items}
}

// todoTool is OpenCode's todo list tool; the engine sends its list as a tool call, never as an ACP plan.
const todoTool = "todowrite"

// todoCalls remembers each session's todo calls: the update that completes one names neither the tool nor its input.
type todoCalls struct {
	mu  sync.Mutex
	ids map[string]bool // callKey → a todo call not finished yet
}

// checklist reads a todo call's list from its input, or from its output once done; a replayed call is titled "N todos", so the list's shape identifies it.
func (t *todoCalls) checklist(sid SessionID, u acp.SessionUpdate) (*Checklist, bool) {
	var id, title, status string
	var todos any
	switch {
	case u.ToolCall != nil:
		id, title, todos = string(u.ToolCall.ToolCallId), u.ToolCall.Title, jsonField(u.ToolCall.RawInput, "todos")
	case u.ToolCallUpdate != nil:
		tcu := u.ToolCallUpdate
		id, status, todos = string(tcu.ToolCallId), toolStatus(tcu.Status), jsonField(tcu.RawInput, "todos")
		if tcu.Title != nil {
			title = *tcu.Title
		}
		if todos == nil {
			todos = jsonField(jsonField(tcu.RawOutput, "metadata"), "todos")
		}
	default:
		return nil, false
	}
	items, isList := todoItems(todos)
	key := callKey(sid, id)
	t.mu.Lock()
	known := t.ids[key] || title == todoTool || isList
	switch {
	case !known:
	case status == "completed" || status == "failed":
		delete(t.ids, key)
	default:
		if t.ids == nil {
			t.ids = map[string]bool{}
		}
		t.ids[key] = true
	}
	t.mu.Unlock()
	if !known || !isList {
		return nil, false
	}
	return &Checklist{ID: "plan", Title: "Plan", Items: items}, true
}

// forget drops a closed session's calls.
func (t *todoCalls) forget(sid SessionID) {
	prefix := callKey(sid, "")
	t.mu.Lock()
	defer t.mu.Unlock()
	for key := range t.ids {
		if strings.HasPrefix(key, prefix) {
			delete(t.ids, key)
		}
	}
}

// todoItems reads OpenCode's todos ({content, status}); a cancelled one is left out, as the checklist has no such state.
func todoItems(v any) ([]ChecklistItem, bool) {
	list, ok := v.([]any)
	if !ok {
		return nil, false
	}
	items := make([]ChecklistItem, 0, len(list))
	for _, raw := range list {
		todo, ok := raw.(map[string]any)
		content := asString(jsonField(todo, "content"))
		if !ok || content == "" {
			return nil, false
		}
		switch status := asString(todo["status"]); status {
		case "cancelled":
		case "in_progress", "completed":
			items = append(items, ChecklistItem{Label: content, Status: status})
		default:
			items = append(items, ChecklistItem{Label: content, Status: "pending"})
		}
	}
	return items, true
}

// jsonField reads one key of a decoded JSON object; nil for anything else.
func jsonField(v any, key string) any {
	m, _ := v.(map[string]any)
	return m[key]
}

func blockText(b acp.ContentBlock) string {
	if b.Text != nil {
		return b.Text.Text
	}
	return ""
}

// toolStatus dereferences the optional ToolCallStatus pointer.
func toolStatus(s *acp.ToolCallStatus) string {
	if s == nil {
		return ""
	}
	return string(*s)
}

func toToolCall(tc *acp.SessionUpdateToolCall) *ToolCall {
	out := &ToolCall{
		ID:     string(tc.ToolCallId),
		Title:  tc.Title,
		Kind:   string(tc.Kind),
		Status: string(tc.Status), // value here; the *Update variant is a pointer (see toolStatus)
		Input:  tc.RawInput,       // the tool's arguments, shown in the card
	}
	out.Paths = locationPaths(tc.Locations)
	return out
}

// locationPaths lists the files a call declares it touches: the permission mapper decides whether to prompt, this one whether to badge.
func locationPaths(locations []acp.ToolCallLocation) []string {
	var paths []string
	for _, l := range locations {
		if strings.TrimSpace(l.Path) != "" {
			paths = append(paths, l.Path)
		}
	}
	return paths
}

// toToolCallRef maps the tool-call a permission request is about; fields are optional in this variant.
func toToolCallRef(tc acp.ToolCallUpdate) *ToolCall {
	out := &ToolCall{ID: string(tc.ToolCallId)}
	if tc.Title != nil {
		out.Title = *tc.Title
	}
	if tc.Kind != nil {
		out.Kind = string(*tc.Kind)
	}
	if tc.Status != nil {
		out.Status = string(*tc.Status)
	}
	if tc.RawInput != nil {
		out.Input = tc.RawInput // the tool's arguments (e.g. Bash {command}), so the permission dialog can show what will run
	}
	out.Paths = locationPaths(tc.Locations)
	return out
}

// contentText concatenates the text parts of tool-call content (skips diff/terminal).
func contentText(content []acp.ToolCallContent) string {
	var b strings.Builder
	for _, c := range content {
		if c.Content != nil && c.Content.Content.Text != nil {
			b.WriteString(c.Content.Content.Text.Text)
		}
	}
	return b.String()
}

// isPersistentGrantOption reports whether an option would persist the decision beyond this call ("Allow/Reject always"): the grant is keyed on the tool name alone, with no path or argument constraint. Checks both the kind and the id.
func isPersistentGrantOption(id, kind string) bool {
	id, kind = strings.ToLower(id), strings.ToLower(kind)
	return strings.HasSuffix(kind, "_always") || strings.Contains(id, "always")
}

// perCallOptions takes the persistent options off a request whose grant would answer for more than this call.
func perCallOptions(req *PermissionRequest) {
	if !grantCoversMany(req.ToolCall) {
		return
	}
	opts := make([]PermissionOption, 0, len(req.Options))
	for _, o := range req.Options {
		if isPersistentGrantOption(o.ID, o.Kind) {
			continue
		}
		opts = append(opts, o)
	}
	if n := len(req.Options) - len(opts); n > 0 { // a request left with no options can only be denied; log so that's explicable, not a broken dialog
		title := ""
		if req.ToolCall != nil {
			title = req.ToolCall.Title
		}
		slog.Info("[permission] dropped persistent-grant options", "tool", title, "dropped", n, "remaining", len(opts))
	}
	req.Options = opts
}

func toPermissionRequest(p acp.RequestPermissionRequest) PermissionRequest {
	tc := toToolCallRef(p.ToolCall)
	opts := make([]PermissionOption, 0, len(p.Options))
	for _, o := range p.Options {
		opts = append(opts, PermissionOption{ID: string(o.OptionId), Label: o.Name, Kind: string(o.Kind)})
	}
	return PermissionRequest{
		ID:        newRequestID(),
		SessionID: SessionID(p.SessionId),
		ToolCall:  tc,
		Options:   opts,
		// TimeoutMs stays 0 → no auto-deny; the prompt waits for the user.
	}
}

// toAuthMethod flattens the SDK's auth-method union (agent/env-var/terminal) into our domain type.
func toAuthMethod(m acp.AuthMethod) (AuthMethod, bool) {
	switch {
	case m.Agent != nil:
		return AuthMethod{ID: m.Agent.Id, Name: m.Agent.Name, Description: strDeref(m.Agent.Description), Type: AuthAgent}, true
	case m.EnvVar != nil:
		return AuthMethod{ID: m.EnvVar.Id, Name: m.EnvVar.Name, Description: strDeref(m.EnvVar.Description), Type: AuthEnvVar}, true
	case m.Terminal != nil:
		return AuthMethod{ID: m.Terminal.Id, Name: m.Terminal.Name, Description: strDeref(m.Terminal.Description), Type: AuthTerminal, Args: m.Terminal.Args}, true
	}
	return AuthMethod{}, false
}

func strDeref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
