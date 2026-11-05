package lsp

import (
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"testing"

	"app-lab-desktop/internal/board"
)

// FileURIToLocalPath is the only place a "file://" URI becomes a path, so the
// leniency it promises is pinned here: "#", "?" and "%" are legal in file names
// and an RFC 3986 parser would reject or truncate them.
func TestFileURIToLocalPath(t *testing.T) {
	tests := []struct {
		name    string
		uri     string
		want    string
		wantErr bool
	}{
		{name: "posix", uri: "file:///home/me/ws/a.py", want: "/home/me/ws/a.py"},
		{name: "percent escapes decoded", uri: "file:///home/me/ws/my%20file.py", want: "/home/me/ws/my file.py"},
		{name: "literal percent kept", uri: "file:///home/me/ws/100%.txt", want: "/home/me/ws/100%.txt"},
		{name: "encoded percent decoded", uri: "file:///home/me/ws/50%25off.txt", want: "/home/me/ws/50%off.txt"},
		{name: "hash is part of the name, not a fragment", uri: "file:///home/me/ws/a#b.txt", want: "/home/me/ws/a#b.txt"},
		{name: "question mark is part of the name, not a query", uri: "file:///home/me/ws/a?b.txt", want: "/home/me/ws/a?b.txt"},
		// Leniency makes the mapping non-injective for raw specials: the encoded
		// and literal spellings both name the file "a#b.txt", which is correct.
		{name: "encoded hash decoded", uri: "file:///home/me/ws/a%23b.txt", want: "/home/me/ws/a#b.txt"},
		{name: "rejects non-file scheme", uri: "untitled:Untitled-1", wantErr: true},
		{name: "rejects bare path", uri: "/home/me/ws/a.py", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := FileURIToLocalPath(tt.uri)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("FileURIToLocalPath(%q) = %q, want error", tt.uri, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("FileURIToLocalPath(%q) returned error: %v", tt.uri, err)
			}
			want := tt.want
			if runtime.GOOS == "windows" {
				want = filepath.FromSlash(want)
			}
			if got != want {
				t.Errorf("FileURIToLocalPath(%q) = %q, want %q", tt.uri, got, want)
			}
		})
	}
}

// "%23" decodes to a literal "#", which is a different file from the one named
// by a raw "#". Keeping them distinct is the reason the unescape is not skipped
// wholesale when it succeeds.
func TestFileURIToLocalPathDistinguishesEncodedFromLiteral(t *testing.T) {
	encoded, err := FileURIToLocalPath("file:///ws/a%2523b.txt")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if want := filepath.FromSlash("/ws/a%23b.txt"); encoded != want {
		t.Errorf("got %q, want %q", encoded, want)
	}
}

// The frontend's toFileUri is the only producer of the URIs this consumes, so
// the two shapes it emits on Windows have to survive the round trip. The UNC
// case is the one with no natural coverage: it is unreachable on the CI host,
// and an earlier authority-form change silently turned "\\server\share" into
// the relative path "server\share".
func TestFileURIToLocalPathWindows(t *testing.T) {
	tests := []struct {
		name string
		uri  string
		want string
	}{
		{name: "drive letter", uri: "file:///C:/Users/Me/ws/a.py", want: `C:\Users\Me\ws\a.py`},
		{name: "encoded drive colon", uri: "file:///C%3A/Users/Me/a.py", want: `C:\Users\Me\a.py`},
		{name: "UNC share", uri: "file://fileserver/team/ws/a.py", want: `\\fileserver\team\ws\a.py`},
		{name: "UNC share root", uri: "file://fileserver/team", want: `\\fileserver\team`},
		{name: "localhost is not a host", uri: "file://localhost/C:/ws/a.py", want: `C:\ws\a.py`},
		{name: "escapes decoded", uri: "file:///C:/ws/my%20file.py", want: `C:\ws\my file.py`},
		{name: "hash kept", uri: "file:///C:/ws/a#b.py", want: `C:\ws\a#b.py`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := fileURIToLocalPath(tt.uri, true)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Errorf("fileURIToLocalPath(%q, windows) = %q, want %q", tt.uri, got, tt.want)
			}
		})
	}
}

func TestFileURIToLocalPathRejectsRemoteHostOnPosix(t *testing.T) {
	if _, err := fileURIToLocalPath("file://fileserver/team/ws/a.py", false); err == nil {
		t.Error("expected an error resolving a UNC share on a non-Windows host")
	}
	// "localhost" is not a remote host, so it still resolves.
	got, err := fileURIToLocalPath("file://localhost/home/me/a.py", false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "/home/me/a.py" {
		t.Errorf("got %q, want %q", got, "/home/me/a.py")
	}
}

func TestIsURIWithinDir(t *testing.T) {
	base := filepath.FromSlash("/home/me/ws")

	tests := []struct {
		name string
		uri  string
		want bool
	}{
		{name: "descendant", uri: "file:///home/me/ws/src/a.py", want: true},
		{name: "the dir itself", uri: "file:///home/me/ws", want: true},
		{name: "encoded descendant", uri: "file:///home/me/ws/my%20file.py", want: true},
		{name: "sibling sharing the prefix", uri: "file:///home/me/ws-extra/a.py", want: false},
		{name: "outside", uri: "file:///usr/lib/python3/foo.py", want: false},
		{name: "traversal out of the dir", uri: "file:///home/me/ws/../other/a.py", want: false},
		{name: "not a uri", uri: "/home/me/ws/a.py", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsURIWithinDir(tt.uri, base); got != tt.want {
				t.Errorf("IsURIWithinDir(%q, %q) = %v, want %v", tt.uri, base, got, tt.want)
			}
		})
	}
}

// The Windows shortened-path migration moves user data — installed cores and
// toolchains — so its behaviour is pinned here rather than left to a manual
// check on one machine. migrateWorkspaceBase takes both paths so this runs on
// any host.
func TestMigrateWorkspaceBase(t *testing.T) {
	// A migration must carry the installed toolchain across and leave no stale
	// absolute paths behind in arduino-cli.yaml.
	t.Run("moves an existing install and drops the stale config", func(t *testing.T) {
		root := t.TempDir()
		oldBase := filepath.Join(root, workspaceBaseDirName)
		newBase := filepath.Join(root, windowsWorkspaceBaseDirName)

		core := filepath.Join(oldBase, arduinoDirName, "data", "packages", "zephyr", "core.txt")
		if err := os.MkdirAll(filepath.Dir(core), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(core, []byte("installed"), 0644); err != nil {
			t.Fatal(err)
		}
		cfg := filepath.Join(oldBase, arduinoDirName, "arduino-cli.yaml")
		if err := os.WriteFile(cfg, []byte("directories:\n  data: "+filepath.Dir(core)+"\n"), 0644); err != nil {
			t.Fatal(err)
		}

		migrateWorkspaceBase(oldBase, newBase)

		moved := filepath.Join(newBase, windowsArduinoDirName, "data", "packages", "zephyr", "core.txt")
		if content, err := os.ReadFile(moved); err != nil {
			t.Errorf("installed core did not survive the migration: %v", err)
		} else if string(content) != "installed" {
			t.Errorf("core content = %q, want %q", content, "installed")
		}
		if _, err := os.Stat(oldBase); !os.IsNotExist(err) {
			t.Errorf("old base still present after migration: %v", err)
		}
		// Left in place it would point directories.data at the pre-move location.
		stale := filepath.Join(newBase, windowsArduinoDirName, "arduino-cli.yaml")
		if _, err := os.Stat(stale); !os.IsNotExist(err) {
			t.Errorf("stale arduino-cli.yaml was not removed: %v", err)
		}
	})

	// Running twice must not clobber a migrated install with a later one.
	t.Run("leaves an already-migrated install alone", func(t *testing.T) {
		root := t.TempDir()
		oldBase := filepath.Join(root, workspaceBaseDirName)
		newBase := filepath.Join(root, windowsWorkspaceBaseDirName)
		for _, d := range []string{oldBase, newBase} {
			if err := os.MkdirAll(d, 0755); err != nil {
				t.Fatal(err)
			}
		}
		keep := filepath.Join(newBase, "marker")
		if err := os.WriteFile(keep, []byte("current"), 0644); err != nil {
			t.Fatal(err)
		}

		migrateWorkspaceBase(oldBase, newBase)

		if content, err := os.ReadFile(keep); err != nil || string(content) != "current" {
			t.Errorf("migrated install was disturbed: content=%q err=%v", content, err)
		}
		if _, err := os.Stat(oldBase); err != nil {
			t.Errorf("old base should be left untouched for manual cleanup: %v", err)
		}
	})

	t.Run("no-ops on a fresh install", func(t *testing.T) {
		root := t.TempDir()
		newBase := filepath.Join(root, windowsWorkspaceBaseDirName)
		migrateWorkspaceBase(filepath.Join(root, workspaceBaseDirName), newBase)
		if _, err := os.Stat(newBase); !os.IsNotExist(err) {
			t.Errorf("migration created the base for a fresh install: %v", err)
		}
	})

	// macOS/Linux pass the same value for both, which must be inert.
	t.Run("no-ops when the names match", func(t *testing.T) {
		root := t.TempDir()
		base := filepath.Join(root, workspaceBaseDirName)
		marker := filepath.Join(base, "marker")
		if err := os.MkdirAll(base, 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(marker, []byte("kept"), 0644); err != nil {
			t.Fatal(err)
		}
		migrateWorkspaceBase(base, base)
		if content, err := os.ReadFile(marker); err != nil || string(content) != "kept" {
			t.Errorf("same-path call was not inert: content=%q err=%v", content, err)
		}
	})
}

func TestIsAllowedLspFilePathAllowsTheWorkspaceRoots(t *testing.T) {
	for _, root := range []string{getTempWorkspaceBase(), getPersistentWorkspaceBase()} {
		path := filepath.Join(root, "app", "main.py")
		if !IsAllowedLspFilePath(path) {
			t.Errorf("expected %s to be allowed", path)
		}
	}
}

// The board apps dir is a real local path on a developer machine, so off-board
// it must not be treated as ours.
func TestIsAllowedLspFilePathRejectsTheBoardAppsDirOffBoard(t *testing.T) {
	if board.IsSBC() {
		t.Skip("running on the board, where the apps dir is legitimately local")
	}

	path := filepath.Join(boardAppsRootDir, "my-app", "main.py")
	if IsAllowedLspFilePath(path) {
		t.Errorf("expected %s to be rejected off-board", path)
	}
}

func makeSketchDir(t *testing.T, files ...string) string {
	t.Helper()
	dir, err := os.MkdirTemp(getTempWorkspaceBase(), "list-test-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(dir) })
	for _, rel := range files {
		p := filepath.Join(dir, filepath.FromSlash(rel))
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func listSorted(t *testing.T, dir string) []string {
	t.Helper()
	got, err := ListLspSketchFiles(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	slices.Sort(got)
	return got
}

// The listing must match what arduino-cli copies into the build folder: a
// listed file with no build copy makes the Arduino LS rebuild when opened.
func TestListLspSketchFilesFollowsArduinoCliRules(t *testing.T) {
	dir := makeSketchDir(t,
		"sketch.ino",
		"second.ino",
		"matrix_display.h",
		"src/weather_bridge.cpp",
		"extras/old.h",
		"notes.txt",
		".hidden.h",
		".cache/generated.h",
		"examples/demo/demo.ino",
		"build/sketch/sketch.ino.cpp",
		"export/build.options.json",
		"export/sketch.ino.cpp",
	)

	want := []string{"extras/old.h", "matrix_display.h", "second.ino", "sketch.ino", "src/weather_bridge.cpp"}
	if got := listSorted(t, dir); !slices.Equal(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

// One subfolder that cannot be read must not hide the rest of the sketch.
func TestListLspSketchFilesSkipsUnreadableSubfolder(t *testing.T) {
	if runtime.GOOS == "windows" || os.Geteuid() == 0 {
		t.Skip("permission bits do not stop this user from reading the folder")
	}
	dir := makeSketchDir(t, "sketch.ino", "locked/inner.h")
	locked := filepath.Join(dir, "locked")
	if err := os.Chmod(locked, 0o000); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(locked, 0o755) })

	if got, want := listSorted(t, dir), []string{"sketch.ino"}; !slices.Equal(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

// An app with no sketch has no sketch dir in the mirror; that must read as
// empty, not fail the caller.
func TestListLspSketchFilesMissingDir(t *testing.T) {
	if got := listSorted(t, filepath.Join(getTempWorkspaceBase(), "does-not-exist")); len(got) != 0 {
		t.Errorf("got %v, want no files", got)
	}
}

func TestListLspSketchFilesRejectsOutsideRoots(t *testing.T) {
	if _, err := ListLspSketchFiles(t.TempDir()); err == nil {
		t.Error("expected a directory outside the workspace roots to be rejected")
	}
}

func TestIsAllowedLspFilePathRejectsUnrelatedPaths(t *testing.T) {
	for _, path := range []string{
		"/etc/passwd",
		filepath.Join(getTempWorkspaceBase(), "..", "elsewhere", "secret"),
	} {
		if IsAllowedLspFilePath(path) {
			t.Errorf("expected %s to be rejected", path)
		}
	}
}

// A folder that appears in one step is announced file by file, and must follow
// the same sketch rules as the startup listing.
func TestListLspFilesAppliesSketchRulesInsideSketch(t *testing.T) {
	dir := makeSketchDir(t,
		"sketch/sketch.ino",
		"sketch/src/helper.h",
		"sketch/src/nested.ino",
		"sketch/build/sketch/sketch.ino.cpp",
		"python/pkg/mod.py",
		"python/pkg/.cache/x.py",
		"python/pkg/notes.txt",
	)

	cases := map[string][]string{
		"":           {"python/pkg/mod.py", "sketch/sketch.ino", "sketch/src/helper.h"},
		"sketch":     {"sketch/sketch.ino", "sketch/src/helper.h"},
		"python/pkg": {"python/pkg/mod.py"},
	}
	for relDir, want := range cases {
		got, err := ListLspFiles(dir, relDir)
		if err != nil {
			t.Fatalf("%q: unexpected error: %v", relDir, err)
		}
		slices.Sort(got)
		if !slices.Equal(got, want) {
			t.Errorf("%q: got %v, want %v", relDir, got, want)
		}
	}
}

func TestListLspFilesHasNoFilesForAFileOrAMissingPath(t *testing.T) {
	dir := makeSketchDir(t, "python/main.py")
	for _, relDir := range []string{"python/main.py", "python/gone"} {
		got, err := ListLspFiles(dir, relDir)
		if err != nil || len(got) != 0 {
			t.Errorf("%q: got %v, %v; want no files", relDir, got, err)
		}
	}
}

func TestListLspFilesRejectsPathsOutsideTheWorkspace(t *testing.T) {
	dir := makeSketchDir(t, "python/main.py")
	if _, err := ListLspFiles(dir, "../.."); err == nil {
		t.Error("expected a relDir escaping the workspace to be rejected")
	}
	if _, err := ListLspFiles(t.TempDir(), ""); err == nil {
		t.Error("expected a workspace outside the roots to be rejected")
	}
}

func makeAppCopy(t *testing.T, files ...string) string {
	t.Helper()
	appDir := t.TempDir()
	for _, rel := range files {
		p := filepath.Join(appDir, filepath.FromSlash(rel))
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return appDir
}

func exists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}

// Removal is a RemoveAll, so the path mapping must never resolve to the app
// copy itself or anything outside it.
func TestRemoveWorkspacePathRemovesOnlyInsideTheAppCopy(t *testing.T) {
	app := boardAppsRootDir + "/myapp"
	for _, p := range []string{
		app,
		app + "/",
		app + "/.",
		app + "/python/..",
		app + "/../other",
		boardAppsRootDir,
		"/var/lib/arduino-app-cli/examples/blink/python",
	} {
		appDir := makeAppCopy(t, "python/main.py")
		removeWorkspacePathIn(appDir, p)
		if !exists(filepath.Join(appDir, "python", "main.py")) {
			t.Errorf("%s: removed files of the app copy", p)
		}
	}

	appDir := makeAppCopy(t, "python/pkg/mod.py", "python/main.py")
	removeWorkspacePathIn(appDir, app+"/python/pkg")
	if exists(filepath.Join(appDir, "python", "pkg")) {
		t.Error("want the folder removed")
	}
	if !exists(filepath.Join(appDir, "python", "main.py")) {
		t.Error("want its sibling kept")
	}
}

func TestRenameWorkspacePathMovesAFolderIntoAMissingParent(t *testing.T) {
	app := boardAppsRootDir + "/myapp"
	appDir := makeAppCopy(t, "python/pkg/mod.py")

	renameWorkspacePathIn(appDir, app+"/python/pkg", app+"/python/lib/pkg")

	if !exists(filepath.Join(appDir, "python", "lib", "pkg", "mod.py")) {
		t.Error("want the folder at its new path")
	}
	if exists(filepath.Join(appDir, "python", "pkg")) {
		t.Error("want the old path gone")
	}

	// Neither end may be the app copy itself.
	renameWorkspacePathIn(appDir, app, app+"/moved")
	if exists(filepath.Join(appDir, "moved")) {
		t.Error("want the app copy itself never moved")
	}
}

// Every app maps to the same temp workspace folder, so only the copied app's
// paths may reach it.
func TestInWorkspaceAppAcceptsOnlyTheCopiedApp(t *testing.T) {
	workspaceMu.Lock()
	prev := workspaceAppPath
	workspaceAppPath = boardAppsRootDir + "/app-a"
	defer func() { workspaceAppPath = prev; workspaceMu.Unlock() }()

	for p, want := range map[string]bool{
		boardAppsRootDir + "/app-a/python/main.py":               true,
		boardAppsRootDir + "/app-a/sketch/":                      true,
		boardAppsRootDir + "/app-b/python/main.py":               false,
		boardAppsRootDir + "/app-ab/python/main.py":              false,
		boardAppsRootDir + "/app-a/../app-b/python/main.py":      false,
		boardAppsRootDir + "/app-a":                              false,
		"/var/lib/arduino-app-cli/examples/blink/python/main.py": false,
	} {
		if got := inWorkspaceApp(p); got != want {
			t.Errorf("inWorkspaceApp(%q) = %v, want %v", p, got, want)
		}
	}

	workspaceAppPath = ""
	if inWorkspaceApp(boardAppsRootDir + "/app-a/python/main.py") {
		t.Error("want nothing accepted before any app is copied")
	}
}
