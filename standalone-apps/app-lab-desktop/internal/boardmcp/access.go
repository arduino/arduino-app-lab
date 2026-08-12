package boardmcp

import "context"

// BoardAccess is the seam board tools use to reach the board without importing App Lab internals; it grows one method at a time.
type BoardAccess interface {
	// OrchestratorBaseURL returns the board orchestrator base URL (e.g. http://localhost:8800), or an error when no board is connected.
	OrchestratorBaseURL(ctx context.Context) (string, error)
	// SelectedBoard returns the board App Lab currently has selected (Connected=false when none).
	SelectedBoard(ctx context.Context) (BoardStatus, error)
	// NetworkStatus reports the board's Wi-Fi state, active connection and internet reachability (over the board connection).
	NetworkStatus(ctx context.Context) (NetworkStatus, error)
	// CheckoutApp mirrors an app's files from the board into a local working copy and returns its path; edits there sync back at turn-end.
	CheckoutApp(ctx context.Context, appID string) (string, error)
	// Exec runs a shell command on the board over App Lab's existing connection (never the host — §2, decision 6),
	// after flushing pending mirror edits; returns the command's (bounded) output. Backs the board_exec escape hatch (§2.8).
	Exec(ctx context.Context, command, cwd string) (string, error)
	// SystemName returns the board's configured device name (e.g. "estrella"), distinct from its model; error when no board.
	SystemName(ctx context.Context) (string, error)
	// ListBoards returns the boards App Lab currently detects (host-side discovery), flagging the selected one.
	ListBoards(ctx context.Context) ([]BoardSummary, error)
	// RequestOpenAppUI asks the UI to auto-open an app's web UI and forward its ports once it's running — matching a manual run, for apps the agent starts.
	RequestOpenAppUI(appID string)
	// FlushMirrorEdits pushes the agent's pending mirror edits to the board now, returning the apps whose sync
	// failed (appID → error, empty/nil when all synced). RULE: call it before any board action that reads an
	// app's source (apps_start, apps_clone, board_exec) so that action sees the latest code instead of waiting
	// for turn-end — and refuse (or warn) when the app the action targets is in the failed set.
	// conflicts are separate from failed: a push that failed is transient, a conflict needs a re-checkout instead of a retry.
	FlushMirrorEdits() (failed, conflicts map[string]error)
}

// BoardSummary is one detected board in a boards_list result (App Lab-side discovery, not the orchestrator).
type BoardSummary struct {
	Name       string `json:"name,omitempty"`       // model, e.g. "Arduino UNO Q"
	CustomName string `json:"customName,omitempty"` // user-set device name, e.g. "estrella"
	Serial     string `json:"serial,omitempty"`
	FQBN       string `json:"fqbn,omitempty"`
	Protocol   string `json:"protocol,omitempty"` // serial | network | local
	Address    string `json:"address,omitempty"`
	Selected   bool   `json:"selected"` // the board App Lab currently has selected (the one all other tools act on)
}

// BoardStatus is the connected board's identity, from App Lab's selection (not the orchestrator).
type BoardStatus struct {
	Connected bool   `json:"connected"`
	Name      string `json:"name,omitempty"`   // model/name from detection, e.g. "Arduino UNO Q"
	Serial    string `json:"serial,omitempty"` // board serial
}

// NetworkStatus is the board's connectivity: Wi-Fi state, active connection name and whether it can reach the internet.
type NetworkStatus struct {
	Connected      bool   `json:"connected"`                // a board is selected (the other fields are meaningful only then)
	Wifi           string `json:"wifi,omitempty"`           // connected | connecting | disconnected
	ConnectionName string `json:"connectionName,omitempty"` // active network name (SSID / connection)
	Internet       bool   `json:"internet"`                 // the board can reach the internet
}
