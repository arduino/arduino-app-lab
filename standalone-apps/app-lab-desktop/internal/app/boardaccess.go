package app

import (
	"context"
	"fmt"
	"strings"
	"time"

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

// RequestOpenAppUI emits the event so the UI opens/forwards the app's web UI once it's running (same as a manual run).
func (b boardAccess) RequestOpenAppUI(appID string) {
	runtime.EventsEmit(b.app.ctx(), appAgentStartedEvent, appID)
}

// FlushMirrorEdits pushes pending mirror edits to the board now (before apps_start/apps_clone/board_exec),
// returning the apps whose sync failed so the caller can refuse to act on stale board code.
func (b boardAccess) FlushMirrorEdits() (failed, conflicts map[string]error) {
	return b.app.syncCheckouts(time.Time{}, true)
}

// OrchestratorBaseURL returns the connected board's orchestrator URL via the existing App Lab resolver.
func (b boardAccess) OrchestratorBaseURL(context.Context) (string, error) {
	return b.app.InferOrchestratorURL()
}

// SelectedBoard reports the currently selected board from cached detection info (no board I/O). Presence follows the connection, never the serial — network boards report none, so gating on one called a connected board disconnected.
func (b boardAccess) SelectedBoard(context.Context) (boardmcp.BoardStatus, error) {
	sb := b.app.selectedBoard
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
	sb := b.app.selectedBoard
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
	if sb := b.app.selectedBoard; sb.HasConn() {
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
func (b boardAccess) CheckoutApp(_ context.Context, appID string) (string, error) {
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
	sb := b.app.selectedBoard
	if !sb.HasConn() { // the command runs over the connection
		return "", fmt.Errorf("no board connected")
	}
	// Force-push pending mirror edits so the command sees the latest code; on failure still run, but tell the agent.
	syncWarn := ""
	if failed, _ := b.app.syncCheckouts(time.Time{}, true); len(failed) > 0 {
		syncWarn = "warning: some agent edits could not be synced to the board (" + flushFailureSummary(failed) + "); the command may see stale files.\n\n"
	}
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

// execOnBoard enforces ctx itself: the vendored SSH Output() ignores its context (blocks in CombinedOutput), so we run it on a goroutine and select on ctx — bounding our wait, not the remote command (no session handle to kill), draining into a buffered channel so nothing leaks.
func execOnBoard(ctx context.Context, sb *board.Board, command string) ([]byte, error) {
	type result struct {
		out []byte
		err error
	}
	ch := make(chan result, 1) // buffered: the goroutine must not block once we've stopped waiting
	go func() {
		out, err := sb.Conn.GetCmd("sh", "-c", command).Output(ctx)
		ch <- result{out, err}
	}()
	select {
	case r := <-ch:
		return r.out, r.err
	case <-ctx.Done():
		return nil, fmt.Errorf("the command did not finish within %s and was abandoned (it may still be running on the board): %w", boardExecTimeout, ctx.Err())
	}
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
	sb := b.app.selectedBoard
	if !sb.HasConn() { // queried over the connection
		return boardmcp.NetworkStatus{Connected: false}, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	status, err := wifi.GetWiFiStatus(ctx, sb.Conn)
	if err != nil {
		return boardmcp.NetworkStatus{}, fmt.Errorf("wifi status: %w", err)
	}
	out := boardmcp.NetworkStatus{Connected: true, Wifi: string(status)}
	if name, err := network.GetConnectionName(ctx, sb.Conn); err == nil && name != nil {
		out.ConnectionName = *name
	}
	if online, err := network.GetInternetStatus(ctx, sb.Conn); err == nil {
		out.Internet = online
	}
	return out, nil
}
