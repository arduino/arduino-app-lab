package app

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
	"github.com/arduino/arduino-app-cli/pkg/board/remote/local"

	"app-lab-desktop/internal/agent"
	"app-lab-desktop/internal/appmirror"
	"app-lab-desktop/internal/arduinoapps"
	"app-lab-desktop/internal/board"
	"app-lab-desktop/internal/fs"
)

// The zero threshold hands the whole decision to the per-file content hashes, so it may only be returned when the
// mirror actually has them: dropping the mtime gate without a baseline is the B4 force-push that reverted the
// user's editor saves. The force callers already pass the zero time, so a missing guard here would be invisible.
func TestSyncThreshold(t *testing.T) {
	baseline := time.Now().Add(-time.Hour)
	earlier, later := baseline.Add(-30*time.Minute), baseline.Add(30*time.Minute)

	for name, tc := range map[string]struct {
		since time.Time
		app   checkedApp
		force bool
		want  time.Time
	}{
		"force on a baselined mirror lets the hashes decide": {
			time.Time{}, checkedApp{baseline: baseline, baselined: true}, true, time.Time{},
		},
		"a dirty baselined mirror re-pushes every edit": {
			later, checkedApp{baseline: baseline, baselined: true, dirty: true}, false, time.Time{},
		},
		"force on a reattached mirror still gates on mtime": { // no hashes to gate on: B4 would push the whole mirror
			time.Time{}, checkedApp{baseline: baseline}, true, baseline,
		},
		"a dirty reattached mirror also keeps the gate": {
			time.Time{}, checkedApp{baseline: baseline, dirty: true}, true, baseline,
		},
		"an older window falls back to the baseline": { // skips the initial Populate copy, whose mtime predates it
			earlier, checkedApp{baseline: baseline, baselined: true}, false, baseline,
		},
		"a later turn window wins over the baseline": {
			later, checkedApp{baseline: baseline, baselined: true}, false, later,
		},
	} {
		if got := syncThreshold(tc.since, tc.app, tc.force); !got.Equal(tc.want) {
			t.Errorf("%s: threshold = %v, want %v", name, got, tc.want)
		}
	}
}

// X2: app ids repeat across boards, so the mirror dir must not be shared between them — switching board would
// otherwise reuse board A's mirror for board B's app of the same name, and Populate would overwrite A's pending edits.
func TestMirrorKeyIsPerBoard(t *testing.T) {
	a := mirrorKey("AAAA1111", "user:blink")
	b := mirrorKey("BBBB2222", "user:blink")
	if a == b {
		t.Fatalf("same key for two boards: %q", a)
	}
	for _, key := range []string{a, b} {
		if strings.ContainsAny(key, `:/\`) {
			t.Errorf("key %q is not filesystem-safe", key)
		}
	}
	// A board with no identity (SBC/placeholder) keys by app alone — no board prefix.
	if got := mirrorKey("", "user:blink"); strings.Contains(got, "__") {
		t.Errorf("unkeyed mirror = %q, want no board prefix", got)
	}
}

// The agent retypes mirror paths, and raw base64 ids get mangled (a mistyped Write strands edits in a ghost dir),
// so the key embeds the decoded id; the hash of the raw id keeps distinct ids distinct through lossy sanitization.
func TestMirrorKeyReadableAndUnique(t *testing.T) {
	enc := func(s string) string { return base64.RawStdEncoding.EncodeToString([]byte(s)) }

	key := mirrorKey("331030603", "dXNlcjplZGdlLWFpLXZvaWNlLWFzc2lzdGFudA") // base64("user:edge-ai-voice-assistant")
	prefix := "331030603__user-edge-ai-voice-assistant-"
	if !strings.HasPrefix(key, prefix) || len(key) != len(prefix)+6 {
		t.Errorf("key = %q, want %s + 6 hex chars", key, prefix)
	}

	// Distinct raw ids whose sanitized names collide must still get distinct keys.
	a, b := mirrorKey("", enc("user:my app")), mirrorKey("", enc("user:my:app"))
	if a == b {
		t.Fatalf("colliding sanitized names share a key: %q", a)
	}
	if !strings.HasPrefix(a, "user-my-app-") || !strings.HasPrefix(b, "user-my-app-") {
		t.Errorf("sanitized names = %q, %q, want user-my-app-*", a, b)
	}

	// A padded id decodes too; a non-base64 id falls back to the sanitized raw id (still hash-suffixed).
	if got := mirrorKey("", "dXNlcjpibGluaw=="); !strings.HasPrefix(got, "user-blink-") {
		t.Errorf("padded id = %q, want user-blink-*", got)
	}
	if got := mirrorKey("", "user:blink"); !strings.HasPrefix(got, "user-blink-") || len(got) != len("user-blink-")+6 {
		t.Errorf("non-base64 id = %q, want the sanitized raw id + hash", got)
	}

	// Long names are capped (40 chars + hash) and every key stays filesystem-safe.
	long := mirrorKey("", enc("user:"+strings.Repeat("very-long-name-", 10)))
	if len(long) > 40+1+6 {
		t.Errorf("long key = %q (%d chars), want at most 47", long, len(long))
	}
	for _, k := range []string{key, a, b, long} {
		if strings.ContainsAny(k, `:/\ `) {
			t.Errorf("key %q is not filesystem-safe", k)
		}
	}
}

// A built-in app is mirrored so the agent can read it, but its board copy ships with the product and the editor
// cannot undo a change to it — so sync must withhold the edits and report them, never push and never stay silent.
func TestSyncCheckoutsWithholdsBuiltInEdits(t *testing.T) {
	edited, untouched, rechecked := t.TempDir(), t.TempDir(), t.TempDir()
	baseline := time.Now().Add(-time.Hour)
	if err := os.WriteFile(filepath.Join(edited, "main.py"), []byte("print('edited')"), 0o644); err != nil {
		t.Fatal(err)
	}
	// A second checkout rewrites every file with the board's copy: new times, the same content.
	const shipped = "print('shipped')"
	if err := os.WriteFile(filepath.Join(rechecked, "main.py"), []byte(shipped), 0o644); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256([]byte(shipped))

	a := &App{checkedOut: map[string]checkedApp{
		"builtin-edited":    {appPath: "/var/lib/arduino-app-cli/examples/inspirational/blink", mirror: edited, baseline: baseline, hashes: map[string]string{}, readOnly: true, baselined: true},
		"builtin-untouched": {appPath: "/var/lib/arduino-app-cli/examples/bricks/arduino/x", mirror: untouched, baseline: baseline, hashes: map[string]string{}, readOnly: true, baselined: true},
		"builtin-rechecked": {appPath: "/var/lib/arduino-app-cli/examples/bricks/arduino/y", mirror: rechecked, baseline: baseline, hashes: map[string]string{"main.py": hex.EncodeToString(sum[:])}, readOnly: true, baselined: true},
	}}

	// A board write would panic on the nil connection, so reaching SyncBack at all is itself the failure signal.
	failed, conflicts, withheld, _ := a.syncCheckouts(time.Time{}, true, nil)

	if len(failed) > 0 || len(conflicts) > 0 {
		t.Errorf("built-in apps reported as failed/conflicted: %v / %v", failed, conflicts)
	}
	if withheld["builtin-edited"] == nil {
		t.Error("edits to a built-in app were dropped without telling the agent")
	}
	if withheld["builtin-untouched"] != nil {
		t.Error("an unedited built-in app should not report withheld edits")
	}
	if withheld["builtin-rechecked"] != nil {
		t.Error("a built-in app checked out twice reported edits nobody made")
	}
}

// Only a clean "no board app matches" verdict makes a ghost: a reverse-map error is transient (the board or its
// app list was unreadable), and tracked or dot dirs (.claude is the agent runtime's own) are never even looked up.
func TestClassifyMirrorDir(t *testing.T) {
	noLookup := func() (bool, error) { t.Fatal("lookup ran for a dir that should be pre-skipped"); return false, nil }
	for name, tc := range map[string]struct {
		dir     string
		tracked bool
		lookup  func() (bool, error)
		want    mirrorDirClass
	}{
		"dot dirs like .claude are never ghosts":        {".claude", false, noLookup, mirrorDirSkip},
		"tracked dirs are already checked out":          {"B1__user-blink-abc123", true, noLookup, mirrorDirSkip},
		"a reverse-map error is transient, not a ghost": {"B1__user-blink-abc123", false, func() (bool, error) { return false, errors.New("board offline") }, mirrorDirSkip},
		"no matching board app means a ghost":           {"B1__user-blnk-typo00", false, func() (bool, error) { return false, nil }, mirrorDirGhost},
		"a matching app is reattached":                  {"B1__user-blink-abc123", false, func() (bool, error) { return true, nil }, mirrorDirReattach},
	} {
		if got := classifyMirrorDir(tc.dir, tc.tracked, tc.lookup); got != tc.want {
			t.Errorf("%s: classify = %v, want %v", name, got, tc.want)
		}
	}
}

// A failed or conflicted sync must outlive slog: the warning stays per app (latest outcome wins) until that
// app's next clean sync, so the agent's next tool call corrects its "edits landed" belief.
func TestRecordSyncIssue(t *testing.T) {
	a := &App{pendingSyncIssues: map[string]syncIssue{}}

	a.recordSyncIssue("user:app", errors.New("dial tcp: timeout"), nil)
	if w := a.pendingSyncWarnings(); len(w) != 1 || !strings.Contains(w[0], "did NOT reach the board") || !strings.Contains(w[0], "re-pushed automatically") {
		t.Fatalf("failure warning = %v, want failure line with the self-heal note", w)
	}

	a.recordSyncIssue("user:app", nil, errors.New("changed on the board since checkout: README.md (re-run apps_checkout to pick up the board's version)"))
	if w := a.pendingSyncWarnings(); len(w) != 1 || strings.Contains(w[0], "re-pushed automatically") || !strings.Contains(w[0], "re-run apps_checkout") {
		t.Fatalf("conflict warning = %v, want a passthrough of the conflict error only", w)
	}

	// A quiet sync proves nothing about a conflict its mtime gate skipped: the conflict half must stick.
	a.recordSyncIssue("user:app", nil, nil)
	if w := a.pendingSyncWarnings(); len(w) != 1 || !strings.Contains(w[0], "re-run apps_checkout") {
		t.Fatalf("conflict must survive a quiet sync, got %v", w)
	}

	a.recordSyncIssue("user:app", errors.New("write did not persist"), nil)
	if w := a.pendingSyncWarnings(); len(w) != 2 {
		t.Fatalf("failure + sticky conflict = %v, want both lines", w)
	}

	a.clearConflictIssue("user:app")
	a.recordSyncIssue("user:app", nil, nil)
	if w := a.pendingSyncWarnings(); len(w) != 0 {
		t.Fatalf("re-checkout then a clean sync must clear everything, got %v", w)
	}
}

func TestGhostWarningsOncePerEdit(t *testing.T) {
	a := &App{ghostMirrors: map[string]bool{}}
	present := map[string]bool{"g": true}

	a.recordGhostMirrors(present, map[string]bool{"g": true})
	if w := a.dueGhostWarnings(); len(w) != 1 || w[0] != "g" {
		t.Fatalf("first render = %v, want [g]", w)
	}
	if w := a.dueGhostWarnings(); len(w) != 0 {
		t.Fatalf("second render = %v, want silence until a newer edit", w)
	}
	a.recordGhostMirrors(present, map[string]bool{"g": true})
	if w := a.dueGhostWarnings(); len(w) != 1 {
		t.Fatalf("re-armed render = %v, want [g] again", w)
	}
	a.recordGhostMirrors(map[string]bool{}, nil)
	if len(a.ghostMirrors) != 0 {
		t.Fatal("a vanished dir must drop its entry")
	}
}

// The editor's GetFileContent hands images back as data URIs: read that way, sync-back's read-back verify would hash the URI against raw bytes and report a false "did not persist".
func TestBoardFilesReadRawBytes(t *testing.T) {
	dir := t.TempDir()
	svg := `<svg xmlns="http://www.w3.org/2000/svg"/>`
	if err := os.WriteFile(filepath.Join(dir, "a.svg"), []byte(svg), 0o644); err != nil {
		t.Fatal(err)
	}
	sb := board.Noop()
	sb.Conn = &local.LocalConnection{}

	got, err := boardFiles{app: &App{selectedBoard: sb}}.ReadFile(filepath.ToSlash(filepath.Join(dir, "a.svg")))

	if err != nil || got != svg {
		t.Errorf("read %q (%v), want the raw image", got, err)
	}
}

// deniedDirConn serves an app with one subdirectory the board refuses to list.
type deniedDirConn struct{ remote.RemoteConn }

func (deniedDirConn) Stats(p string) (remote.FileInfo, error) {
	return remote.FileInfo{Name: path.Base(p), IsDir: path.Ext(p) == ""}, nil
}

func (deniedDirConn) List(p string) ([]remote.FileInfo, error) {
	if strings.TrimSuffix(p, "/") == "/apps/demo" {
		return []remote.FileInfo{{Name: "app.yaml"}, {Name: "denied", IsDir: true}}, nil
	}
	return nil, errors.New("ls: cannot open directory: Permission denied: Process exited with status 2")
}

// A walk that lost one subtree still hands back what it read: the error names
// the subtree so the callers that compare against a full listing can refuse,
// while a first checkout mirrors the rest instead of failing outright.
func TestBoardFilesListFilesKeepsThePathsFromAPartialWalk(t *testing.T) {
	sb := board.Noop()
	sb.Conn = deniedDirConn{}

	files, err := boardFiles{app: &App{selectedBoard: sb}}.ListFiles("/apps/demo")

	var partial *fs.UnreadableDirsError
	if !errors.As(err, &partial) {
		t.Fatalf("want *fs.UnreadableDirsError, got %v", err)
	}
	if len(partial.Paths) != 1 || partial.Paths[0] != "denied" {
		t.Errorf("want the unreadable dir named, got %v", partial.Paths)
	}
	if len(files) != 1 || files[0] != "/apps/demo/app.yaml" {
		t.Errorf("want the readable files back, got %v", files)
	}
}

// The new name may hold the checkout of an app gone since: it moves aside, and the rename goes through.
func TestMoveCheckoutSetsAStaleFolderAside(t *testing.T) {
	root := t.TempDir()
	from, to := filepath.Join(root, "board__user-a-111111"), filepath.Join(root, "board__user-b-222222")
	writeFiles(t, from, map[string]string{"main.py": "renamed app"})
	writeFiles(t, to, map[string]string{"main.py": "deleted app"})

	if err := moveCheckout(from, to); err != nil {
		t.Fatal(err)
	}

	if got, err := os.ReadFile(filepath.Join(to, "main.py")); err != nil || string(got) != "renamed app" {
		t.Errorf("checkout main.py = %q, %v; want the renamed app's", got, err)
	}
	entries, _ := os.ReadDir(root)
	var aside []string
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".") {
			aside = append(aside, e.Name())
		}
	}
	if len(aside) != 1 {
		t.Fatalf("folders set aside = %v, want one", aside)
	}
	if got, _ := os.ReadFile(filepath.Join(root, aside[0], "main.py")); string(got) != "deleted app" {
		t.Errorf("the old checkout was not kept aside: %q", got)
	}
}

// dotFolders lists the folders under root that a move set aside.
func dotFolders(t *testing.T, root string) []string {
	t.Helper()
	entries, err := os.ReadDir(root)
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for _, e := range entries {
		if e.IsDir() && strings.HasPrefix(e.Name(), ".") {
			out = append(out, e.Name())
		}
	}
	return out
}

// A deleted app's checkout is removed only when its baseline shows it holds what the board last had; a new app of that name gets the folder.
func TestADeletedAppsCheckoutIsRemovedUnlessItMayHoldEdits(t *testing.T) {
	const app = "dXNlcjpibGluaw" // user:blink
	sum := sha256.Sum256([]byte("print('board')"))
	baseline := map[string]string{"main.py": hex.EncodeToString(sum[:])}
	for name, tc := range map[string]struct {
		files   map[string]string
		entry   string // baselined, adopted (at a turn end, no hashes) or untracked
		removed bool
	}{
		"what the board had":                  {map[string]string{"main.py": "print('board')"}, "baselined", true},
		"an edit the board never got":         {map[string]string{"main.py": "print('edited')"}, "baselined", false},
		"a parked copy to re-apply":           {map[string]string{"main.py": "print('board')", "main.py" + appmirror.ParkedSuffix: "print('edited')"}, "baselined", false},
		"a file in a folder no sync reads":    {map[string]string{"main.py": "print('board')", ".git/notes": "notes"}, "baselined", false},
		"a checkout adopted at a turn end":    {map[string]string{"main.py": "print('board')"}, "adopted", false},
		"a checkout no entry of this run has": {map[string]string{"main.py": "print('board')"}, "untracked", false},
	} {
		t.Run(name, func(t *testing.T) {
			a := testApp(t)
			mirror := a.workspaceMirrorDir(app)
			writeFiles(t, mirror, tc.files)
			switch tc.entry {
			case "baselined":
				a.checkedOut[app] = checkedApp{appPath: "/apps/blink", mirror: mirror, baseline: time.Now(), hashes: baseline, baselined: true}
			case "adopted": // every file older than the adoption, so file times say nothing was edited since
				a.checkedOut[app] = checkedApp{appPath: "/apps/blink", mirror: mirror, baseline: time.Now().Add(time.Minute), hashes: map[string]string{}}
			}
			a.pendingSyncIssues[app] = syncIssue{conflict: "warning: edits to app blink did NOT reach the board"}
			a.ghostMirrors[filepath.Base(mirror)] = false

			a.dropDeletedCheckout(app, a.selectedBoardID(), 0)

			if _, tracked := a.checkedOut[app]; tracked {
				t.Error("the deleted app is still checked out, so a sync would write its files back onto the board")
			}
			if len(a.ghostMirrors) != 0 || (tc.entry != "untracked" && len(a.pendingSyncIssues) != 0) {
				t.Errorf("sync issues %v and ghosts %v are left about the deleted app", a.pendingSyncIssues, a.ghostMirrors)
			}
			if _, err := os.Stat(mirror); !errors.Is(err, os.ErrNotExist) {
				t.Errorf("the checkout is still at %s (%v): a new app of that name would get its files", mirror, err)
			}
			aside := dotFolders(t, filepath.Dir(mirror))
			if tc.removed && len(aside) != 0 {
				t.Errorf("folders set aside = %v, want the checkout removed", aside)
			}
			if !tc.removed {
				if len(aside) != 1 {
					t.Fatalf("folders set aside = %v, want the checkout kept aside", aside)
				}
				for rel, content := range tc.files {
					if got, _ := os.ReadFile(filepath.Join(filepath.Dir(mirror), aside[0], filepath.FromSlash(rel))); string(got) != content {
						t.Errorf("%s set aside = %q, want %q", rel, got, content)
					}
				}
			}
		})
	}
	// After a board change the entry is another board's app of the same id: it stays.
	a := testApp(t)
	a.checkedOut[app] = checkedApp{appPath: "/apps/blink", mirror: t.TempDir()}
	a.boardGen = 1
	a.dropDeletedCheckout(app, "B1", 0)
	if _, tracked := a.checkedOut[app]; !tracked {
		t.Error("a delete seen before a board change dropped the new board's checkout")
	}
}

// The drop waits for a sync or a checkout of the same app: either may be walking the folder it removes.
func TestTheDropWaitsForTheAppsCheckoutLock(t *testing.T) {
	const app = "dXNlcjpibGluaw"
	a := testApp(t)
	mirror := a.workspaceMirrorDir(app)
	writeFiles(t, mirror, map[string]string{"main.py": "print('board')"})
	sum := sha256.Sum256([]byte("print('board')"))
	a.checkedOut[app] = checkedApp{appPath: "/apps/blink", mirror: mirror, baseline: time.Now(), hashes: map[string]string{"main.py": hex.EncodeToString(sum[:])}, baselined: true}
	lock := a.checkoutLock(app)
	lock.Lock()
	done := make(chan struct{})
	go func() {
		a.dropDeletedCheckout(app, a.selectedBoardID(), 0)
		close(done)
	}()
	select {
	case <-done:
		t.Fatal("the drop ran while a sync held the app's lock")
	case <-time.After(200 * time.Millisecond):
	}
	if _, err := os.Stat(mirror); err != nil {
		t.Errorf("the folder went while the lock was held: %v", err)
	}
	lock.Unlock()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("the drop never ran")
	}
}

// A clean checkout the delete could not remove whole (a file held open on Windows) moves aside with what is left of it.
func TestACheckoutThatCannotBeRemovedMovesAside(t *testing.T) {
	if os.Geteuid() == 0 || runtime.GOOS == "windows" {
		t.Skip("a read-only folder does not stop root, or a removal on Windows")
	}
	const app = "dXNlcjpibGluaw"
	a := testApp(t)
	mirror := a.workspaceMirrorDir(app)
	writeFiles(t, mirror, map[string]string{"python/main.py": "print('board')"})
	sum := sha256.Sum256([]byte("print('board')"))
	a.checkedOut[app] = checkedApp{appPath: "/apps/blink", mirror: mirror, baseline: time.Now(), hashes: map[string]string{"python/main.py": hex.EncodeToString(sum[:])}, baselined: true}
	if err := os.Chmod(filepath.Join(mirror, "python"), 0o555); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { // the folder moved, so the temp dir's cleanup needs it writable where it is now
		_ = filepath.WalkDir(filepath.Dir(mirror), func(p string, d os.DirEntry, err error) error {
			if err == nil && d.IsDir() {
				_ = os.Chmod(p, 0o755)
			}
			return nil
		})
	})

	a.dropDeletedCheckout(app, a.selectedBoardID(), 0)

	if _, err := os.Stat(mirror); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("the checkout is still at %s (%v): a new app of that name would get its files", mirror, err)
	}
	if aside := dotFolders(t, filepath.Dir(mirror)); len(aside) != 1 {
		t.Errorf("folders set aside = %v, want what the removal left", aside)
	}
	if len(a.deletedLeftovers) != 0 {
		t.Errorf("leftovers = %v, want none: the folder moved", a.deletedLeftovers)
	}
}

// A folder the delete could neither remove nor move (a file held open on Windows) is moved aside by the next checkout of that id.
func TestANewCheckoutMovesADeletedAppsLeftoverAside(t *testing.T) {
	if os.Geteuid() == 0 || runtime.GOOS == "windows" {
		t.Skip("a read-only folder does not stop root, or a rename on Windows")
	}
	const app = "dXNlcjpibGluaw"
	a := testApp(t)
	a.selectedBoard.Conn = &local.LocalConnection{}
	appDir := filepath.Join(t.TempDir(), "blink")
	writeFiles(t, appDir, map[string]string{"app.yaml": "name: blink", "python/main.py": "print('new app')"})
	orig := resolveApp
	resolveApp = func(*App, string) (arduinoapps.AppTarget, error) {
		return arduinoapps.AppTarget{Path: filepath.ToSlash(appDir)}, nil
	}
	t.Cleanup(func() { resolveApp = orig })
	mirror := a.workspaceMirrorDir(app)
	writeFiles(t, mirror, map[string]string{"python/old.py": "print('the deleted app')"})
	root := filepath.Dir(mirror)
	if err := os.Chmod(root, 0o555); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(root, 0o755) })

	a.dropDeletedCheckout(app, a.selectedBoardID(), 0)
	if err := os.Chmod(root, 0o755); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(mirror, "python", "old.py")); err != nil {
		t.Fatalf("setup: the leftover was moved after all: %v", err)
	}

	co, err := a.checkoutApp(app)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := filesUnder(t, co.Path), []string{"app.yaml", "python/main.py"}; !slices.Equal(got, want) {
		t.Errorf("new checkout = %v, want the new app's files alone: %v", got, want)
	}
	if aside := dotFolders(t, root); len(aside) != 1 {
		t.Errorf("folders set aside = %v, want the leftover kept aside", aside)
	}
}

// An entry left on the old id would sync into the app folder the rename took away, and make it again on the board.
func TestRebindCheckoutDropsAnEntryItCannotMove(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_DATA_HOME", filepath.Join(home, ".local", "share"))
	t.Setenv("LOCALAPPDATA", filepath.Join(home, "AppData", "Local"))
	a := &App{selectedBoard: board.Noop(), checkedOut: map[string]checkedApp{"old": {appPath: "/apps/old", mirror: filepath.Join(home, "old")}}}

	a.rebindCheckout("old", "new")

	if len(a.checkedOut) != 0 {
		t.Errorf("checkouts = %v, want the old entry dropped", a.checkedOut)
	}
}

// A rename moves the holds running turns have on the parked copies: left on the old id, the next turn end would remove copies a chat still has to re-apply.
func TestARenameMovesTheHoldsOnParkedCopies(t *testing.T) {
	a := testApp(t)
	oldMirror := a.workspaceMirrorDir("user:old")
	writeFiles(t, oldMirror, map[string]string{"main.py": "agent edit", "main.py" + appmirror.ParkedSuffix: "parked edit"})
	a.checkedOut["user:old"] = checkedApp{appPath: "/apps/old", mirror: oldMirror}
	orig := resolveApp
	resolveApp = func(*App, string) (arduinoapps.AppTarget, error) {
		return arduinoapps.AppTarget{Path: "/apps/new"}, nil
	}
	t.Cleanup(func() { resolveApp = orig })
	a.beginTurn("chat")
	a.checkoutMu.Lock()
	a.holdParkedLocked("user:old")
	a.checkoutMu.Unlock()

	a.rebindCheckout("user:old", "user:new")

	newMirror := a.workspaceMirrorDir("user:new")
	a.checkoutMu.Lock()
	newHeld, oldHeld := a.parkedHeldLocked("user:new"), a.parkedHeldLocked("user:old")
	moved, left := a.checkedOut["user:new"]
	_, stale := a.checkedOut["user:old"]
	a.checkoutMu.Unlock()
	if !newHeld || oldHeld {
		t.Errorf("held: new id %v, old id %v; want the hold on the new id only", newHeld, oldHeld)
	}
	if !left || stale || moved.mirror != newMirror || moved.appPath != "/apps/new" {
		t.Errorf("checkout on the new id = %+v (tracked %v, old one still tracked %v), want it moved to %s", moved, left, stale, newMirror)
	}
	if _, err := os.Stat(filepath.Join(newMirror, "main.py"+appmirror.ParkedSuffix)); err != nil {
		t.Errorf("the parked copy did not move with the folder: %v", err)
	}
}

// Three empty maps read as "nothing to push", so the flush also has to say it looked at everything.
func TestEveryFlushIsJudgedOnItsOwnRun(t *testing.T) {
	a := &App{checkedOut: map[string]checkedApp{}}

	if _, _, _, complete := a.syncCheckoutsComplete(time.Time{}, true); !complete {
		t.Error("a flush with nothing to do reported itself incomplete")
	}
	// What a turn-end flush leaves behind when the board changes under it, and nobody used to consume.
	a.syncStoppedEarly = true
	if _, _, _, complete := a.syncCheckoutsComplete(time.Time{}, true); !complete {
		t.Error("a flag left by an earlier flush condemned this one")
	}
	a.checkoutMu.Lock()
	stuck := a.syncStoppedEarly
	a.checkoutMu.Unlock()
	if stuck {
		t.Error("the flag outlived the run it describes")
	}
}

// A board whose every write moves the generation, the way a real board swap does under a running flush.
type swappingConn struct {
	remote.RemoteConn
	app   *App
	mu    sync.Mutex
	files map[string]string
}

func (c *swappingConn) WriteFile(r io.Reader, p string) error {
	data, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	c.mu.Lock()
	c.files[p] = string(data)
	c.mu.Unlock()
	c.app.checkoutMu.Lock()
	c.app.boardGen++
	c.app.checkoutMu.Unlock()
	return nil
}

func (c *swappingConn) Stats(p string) (remote.FileInfo, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, ok := c.files[p]; !ok {
		return remote.FileInfo{}, os.ErrNotExist
	}
	return remote.FileInfo{Name: path.Base(p)}, nil
}

func (c *swappingConn) ReadFile(p string) (io.ReadCloser, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	content, ok := c.files[p]
	if !ok {
		return nil, os.ErrNotExist
	}
	return io.NopCloser(strings.NewReader(content)), nil
}

func (c *swappingConn) MkDirAll(string) error { return nil }

// Two edited checkouts and a board the first push swaps, so the flush stops before the second.
func armSwapMidFlush(t *testing.T, a *App) *swappingConn {
	t.Helper()
	conn := &swappingConn{app: a, files: map[string]string{}}
	sb := board.Noop()
	sb.Conn = conn
	a.selectedBoard = sb

	baseline := time.Now().Add(-time.Hour)
	for _, name := range []string{"one", "two"} {
		mirror := t.TempDir()
		if err := os.WriteFile(filepath.Join(mirror, "notes.txt"), []byte("edited "+name), 0o644); err != nil {
			t.Fatal(err)
		}
		a.checkedOut["user:"+name] = checkedApp{
			appPath:   "/apps/" + name,
			mirror:    mirror,
			baseline:  baseline,
			hashes:    map[string]string{},
			baselined: true,
		}
	}
	return conn
}

// Three empty maps read as "nothing to push", so a flush the board interrupted has to say so itself.
func TestAFlushTheBoardInterruptedReportsIncomplete(t *testing.T) {
	a := &App{checkedOut: map[string]checkedApp{}, pendingSyncIssues: map[string]syncIssue{}, ghostMirrors: map[string]bool{}}
	conn := armSwapMidFlush(t, a)

	failed, conflicts, withheld, complete := a.syncCheckoutsComplete(time.Time{}, true)

	if len(failed) > 0 || len(conflicts) > 0 || len(withheld) > 0 {
		t.Fatalf("the push itself failed, so this proves nothing about the early return: %v / %v / %v", failed, conflicts, withheld)
	}
	if complete {
		t.Error("a flush that returned before it had looked at every checkout reported itself complete")
	}
	if len(conn.files) != 1 {
		t.Errorf("%d files reached the board, want the one pushed before the swap: %v", len(conn.files), conn.files)
	}
	// Consumed by its one reader, so the next flush is judged on its own run.
	a.checkoutMu.Lock()
	stuck := a.syncStoppedEarly
	a.checkoutMu.Unlock()
	if stuck {
		t.Error("the flag outlived the run it describes")
	}
}

// memBoardConn is a board whose files live in a map.
type memBoardConn struct {
	remote.RemoteConn
	mu    sync.Mutex
	files map[string]string
}

func (c *memBoardConn) WriteFile(r io.Reader, p string) error {
	data, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.files[p] = string(data)
	return nil
}

func (c *memBoardConn) Stats(p string) (remote.FileInfo, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, ok := c.files[p]; !ok {
		return remote.FileInfo{}, os.ErrNotExist
	}
	return remote.FileInfo{Name: path.Base(p)}, nil
}

func (c *memBoardConn) ReadFile(p string) (io.ReadCloser, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	content, ok := c.files[p]
	if !ok {
		return nil, os.ErrNotExist
	}
	return io.NopCloser(strings.NewReader(content)), nil
}

func (c *memBoardConn) MkDirAll(string) error { return nil }

func memBoardApp(t *testing.T, files map[string]string) (*App, *memBoardConn) {
	t.Helper()
	conn := &memBoardConn{files: files}
	sb := board.Noop()
	sb.Conn = conn
	return &App{selectedBoard: sb, checkedOut: map[string]checkedApp{}, pendingSyncIssues: map[string]syncIssue{}, ghostMirrors: map[string]bool{}}, conn
}

// A turn end pushes what its chat touched and what no running chat touched; an app only another running chat touched is its own to push.
func TestTurnEndKeep(t *testing.T) {
	keep := turnEndKeep(map[string]bool{"mine": true, "both": true}, map[string]bool{"both": true, "theirs": true})
	for app, want := range map[string]bool{"mine": true, "both": true, "theirs": false, "nobody": true} {
		if got := keep(app); got != want {
			t.Errorf("keep(%s) = %v, want %v", app, got, want)
		}
	}
	if keep := turnEndKeep(nil, nil); !keep("any") {
		t.Error("with no other chat running, every app must be pushed")
	}
}

// The app left to the other chat is marked dirty: its next sync drops the mtime gate, so these edits are not skipped as old.
func TestATurnEndLeavesTheOtherChatsAppDirty(t *testing.T) {
	a, conn := memBoardApp(t, map[string]string{})
	since := time.Now().Add(-time.Minute)
	for _, name := range []string{"mine", "theirs"} {
		mirror := t.TempDir()
		if err := os.WriteFile(filepath.Join(mirror, "notes.txt"), []byte("edited "+name), 0o644); err != nil {
			t.Fatal(err)
		}
		a.checkedOut["user:"+name] = checkedApp{appPath: "/apps/" + name, mirror: mirror, baseline: time.Now().Add(-time.Hour), hashes: map[string]string{}, baselined: true}
	}

	failed, _, _, _ := a.syncCheckouts(since, false, turnEndKeep(map[string]bool{"user:mine": true}, map[string]bool{"user:theirs": true}))

	if len(failed) > 0 {
		t.Fatalf("sync failed: %v", failed)
	}
	if conn.files["/apps/mine/notes.txt"] != "edited mine" || len(conn.files) != 1 {
		t.Errorf("board = %v, want this chat's file alone", conn.files)
	}
	if !a.checkedOut["user:theirs"].dirty || a.checkedOut["user:mine"].dirty {
		t.Errorf("dirty: mine %v, theirs %v; want only the app left out", a.checkedOut["user:mine"].dirty, a.checkedOut["user:theirs"].dirty)
	}
}

// A copy a re-checkout parked is for the chat to re-apply until its turn ends: another chat's turn end must leave it.
func TestParkedCopiesStayUntilTheTurnThatGotThemEnds(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_DATA_HOME", filepath.Join(home, ".local", "share"))
	t.Setenv("LOCALAPPDATA", filepath.Join(home, "AppData", "Local"))
	appDir := filepath.Join(t.TempDir(), "demo")
	writeFiles(t, appDir, map[string]string{"main.py": "board rewrite"})
	mirror := t.TempDir()
	writeFiles(t, mirror, map[string]string{"main.py": "agent edit"})
	sum := sha256.Sum256([]byte("original"))
	sb := board.Noop()
	sb.Conn = &local.LocalConnection{}
	a := &App{selectedBoard: sb, pendingSyncIssues: map[string]syncIssue{}, ghostMirrors: map[string]bool{}, checkedOut: map[string]checkedApp{
		"user:demo": {appPath: filepath.ToSlash(appDir), mirror: mirror, baseline: time.Now().Add(-time.Hour), hashes: map[string]string{"main.py": hex.EncodeToString(sum[:])}, baselined: true},
	}}
	m := agent.NewManager(agent.New(agent.Config{}), agent.DefaultConnFactory, agent.ManagerConfig{})
	chatA, chatB := a.beginTurn("chat-a"), a.beginTurn("chat-b")
	if co, err := a.checkoutApp("user:demo"); err != nil || len(co.Parked) != 1 {
		t.Fatalf("chat B's re-checkout parked %v (err %v), want main.py", co.Parked, err)
	}
	parkedCopy := filepath.Join(mirror, "main.py"+appmirror.ParkedSuffix)

	a.syncTurnEnd(m, "chat-a", chatA)
	a.finishTurn(chatA, nil)
	if _, err := os.Stat(parkedCopy); err != nil {
		t.Fatalf("chat A's turn end removed the copy chat B still has to re-apply: %v", err)
	}
	a.syncTurnEnd(m, "chat-b", chatB)
	a.finishTurn(chatB, nil)
	if _, err := os.Stat(parkedCopy); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("chat B's turn end left its parked copy: stat err = %v", err)
	}
}

// A turn's edits count for the app whose checkout holds them; a folder no checkout tracks counts for none.
func TestAppsOfAndTheEarliestRunningTurn(t *testing.T) {
	a := &App{checkedOut: map[string]checkedApp{"user:blink": {mirror: "/mirror/b__user-blink-111111"}}}
	got := a.appsOf([]string{"user:named"}, []string{"/mirror/b__user-blink-111111/python/main.py", "/mirror/b__ghost-222222/x.py"})
	if len(got) != 2 || !got["user:named"] || !got["user:blink"] {
		t.Errorf("appsOf = %v, want the named app and the checkout holding the edit", got)
	}

	older, newer := a.beginTurn("s1"), a.beginTurn("s2")
	older.since = newer.since.Add(-time.Minute)
	if got := a.earliestTurnStart(); !got.Equal(older.since) {
		t.Errorf("earliest = %v, want the older running turn's start %v", got, older.since)
	}
	a.finishTurn(older, nil)
	if got := a.earliestTurnStart(); !got.Equal(newer.since) {
		t.Errorf("earliest = %v, want the one still running", got)
	}
}

// A one-time note goes back to the caller, for the chat it concerns, and is not kept as a pending warning anyone could take.
func TestAWithheldEditComesBackAsANote(t *testing.T) {
	const boardYAML = "name: Blink\n"
	a, _ := memBoardApp(t, map[string]string{"/apps/blink/app.yaml": boardYAML})
	mirror := t.TempDir()
	if err := os.WriteFile(filepath.Join(mirror, "app.yaml"), []byte("name: Renamed by hand\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256([]byte(boardYAML))
	a.checkedOut["user:blink"] = checkedApp{appPath: "/apps/blink", mirror: mirror, baseline: time.Now().Add(-time.Hour), hashes: map[string]string{"app.yaml": hex.EncodeToString(sum[:])}, baselined: true}

	_, _, _, notes := a.syncCheckouts(time.Time{}, true, nil)

	if len(notes["user:blink"]) != 1 || !strings.Contains(notes["user:blink"][0], "app.yaml") {
		t.Errorf("notes = %v, want the withheld app.yaml", notes)
	}
	if w := a.pendingSyncWarnings(); len(w) != 0 {
		t.Errorf("pending warnings = %v, want none: the note is not anyone's to take", w)
	}
	got := noteRecipients("user:blink", "self", map[string]map[string]bool{"self": {}, "other": {"user:blink": true}})
	if len(got) != 1 || got[0] != "other" {
		t.Errorf("recipients = %v, want the chat that touched the app", got)
	}
	if got := noteRecipients("user:blink", "self", map[string]map[string]bool{"self": {}}); len(got) != 1 || got[0] != "self" {
		t.Errorf("recipients = %v, want the chat that synced when none touched it", got)
	}
}
