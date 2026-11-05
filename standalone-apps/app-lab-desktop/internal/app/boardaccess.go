package app

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"app-lab-desktop/internal/board"
	"app-lab-desktop/internal/boardmcp"
	"app-lab-desktop/internal/network"
	"app-lab-desktop/internal/network/wifi"
)

// listBoardsTimeout bounds the discovery scan (serial/network/adb) so boards_list can't hang the tool call.
const listBoardsTimeout = 15 * time.Second

// boardAccess adapts App to boardmcp.BoardAccess, delegating to the existing App Lab board plumbing.
type boardAccess struct{ app *App }

// appAgentStartedEvent tells the FE to auto-open an agent-started app's web UI once it's running.
const appAgentStartedEvent = "app:agent-started"

// appAgentRenamedEvent tells the FE the agent renamed an app, so a page and a chat on the old id follow it to the new one.
const appAgentRenamedEvent = "app:agent-renamed"

// ForgetWorkspaceApp drops a deleted app's workspace grants (see App.ForgetWorkspaceApp).
func (b boardAccess) ForgetWorkspaceApp(appID string) { b.app.ForgetWorkspaceApp(appID) }

func (b boardAccess) RebindWorkspaceApp(oldID, newID, newName string) string {
	release := b.app.holdRename(oldID, newID) // before the event: the page that follows it lists the chats, which runs a sweep
	defer release()
	// Sent before the rebind: the board saves app.yaml in the renamed folder, and a page still on the old id reads the refresh that follows as the app being deleted.
	b.app.emit(appAgentRenamedEvent, oldID, newID, newName)
	return b.app.rebindWorkspaceApp(oldID, newID, newName)
}

// RefreshManagedFiles copies the board's app.yaml and sketch.yaml into the app's checkout (see App.refreshManagedFiles).
func (b boardAccess) RefreshManagedFiles(appID string) { b.app.refreshManagedFiles(appID) }

// RequestOpenAppUI emits the event so the UI opens/forwards the app's web UI once it's running (same as a manual run).
func (b boardAccess) RequestOpenAppUI(appID string) {
	runtime.EventsEmit(b.app.ctx(), appAgentStartedEvent, appID)
}

// FlushMirrorEdits pushes one app only, as the others may be mid-edit in another chat; its notes go in the calling tool's result, and with their next prompt to the other running chats that edited the app.
func (b boardAccess) FlushMirrorEdits(appID string) (failed, conflicts, withheld map[string]error, notes []string) {
	failed, conflicts, withheld, byApp := b.app.syncCheckouts(time.Time{}, true, func(id string) bool { return id == appID })
	b.app.notifyChatsThatEdited(byApp, "", appID)
	return failed, conflicts, withheld, byApp[appID]
}

// agentWifiConnectEvent tells the FE to open its Wi-Fi dialog on an SSID the agent proposed.
const agentWifiConnectEvent = "wifi:agent-connect"

// ListWiFiNetworks scans for networks over the board connection (same scan the Wi-Fi dialog uses).
func (b boardAccess) ListWiFiNetworks(context.Context) ([]string, error) {
	sb := b.app.boardSnapshot()
	if !sb.HasConn() { // the scan runs over the connection
		return nil, fmt.Errorf("no board connected")
	}
	return wifi.ListSSIDs(b.app.ctx(), sb.Conn) // the snapshot's conn, so the check and the scan are one board
}

// RequestWiFiConnect hands the join to App Lab's own Wi-Fi dialog: a passphrase reaching the agent would travel through the model's context, the session history and the permission prompt in clear text.
func (b boardAccess) RequestWiFiConnect(ssid string) {
	runtime.EventsEmit(b.app.ctx(), agentWifiConnectEvent, ssid)
}

// agentModelImportEvent tells the FE to open its model picker on the brick the agent named.
const agentModelImportEvent = "models:agent-import"

// RequestImportCustomModel hands the import to App Lab's own picker: the Edge Impulse project key would otherwise travel through the model's context, the session history and the permission prompt in clear text.
func (b boardAccess) RequestImportCustomModel(appID, brickID string) {
	runtime.EventsEmit(b.app.ctx(), agentModelImportEvent, appID, brickID)
}

// DisconnectWiFi drops the board's Wi-Fi, unless App Lab is talking to the board over that very network.
func (b boardAccess) DisconnectWiFi(context.Context) error {
	sb := b.app.boardSnapshot()
	if !sb.HasConn() {
		return fmt.Errorf("no board connected")
	}
	// Dropping Wi-Fi on a board we reach over IP cuts App Lab off mid-call, with only a physical reconnect left; USB and on-board (SBC) links don't depend on it.
	if sb.IsNetwork() {
		return fmt.Errorf("this board is connected over the network (%s), so disconnecting its Wi-Fi would also cut App Lab's own connection to it — refused. Tell the user to switch to a USB connection first if they really want this", sb.Info.Address)
	}
	return wifi.Disconnect(b.app.ctx(), sb.Conn) // the snapshot's conn, so the check and the drop are one board
}

// PendingGhostEdits lists mirror dirs holding agent edits that match no board app (stranded), for tool-result warnings.
func (b boardAccess) PendingGhostEdits() []string {
	return b.app.pendingGhostEdits()
}

// PendingSyncIssues lists per-app warnings for syncs that failed or conflicted, so the agent learns its edits did not land.
func (b boardAccess) PendingSyncIssues() []string {
	return b.app.pendingSyncWarnings()
}

// OrchestratorBaseURL returns the connected board's orchestrator URL via the existing App Lab resolver.
func (b boardAccess) OrchestratorBaseURL(context.Context) (string, error) {
	return b.app.InferOrchestratorURL()
}

// SelectedBoard reports the currently selected board from cached detection info (no board I/O). Presence follows the connection, never the serial — network boards report none, so gating on one called a connected board disconnected.
func (b boardAccess) SelectedBoard(context.Context) (boardmcp.BoardStatus, error) {
	sb := b.app.boardSnapshot()
	if !sb.HasConn() {
		return boardmcp.BoardStatus{Connected: false}, nil
	}
	return boardmcp.BoardStatus{
		Connected: true,
		Name:      sb.Info.BoardName,
		Serial:    sb.Info.Serial, // empty for a network board; the name identifies it
	}, nil
}

// SystemName returns the selected board's configured device name; guards the no-board case (unlike App.GetBoardName, which assumes a board).
func (b boardAccess) SystemName(ctx context.Context) (string, error) {
	sb := b.app.boardSnapshot()
	if !sb.HasConn() { // reads the name over the connection
		return "", fmt.Errorf("no board connected")
	}
	return sb.GetName(ctx)
}

// ListBoards runs App Lab's host-side board discovery and flags the selected one. It calls board.GetBoards
// directly (not App Lab's detectBoards) so it doesn't mutate the shared detected-boards cache from the MCP goroutine.
func (b boardAccess) ListBoards(ctx context.Context) ([]boardmcp.BoardSummary, error) {
	ctx, cancel := context.WithTimeout(ctx, listBoardsTimeout)
	defer cancel()
	boards, err := board.GetBoards(ctx)
	if err != nil {
		return nil, err
	}
	// Match on identity, not serial: a network board has none, and comparing two empty serials would flag nothing or every network board.
	selID := ""
	if sb := b.app.boardSnapshot(); sb.HasConn() {
		selID = boardIdentity(sb.Info.Serial, sb.Info.Address)
	}
	out := make([]boardmcp.BoardSummary, 0, len(boards))
	for _, bd := range boards {
		out = append(out, boardmcp.BoardSummary{
			Name:       bd.Info.BoardName,
			CustomName: bd.Info.CustomName,
			Serial:     bd.Info.Serial,
			FQBN:       bd.Info.FQBN,
			Protocol:   bd.Info.Protocol,
			Address:    bd.Info.Address,
			Selected:   selID != "" && boardIdentity(bd.Info.Serial, bd.Info.Address) == selID,
		})
	}
	return out, nil
}

// CheckoutApp mirrors the app's files from the board into a local working copy the agent can edit natively.
func (b boardAccess) CheckoutApp(_ context.Context, appID string) (boardmcp.Checkout, error) {
	return b.app.checkoutApp(appID)
}

const (
	// boardExecTimeout is generous: board_exec covers heavy one-offs like `pip install`, not just quick commands.
	boardExecTimeout = 10 * time.Minute
	// maxBoardExecOutput caps captured output so a chatty command can't blow the model's context (best-effort — Output reads it all first).
	maxBoardExecOutput = 64 << 10
)

// Exec runs a shell command on the board over the shared connection (never the host — §2 decision 6), flushing pending
// mirror edits first so the command runs against the latest files. Backs the board_exec escape hatch (§2.8).
func (b boardAccess) Exec(ctx context.Context, command, cwd string) (string, error) {
	sb := b.app.boardSnapshot()
	if !sb.HasConn() { // the command runs over the connection
		return "", fmt.Errorf("no board connected")
	}
	// Force-push pending mirror edits so the command sees the latest code; on failure still run, but tell the agent.
	syncWarn := ""
	failed, _, withheld, notes := b.app.syncCheckouts(time.Time{}, true, nil)
	if len(failed) > 0 {
		syncWarn = "warning: some agent edits could not be synced to the board; the command may see stale files.\n\n"
	}
	if len(withheld) > 0 {
		syncWarn += "warning: edits to a built-in example were withheld (" + flushFailureSummary(withheld) + "); the board still holds the shipped files.\n\n"
	}
	b.app.notifyChatsThatEdited(notes, "board_exec", "")
	noted := make([]string, 0, len(notes))
	for appID := range notes {
		noted = append(noted, appID)
	}
	sort.Strings(noted)
	for _, appID := range noted {
		syncWarn += boardmcp.SyncIssueWarning(notes[appID])
	}
	syncWarn += boardmcp.SyncIssueWarning(b.PendingSyncIssues()) + boardmcp.GhostEditWarning(b.PendingGhostEdits())
	full := command
	if c := strings.TrimSpace(cwd); c != "" {
		full = "cd '" + strings.ReplaceAll(c, "'", `'\''`) + "' && " + command
	}
	ctx, cancel := context.WithTimeout(ctx, boardExecTimeout)
	defer cancel()
	out, err := execOnBoard(ctx, sb, full)
	text := string(out)
	if len(text) > maxBoardExecOutput { // keep the tail — results/errors are usually at the end
		text = "…(output truncated)\n" + text[len(text)-maxBoardExecOutput:]
	}
	text = syncWarn + text
	if err != nil {
		if strings.TrimSpace(text) != "" {
			return "", fmt.Errorf("command failed: %w\n%s", err, text)
		}
		return "", fmt.Errorf("command failed: %w", err)
	}
	return text, nil
}

// awaitBoard enforces ctx itself: the vendored SSH Output() ignores its context (blocks in CombinedOutput), so we run
// the command on a goroutine and select on ctx — bounding our wait, not the remote command (no session handle to kill),
// draining into a buffered channel so nothing leaks. Every board command on a caller's deadline goes through here.
func awaitBoard[T any](ctx context.Context, fn func() (T, error)) (T, error) {
	var zero T
	// Checked before dispatching: an expired caller must not issue one more command, and a multi-command probe
	// would otherwise keep going after its deadline, abandoning a session per step.
	if err := ctx.Err(); err != nil {
		return zero, err
	}
	type result struct {
		out T
		err error
	}
	ch := make(chan result, 1) // buffered: the goroutine must not block once we've stopped waiting
	started := time.Now()
	go func() {
		out, err := fn()
		ch <- result{out, err}
	}()
	select {
	case r := <-ch:
		return r.out, r.err
	case <-ctx.Done():
		waited := time.Since(started).Round(time.Second)
		return zero, fmt.Errorf("the command did not finish within %s and was abandoned (it may still be running on the board): %w", waited, ctx.Err())
	}
}

// boardSnapshot copies the selected board under boardMu, for the readers that run on the agent's goroutines.
// The agent keeps running across a same-board re-select, so it reads Conn and tunnels while selectBoard
// overwrites the whole struct; Conn is an interface and tunnels a slice, so an unsynchronised read can see
// half of each board. The copy is taken once and used for the whole call.
func (a *App) boardSnapshot() *board.Board {
	a.boardMu.RLock()
	defer a.boardMu.RUnlock()
	if a.selectedBoard == nil {
		return board.Noop()
	}
	sb := *a.selectedBoard
	return &sb
}

// boardConn reads the selected board's connection under boardMu. Every board I/O goes through it: the agent
// runs across a same-board re-select, so reading the field directly races setSelectedBoard's write.
func (a *App) boardConn() remote.RemoteConn {
	a.boardMu.RLock()
	defer a.boardMu.RUnlock()
	if a.selectedBoard == nil {
		return nil
	}
	return a.selectedBoard.Conn
}

// setSelectedBoard installs the board selectBoard just connected. Paired with boardSnapshot: the agent's copy
// and this write take the same lock.
func (a *App) setSelectedBoard(b *board.Board) {
	a.boardMu.Lock()
	defer a.boardMu.Unlock()
	*a.selectedBoard = *b
}

// execOnBoard runs a shell command on the board. Its only auto-approved caller is carrier_status, with a constant
// command: anything built from model input belongs behind board_exec's permission prompt.
func execOnBoard(ctx context.Context, sb *board.Board, command string) ([]byte, error) {
	return awaitBoard(ctx, func() ([]byte, error) {
		return sb.Conn.GetCmd("sh", "-c", command).Output(ctx)
	})
}

// boardIdentity keys a board by serial, or by address for network boards that report none.
func boardIdentity(serial, address string) string {
	if serial != "" {
		return serial
	}
	return address
}

// flushFailureSummary flattens per-app sync failures into one line for agent-facing warnings.
func flushFailureSummary(failed map[string]error) string {
	parts := make([]string, 0, len(failed))
	for appID, err := range failed {
		parts = append(parts, fmt.Sprintf("%s: %v", appID, err))
	}
	return strings.Join(parts, "; ")
}

// NetworkStatus queries the board's Wi-Fi state, active connection and internet reachability over the shared board connection (bounded so a wedged link can't hang the tool).
func (b boardAccess) NetworkStatus(ctx context.Context) (boardmcp.NetworkStatus, error) {
	sb := b.app.boardSnapshot()
	if !sb.HasConn() { // queried over the connection
		return boardmcp.NetworkStatus{Connected: false}, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	status, err := network.GetNetworkStatus(ctx, sb.Conn)
	if err != nil {
		return boardmcp.NetworkStatus{}, fmt.Errorf("network status: %w", err)
	}
	out := boardmcp.NetworkStatus{
		Connected: true,
		Wifi:      string(status.WiFi),
		Internet:  status.Internet,
	}
	if name, err := network.GetConnectionName(ctx, sb.Conn); err == nil && name != nil {
		out.ConnectionName = *name
	}
	return out, nil
}
