package app

import (
	"context"
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

// The board_exec deadline has to be enforced here: the vendored SSH Output() ignores its context.
func TestExecOnBoardHonoursTheContext(t *testing.T) {
	sb := board.Noop() // its Cmder returns immediately with ErrNoConn
	ctx, cancel := context.WithCancel(t.Context())
	cancel() // already past the deadline

	start := time.Now()
	if _, err := execOnBoard(ctx, sb, "sleep 600"); err == nil {
		t.Fatal("a cancelled context must abandon the command")
	} else if !strings.Contains(err.Error(), "may still be running on the board") {
		t.Fatalf("the error must say the command was abandoned, got %q", err)
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Fatalf("execOnBoard waited %s; it must not block past the context", elapsed)
	}
}
