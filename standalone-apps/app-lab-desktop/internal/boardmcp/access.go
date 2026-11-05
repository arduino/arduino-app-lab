package boardmcp

import (
	"context"
	"fmt"
	"strings"
)

// BoardAccess is the seam board tools use to reach the board without importing App Lab internals; it grows one method at a time.
type BoardAccess interface {
	// OrchestratorBaseURL returns the board orchestrator base URL (e.g. http://localhost:8800), or an error when no board is connected.
	OrchestratorBaseURL(ctx context.Context) (string, error)
	// SelectedBoard returns the board App Lab currently has selected (Connected=false when none).
	SelectedBoard(ctx context.Context) (BoardStatus, error)
	// NetworkStatus reports the board's Wi-Fi state, active connection and internet reachability (over the board connection).
	NetworkStatus(ctx context.Context) (NetworkStatus, error)
	// ListWiFiNetworks scans for Wi-Fi networks the board can see (SSIDs, deduplicated), over the board connection.
	ListWiFiNetworks(ctx context.Context) ([]string, error)
	// RequestWiFiConnect asks the UI to open its Wi-Fi dialog on this SSID so the USER types the password there: it must never reach the agent, where it would land in the model's context and the session history.
	RequestWiFiConnect(ssid string)
	// DisconnectWiFi drops the board's Wi-Fi; refused when App Lab reaches the board over the network, which would sever the very link the agent works through.
	DisconnectWiFi(ctx context.Context) error
	// CheckoutApp mirrors an app's files from the board into a local working copy; edits there sync back at turn-end,
	// except for a built-in app (Checkout.ReadOnly), whose board copy is never written.
	CheckoutApp(ctx context.Context, appID string) (Checkout, error)
	// Exec runs a shell command on the board over App Lab's existing connection (never the host — §2, decision 6),
	// after flushing pending mirror edits; returns the command's (bounded) output. Backs the board_exec escape hatch (§2.8).
	Exec(ctx context.Context, command, cwd string) (string, error)
	// SystemName returns the board's configured device name (e.g. "estrella"), distinct from its model; error when no board.
	SystemName(ctx context.Context) (string, error)
	// ListBoards returns the boards App Lab currently detects (host-side discovery), flagging the selected one.
	ListBoards(ctx context.Context) ([]BoardSummary, error)
	// RequestImportCustomModel asks the UI to open its own Edge Impulse model picker for a brick: pulling a new impulse needs the user's Edge Impulse project key, which App Lab holds and the agent must never see.
	RequestImportCustomModel(appID, brickID string)
	// CarrierStatus reports the carrier configuration and the media nodes the kernel exposes; read-only.
	CarrierStatus(ctx context.Context) (CarrierStatus, error)

	// RequestOpenAppUI asks the UI to auto-open an app's web UI and forward its ports once it's running — matching a manual run, for apps the agent starts.
	RequestOpenAppUI(appID string)

	// ForgetWorkspaceApp drops what was keyed on a deleted app. App ids are derived from the name, so a later app of the same name would otherwise inherit its permissions.
	ForgetWorkspaceApp(appID string)
	// RebindWorkspaceApp carries grants and chats onto the id a rename mints; the note it returns is for the renaming tool's result.
	RebindWorkspaceApp(oldID, newID, newName string) (note string)
	// RefreshManagedFiles copies the board's app.yaml and sketch/sketch.yaml into the app's checkout, after a tool changed them on the board.
	RefreshManagedFiles(appID string)
	// RenameAppFile renames or moves a user app's file or folder with the file tree's own operation; paths are relative to the app folder, and the note says what became of the checkout.
	RenameAppFile(ctx context.Context, appID, from, to string) (note string, err error)
	// DeleteAppFile deletes a user app's file or folder with the file tree's own operation; rel is relative to the app folder, and the note says what became of the checkout.
	DeleteAppFile(ctx context.Context, appID, rel string) (note string, err error)
	// FlushMirrorEdits pushes the agent's pending edits to one app to the board now, returning its outcome (appID →
	// error, empty/nil when it synced). RULE: call it before any board action that reads an app's source (apps_start,
	// apps_clone) so that action sees the latest code instead of waiting for turn-end — and refuse (or warn) when the
	// app the action targets is in the failed set. Only that app: another chat may be halfway through editing the others.
	// The three outcomes stay apart because they call for different advice: a push that failed is transient, a conflict
	// needs a re-checkout instead of a retry, and withheld edits to a built-in app can only ever land in a clone.
	// notes are one-time messages about the push, for the calling tool's result.
	FlushMirrorEdits(appID string) (failed, conflicts, withheld map[string]error, notes []string)
	// PendingGhostEdits lists mirror dirs holding agent edits that belong to no checked-out app (stable order), so tools can warn they are not on the board.
	PendingGhostEdits() []string
	// PendingSyncIssues lists per-app warnings for the latest syncs that failed or conflicted (stable order), so tools can tell the agent its earlier edits did not land.
	PendingSyncIssues() []string
}

// SyncIssueWarning renders the pending sync failure/conflict warnings as a tool-result prefix ("" when none).
func SyncIssueWarning(lines []string) string {
	if len(lines) == 0 {
		return ""
	}
	return strings.Join(lines, "\n") + "\n\n"
}

// GhostEditWarning renders the stranded-edit warning block prefixed to tool results ("" when there are no ghosts).
func GhostEditWarning(dirs []string) string {
	if len(dirs) == 0 {
		return ""
	}
	var b strings.Builder
	for _, dir := range dirs {
		fmt.Fprintf(&b, "warning: files were written under %s, which is not a checked-out app — those edits are NOT on the board and will not run. Do not copy them over with board_exec; re-run apps_checkout for the intended app and re-apply the changes there.\n", dir)
	}
	b.WriteString("\n")
	return b.String()
}

// Checkout is the local working copy CheckoutApp hands back.
type Checkout struct {
	Path     string   // the local directory holding the app's files
	Parked   []string // files whose local edits lost a both-sides conflict and were saved aside as .claude-local copies
	ReadOnly bool     // a built-in example or an installed App release: edits never reach the board
	Stale    error    // why a re-checkout could not refresh the copy from the board, so its files may be out of date; nil when it could
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

// CarrierStatus pairs what is configured with what the kernel actually exposes: two different questions.
type CarrierStatus struct {
	Connected    bool               `json:"connected"` // a board is selected; the rest is meaningful only then
	Carriers     []CarrierConfig    `json:"carriers,omitempty"`
	VideoDevices []VideoDevice      `json:"videoDevices,omitempty"`
	Displays     []DisplayConnector `json:"displays,omitempty"`
	// Fields whose probe failed. They are absent below because they were not read, not because there is nothing.
	Unread []string `json:"unread,omitempty"`
}

// CarrierConfig is one carrier the platform knows, with its slots. Being listed says nothing about it being attached.
type CarrierConfig struct {
	Name string `json:"name"`
	// Absent when the carrier's configuration could not be read; false is never assumed.
	Enabled         *bool `json:"enabled,omitempty"`
	EnabledNextBoot *bool `json:"enabledNextBoot,omitempty"`
	// "unknown" while the carrier is disabled: nothing on the board can then tell attached hardware from absent.
	Attached string          `json:"attached,omitempty"`
	Devices  []CarrierDevice `json:"devices,omitempty"`
}

// CarrierDevice is one slot on a carrier: what it is set to now, and what else it could be set to.
type CarrierDevice struct {
	Name           string   `json:"name"`
	Type           string   `json:"type,omitempty"`
	Option         string   `json:"option,omitempty"`         // absent when the configuration was not read, or the slot was not in it; "none" means read and unset
	OptionNextBoot string   `json:"optionNextBoot,omitempty"` // only when a change is staged for the next boot
	Options        []string `json:"options,omitempty"`
}

// VideoDevice is a /dev/video* node the kernel exposes, by its driver name — a camera pipeline or a codec.
type VideoDevice struct {
	Path string `json:"path"`
	Name string `json:"name,omitempty"`
}

// DisplayConnector is a DRM connector: its status is real detection for a physical port like DP.
type DisplayConnector struct {
	Connector string `json:"connector"`
	Status    string `json:"status,omitempty"` // connected | disconnected | unknown
	Enabled   bool   `json:"enabled"`
}

// NetworkStatus is the board's connectivity: Wi-Fi state, active connection name and whether it can reach the internet.
type NetworkStatus struct {
	Connected      bool   `json:"connected"`                // a board is selected (the other fields are meaningful only then)
	Wifi           string `json:"wifi,omitempty"`           // connected | connecting | disconnected
	ConnectionName string `json:"connectionName,omitempty"` // active network name (SSID / connection)
	Internet       bool   `json:"internet"`                 // the board can reach the internet
}
