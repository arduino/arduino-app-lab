package agent

// These mirror the TS domain contract; JSON tags match the TS fields.

type SessionID string

// AgentModel is a model the agent advertises for a session; ID is passed back to SetModel.
type AgentModel struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"` // ACP option description (carries the resolved version, e.g. "Opus 4.8 with 1M context · …")
}

// AgentMode is an operating mode the agent advertises for a session (ACP session mode); ID is passed back to SetMode.
type AgentMode struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"` // ACP mode description (e.g. "Planning mode, no actual tool execution")
}

// SessionSummary is one persisted session as listed for the sidebar (from ACP SessionInfo).
type SessionSummary struct {
	ID        string `json:"id"`
	Title     string `json:"title,omitempty"`     // agent-generated summary; may be overridden by a client rename later
	UpdatedAt string `json:"updatedAt,omitempty"` // ISO 8601 last-activity timestamp
	Status    string `json:"status,omitempty"`    // last-turn outcome overlaid by App Lab: "error" or empty (idle); live states are FE-only
	Pinned    bool   `json:"pinned,omitempty"`    // client-side: user pinned this session to the top of the sidebar
}

// NewSessionResult is a new session's id plus the models and modes the agent advertised at creation.
type NewSessionResult struct {
	SessionID      SessionID
	Models         []AgentModel
	CurrentModelID string
	Modes          []AgentMode
	CurrentModeID  string
}

// Update mirrors the TS AgentUpdate union, flattened for JSON to the webview.
type Update struct {
	Type        string         `json:"type"`                  // message_chunk | thinking | tool_call | tool_call_update | checklist | model_change | mode_change
	Delta       string         `json:"delta,omitempty"`       // message_chunk, thinking
	ToolCall    *ToolCall      `json:"toolCall,omitempty"`    // tool_call
	ID          string         `json:"id,omitempty"`          // tool_call_update
	Status      string         `json:"status,omitempty"`      // tool_call_update
	Output      string         `json:"output,omitempty"`      // tool_call_update
	Input       any            `json:"input,omitempty"`       // tool_call_update (refined args)
	Checklist   *Checklist     `json:"checklist,omitempty"`   // checklist
	Choices     *ChoiceRequest `json:"choices,omitempty"`     // choices (form elicitation)
	ModelID     string         `json:"modelId,omitempty"`     // model_change
	Models      []AgentModel   `json:"models,omitempty"`      // model_change
	ModeID      string         `json:"modeId,omitempty"`      // mode_change
	UsedTokens  int            `json:"usedTokens,omitempty"`  // usage
	ContextSize int            `json:"contextSize,omitempty"` // usage
}

type ToolCall struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Kind   string `json:"kind,omitempty"`
	Status string `json:"status"`
	Input  any    `json:"input,omitempty"` // the tool's raw arguments (ACP rawInput)
	Output string `json:"output,omitempty"`
}

type ChecklistItem struct {
	Label  string `json:"label"`
	Status string `json:"status"` // pending | in_progress | completed (matches ACP PlanEntryStatus)
}

// Checklist mirrors the agent's plan (ACP Plan): a full snapshot replaced in place by its stable id.
type Checklist struct {
	ID    string          `json:"id"`
	Title string          `json:"title"`
	Items []ChecklistItem `json:"items"`
}

// ChoiceOption is one selectable answer in a ChoiceRequest; ID is echoed back in the submission.
type ChoiceOption struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Description string `json:"description,omitempty"`
}

// ChoiceRequest is a question the agent asks via an ACP form elicitation (e.g. Claude's AskUserQuestion).
// Multiple allows several picks; AllowOther adds a free-text answer; ID correlates the reply (ChoiceSubmission).
type ChoiceRequest struct {
	ID         string         `json:"id"`
	Title      string         `json:"title"`
	Options    []ChoiceOption `json:"options"`
	Multiple   bool           `json:"multiple,omitempty"`
	AllowOther bool           `json:"allowOther,omitempty"`
	// BatchID groups the questions of one AskUserQuestion so the UI can page through them; Total is that count.
	BatchID string `json:"batchId,omitempty"`
	Total   int    `json:"total,omitempty"`
}

// ChoiceSubmission is the user's answer to a ChoiceRequest: picked option ids + optional free-text; Cancelled = skipped.
type ChoiceSubmission struct {
	SelectedIDs []string `json:"selectedIds"`
	Other       string   `json:"other,omitempty"`
	Cancelled   bool     `json:"cancelled,omitempty"`
}

type PermissionOption struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Kind  string `json:"kind"`
}

type PermissionRequest struct {
	ID        string             `json:"id"`
	SessionID SessionID          `json:"sessionId"`
	ToolCall  *ToolCall          `json:"toolCall,omitempty"`
	Options   []PermissionOption `json:"options"`
	TimeoutMs int                `json:"timeoutMs,omitempty"`
}

// clone deep-copies the request (options + the tool call and its decoded-JSON Input) so a copy published for UI rehydration shares no mutable map with the one the host enriches in place — sharing it is a fatal concurrent read+write (see HandlePermission).
func (r PermissionRequest) clone() PermissionRequest {
	out := r
	out.Options = append([]PermissionOption(nil), r.Options...)
	if r.ToolCall != nil {
		tc := *r.ToolCall
		tc.Input = cloneJSONValue(r.ToolCall.Input)
		out.ToolCall = &tc
	}
	return out
}

// cloneJSONValue deep-copies a decoded-JSON value (maps/slices; scalars are immutable and pass through).
func cloneJSONValue(v any) any {
	switch t := v.(type) {
	case map[string]any:
		out := make(map[string]any, len(t))
		for k, val := range t {
			out[k] = cloneJSONValue(val)
		}
		return out
	case []any:
		out := make([]any, len(t))
		for i, val := range t {
			out[i] = cloneJSONValue(val)
		}
		return out
	default:
		return v
	}
}

type PermissionOutcome struct {
	OptionID  string `json:"optionId,omitempty"`
	Cancelled bool   `json:"cancelled,omitempty"`
}

// SessionState lets the UI rehydrate after a reload: turn status, model, mode, and any pending permission.
type SessionState struct {
	SessionID         SessionID          `json:"sessionId"`
	Status            string             `json:"status"` // idle | streaming
	ModelID           string             `json:"modelId,omitempty"`
	Models            []AgentModel       `json:"models,omitempty"` // models the agent advertises for this session
	ModeID            string             `json:"modeId,omitempty"`
	Modes             []AgentMode        `json:"modes,omitempty"` // operating modes the agent advertises for this session
	PendingPermission *PermissionRequest `json:"pendingPermission,omitempty"`
}

// AuthMethodType is how a login method is performed.
type AuthMethodType string

const (
	AuthAgent    AuthMethodType = "agent"    // the agent logs in itself (ACP Authenticate)
	AuthEnvVar   AuthMethodType = "env_var"  // a key set as an env var at spawn
	AuthTerminal AuthMethodType = "terminal" // run the agent binary with Args in a terminal
)

// AuthMethod is a login option the agent advertises at initialize; how it's run depends on Type.
type AuthMethod struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	Type        AuthMethodType `json:"type,omitempty"`
	Args        []string       `json:"args,omitempty"` // terminal: args to run the agent binary with
}

// AuthStatus reports whether an agent can start without a fresh sign-in (persisted login or a key set this session).
type AuthStatus struct {
	Authenticated bool   `json:"authenticated"`
	AgentID       string `json:"agentId,omitempty"`
	// IsDefault reports whether this agent is the default launched for new sessions.
	IsDefault bool `json:"isDefault,omitempty"`
	// Rich details for the Settings "Agent" section; empty when unknown (the UI shows a dash).
	Method      string `json:"method,omitempty"`      // "subscription" | "api_key"
	Account     string `json:"account,omitempty"`     // email (subscription) or masked key (api_key)
	ConnectedAt string `json:"connectedAt,omitempty"` // ISO 8601, approximate
}
