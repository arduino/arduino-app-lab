package appmirror

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// fakeBoard records mirror→board calls; failWrites makes every WriteFile fail.
type fakeBoard struct {
	writes     map[string]string
	contents   map[string]string // board-side content per path, for the three-way checks; absent → "content"
	dirs       []string
	removed    []string
	failWrites bool
	list       []string // served by ListFiles (Populate tests)
}

func newFakeBoard() *fakeBoard {
	return &fakeBoard{writes: map[string]string{}, contents: map[string]string{}}
}

func (f *fakeBoard) ListFiles(string) ([]string, error) { return f.list, nil }
func (f *fakeBoard) ReadFile(p string) (string, error) {
	if c, ok := f.contents[p]; ok {
		return c, nil
	}
	return "content", nil
}
func (f *fakeBoard) WriteFile(path, content string) error {
	if f.failWrites {
		return os.ErrPermission
	}
	f.writes[path] = content
	return nil
}
func (f *fakeBoard) MkDirAll(path string) error { f.dirs = append(f.dirs, path); return nil }
func (f *fakeBoard) RemoveFile(path string) error {
	f.removed = append(f.removed, path)
	return nil
}

func writeLocal(t *testing.T, root, rel, content string) {
	t.Helper()
	p := filepath.Join(root, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

// New local subdirectories must be created on the board before their files are written,
// or the whole sync aborts (the board write seam can't create parent dirs itself).
func TestSyncBackCreatesNewBoardDirs(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "app.yaml", "name: x")
	writeLocal(t, local, "assets/app.js", "js")
	writeLocal(t, local, "assets/libs/socket.js", "lib")

	board := newFakeBoard()
	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, nil)
	if err != nil {
		t.Fatalf("SyncBack: %v", err)
	}
	if len(res.Written) != 3 {
		t.Fatalf("written = %v, want 3 files", res.Written)
	}
	wantDirs := map[string]bool{"/apps/demo/assets": true, "/apps/demo/assets/libs": true}
	for _, d := range board.dirs {
		if !wantDirs[d] {
			t.Fatalf("unexpected MkDirAll(%q) (dirs: %v)", d, board.dirs)
		}
		delete(wantDirs, d)
	}
	if len(wantDirs) > 0 {
		t.Fatalf("missing MkDirAll for %v (got %v)", wantDirs, board.dirs)
	}
	if board.writes["/apps/demo/assets/libs/socket.js"] != "lib" {
		t.Fatalf("nested file not written: %v", board.writes)
	}
	for _, rel := range []string{"app.yaml", "assets/app.js", "assets/libs/socket.js"} {
		if res.NewBase[rel] == "" {
			t.Fatalf("NewBase missing %q: %v", rel, res.NewBase)
		}
	}
}

// A write failure must abort before deletions and keep the old baseline.
func TestSyncBackWriteFailureSkipsDeletions(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "main.py", "edited")

	board := newFakeBoard()
	board.failWrites = true
	board.contents["/apps/demo/main.py"] = "code" // board still holds the checked-out copy, so it's an edit, not a conflict
	base := map[string]string{"main.py": contentHash([]byte("code")), "gone.py": contentHash([]byte("old"))}
	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, base)
	if err == nil {
		t.Fatal("want error from failing write")
	}
	if len(res.Deleted) != 0 || len(board.removed) != 0 {
		t.Fatalf("deletions ran after a failed write: %v", board.removed)
	}
	if res.NewBase["gone.py"] != base["gone.py"] {
		t.Fatalf("baseline not preserved on failure: %v", res.NewBase)
	}
}

// A case-colliding board listing must be refused before anything is written, or SyncBack later deletes a board file (W6).
func TestPopulateRefusesCaseCollision(t *testing.T) {
	local := t.TempDir()
	if !foldsCase(local) {
		t.Skip("case-sensitive filesystem: both files mirror fine, no refusal expected")
	}
	board := newFakeBoard()
	board.list = []string{"/apps/demo/README.md", "/apps/demo/readme.md"}
	_, err := Populate(board, "/apps/demo", local)
	if err == nil {
		t.Fatal("want refusal for case-colliding names")
	}
	for _, name := range []string{`"README.md"`, `"readme.md"`, "ask"} {
		if !strings.Contains(err.Error(), name) {
			t.Fatalf("error should contain %s: %v", name, err)
		}
	}
	if entries, _ := os.ReadDir(local); len(entries) != 0 {
		t.Fatalf("refusal must precede any local write, found %v", entries)
	}
}

func TestCaseCollision(t *testing.T) {
	if a, b := caseCollision([]string{"src/main.py", "app.yaml"}); a != "" {
		t.Fatalf("false positive: %q %q", a, b)
	}
	if a, b := caseCollision([]string{"a/x.md", "b/X.md"}); a != "" {
		t.Fatalf("same folded name under different dirs is not a collision: %q %q", a, b)
	}
	if a, b := caseCollision([]string{"README.md", "readme.md"}); a != "README.md" || b != "readme.md" {
		t.Fatalf("missed file pair: %q %q", a, b)
	}
	if a, b := caseCollision([]string{"Docs", "docs/x"}); a != "docs/" || b != "Docs" {
		t.Fatalf("missed file-vs-dir clash: %q %q", a, b)
	}
}

func TestWinIllegal(t *testing.T) {
	for rel, want := range map[string]bool{
		"src/main.py": false, "app.yaml": false, "conf.py": false,
		"a:b.txt": true, "what?.md": true, "con": true, "CON.txt": true, "sub/nul.log": true,
		"trailing./x": true, "trailing ": true, `back\slash`: true,
	} {
		if got := winIllegal(rel); got != want {
			t.Fatalf("winIllegal(%q) = %v, want %v", rel, got, want)
		}
	}
}

// Files deleted locally (in the baseline, absent from the mirror) are removed from the board.
func TestSyncBackPropagatesDeletions(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "main.py", "code")

	board := newFakeBoard()
	board.contents["/apps/demo/old.py"] = "old" // untouched on the board since checkout, so deleting it is safe
	base := map[string]string{"main.py": contentHash([]byte("code")), "old.py": contentHash([]byte("old"))}
	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, base)
	if err != nil {
		t.Fatalf("SyncBack: %v", err)
	}
	if len(res.Deleted) != 1 || res.Deleted[0] != "/apps/demo/old.py" {
		t.Fatalf("deleted = %v, want [/apps/demo/old.py]", res.Deleted)
	}
	if _, still := res.NewBase["old.py"]; still {
		t.Fatalf("NewBase still lists the deleted file: %v", res.NewBase)
	}
}

// B4: a force sync drops the mtime gate, so only the content hashes stop it from re-pushing the whole mirror over
// what the user saved in the editor since checkout.
func TestSyncBackForceKeepsBoardEditsToUntouchedFiles(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "main.py", "agent edit")   // the agent edited this one
	writeLocal(t, local, "app.yaml", "checked out") // untouched in the mirror since checkout
	board := newFakeBoard()
	board.contents["/apps/demo/main.py"] = "original" // still as checked out
	board.contents["/apps/demo/app.yaml"] = "user saved this in the editor"
	base := map[string]string{
		"main.py":  contentHash([]byte("original")),
		"app.yaml": contentHash([]byte("checked out")),
	}

	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, base) // zero time = the force path
	if err != nil {
		t.Fatalf("SyncBack: %v", err)
	}
	if _, overwritten := board.writes["/apps/demo/app.yaml"]; overwritten {
		t.Error("a file untouched in the mirror was pushed, reverting the user's editor save")
	}
	if len(res.Conflicts) != 0 {
		t.Errorf("a file the agent never touched is not a conflict, got %v", res.Conflicts) // it must be skipped outright, not fall through to the board comparison
	}
	if board.writes["/apps/demo/main.py"] != "agent edit" {
		t.Errorf("the agent's own edit was not pushed: %v", board.writes)
	}
	if res.NewBase["app.yaml"] != base["app.yaml"] {
		t.Errorf("an untouched file must keep its baseline, got %v", res.NewBase)
	}
}

// Both sides edited the file since checkout: report it and leave the board alone rather than pick a winner.
func TestSyncBackReportsConflictInsteadOfOverwriting(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "main.py", "agent edit")
	board := newFakeBoard()
	board.contents["/apps/demo/main.py"] = "user edit" // moved under us
	base := map[string]string{"main.py": contentHash([]byte("original"))}

	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, base)
	if err != nil {
		t.Fatalf("SyncBack: %v", err)
	}
	if len(res.Conflicts) != 1 || res.Conflicts[0] != "main.py" {
		t.Fatalf("conflicts = %v, want [main.py]", res.Conflicts)
	}
	if _, overwritten := board.writes["/apps/demo/main.py"]; overwritten {
		t.Error("a conflicting file was overwritten on the board")
	}
	if res.NewBase["main.py"] != base["main.py"] {
		t.Error("an unresolved conflict must keep its baseline so the next sync re-detects it")
	}
}

// Deleting is as destructive as overwriting: a file changed on the board must not be removed to propagate a local delete.
func TestSyncBackDoesNotDeleteAFileChangedOnTheBoard(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "main.py", "code")
	board := newFakeBoard()
	board.contents["/apps/demo/notes.md"] = "the user rewrote this"
	base := map[string]string{"main.py": contentHash([]byte("code")), "notes.md": contentHash([]byte("old notes"))}

	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, base)
	if err != nil {
		t.Fatalf("SyncBack: %v", err)
	}
	if len(board.removed) != 0 {
		t.Errorf("removed a file the user had changed on the board: %v", board.removed)
	}
	if len(res.Conflicts) != 1 || res.Conflicts[0] != "notes.md" {
		t.Fatalf("conflicts = %v, want [notes.md]", res.Conflicts)
	}
}

// A re-checkout must show the agent the board's current content, but never discard its pending edits.
func TestReconcileRefreshesOnlyUntouchedFiles(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "main.py", "agent edit")   // edited locally → keep
	writeLocal(t, local, "app.yaml", "checked out") // untouched → refresh from the board
	writeLocal(t, local, "gone.py", "obsolete")     // no longer on the board → drop
	board := newFakeBoard()
	board.list = []string{"/apps/demo/main.py", "/apps/demo/app.yaml", "/apps/demo/new.py"}
	board.contents["/apps/demo/main.py"] = "original"
	board.contents["/apps/demo/app.yaml"] = "user saved this in the editor"
	board.contents["/apps/demo/new.py"] = "added in the editor"
	base := map[string]string{
		"main.py":  contentHash([]byte("original")),
		"app.yaml": contentHash([]byte("checked out")),
		"gone.py":  contentHash([]byte("obsolete")),
	}

	next, err := Reconcile(board, "/apps/demo", local, base)
	if err != nil {
		t.Fatalf("Reconcile: %v", err)
	}
	for rel, want := range map[string]string{
		"main.py":  "agent edit",                    // pending edit survives
		"app.yaml": "user saved this in the editor", // refreshed
		"new.py":   "added in the editor",           // added
	} {
		got, err := os.ReadFile(filepath.Join(local, rel))
		if err != nil {
			t.Fatalf("read %s: %v", rel, err)
		}
		if string(got) != want {
			t.Errorf("%s = %q, want %q", rel, got, want)
		}
	}
	if _, err := os.Stat(filepath.Join(local, "gone.py")); !os.IsNotExist(err) {
		t.Errorf("a file deleted on the board should not linger in the mirror (err=%v)", err)
	}
	if next["main.py"] != base["main.py"] {
		t.Error("a locally edited file must keep its checkout baseline, so SyncBack can still tell it was edited")
	}
	if next["app.yaml"] != contentHash([]byte("user saved this in the editor")) {
		t.Error("a refreshed file must be re-baselined to the board's content")
	}
}
