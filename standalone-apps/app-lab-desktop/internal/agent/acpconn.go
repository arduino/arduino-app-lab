// sdkConn is the AgentConn implementation backed by the pre-1.0 coder/acp-go-sdk.
package agent

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"sort"
	"strconv"
	"strings"
	"sync"

	acp "github.com/coder/acp-go-sdk"
)

type sdkConn struct {
	conn    *acp.ClientSideConnection
	handler ClientHandler

	mu       sync.Mutex                        // guards modelCfg
	modelCfg map[SessionID]acp.SessionConfigId // per-session id of the "model" config option, for SetModel

	elicitTags     *elicitationTags // sessionIds sniffed off the wire, because the SDK drops them (see elicitationtag.go)
	canLoadSession bool             // agent advertised session/load at initialize
	mcpServers     []acp.McpServer  // MCP servers advertised on every session (board tools)
	allowedTools   []string         // read-only MCP tools auto-approved via session _meta (no permission prompt)
	boardName      string           // connected board's display name, stated in every session's system prompt
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
			allowed = append(allowed, fmt.Sprintf("mcp__%s__%s", boardMCPServerName, t))
		}
	}
	c.mu.Lock()
	c.mcpServers = out
	c.allowedTools = allowed
	c.mu.Unlock()
}

// acpMcpServers returns a copy of the configured MCP servers for a session request.
func (c *sdkConn) acpMcpServers() []acp.McpServer {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.mcpServers) == 0 {
		return []acp.McpServer{}
	}
	return append([]acp.McpServer(nil), c.mcpServers...)
}

// acpAllowedTools returns a copy of the auto-approved read-only tool names for a session request.
func (c *sdkConn) acpAllowedTools() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]string(nil), c.allowedTools...)
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
	c := &sdkConn{handler: handler, modelCfg: map[SessionID]acp.SessionConfigId{}, elicitTags: &elicitationTags{}}
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
			Fs:          acp.FileSystemCapabilities{ReadTextFile: true, WriteTextFile: true},
			Auth:        acp.AuthCapabilities{Terminal: true},                                   // lets the agent offer terminal-based login
			Elicitation: &acp.ElicitationCapabilities{Form: &acp.ElicitationFormCapabilities{}}, // form elicitation: Claude's AskUserQuestion → Choices
		},
	})
	if err != nil {
		return nil, err
	}
	c.canLoadSession = resp.AgentCapabilities.LoadSession
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
func claudeSessionMeta(allowedTools []string, boardName string) map[string]any {
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
		"systemPrompt": map[string]any{"append": chatOutputStyle + "\n\n" + boardKnowledgeFor(boardName)},
	}
}

func (c *sdkConn) NewSession(ctx context.Context, cwd string) (NewSessionResult, error) {
	resp, err := c.conn.NewSession(ctx, acp.NewSessionRequest{Cwd: cwd, McpServers: c.acpMcpServers(), Meta: claudeSessionMeta(c.acpAllowedTools(), c.acpBoardName())})
	if err != nil {
		return NewSessionResult{}, err
	}
	sid := SessionID(resp.SessionId)
	return c.sessionResult(sid, resp.ConfigOptions, resp.Modes), nil
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
	if modes != nil {
		res.CurrentModeID = string(modes.CurrentModeId)
		res.Modes = toAgentModes(modes.AvailableModes)
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
	for _, o := range opts {
		if s := o.Select; s != nil && s.Category != nil && *s.Category == acp.SessionConfigOptionCategoryModel {
			return s, true
		}
	}
	return nil, false
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

// LoadSession re-establishes sid on a relaunched agent and re-captures its model option.
func (c *sdkConn) LoadSession(ctx context.Context, sid SessionID, cwd string) (NewSessionResult, error) {
	if !c.canLoadSession {
		return NewSessionResult{}, errors.New("agent does not support session/load")
	}
	resp, err := c.conn.LoadSession(ctx, acp.LoadSessionRequest{
		SessionId:  acp.SessionId(sid),
		Cwd:        cwd,
		McpServers: c.acpMcpServers(),
		Meta:       claudeSessionMeta(c.acpAllowedTools(), c.acpBoardName()),
	})
	if err != nil {
		return NewSessionResult{}, err
	}
	return c.sessionResult(sid, resp.ConfigOptions, resp.Modes), nil
}

func (c *sdkConn) Prompt(ctx context.Context, sid SessionID, text string) error {
	_, err := c.conn.Prompt(ctx, acp.PromptRequest{
		SessionId: acp.SessionId(sid),
		Prompt:    []acp.ContentBlock{acp.TextBlock(text)},
	})
	return err
}

func (c *sdkConn) Cancel(ctx context.Context, sid SessionID) error {
	return c.conn.Cancel(ctx, acp.CancelNotification{SessionId: acp.SessionId(sid)})
}

// CloseSession frees the session on the agent and drops its local model-config entry.
func (c *sdkConn) CloseSession(ctx context.Context, sid SessionID) error {
	c.mu.Lock()
	delete(c.modelCfg, sid)
	c.mu.Unlock()
	_, err := c.conn.CloseSession(ctx, acp.CloseSessionRequest{SessionId: acp.SessionId(sid)})
	return err
}

// DeleteSession permanently removes a persisted session (ACP session/unstable/delete).
func (c *sdkConn) DeleteSession(ctx context.Context, sid SessionID) error {
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
	if u, ok := toUpdate(n.Update); ok {
		c.handler.HandleUpdate(SessionID(n.SessionId), u)
	}
	return nil
}

func (c *sdkConn) RequestPermission(ctx context.Context, p acp.RequestPermissionRequest) (acp.RequestPermissionResponse, error) {
	out := c.handler.HandlePermission(ctx, toPermissionRequest(p))
	if out.Cancelled || out.OptionID == "" {
		return acp.RequestPermissionResponse{Outcome: acp.NewRequestPermissionOutcomeCancelled()}, nil
	}
	return acp.RequestPermissionResponse{
		Outcome: acp.NewRequestPermissionOutcomeSelected(acp.PermissionOptionId(out.OptionID)),
	}, nil
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
	slog.Info("[elicitation] rendering choices", "questions", len(questions), "session", sid)
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

// parseElicitation turns the adapter's AskUserQuestion form schema into per-question ChoiceRequests. Fields are keyed
// question_<n> (single-select oneOf/type string, multi items.anyOf/type array); each option's const is the answer
// label and _meta._claude/askUserQuestionOption.description its detail; a question_<n>_custom field means "Other".
func parseElicitation(form *acp.UnstableCreateElicitationForm) []parsedQuestion {
	props := form.RequestedSchema.Properties
	type keyed struct {
		key string
		idx int
	}
	var keys []keyed
	for k := range props {
		if !strings.HasPrefix(k, "question_") || strings.HasSuffix(k, "_custom") {
			continue
		}
		idx, err := strconv.Atoi(strings.TrimPrefix(k, "question_"))
		if err != nil {
			continue
		}
		keys = append(keys, keyed{k, idx})
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i].idx < keys[j].idx })

	out := make([]parsedQuestion, 0, len(keys))
	for _, k := range keys {
		field, ok := props[k.key].(map[string]any)
		if !ok {
			continue
		}
		multiple := asString(field["type"]) == "array"
		options := make([]ChoiceOption, 0)
		for _, raw := range optionList(field, multiple) {
			opt, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			label := asString(opt["const"])
			if label == "" {
				continue
			}
			options = append(options, ChoiceOption{ID: label, Label: label, Description: optionDescription(opt)})
		}
		if len(options) == 0 {
			continue
		}
		_, hasCustom := props[k.key+"_custom"]
		out = append(out, parsedQuestion{
			req: ChoiceRequest{
				ID:         newChoiceID(),
				Title:      questionTitle(form, field),
				Options:    options,
				Multiple:   multiple,
				AllowOther: hasCustom,
			},
			fieldKey: k.key,
			multiple: multiple,
		})
	}
	return out
}

// optionList returns a question's enum options: oneOf for single-select, items.anyOf for multi-select.
func optionList(field map[string]any, multiple bool) []any {
	if multiple {
		if items, ok := field["items"].(map[string]any); ok {
			if anyOf, ok := items["anyOf"].([]any); ok {
				return anyOf
			}
		}
		return nil
	}
	oneOf, _ := field["oneOf"].([]any)
	return oneOf
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

// fs sandboxing and terminals come later — deny for now.
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

func toUpdate(u acp.SessionUpdate) (Update, bool) {
	switch {
	case u.AgentMessageChunk != nil:
		return Update{Type: "message_chunk", Delta: blockText(u.AgentMessageChunk.Content)}, true
	case u.UserMessageChunk != nil:
		// Only seen during loadSession history replay; live user prompts are sent by us, not echoed.
		return Update{Type: "user_message", Delta: blockText(u.UserMessageChunk.Content)}, true
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
	return &ToolCall{
		ID:     string(tc.ToolCallId),
		Title:  tc.Title,
		Kind:   string(tc.Kind),
		Status: string(tc.Status), // value here; the *Update variant is a pointer (see toolStatus)
		Input:  tc.RawInput,       // the tool's arguments, shown in the card
	}
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

func toPermissionRequest(p acp.RequestPermissionRequest) PermissionRequest {
	tc := toToolCallRef(p.ToolCall)
	perCallOnly := isNeverAutoApprovable(tc.Title) // only board_exec: everything else may be granted for good, as Claude Code offers it
	opts := make([]PermissionOption, 0, len(p.Options))
	for _, o := range p.Options {
		if perCallOnly && isPersistentGrantOption(string(o.OptionId), string(o.Kind)) {
			continue
		}
		opts = append(opts, PermissionOption{ID: string(o.OptionId), Label: o.Name, Kind: string(o.Kind)})
	}
	if n := len(p.Options) - len(opts); n > 0 { // a request left with no options can only be denied; log so that's explicable, not a broken dialog
		slog.Info("[permission] dropped persistent-grant options", "tool", tc.Title, "dropped", n, "remaining", len(opts))
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
