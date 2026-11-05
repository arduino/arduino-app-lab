package boardmcp

import (
	"errors"
	"testing"
)

// The paths come from the model: one that leaves the app folder, or that App Lab's file tree protects, must never reach the board.
func TestAppRelPath(t *testing.T) {
	for in, want := range map[string]string{
		"capito":            "capito",
		" python/utils.py ": "python/utils.py",
		"./assets/":         "assets",
		"sketch":            "sketch",
		"sketch/helpers.h":  "sketch/helpers.h",
		"a:b.txt":           "a:b.txt",
		"è/emoji 🎉.txt":     "è/emoji 🎉.txt",
		"no\u00a0break.txt": "no\u00a0break.txt",
	} {
		if got, err := appRelPath(in); err != nil || got != want {
			t.Errorf("appRelPath(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, in := range []string{
		"", ".", "..", "../other-app/main.py", "python/../../x",
		"/home/arduino/ArduinoApps/demo/x", `C:\mirror\demo\x`, "C:",
		"app.yaml", "python", "python/", "python/main.py", "sketch/sketch.ino", "sketch/sketch.yaml",
		`q"uote.txt`, "new\nline.txt", "tab\there.txt", "zero\u200bwidth.txt", "del\x7f.txt",
		`python\lib\x.py`, `b\ack.py`,
	} {
		if got, err := appRelPath(in); err == nil {
			t.Errorf("appRelPath(%q) = %q, want an error", in, got)
		}
	}
}

func TestRenamePaths(t *testing.T) {
	if from, to, err := renamePaths("lib", "lib-old"); err != nil || from != "lib" || to != "lib-old" {
		t.Errorf("a sibling sharing the prefix is a plain rename: %q, %q, %v", from, to, err)
	}
	for _, c := range [][2]string{{"lib", "lib/old"}, {"lib", "./lib"}, {"python/x.py", "python/main.py"}, {"sketch", "firmware"}, {"assets", "static"}} {
		if _, _, err := renamePaths(c[0], c[1]); err == nil {
			t.Errorf("renamePaths(%q, %q) should be refused", c[0], c[1])
		}
	}
}

// flushStub answers a flush with fixed outcomes; any other call would panic on the nil embedded interface.
type flushStub struct {
	BoardAccess
	failed, conflicts map[string]error
}

func (s flushStub) FlushMirrorEdits(string) (failed, conflicts, withheld map[string]error, notes []string) {
	return s.failed, s.conflicts, nil, nil
}
func (flushStub) PendingSyncIssues() []string { return nil }
func (flushStub) PendingGhostEdits() []string { return nil }

// An edit still waiting under the old path would put the file back after the rename: no flush, no rename.
func TestFlushBeforeFileChange(t *testing.T) {
	stuck := map[string]error{"app": errors.New("board unreachable")}
	if _, err := flushBeforeFileChange(flushStub{failed: stuck}, "app"); err == nil {
		t.Error("went ahead with this app's edits not on the board")
	}
	if _, err := flushBeforeFileChange(flushStub{conflicts: stuck}, "app"); err == nil {
		t.Error("went ahead with this app's edits in conflict")
	}
	if _, err := flushBeforeFileChange(flushStub{failed: stuck}, "other-app"); err != nil {
		t.Errorf("another app's failed flush blocked this one: %v", err)
	}
}
