package fs

import (
	"errors"
	"os"
	"path"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

func TestWalkFilePaths(t *testing.T) {
	got, err := WalkFilePaths(os.DirFS("./testdata/my_app"), []string{"fileToIgnore.txt"})
	if err != nil {
		t.Fatalf("WalkFilePaths failed: %v", err)
	}

	// Directories first, then alphabetical — and only files come back, each
	// relative to the root with no leading "./".
	want := []string{
		"python/main.py",
		"python/requirements.txt",
		"sketch/sketch.ino",
		"app.yaml",
	}
	if !slices.Equal(got, want) {
		t.Errorf("WalkFilePaths\n got: %v\nwant: %v", got, want)
	}
}

func TestWalkFilePathsSkipsUnreadableRoot(t *testing.T) {
	if _, err := WalkFilePaths(os.DirFS("./testdata/does_not_exist"), nil); err == nil {
		t.Error("expected an error for a root that cannot be opened, got nil")
	}
}

// A directory that stays unreadable used to be skipped, so a short walk was
// indistinguishable from a complete one — and this list is what tells the agent
// which files exist on the board. The folder is named in the error instead, and
// a working sibling is untouched.
func TestWalkFilePathsReportsAnUnreadableDirInsteadOfSkippingIt(t *testing.T) {
	got, err := WalkFilePaths(newFailingFS("python", -1), []string{"fileToIgnore.txt"})

	var partial *UnreadableDirsError
	if !errors.As(err, &partial) {
		t.Fatalf("want *UnreadableDirsError, got %v", err)
	}
	if len(partial.Paths) != 1 || partial.Paths[0] != "python" {
		t.Errorf("want paths [python], got %v", partial.Paths)
	}

	want := []string{"sketch/sketch.ino", "app.yaml"}
	if !slices.Equal(got, want) {
		t.Errorf("the readable files should still come back\n got: %v\nwant: %v", got, want)
	}
}

// One refused session, retried by listDirEntries, and the walk is whole with no
// error at all.
func TestWalkFilePathsRetriesATransientFailure(t *testing.T) {
	got, err := WalkFilePaths(newFailingFS("python", 1), []string{"fileToIgnore.txt"})
	if err != nil {
		t.Fatalf("a listing that fails once should be retried, got %v", err)
	}

	want := []string{"python/main.py", "python/requirements.txt", "sketch/sketch.ino", "app.yaml"}
	if !slices.Equal(got, want) {
		t.Errorf("WalkFilePaths\n got: %v\nwant: %v", got, want)
	}
}

// A root that cannot be listed is a different thing entirely: there is nothing
// to salvage, and the UI reads that error as the app being gone.
func TestWalkFilePathsRootFailureIsAPlainError(t *testing.T) {
	got, err := WalkFilePaths(newFailingFS(".", -1), []string{"fileToIgnore.txt"})

	if got != nil {
		t.Errorf("want no paths when the root cannot be listed, got %v", got)
	}
	var partial *UnreadableDirsError
	if err == nil || errors.As(err, &partial) {
		t.Errorf("want a plain error for a failed root, got %v", err)
	}
}

// dirConn serves one canned directory listing. The embedded interface covers
// the rest of RemoteConn, which ListDirectory never reaches.
type dirConn struct {
	remote.RemoteConn
	isDir   bool
	entries []remote.FileInfo
}

func (c dirConn) Stats(string) (remote.FileInfo, error) {
	return remote.FileInfo{Name: "my_app", IsDir: c.isDir}, nil
}

func (c dirConn) List(string) ([]remote.FileInfo, error) {
	return c.entries, nil
}

func TestListDirectory(t *testing.T) {
	conn := dirConn{
		isDir: true,
		entries: []remote.FileInfo{
			{Name: "app.yaml"},
			{Name: "sketch", IsDir: true},
			{Name: ".DS_Store"},
			{Name: "python", IsDir: true},
			{Name: "README.md"},
		},
	}

	got, err := ListDirectory("/apps/my_app", conn)
	if err != nil {
		t.Fatalf("ListDirectory failed: %v", err)
	}

	// Directories first, then files, each alphabetically. .DS_Store is ignored.
	wantNames := []string{"python", "sketch", "README.md", "app.yaml"}
	if len(got) != len(wantNames) {
		t.Fatalf("Entry count mismatch\nGot: %d (%+v)\nExpected: %d (%v)", len(got), got, len(wantNames), wantNames)
	}

	for i, want := range wantNames {
		if got[i].Name != want {
			t.Errorf("Name mismatch at %d\nGot: %s\nExpected: %s", i, got[i].Name, want)
		}
		// A node carries the full board path, the same shape StatPath returns.
		if wantPath := "/apps/my_app/" + want; got[i].Path != wantPath {
			t.Errorf("Path mismatch at %d\nGot: %s\nExpected: %s", i, got[i].Path, wantPath)
		}
		if got[i].Children != nil {
			t.Errorf("ListDirectory must not descend, but %s has children", got[i].Name)
		}
	}

	if !got[0].IsDir || !got[1].IsDir {
		t.Errorf("Expected python and sketch to be directories: %+v", got[:2])
	}
	if got[3].IsDir {
		t.Errorf("Expected app.yaml to be a file: %+v", got[3])
	}
	if got[3].Extension == nil || *got[3].Extension != ".yaml" {
		t.Errorf("Extension mismatch on app.yaml: %v", got[3].Extension)
	}
	if got[0].Extension != nil {
		t.Errorf("Directories carry no extension, got %v", *got[0].Extension)
	}
}

// The path is no longer stat-ed before listing: that cost a round trip on every
// folder expansion to reject a path the callers cannot produce (the tree only
// lists nodes it already knows are folders). A path that genuinely cannot be
// listed still fails, which is what the UI reacts to.
type failingConn struct {
	remote.RemoteConn
	calls atomic.Int32
}

func (c *failingConn) List(string) ([]remote.FileInfo, error) {
	c.calls.Add(1)
	return nil, errors.New("ls: cannot access: No such file or directory: Process exited with status 2")
}

// A directory that is genuinely not there is one round trip: the command ran and
// answered, so the retry — which exists for a refused session — must not turn
// that answer into three ls runs and two backoffs.
func TestListDirectoryPropagatesListErrorWithoutRetrying(t *testing.T) {
	conn := &failingConn{}

	if _, err := ListDirectory("/apps/my_app/nope", conn); err == nil {
		t.Error("Expected the listing error to propagate, got nil")
	}
	if got := conn.calls.Load(); got != 1 {
		t.Errorf("want a single listing attempt, got %d", got)
	}
}

// lsConn emulates what every real connection does — `ls -laQ <path>` through
// remote.ParseLsOutput — so the trailing slash is checked against the parser
// that ships rather than a stub's idea of one.
type lsConn struct {
	remote.RemoteConn
	dir  string
	file string
}

func (c lsConn) List(p string) ([]remote.FileInfo, error) {
	// ls of a non-directory ending in "/" stops at ENOTDIR; without the slash it
	// prints the file itself, and that line has no "total" header in front of it
	// for ParseLsOutput to drop.
	notADirectory := errors.New("Process exited with status 2")
	switch strings.TrimSuffix(p, "/") {
	case c.dir:
		return remote.ParseLsOutput(strings.NewReader("total 12\n" +
			`drwxr-xr-x 2 arduino arduino 4096 Sep  1 10:00 "."` + "\n" +
			`drwxr-xr-x 4 arduino arduino 4096 Sep  1 10:00 ".."` + "\n" +
			`-rw-r--r-- 1 arduino arduino   42 Sep  1 10:00 "app.yaml"` + "\n"))
	case c.file:
		if strings.HasSuffix(p, "/") {
			return nil, notADirectory
		}
		return remote.ParseLsOutput(strings.NewReader(
			`-rw-r--r-- 1 arduino arduino 42 Sep  1 10:00 "main.py"` + "\n"))
	}
	return nil, notADirectory
}

// Listing a file used to come back as an empty directory, because the only line
// ls printed was the one the parser drops.
func TestListDirectoryFailsOnAFilePath(t *testing.T) {
	conn := lsConn{dir: "/apps/my_app", file: "/apps/my_app/main.py"}

	got, err := ListDirectory("/apps/my_app/main.py", conn)
	if err == nil {
		t.Errorf("want an error for a path that is a file, got %v", got)
	}

	// And a real directory still lists, so the slash costs the normal case nothing.
	got, err = ListDirectory("/apps/my_app", conn)
	if err != nil {
		t.Fatalf("ListDirectory failed: %v", err)
	}
	if len(got) != 1 || got[0].Path != "/apps/my_app/app.yaml" {
		t.Errorf("want [/apps/my_app/app.yaml], got %+v", got)
	}
}

// flakyConn refuses List a fixed number of times before answering, standing in
// for a board out of SSH sessions.
type flakyConn struct {
	remote.RemoteConn
	failures int32
	calls    atomic.Int32
}

func (c *flakyConn) List(string) ([]remote.FileInfo, error) {
	if c.calls.Add(1) <= c.failures {
		return nil, errors.New("ssh: rejected: connect failed (open failed)")
	}
	return []remote.FileInfo{{Name: "sketch", IsDir: true}}, nil
}

// Expanding a folder is one round trip, and a refused one is transient: it is
// retried rather than surfacing as a failed expansion. The React Query side runs
// with retry: false, so this is the only retry on that path.
func TestListDirectoryRetriesATransientFailure(t *testing.T) {
	conn := &flakyConn{failures: 1}

	got, err := ListDirectory("/apps/my_app", conn)
	if err != nil {
		t.Fatalf("a listing that fails once should be retried, got %v", err)
	}
	if len(got) != 1 || got[0].Name != "sketch" {
		t.Errorf("want [sketch], got %+v", got)
	}
	if conn.calls.Load() != 2 {
		t.Errorf("want 2 calls (one failure, one success), got %d", conn.calls.Load())
	}
}

// countingConn records how many listings the connection is serving at once.
type countingConn struct {
	remote.RemoteConn
	inFlight atomic.Int32
	peak     atomic.Int32
}

func (c *countingConn) List(string) ([]remote.FileInfo, error) {
	n := c.inFlight.Add(1)
	for {
		peak := c.peak.Load()
		if n <= peak || c.peak.CompareAndSwap(peak, n) {
			break
		}
	}
	time.Sleep(5 * time.Millisecond)
	c.inFlight.Add(-1)
	return []remote.FileInfo{{Name: "app.yaml"}}, nil
}

// The limiter is shared by the whole package, so the frontend needs no cap of
// its own: invalidating every expanded directory at once still meets one budget
// here, whatever number of queries React Query starts.
func TestListDirectoryBoundsConcurrentListings(t *testing.T) {
	conn := &countingConn{}

	var wg sync.WaitGroup
	for range 16 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := ListDirectory("/apps/my_app", conn); err != nil {
				t.Errorf("listing failed: %v", err)
			}
		}()
	}
	wg.Wait()

	if got := conn.peak.Load(); got > maxConcurrentBoardReads {
		t.Errorf("want at most %d listings in flight, saw %d", maxConcurrentBoardReads, got)
	}
}

// treeConn serves a folder tree by path; its Stats answers as file -L does, which calls a folder named like "v1:2" a file.
type treeConn struct {
	remote.RemoteConn
	dirs map[string][]remote.FileInfo
}

func (c treeConn) List(p string) ([]remote.FileInfo, error) {
	entries, ok := c.dirs[strings.TrimSuffix(p, "/")]
	if !ok {
		return nil, errors.New("ls: cannot access: No such file or directory")
	}
	return entries, nil
}

func (c treeConn) Stats(p string) (remote.FileInfo, error) {
	_, isDir := c.dirs[p]
	return remote.FileInfo{Name: path.Base(p), IsDir: isDir && !strings.Contains(path.Base(p), ":")}, nil
}

// A checkout holds every file the listings show: trusting file -L, the files of a folder named like "v1:2" dropped out of it.
func TestListFilePathsTrustsTheListings(t *testing.T) {
	conn := treeConn{dirs: map[string][]remote.FileInfo{
		"/apps/demo":             {{Name: "python", IsDir: true}},
		"/apps/demo/python":      {{Name: "v1:2", IsDir: true}, {Name: "main.py"}},
		"/apps/demo/python/v1:2": {{Name: "three.py"}},
	}}

	got, err := ListFilePaths("/apps/demo", conn)

	if want := []string{"python/v1:2/three.py", "python/main.py"}; err != nil || !slices.Equal(got, want) {
		t.Errorf("ListFilePaths = %v, %v; want %v", got, err, want)
	}
}
