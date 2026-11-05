package app

import (
	"context"
	"errors"
	"os"
	"path"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
	"github.com/arduino/arduino-app-cli/pkg/board/remote/local"

	"app-lab-desktop/internal/appmirror"
	"app-lab-desktop/internal/board"
)

// writeFiles creates rel → content under root.
func writeFiles(t *testing.T, root string, files map[string]string) {
	t.Helper()
	for rel, content := range files {
		p := filepath.Join(root, filepath.FromSlash(rel))
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

// filesUnder lists every file and empty folder under root, relative and sorted; an empty folder ends in "/".
func filesUnder(t *testing.T, root string) []string {
	t.Helper()
	var out []string
	err := filepath.WalkDir(root, func(p string, d os.DirEntry, err error) error {
		if err != nil || p == root {
			return err
		}
		rel, _ := filepath.Rel(root, p)
		rel = filepath.ToSlash(rel)
		if !d.IsDir() {
			out = append(out, rel)
		} else if entries, _ := os.ReadDir(p); len(entries) == 0 {
			out = append(out, rel+"/")
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(out)
	return out
}

// localBoardApp serves a temp dir as the board, with one app in it.
func localBoardApp(t *testing.T) (*App, string) {
	t.Helper()
	appDir := filepath.Join(t.TempDir(), "demo")
	writeFiles(t, appDir, map[string]string{
		"app.yaml":         "name: demo",
		"capito/notes.txt": "notes",
		"capito/sub/a.txt": "a",
		"readme.txt":       "readme",
	})
	if err := os.MkdirAll(filepath.Join(appDir, "capito", "empty"), 0o755); err != nil {
		t.Fatal(err)
	}
	sb := board.Noop()
	sb.Conn = &local.LocalConnection{}
	return &App{selectedBoard: sb}, filepath.ToSlash(appDir)
}

func TestRenameAppPathOnTheBoard(t *testing.T) {
	a, appDir := localBoardApp(t)
	writeFiles(t, appDir, map[string]string{"notes:v1/x.txt": "x"})

	if isDir, err := a.renameAppPath(appDir, "capito", "ok", 0); err != nil || !isDir {
		t.Fatalf("folder rename: isDir=%v err=%v", isDir, err)
	}
	if isDir, err := a.renameAppPath(appDir, "readme.txt", "docs/readme.txt", 0); err != nil || isDir {
		t.Fatalf("a move into a folder the app does not have yet: isDir=%v err=%v", isDir, err)
	}
	// file -L reads "notes:v1: directory" as a file called "notes"; the listing does not.
	if isDir, err := a.renameAppPath(appDir, "notes:v1", "notes-v1", 0); err != nil || !isDir {
		t.Fatalf("a folder named with ':': isDir=%v err=%v", isDir, err)
	}

	want := []string{"app.yaml", "docs/readme.txt", "notes-v1/x.txt", "ok/empty/", "ok/notes.txt", "ok/sub/a.txt"}
	if got := filesUnder(t, appDir); !reflect.DeepEqual(got, want) {
		t.Errorf("board files = %v, want %v", got, want)
	}
}

// mv takes what it is given, so every name it must not overwrite, or that a checkout could not hold, stops the rename before it starts.
func TestRenameAppPathRefuses(t *testing.T) {
	a, appDir := localBoardApp(t)
	writeFiles(t, appDir, map[string]string{"ok/keep.txt": "keep"})
	outside := t.TempDir()
	writeFiles(t, outside, map[string]string{"secret.txt": "secret"})
	if err := os.Symlink(outside, filepath.Join(appDir, "link")); err != nil {
		t.Fatal(err)
	}
	before := filesUnder(t, appDir)

	for _, c := range []struct{ from, to, why string }{
		{"capito", "ok", "a name already taken"},
		{"missing", "elsewhere", "a path the app does not have"},
		{"readme.txt", "CAPITO", "a name that differs from a folder only in letter case"},
		{"capito/notes.txt", "Capito/notes.txt", "a folder that differs from the source's only in letter case"},
		{"link/secret.txt", "secret.txt", "a source reached through a symlink"},
		{"readme.txt", "link/readme.txt", "a destination reached through a symlink"},
		{"readme.txt", "readme.txt/x", "a destination inside a file"},
	} {
		if _, err := a.renameAppPath(appDir, c.from, c.to, 0); err == nil {
			t.Errorf("renamed %s to %s: %s", c.from, c.to, c.why)
		}
	}
	a.boardGen = 1
	if _, err := a.renameAppPath(appDir, "readme.txt", "readme2.txt", 0); err != errBoardChanged {
		t.Errorf("a rename that outlived its board went on: %v", err)
	}

	if got := filesUnder(t, appDir); !reflect.DeepEqual(got, before) {
		t.Errorf("board files = %v, want them untouched: %v", got, before)
	}
	if got, err := os.ReadFile(filepath.Join(outside, "secret.txt")); err != nil || string(got) != "secret" {
		t.Errorf("the symlink target changed: %q, %v", got, err)
	}
}

func TestDeleteAppPathOnTheBoard(t *testing.T) {
	a, appDir := localBoardApp(t)
	outside := t.TempDir()
	writeFiles(t, outside, map[string]string{"secret.txt": "secret"})
	if err := os.Symlink(outside, filepath.Join(appDir, "link")); err != nil {
		t.Fatal(err)
	}

	if err := a.deleteAppPath(appDir, "link/secret.txt", 0); err == nil {
		t.Error("deleted through a symlink")
	}
	if err := a.deleteAppPath(appDir, "capito", 0); err != nil {
		t.Fatal(err)
	}
	if err := a.deleteAppPath(appDir, "capito", 0); err == nil {
		t.Error("deleted a path the app no longer has")
	}
	// rm removes the link itself, never what it points to.
	if err := a.deleteAppPath(appDir, "link", 0); err != nil {
		t.Fatal(err)
	}

	if got, want := filesUnder(t, appDir), []string{"app.yaml", "readme.txt"}; !reflect.DeepEqual(got, want) {
		t.Errorf("board files = %v, want %v", got, want)
	}
	if got, err := os.ReadFile(filepath.Join(outside, "secret.txt")); err != nil || string(got) != "secret" {
		t.Errorf("the symlink target changed: %q, %v", got, err)
	}
}

// checkoutForTest checks the board app out as apps_checkout does, tracked as "app".
func checkoutForTest(t *testing.T, a *App, appDir string) string {
	t.Helper()
	mirror := filepath.Join(t.TempDir(), "board__user-demo-abc123")
	if err := os.MkdirAll(mirror, 0o755); err != nil {
		t.Fatal(err)
	}
	hashes, err := appmirror.Populate(boardFiles{app: a}, appDir, mirror)
	if err != nil {
		t.Fatal(err)
	}
	a.checkedOut = map[string]checkedApp{"app": {appPath: appDir, mirror: mirror, hashes: hashes, baselined: true}}
	return mirror
}

// A checkout keeps whatever path the board lost, and a later sync puts it back: the tools swap a fresh one in.
func TestResetCheckoutSwapsAFreshCheckoutIn(t *testing.T) {
	a, appDir := localBoardApp(t)
	mirror := checkoutForTest(t, a, appDir)
	writeFiles(t, mirror, map[string]string{"readme.txt" + appmirror.ParkedSuffix: "edit to re-apply"})
	if _, err := a.renameAppPath(appDir, "capito", "notes", 0); err != nil {
		t.Fatal(err)
	}

	note := a.resetCheckout("app")

	if !strings.Contains(note, "refreshed") {
		t.Errorf("note = %q, want the refresh reported", note)
	}
	want := []string{"app.yaml", "notes/notes.txt", "notes/sub/a.txt", "readme.txt", "readme.txt" + appmirror.ParkedSuffix}
	if got := filesUnder(t, mirror); !reflect.DeepEqual(got, want) {
		t.Errorf("checkout = %v, want the board's files and the parked copy: %v", got, want)
	}
	entries, _ := os.ReadDir(filepath.Dir(mirror))
	if len(entries) != 1 {
		t.Errorf("the mirror root holds %d entries, want only the checkout: the swap left a folder behind", len(entries))
	}
	c := a.checkedOut["app"]
	if _, ok := c.hashes["capito/notes.txt"]; ok || len(c.hashes) != 4 || !c.baselined {
		t.Errorf("baseline = %v (baselined %v), want the board's four files", c.hashes, c.baselined)
	}
}

// What no sync pushed yet would go with the old folder: the reset keeps the old checkout and sends the agent to apps_checkout.
func TestResetCheckoutKeepsChangesTheBoardLacks(t *testing.T) {
	for name, change := range map[string]func(mirror string) error{
		"an edit":    func(m string) error { return os.WriteFile(filepath.Join(m, "readme.txt"), []byte("edited"), 0o644) },
		"a new file": func(m string) error { return os.WriteFile(filepath.Join(m, "new.txt"), []byte("new"), 0o644) },
		"a deletion": func(m string) error { return os.Remove(filepath.Join(m, "readme.txt")) },
	} {
		t.Run(name, func(t *testing.T) {
			a, appDir := localBoardApp(t)
			mirror := checkoutForTest(t, a, appDir)
			old := a.checkedOut["app"]
			if err := change(mirror); err != nil {
				t.Fatal(err)
			}
			if _, err := a.renameAppPath(appDir, "capito", "notes", 0); err != nil {
				t.Fatal(err)
			}
			before := filesUnder(t, mirror)

			note := a.resetCheckout("app")

			if !strings.Contains(note, "apps_checkout") {
				t.Errorf("note = %q, want the agent sent to apps_checkout", note)
			}
			if got := filesUnder(t, mirror); !reflect.DeepEqual(got, before) {
				t.Errorf("checkout = %v, want the old one: %v", got, before)
			}
			if c := a.checkedOut["app"]; !reflect.DeepEqual(c.hashes, old.hashes) {
				t.Errorf("baseline = %v, want the old one", c.hashes)
			}
		})
	}
}

// lateSaveConn stands for an editor save that lands on the old path right after the agent's move.
type lateSaveConn struct{ *local.LocalConnection }

func (c lateSaveConn) GetCmd(cmd string, args ...string) remote.Cmder {
	inner := c.LocalConnection.GetCmd(cmd, args...)
	if cmd != "mv" {
		return inner
	}
	return lateSave{Cmder: inner, path: args[len(args)-2]}
}

type lateSave struct {
	remote.Cmder
	path string
}

func (s lateSave) Output(ctx context.Context) ([]byte, error) {
	out, err := s.Cmder.Output(ctx)
	if err == nil {
		err = os.WriteFile(s.path, []byte("saved late"), 0o644)
	}
	return out, err
}

// hiddenNameConn lists a folder without one name, as the board's listing misreads some: the check before mv then calls a taken name free. With mvFails its mv refuses a taken name with an error, as GNU mv 9.2 to 9.4 do.
type hiddenNameConn struct {
	*local.LocalConnection
	hidden  string
	mvFails bool
}

func (c hiddenNameConn) GetCmd(cmd string, args ...string) remote.Cmder {
	inner := c.LocalConnection.GetCmd(cmd, args...)
	if cmd != "mv" || !c.mvFails {
		return inner
	}
	if _, err := os.Lstat(args[len(args)-1]); err != nil {
		return inner
	}
	return refusedMv{inner}
}

type refusedMv struct{ remote.Cmder }

func (refusedMv) Output(context.Context) ([]byte, error) {
	return []byte("mv: not replacing"), errors.New("exit status 1")
}

func (c hiddenNameConn) List(p string) ([]remote.FileInfo, error) {
	entries, err := c.LocalConnection.List(p)
	var shown []remote.FileInfo
	for _, e := range entries {
		if e.Name != c.hidden {
			shown = append(shown, e)
		}
	}
	return shown, err
}

// A save to the old name right after the move is a new file there: the rename still happened, and saying "already exists" would stop the tabs following it.
func TestRenameAppPathCountsAMoveFollowedByASave(t *testing.T) {
	a, appDir := localBoardApp(t)
	a.selectedBoard.Conn = lateSaveConn{&local.LocalConnection{}}

	if _, err := a.renameAppPath(appDir, "readme.txt", "notes.txt", 0); err != nil {
		t.Fatalf("a move followed by a save was reported as failed: %v", err)
	}
	if got, err := os.ReadFile(filepath.Join(appDir, "notes.txt")); err != nil || string(got) != "readme" {
		t.Errorf("notes.txt = %q, %v; want the moved file", got, err)
	}
}

// mv -n leaves a name the listing hid alone, with an error or without one depending on its version: either way the tool says the name is taken, and nothing changes.
func TestRenameAppPathReportsANameMvSkipped(t *testing.T) {
	for name, mvFails := range map[string]bool{"mv skips without an error": false, "mv fails": true} {
		t.Run(name, func(t *testing.T) {
			a, appDir := localBoardApp(t)
			a.selectedBoard.Conn = hiddenNameConn{LocalConnection: &local.LocalConnection{}, hidden: "app.yaml", mvFails: mvFails}

			if _, err := a.renameAppPath(appDir, "readme.txt", "app.yaml", 0); err == nil || !strings.Contains(err.Error(), "already exists") {
				t.Errorf("a rename onto a hidden taken name: %v, want it reported as taken", err)
			}
			if got, err := os.ReadFile(filepath.Join(appDir, "app.yaml")); err != nil || string(got) != "name: demo" {
				t.Errorf("app.yaml = %q, %v; want it untouched", got, err)
			}
		})
	}
}

// mv -n never replaces a file, whatever the check before it saw.
func TestMoveOnBoardNeverReplaces(t *testing.T) {
	a, appDir := localBoardApp(t)
	// GNU mv 9.2 to 9.4 fail here; other versions skip without an error.
	_ = a.moveOnBoard(a.boardConn(), path.Join(appDir, "readme.txt"), path.Join(appDir, "app.yaml"))

	if got, err := os.ReadFile(filepath.Join(appDir, "app.yaml")); err != nil || string(got) != "name: demo" {
		t.Errorf("app.yaml = %q, %v: the move replaced it", got, err)
	}
	if _, err := os.Stat(filepath.Join(appDir, "readme.txt")); err != nil {
		t.Errorf("the source left its place: %v", err)
	}
}

// Until a fresh checkout is complete the old one stays in place and tracked: a sync from another session may be walking it.
func TestResetCheckoutKeepsTheOldOneWhenTheBoardCannotBeRead(t *testing.T) {
	root := t.TempDir()
	mirror := filepath.Join(root, "board__user-demo-abc123")
	writeFiles(t, mirror, map[string]string{"python/main.py": "main"})
	old := checkedApp{appPath: "/apps/demo", mirror: mirror, hashes: map[string]string{"python/main.py": "h"}}
	a := &App{selectedBoard: board.Noop(), checkedOut: map[string]checkedApp{"app": old}}

	note := a.resetCheckout("app")

	if !strings.Contains(note, "apps_checkout") {
		t.Errorf("a failed refresh must send the agent to apps_checkout: %q", note)
	}
	if got := filesUnder(t, root); !reflect.DeepEqual(got, []string{"board__user-demo-abc123/python/main.py"}) {
		t.Errorf("mirror root = %v, want the old checkout and nothing else", got)
	}
	if c := a.checkedOut["app"]; !reflect.DeepEqual(c.hashes, old.hashes) {
		t.Errorf("the old checkout is no longer tracked as it was: %v", c.hashes)
	}
}

// A checkout an earlier run left on disk may hold edits the board never got: the tool waits for a checkout instead of guessing.
func TestRefuseStaleCheckout(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_DATA_HOME", filepath.Join(home, ".local", "share"))
	t.Setenv("LOCALAPPDATA", filepath.Join(home, "AppData", "Local"))
	a := &App{selectedBoard: board.Noop(), checkedOut: map[string]checkedApp{}}
	dir := a.workspaceMirrorDir("app")
	if !strings.HasPrefix(dir, home) {
		t.Fatalf("the mirror dir %q is outside the test's home", dir)
	}
	writeFiles(t, dir, map[string]string{"capito/notes.txt": "edited, not synced yet"})

	if err := a.refuseStaleCheckout("app", "capito"); err == nil || !strings.Contains(err.Error(), "apps_checkout") {
		t.Errorf("a stale copy of the path must send the agent to apps_checkout: %v", err)
	}
	if err := a.refuseStaleCheckout("app", "python"); err != nil {
		t.Errorf("a path the stale copy does not hold is fine: %v", err)
	}
	a.checkedOut["app"] = checkedApp{mirror: dir}
	if err := a.refuseStaleCheckout("app", "capito"); err != nil {
		t.Errorf("a checkout of this run is reset by the tool, not refused: %v", err)
	}
}
