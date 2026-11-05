package appmirror

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

// fakeBoard records mirror→board calls; failWrites/failPath make writes fail, silentWrites makes them lie (nil error, nothing stored).
type fakeBoard struct {
	writes       map[string]string
	contents     map[string]string // board-side content per path, for the three-way checks; absent → "content"
	dirs         []string
	removed      []string
	failWrites   bool
	failPath     string
	silentWrites bool
	list         []string         // served by ListFiles (Populate tests)
	listErr      error            // served alongside list, for the partial-walk case
	readErrs     map[string]error // ReadFile fails for these paths; fs.ErrNotExist is a file the board lacks
}

func newFakeBoard() *fakeBoard {
	return &fakeBoard{writes: map[string]string{}, contents: map[string]string{}}
}

func (f *fakeBoard) ListFiles(string) ([]string, error) { return f.list, f.listErr }
func (f *fakeBoard) ReadFile(p string) (string, error) {
	if c, ok := f.writes[p]; ok { // what a sync wrote is what a read-back must see
		return c, nil
	}
	if err := f.readErrs[p]; err != nil {
		return "", err
	}
	if c, ok := f.contents[p]; ok {
		return c, nil
	}
	return "content", nil
}
func (f *fakeBoard) WriteFile(path, content string) error {
	if f.failWrites || path == f.failPath {
		return os.ErrPermission
	}
	if f.silentWrites {
		return nil
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
	writeLocal(t, local, "README.md", "readme")
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
	for _, rel := range []string{"README.md", "assets/app.js", "assets/libs/socket.js"} {
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

// An agent edit or delete of a managed file must never reach the board, and the mirror must go back to the board's copy.
func TestSyncBackWithholdsManagedFiles(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "app.yaml", "name: renamed by hand")
	writeLocal(t, local, "python/main.py", "agent edit")
	writeLocal(t, local, "sketch/sketch.ino", "void setup() {}")
	board := newFakeBoard()
	board.contents["/apps/demo/app.yaml"] = "name: demo"
	board.contents["/apps/demo/sketch/sketch.yaml"] = "profiles: {}"
	board.contents["/apps/demo/python/main.py"] = "original"
	board.contents["/apps/demo/sketch/sketch.ino"] = "void setup() {}"
	base := map[string]string{
		"app.yaml":           contentHash([]byte("name: demo")),
		"sketch/sketch.yaml": contentHash([]byte("profiles: {}")), // deleted in the mirror, while sketch.ino stays
		"python/main.py":     contentHash([]byte("original")),
		"sketch/sketch.ino":  contentHash([]byte("void setup() {}")),
	}

	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, base)
	if err != nil {
		t.Fatalf("SyncBack: %v", err)
	}
	for _, p := range []string{"/apps/demo/app.yaml", "/apps/demo/sketch/sketch.yaml"} {
		if _, written := board.writes[p]; written {
			t.Errorf("%s was written to the board", p)
		}
	}
	if len(board.removed) != 0 {
		t.Errorf("removed from the board: %v", board.removed)
	}
	if board.writes["/apps/demo/python/main.py"] != "agent edit" {
		t.Errorf("an ordinary edit must still be pushed: %v", board.writes)
	}
	if strings.Join(res.Withheld, ",") != "app.yaml" {
		t.Errorf("withheld = %v, want app.yaml", res.Withheld)
	}
	if strings.Join(res.Unpaired, ",") != "sketch/sketch.yaml" {
		t.Errorf("unpaired = %v, want sketch/sketch.yaml: deleted without sketch.ino", res.Unpaired)
	}
	for rel, want := range map[string]string{"app.yaml": "name: demo", "sketch/sketch.yaml": "profiles: {}"} {
		if got, _ := os.ReadFile(filepath.Join(local, filepath.FromSlash(rel))); string(got) != want {
			t.Errorf("mirror %s = %q, want the board's %q", rel, got, want)
		}
		if res.NewBase[rel] != contentHash([]byte(want)) {
			t.Errorf("the baseline of %s must follow the board's copy", rel)
		}
	}
}

// Removing both sketch files is removing the sketch: keeping sketch.yaml alone would leave an app arduino-app-cli does not load.
func TestSyncBackRemovesWholeSketch(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "python/main.py", "original")
	board := newFakeBoard()
	board.contents["/apps/demo/sketch/sketch.ino"] = "void setup() {}"
	board.contents["/apps/demo/sketch/sketch.yaml"] = "profiles: {}"
	board.contents["/apps/demo/python/main.py"] = "original"
	base := map[string]string{
		"sketch/sketch.ino":  contentHash([]byte("void setup() {}")),
		"sketch/sketch.yaml": contentHash([]byte("profiles: {}")),
		"python/main.py":     contentHash([]byte("original")),
	}

	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, base)
	if err != nil {
		t.Fatalf("SyncBack: %v", err)
	}
	removed := strings.Join(board.removed, ",")
	if !strings.Contains(removed, "/apps/demo/sketch/sketch.ino") || !strings.Contains(removed, "/apps/demo/sketch/sketch.yaml") {
		t.Errorf("removed = %v, want both sketch files", board.removed)
	}
	if len(res.Withheld) != 0 {
		t.Errorf("withheld = %v, want none", res.Withheld)
	}
}

// A change that would leave the board with one sketch file alone is not applied, and the checkout goes back to the board's state.
func TestSyncBackKeepsSketchPairTogether(t *testing.T) {
	notOnBoard := func(rels ...string) map[string]error {
		errs := map[string]error{}
		for _, rel := range rels {
			errs["/apps/demo/"+rel] = fs.ErrNotExist
		}
		return errs
	}
	ino, yaml := "void setup() {}", "profiles: {}"
	cases := []struct {
		name       string
		local      map[string]string
		board      map[string]string // board contents; the other sketch file is absent
		base       map[string]string
		wantLocal  []string // sketch files the checkout must hold afterwards
		wantUnpair string
	}{
		{
			name:       "sketch.yaml alone into an app without a sketch",
			local:      map[string]string{"python/main.py": "x", "sketch/sketch.yaml": yaml},
			base:       map[string]string{"python/main.py": contentHash([]byte("x"))},
			wantUnpair: "sketch/sketch.yaml",
		},
		{
			name:       "sketch.ino deleted alone",
			local:      map[string]string{"sketch/sketch.yaml": yaml},
			board:      map[string]string{"sketch/sketch.ino": ino, "sketch/sketch.yaml": yaml},
			base:       map[string]string{"sketch/sketch.ino": contentHash([]byte(ino)), "sketch/sketch.yaml": contentHash([]byte(yaml))},
			wantLocal:  []string{"sketch/sketch.ino", "sketch/sketch.yaml"},
			wantUnpair: "sketch/sketch.ino",
		},
		{
			name:       "sketch.ino edited after the board lost the sketch",
			local:      map[string]string{"sketch/sketch.ino": ino + " // edit", "sketch/sketch.yaml": yaml},
			base:       map[string]string{"sketch/sketch.ino": contentHash([]byte(ino)), "sketch/sketch.yaml": contentHash([]byte(yaml))},
			wantUnpair: "sketch/sketch.ino,sketch/sketch.yaml",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			local := t.TempDir()
			for rel, content := range tc.local {
				writeLocal(t, local, rel, content)
			}
			board := newFakeBoard()
			board.readErrs = notOnBoard(sketchPair[0], sketchPair[1])
			for rel, content := range tc.board {
				board.contents["/apps/demo/"+rel] = content
				delete(board.readErrs, "/apps/demo/"+rel)
			}

			res, err := SyncBack(board, "/apps/demo", local, time.Time{}, tc.base)
			if err != nil {
				t.Fatalf("SyncBack: %v", err)
			}
			for p := range board.writes {
				if pairedWith(strings.TrimPrefix(p, "/apps/demo/")) != "" {
					t.Errorf("%s was written to the board", p)
				}
			}
			if len(board.removed) != 0 {
				t.Errorf("removed from the board: %v", board.removed)
			}
			if got := strings.Join(res.Unpaired, ","); got != tc.wantUnpair {
				t.Errorf("unpaired = %q, want %q", got, tc.wantUnpair)
			}
			for _, rel := range sketchPair {
				_, err := os.Stat(filepath.Join(local, filepath.FromSlash(rel)))
				want := slices.Contains(tc.wantLocal, rel)
				if (err == nil) != want {
					t.Errorf("checkout has %s = %v, want %v", rel, err == nil, want)
				}
			}
		})
	}
}

// Pushed back alone, a sketch.yaml the board lost since checkout could leave half a sketch: the checkout drops it instead.
func TestSyncBackDropsManagedFileTheBoardLost(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "sketch/sketch.yaml", "profiles: {} # agent edit")
	board := newFakeBoard()
	board.readErrs = map[string]error{"/apps/demo/sketch/sketch.yaml": fs.ErrNotExist}
	base := map[string]string{"sketch/sketch.yaml": contentHash([]byte("profiles: {}"))}

	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, base)
	if err != nil {
		t.Fatalf("SyncBack: %v", err)
	}
	if len(board.writes) != 0 {
		t.Errorf("the board was written: %v", board.writes)
	}
	if strings.Join(res.Withheld, ",") != "sketch/sketch.yaml" {
		t.Errorf("withheld = %v, want sketch/sketch.yaml", res.Withheld)
	}
	if _, err := os.Stat(filepath.Join(local, "sketch")); !errors.Is(err, fs.ErrNotExist) {
		t.Errorf("the checkout must match the board, which has no sketch/: stat err = %v", err)
	}
	if _, tracked := res.NewBase["sketch/sketch.yaml"]; tracked {
		t.Error("a file the board lost must leave the baseline")
	}
}

// An app without a sketch gains one when the agent writes both files: arduino-app-cli does not load half a sketch/.
func TestSyncBackPushesManagedFileTheBoardLacks(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "sketch/sketch.ino", "void setup() {}")
	writeLocal(t, local, "sketch/sketch.yaml", "profiles: {}")
	board := newFakeBoard()
	board.readErrs = map[string]error{
		"/apps/demo/sketch/sketch.ino":  fs.ErrNotExist,
		"/apps/demo/sketch/sketch.yaml": fs.ErrNotExist,
	}

	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, map[string]string{})
	if err != nil {
		t.Fatalf("SyncBack: %v", err)
	}
	if board.writes["/apps/demo/sketch/sketch.yaml"] != "profiles: {}" || board.writes["/apps/demo/sketch/sketch.ino"] != "void setup() {}" {
		t.Errorf("both sketch files must reach the board: %v", board.writes)
	}
	if len(res.Withheld) != 0 {
		t.Errorf("withheld = %v, want none", res.Withheld)
	}
	if res.NewBase["sketch/sketch.yaml"] != contentHash([]byte("profiles: {}")) {
		t.Error("the pushed sketch.yaml must enter the baseline, so a later edit to it is withheld")
	}
}

// Without the board's copy there is nothing to put back: keep the file, report nothing, and let a later sync decide.
func TestSyncBackKeepsManagedFileItCannotRead(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "app.yaml", "name: renamed by hand")
	board := newFakeBoard()
	board.readErrs = map[string]error{"/apps/demo/app.yaml": errors.New("connection reset")}
	base := map[string]string{"app.yaml": contentHash([]byte("name: demo"))}

	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, base)
	if err != nil {
		t.Fatalf("SyncBack: %v", err)
	}
	if len(res.Withheld) != 0 || len(board.writes) != 0 {
		t.Errorf("withheld = %v, writes = %v, want neither", res.Withheld, board.writes)
	}
	if got, _ := os.ReadFile(filepath.Join(local, "app.yaml")); string(got) != "name: renamed by hand" {
		t.Errorf("mirror app.yaml = %q, want the agent's copy kept", got)
	}
	if res.NewBase["app.yaml"] != base["app.yaml"] {
		t.Error("the baseline must stay, so the next sync sees the edit again")
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

// A board copy that cannot be read may have changed since checkout: the edit waits for a sync that can tell.
func TestSyncBackDoesNotPushOverABoardFileItCannotRead(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "main.py", "agent edit")
	board := newFakeBoard()
	board.readErrs = map[string]error{"/apps/demo/main.py": errors.New("exit status 1")}
	base := map[string]string{"main.py": contentHash([]byte("original"))}

	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, base)

	if err == nil {
		t.Error("the edit did not reach the board, and the sync reported no failure")
	}
	if len(board.writes) != 0 {
		t.Errorf("wrote %v over a board file it could not read", board.writes)
	}
	if res.NewBase["main.py"] != base["main.py"] {
		t.Error("the baseline must stay, so the next sync pushes the edit")
	}
}

// The same holds for a local deletion: the board file is removed only once a sync can tell it is unchanged.
func TestSyncBackDoesNotDeleteABoardFileItCannotRead(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "main.py", "code")
	board := newFakeBoard()
	board.readErrs = map[string]error{"/apps/demo/notes.md": errors.New("exit status 1")}
	base := map[string]string{"main.py": contentHash([]byte("code")), "notes.md": contentHash([]byte("old notes"))}

	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, base)
	if err != nil {
		t.Fatalf("SyncBack: %v", err)
	}
	if len(board.removed) != 0 {
		t.Errorf("removed %v, a board file it could not read", board.removed)
	}
	if res.NewBase["notes.md"] != base["notes.md"] {
		t.Error("the baseline must stay, so a later sync propagates the deletion")
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

	next, parked, err := Reconcile(board, "/apps/demo", local, base)
	if err != nil {
		t.Fatalf("Reconcile: %v", err)
	}
	if len(parked) != 0 {
		t.Fatalf("nothing should be parked when the board side is unchanged: %v", parked)
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

// A built-in app's checkout passes no baseline so the shipped files win: with a baseline, Reconcile preserves a
// locally-diverged file for SyncBack to judge, and for a read-only app SyncBack never runs to judge it.
func TestReconcileWithoutBaselineRestoresBoardContent(t *testing.T) {
	local := t.TempDir()
	if err := os.WriteFile(filepath.Join(local, "main.py"), []byte("agent's edit"), 0o644); err != nil {
		t.Fatal(err)
	}
	board := newFakeBoard()
	board.list = []string{"/ex/main.py"}
	board.contents["/ex/main.py"] = "shipped"

	if _, _, err := Reconcile(board, "/ex", local, nil); err != nil {
		t.Fatalf("reconcile: %v", err)
	}

	got, err := os.ReadFile(filepath.Join(local, "main.py"))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "shipped" {
		t.Errorf("mirror holds %q, want the board's shipped content", got)
	}
}

// Both sides moved since checkout: a re-checkout resolves it — board wins, the local edit is parked as
// .claude-local, the baseline follows the board — so the next SyncBack has nothing left to push or report.
func TestReconcileParksConflictingEditAndRebaselines(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "main.py", "agent edit")
	board := newFakeBoard()
	board.list = []string{"/apps/demo/main.py"}
	board.contents["/apps/demo/main.py"] = "board rewrite"
	base := map[string]string{"main.py": contentHash([]byte("original"))}

	next, parked, err := Reconcile(board, "/apps/demo", local, base)
	if err != nil {
		t.Fatalf("Reconcile: %v", err)
	}
	if len(parked) != 1 || parked[0] != "main.py" {
		t.Fatalf("parked = %v, want [main.py]", parked)
	}
	if got, _ := os.ReadFile(filepath.Join(local, "main.py")); string(got) != "board rewrite" {
		t.Errorf("real file = %q, want the board's version", got)
	}
	if got, _ := os.ReadFile(filepath.Join(local, "main.py"+ParkedSuffix)); string(got) != "agent edit" {
		t.Errorf("parked copy = %q, want the displaced local edit", got)
	}
	if next["main.py"] != contentHash([]byte("board rewrite")) {
		t.Error("baseline must follow the board's content after the resolution")
	}

	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, next)
	if err != nil {
		t.Fatalf("SyncBack: %v", err)
	}
	if len(res.Written) != 0 || len(res.Conflicts) != 0 {
		t.Errorf("resolved file must be in sync: written=%v conflicts=%v", res.Written, res.Conflicts)
	}
}

// Parked copies are mirror-local bookkeeping: SyncBack must never push one to the board or delete one from it.
func TestSyncBackIgnoresParkedFiles(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "main.py", "code")
	writeLocal(t, local, "main.py"+ParkedSuffix, "displaced edit")
	board := newFakeBoard()
	board.contents["/apps/demo/main.py"] = "code"
	base := map[string]string{"main.py": contentHash([]byte("code"))}

	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, base)
	if err != nil {
		t.Fatalf("SyncBack: %v", err)
	}
	if len(board.writes) != 0 {
		t.Errorf("a parked file was pushed to the board: %v", board.writes)
	}
	if len(board.removed) != 0 || len(res.Deleted) != 0 {
		t.Errorf("a parked file triggered deletion bookkeeping: %v %v", board.removed, res.Deleted)
	}
	if _, tracked := res.NewBase["main.py"+ParkedSuffix]; tracked {
		t.Errorf("a parked file entered the baseline: %v", res.NewBase)
	}
}

// A write that returns nil but doesn't persist must fail the sync and leave the baseline alone: advancing it
// would mark the file "in sync" forever — never re-pushed, and reverted by the next Reconcile.
func TestSyncBackDetectsSilentWriteFailure(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "main.py", "edited")
	board := newFakeBoard()
	board.silentWrites = true
	board.contents["/apps/demo/main.py"] = "code" // the stale copy the lying write never replaced
	base := map[string]string{"main.py": contentHash([]byte("code"))}

	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, base)
	if err == nil || !strings.Contains(err.Error(), "did not persist") {
		t.Fatalf("want a did-not-persist error, got %v", err)
	}
	if res.NewBase["main.py"] != base["main.py"] {
		t.Fatalf("baseline advanced for an unverified write: %v", res.NewBase)
	}
}

// A per-file failure must not strand the rest of the run: later files still land and keep their verified
// baseline advances, and the failed file alone is re-pushed on retry — never misread as a conflict.
func TestSyncBackKeepsVerifiedAdvancesOnMidRunFailure(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "a.py", "a edited")
	writeLocal(t, local, "b.py", "b edited")
	board := newFakeBoard()
	board.failPath = "/apps/demo/a.py" // fails first; b.py must still be pushed
	board.contents["/apps/demo/a.py"] = "a orig"
	board.contents["/apps/demo/b.py"] = "b orig"
	base := map[string]string{"a.py": contentHash([]byte("a orig")), "b.py": contentHash([]byte("b orig"))}

	res, err := SyncBack(board, "/apps/demo", local, time.Time{}, base)
	if err == nil {
		t.Fatal("want error from the failing write")
	}
	if board.writes["/apps/demo/b.py"] != "b edited" {
		t.Fatalf("a failure must not strand later files: %v", board.writes)
	}
	if res.NewBase["b.py"] != contentHash([]byte("b edited")) {
		t.Fatalf("a verified write lost its baseline advance: %v", res.NewBase)
	}
	if res.NewBase["a.py"] != base["a.py"] {
		t.Fatalf("the failed write must keep its old baseline: %v", res.NewBase)
	}

	board.failPath = ""
	res2, err := SyncBack(board, "/apps/demo", local, time.Time{}, res.NewBase)
	if err != nil {
		t.Fatalf("retry: %v", err)
	}
	if len(res2.Conflicts) != 0 {
		t.Fatalf("retry misreported already-synced files as conflicts: %v", res2.Conflicts)
	}
	if len(res2.Written) != 1 || res2.Written[0] != "/apps/demo/a.py" {
		t.Fatalf("retry must push only the failed file, wrote %v", res2.Written)
	}
}

// Deleted locally while the board changed since checkout: the board copy is restored, nothing to park.
func TestReconcileRestoresBoardCopyWhenLocalDeleted(t *testing.T) {
	local := t.TempDir()
	board := newFakeBoard()
	board.list = []string{"/apps/demo/main.py"}
	board.contents["/apps/demo/main.py"] = "board rewrite"
	base := map[string]string{"main.py": contentHash([]byte("original"))}

	next, parked, err := Reconcile(board, "/apps/demo", local, base)
	if err != nil {
		t.Fatalf("Reconcile: %v", err)
	}
	if len(parked) != 0 {
		t.Fatalf("a deleted file leaves nothing to park: %v", parked)
	}
	if got, err := os.ReadFile(filepath.Join(local, "main.py")); err != nil || string(got) != "board rewrite" {
		t.Errorf("board copy not restored: %q (%v)", got, err)
	}
	if next["main.py"] != contentHash([]byte("board rewrite")) {
		t.Error("baseline must follow the restored board content")
	}
}

// editingBoard writes a checkout file while its board copy is read, as an agent edit lands during a read over adb.
type editingBoard struct {
	*fakeBoard
	duringRead map[string]func() // board path → the local write that lands while it is read
}

func (b editingBoard) ReadFile(p string) (string, error) {
	if edit := b.duringRead[p]; edit != nil {
		edit()
	}
	return b.fakeBoard.ReadFile(p)
}

// An edit written while Reconcile reads the board copy is parked when the board moved too, and kept for SyncBack when it did not.
func TestReconcileKeepsAnEditMadeDuringTheBoardRead(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "main.py", "original")
	writeLocal(t, local, "util.py", "util")
	inner := newFakeBoard()
	inner.list = []string{"/apps/demo/main.py", "/apps/demo/util.py"}
	inner.contents["/apps/demo/main.py"] = "board rewrite"
	inner.contents["/apps/demo/util.py"] = "util"
	board := editingBoard{fakeBoard: inner, duringRead: map[string]func(){
		"/apps/demo/main.py": func() { writeLocal(t, local, "main.py", "agent edit") },
		"/apps/demo/util.py": func() { writeLocal(t, local, "util.py", "util edit") },
	}}
	base := map[string]string{"main.py": contentHash([]byte("original")), "util.py": contentHash([]byte("util"))}

	next, parked, err := Reconcile(board, "/apps/demo", local, base)
	if err != nil {
		t.Fatalf("Reconcile: %v", err)
	}
	if len(parked) != 1 || parked[0] != "main.py" {
		t.Errorf("parked = %v, want [main.py]", parked)
	}
	if got, _ := os.ReadFile(filepath.Join(local, "main.py"+ParkedSuffix)); string(got) != "agent edit" {
		t.Errorf("parked copy = %q, want the edit made during the read", got)
	}
	if got, _ := os.ReadFile(filepath.Join(local, "util.py")); string(got) != "util edit" {
		t.Errorf("util.py = %q, want the edit left for SyncBack", got)
	}
	if next["util.py"] != base["util.py"] {
		t.Error("util.py must keep its baseline, so SyncBack still sees the edit")
	}
}

// A file the board lost takes the folders it alone kept with it; a folder that still holds a file stays.
func TestReconcileRemovesTheFoldersADropLeavesEmpty(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "app.yaml", "name: demo")
	writeLocal(t, local, "old/sub/gone.py", "gone")
	writeLocal(t, local, "old/also-gone.py", "gone too")
	writeLocal(t, local, "keep/gone.py", "gone")
	writeLocal(t, local, "keep/new.py", "a file the agent created")
	board := newFakeBoard()
	board.list = []string{"/apps/demo/app.yaml"}
	board.contents["/apps/demo/app.yaml"] = "name: demo"
	base := map[string]string{
		"app.yaml":         contentHash([]byte("name: demo")),
		"old/sub/gone.py":  contentHash([]byte("gone")),
		"old/also-gone.py": contentHash([]byte("gone too")),
		"keep/gone.py":     contentHash([]byte("gone")),
	}

	if _, _, err := Reconcile(board, "/apps/demo", local, base); err != nil {
		t.Fatalf("Reconcile: %v", err)
	}
	if _, err := os.Stat(filepath.Join(local, "old")); !errors.Is(err, fs.ErrNotExist) {
		t.Errorf("old/ held only files the board lost: stat err = %v, want it removed", err)
	}
	if _, err := os.Stat(filepath.Join(local, "keep", "new.py")); err != nil {
		t.Errorf("keep/new.py and its folder must stay: %v", err)
	}
	if _, err := os.Stat(filepath.Join(local, "keep", "gone.py")); !errors.Is(err, fs.ErrNotExist) {
		t.Errorf("keep/gone.py: stat err = %v, want it dropped", err)
	}
}

// Turn-end cleanup removes the parked copies (same-turn buffers) and touches nothing else.
// A sync skips parked copies and skipped folders, so the checkout matches its baseline with them; a delete of the folder would lose them.
func TestHoldsOnlyBaselineCountsWhatASyncSkips(t *testing.T) {
	base := map[string]string{"main.py": contentHash([]byte("code"))}
	for name, extra := range map[string]string{
		"nothing more":  "",
		"a parked copy": "main.py" + ParkedSuffix,
		"a .git file":   ".git/notes",
		"a dependency":  "node_modules/x/index.js",
		"a cache file":  ".cache/y",
	} {
		local := t.TempDir()
		writeLocal(t, local, "main.py", "code")
		if extra != "" {
			writeLocal(t, local, extra, "kept only here")
		}
		if !MatchesBaseline(local, base) {
			t.Errorf("%s: MatchesBaseline = false, want true: a sync pushes nothing", name)
		}
		if got := HoldsOnlyBaseline(local, base); got != (extra == "") {
			t.Errorf("%s: HoldsOnlyBaseline = %v, want %v", name, got, extra == "")
		}
	}
}

func TestRemoveParkedLeavesRealFiles(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "main.py", "code")
	writeLocal(t, local, "main.py"+ParkedSuffix, "displaced edit")
	writeLocal(t, local, "sub/app.yaml", "y")
	writeLocal(t, local, "sub/app.yaml"+ParkedSuffix, "old y")

	RemoveParked(local)

	for _, rel := range []string{"main.py", "sub/app.yaml"} {
		if _, err := os.Stat(filepath.Join(local, filepath.FromSlash(rel))); err != nil {
			t.Errorf("real file %s touched by cleanup: %v", rel, err)
		}
		if _, err := os.Stat(filepath.Join(local, filepath.FromSlash(rel)+ParkedSuffix)); !os.IsNotExist(err) {
			t.Errorf("parked copy %s not removed (err=%v)", rel+ParkedSuffix, err)
		}
	}
}

func TestReconcileParksUntrackedEdits(t *testing.T) {
	local := t.TempDir()
	writeLocal(t, local, "main.py", "stranded agent edit")
	board := newFakeBoard()
	board.list = []string{"/apps/demo/main.py"}
	board.contents["/apps/demo/main.py"] = "board content"

	// Empty non-nil base = a reattached mirror: the stranded edit is parked, never silently overwritten.
	next, parked, err := Reconcile(board, "/apps/demo", local, map[string]string{})
	if err != nil {
		t.Fatalf("Reconcile: %v", err)
	}
	if len(parked) != 1 || parked[0] != "main.py" {
		t.Fatalf("parked = %v, want [main.py]", parked)
	}
	if got, _ := os.ReadFile(filepath.Join(local, "main.py")); string(got) != "board content" {
		t.Errorf("real file = %q, want the board's version", got)
	}
	if got, _ := os.ReadFile(filepath.Join(local, "main.py"+ParkedSuffix)); string(got) != "stranded agent edit" {
		t.Errorf("parked copy = %q, want the stranded edit", got)
	}
	if next["main.py"] != contentHash([]byte("board content")) {
		t.Error("baseline must track the restored board content")
	}

	// nil base is the read-only restore: same difference, deliberately no parking.
	writeLocal(t, local, "main.py", "stranded agent edit")
	_ = os.Remove(filepath.Join(local, "main.py"+ParkedSuffix))
	if _, parked, err := Reconcile(board, "/apps/demo", local, nil); err != nil || len(parked) != 0 {
		t.Fatalf("nil-base reconcile: parked=%v err=%v, want no parking", parked, err)
	}
}

// partialList is what a walk that lost a subtree looks like across the BoardFS seam (fs.UnreadableDirsError).
type partialList struct{ dirs []string }

func (e partialList) Error() string             { return "could not list: " + strings.Join(e.dirs, ", ") }
func (e partialList) UnreadablePaths() []string { return e.dirs }

// One folder the board won't let us list (a root-owned .venv, say) used to fail the whole checkout, leaving the
// agent with no mirror at all. The rest of the app is mirrored instead, and the missing paths stay out of the
// baseline, so SyncBack neither pushes nor deletes them.
func TestPopulateMirrorsWhatTheWalkCouldRead(t *testing.T) {
	local := t.TempDir()
	board := newFakeBoard()
	board.list = []string{"/apps/demo/app.yaml", "/apps/demo/main.py"}
	board.listErr = partialList{dirs: []string{"/apps/demo/.venv"}}

	base, err := Populate(board, "/apps/demo", local)
	if err != nil {
		t.Fatalf("a partial walk must still check the app out: %v", err)
	}
	for _, rel := range []string{"app.yaml", "main.py"} {
		if base[rel] == "" {
			t.Errorf("baseline missing %q: %v", rel, base)
		}
		if _, err := os.Stat(filepath.Join(local, rel)); err != nil {
			t.Errorf("%q not mirrored: %v", rel, err)
		}
	}
	if _, ok := base[".venv/pyvenv.cfg"]; ok {
		t.Error("the unreadable subtree must not appear in the baseline")
	}
}

// A connection that failed outright is still fatal: an empty listing there would mirror an empty app and let
// SyncBack read every board file as deleted.
func TestPopulateFailsWhenTheWalkFailed(t *testing.T) {
	board := newFakeBoard()
	board.listErr = errors.New("ssh: rejected: connect failed (open failed)")

	if _, err := Populate(board, "/apps/demo", t.TempDir()); err == nil {
		t.Fatal("want an error when the board could not be walked at all")
	}
}
