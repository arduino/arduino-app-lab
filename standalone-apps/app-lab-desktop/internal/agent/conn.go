package agent

import (
	"context"
	"io"
)

// AgentConn is our thin interface over the pre-1.0 coder/acp-go-sdk (only sdkConn imports it).
type AgentConn interface {
	Initialize(ctx context.Context) ([]AuthMethod, error) // returns the agent's advertised auth methods
	Authenticate(ctx context.Context, methodID string) error
	NewSession(ctx context.Context, cwd string) (NewSessionResult, error)                 // also returns the advertised models
	ListSessions(ctx context.Context, cwd string) ([]SessionSummary, error)               // persisted sessions for a workspace
	LoadSession(ctx context.Context, sid SessionID, cwd string) (NewSessionResult, error) // re-establish a session (replays history); returns its models/modes
	Prompt(ctx context.Context, sid SessionID, text string) error                         // blocks until the turn ends
	Cancel(ctx context.Context, sid SessionID) error
	CloseSession(ctx context.Context, sid SessionID) error             // best-effort; frees the session on the agent
	DeleteSession(ctx context.Context, sid SessionID) error            // permanently removes a persisted session (UNSTABLE)
	SetModel(ctx context.Context, sid SessionID, modelID string) error // optional capability
	SetMode(ctx context.Context, sid SessionID, modeID string) error   // optional capability
	SetMCPServers(servers []MCPServer)                                 // MCP servers to advertise on every session (set before Start)
	SetBoardName(name string)                                          // connected board's display name, stated in every session's system prompt (set before Start)
	Close() error
}

// MCPServer is an HTTP MCP endpoint (URL + bearer token) handed to the agent for board tools.
type MCPServer struct {
	URL           string
	Token         string
	ReadOnlyTools []string // bare tool names auto-approved (no permission prompt) via the session allowedTools
}

// ClientHandler receives the agent's callbacks; the Manager implements it.
type ClientHandler interface {
	HandleUpdate(sid SessionID, u Update)
	HandlePermission(ctx context.Context, req PermissionRequest) PermissionOutcome // blocks for the reply
	// HandleElicitation blocks for one reply per question. sid is the session recovered from the wire, "" when it couldn't be.
	HandleElicitation(ctx context.Context, sid SessionID, questions []ChoiceRequest) []ChoiceSubmission
}

// ConnFactory builds an AgentConn over the agent process stdio (tests inject a fake).
type ConnFactory func(stdin io.Writer, stdout io.Reader, handler ClientHandler) (AgentConn, error)

// DefaultConnFactory is the SDK-backed factory, registered by acpconn.go's init().
var DefaultConnFactory ConnFactory
