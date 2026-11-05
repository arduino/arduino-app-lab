package app

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"app-lab-desktop/internal/board"
)

// Presence must follow the connection, never the serial: network boards report no serial, so the old serial gate called a connected board disconnected (that was X10). Here the inverse: a serial with no live connection must not read as connected.
func TestSelectedBoardFollowsTheConnectionNotTheSerial(t *testing.T) {
	serialOnly := board.Noop()
	serialOnly.Info.Serial = "AAAA1111"
	serialOnly.Info.BoardName = "Portenta X8"

	for name, sb := range map[string]*board.Board{"placeholder": board.Noop(), "serial but no connection": serialOnly} {
		ba := boardAccess{app: &App{selectedBoard: sb}}
		st, err := ba.SelectedBoard(t.Context())
		if err != nil {
			t.Fatalf("%s: SelectedBoard: %v", name, err)
		}
		if st.Connected {
			t.Errorf("%s: must not report a connected board, got %+v", name, st)
		}
	}
}

// The board_exec deadline has to be enforced here: the vendored SSH Output() ignores its context. An expired caller
// must also stop before dispatching, or a multi-command probe keeps sending after its deadline.
func TestExecOnBoardHonoursTheContext(t *testing.T) {
	sb := board.Noop() // its Cmder returns immediately with ErrNoConn
	ctx, cancel := context.WithCancel(t.Context())
	cancel() // already past the deadline

	start := time.Now()
	_, err := execOnBoard(ctx, sb, "sleep 600")
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("an expired context must refuse before dispatching, got %v", err)
	}
	if strings.Contains(err.Error(), "may still be running on the board") {
		t.Errorf("nothing was sent, so the error must not claim the board is still running it: %q", err)
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Fatalf("execOnBoard waited %s; it must not block past the context", elapsed)
	}
}

// A command already in flight when the deadline passes is abandoned, and the error says so: it may still be running
// on the board, and that is what stops the agent from simply retrying it.
func TestExecOnBoardAbandonsACommandInFlight(t *testing.T) {
	blocked := make(chan struct{})
	defer close(blocked)
	ctx, cancel := context.WithTimeout(t.Context(), 50*time.Millisecond)
	defer cancel()

	_, err := awaitBoard(ctx, func() (string, error) {
		<-blocked
		return "", nil
	})
	if err == nil || !strings.Contains(err.Error(), "may still be running on the board") {
		t.Fatalf("the error must say the command was abandoned, got %v", err)
	}
	if !strings.Contains(err.Error(), "did not finish within") {
		t.Errorf("the error must say how long it waited: %q", err)
	}
}

// A tool's flush pushes its own app only: another chat may be halfway through editing the others.
func TestAToolsFlushPushesOnlyItsOwnApp(t *testing.T) {
	a, conn := memBoardApp(t, map[string]string{})
	for _, name := range []string{"mine", "theirs"} {
		mirror := t.TempDir()
		if err := os.WriteFile(filepath.Join(mirror, "notes.txt"), []byte("edited "+name), 0o644); err != nil {
			t.Fatal(err)
		}
		a.checkedOut["user:"+name] = checkedApp{appPath: "/apps/" + name, mirror: mirror, baseline: time.Now().Add(-time.Hour), hashes: map[string]string{}, baselined: true}
	}

	failed, conflicts, _, _ := boardAccess{app: a}.FlushMirrorEdits("user:mine")

	if len(failed) > 0 || len(conflicts) > 0 {
		t.Fatalf("flush: %v / %v", failed, conflicts)
	}
	if len(conn.files) != 1 || conn.files["/apps/mine/notes.txt"] != "edited mine" {
		t.Errorf("board = %v, want this app's file alone", conn.files)
	}
}

// The agent's rename holds both ids before app:agent-renamed: the page that follows the event lists the chats, which starts a sweep.
func TestTheAgentsRenameHoldsBothIdsBeforeItsEvent(t *testing.T) {
	a := testApp(t)
	const oldID, newID = "dXNlcjpibGluaw", "dXNlcjpibGluay0y"
	var heldOld, heldNew bool
	orig := emitEvent
	emitEvent = func(_ context.Context, event string, _ ...any) {
		if event == appAgentRenamedEvent {
			a.appSweep.mu.Lock()
			heldOld, heldNew = a.appSweep.renaming[oldID] > 0, a.appSweep.renaming[newID] > 0
			a.appSweep.mu.Unlock()
		}
	}
	t.Cleanup(func() { emitEvent = orig })

	boardAccess{app: a}.RebindWorkspaceApp(oldID, newID, "Blink 2")

	if !heldOld || !heldNew {
		t.Errorf("held while the event went out: old id %v, new id %v; want both", heldOld, heldNew)
	}
	a.appSweep.mu.Lock()
	defer a.appSweep.mu.Unlock()
	if len(a.appSweep.renaming) != 0 {
		t.Errorf("holds left after the rename: %v", a.appSweep.renaming)
	}
}
