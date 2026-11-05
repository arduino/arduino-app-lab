package fs

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"strings"
	"sync/atomic"
	"syscall"
	"testing"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

// statConn stubs out the one method StatPath uses; the embedded interface
// covers the rest of RemoteConn, which is never reached.
type statConn struct {
	remote.RemoteConn
	info remote.FileInfo
	err  error
}

func (c statConn) Stats(string) (remote.FileInfo, error) {
	return c.info, c.err
}

func TestStatPath(t *testing.T) {
	errUnreachable := errors.New("board unreachable")

	tests := []struct {
		name      string
		conn      statConn
		wantNil   bool
		wantIsDir bool
		wantErr   error
	}{
		{
			name: "file",
			conn: statConn{info: remote.FileInfo{Name: "app.yaml", IsDir: false}},
		},
		{
			name:      "directory",
			conn:      statConn{info: remote.FileInfo{Name: "sketch", IsDir: true}},
			wantIsDir: true,
		},
		{
			name:    "missing path resolves to nil, not an error",
			conn:    statConn{err: fs.ErrNotExist},
			wantNil: true,
		},
		{
			// The local backend wraps os.Stat's error rather than returning it bare.
			name:    "wrapped missing path is still recognised",
			conn:    statConn{err: fmt.Errorf("failed to get stats: %w", fs.ErrNotExist)},
			wantNil: true,
		},
		{
			// A path we cannot reach must not read as free, or a rename would
			// silently overwrite whatever is actually there.
			name:    "other errors propagate",
			conn:    statConn{err: errUnreachable},
			wantErr: errUnreachable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := StatPath(tt.conn, "/apps/my_app/target")

			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("Error mismatch\nGot: %v\nExpected: %v", err, tt.wantErr)
				}
				if got != nil {
					t.Errorf("Expected no node alongside an error, got %+v", got)
				}
				return
			}

			if err != nil {
				t.Fatalf("StatPath failed: %v", err)
			}

			if tt.wantNil {
				if got != nil {
					t.Errorf("Expected nil for a missing path, got %+v", got)
				}
				return
			}

			if got == nil {
				t.Fatal("Expected a node, got nil")
			}
			if got.IsDir != tt.wantIsDir {
				t.Errorf("IsDir mismatch\nGot: %v\nExpected: %v", got.IsDir, tt.wantIsDir)
			}
			if got.Path != "/apps/my_app/target" {
				t.Errorf("Path mismatch\nGot: %s\nExpected: /apps/my_app/target", got.Path)
			}
		})
	}
}

// flakyStatConn refuses Stats a fixed number of times before answering.
type flakyStatConn struct {
	remote.RemoteConn
	failures int32
	calls    atomic.Int32
}

func (c *flakyStatConn) Stats(string) (remote.FileInfo, error) {
	if c.calls.Add(1) <= c.failures {
		return remote.FileInfo{}, errors.New("ssh: rejected: connect failed (open failed)")
	}
	return remote.FileInfo{Name: "target", IsDir: true}, nil
}

// A stat competes with the listings for the board's sessions, so a refused one
// is retried rather than reported as "nothing is there".
func TestStatPathRetriesARefusedSession(t *testing.T) {
	conn := &flakyStatConn{failures: 1}

	got, err := StatPath(conn, "/apps/my_app/target")
	if err != nil {
		t.Fatalf("a stat that is refused once should be retried, got %v", err)
	}
	if got == nil || !got.IsDir {
		t.Fatalf("want the directory node, got %+v", got)
	}
	if conn.calls.Load() != 2 {
		t.Errorf("want 2 calls (one refusal, one success), got %d", conn.calls.Load())
	}
}

// readConn serves one board file; closeErr is what the transport reports when the read ends.
type readConn struct {
	remote.RemoteConn
	info     remote.FileInfo
	statErr  error
	content  string
	closeErr error
}

func (c readConn) Stats(string) (remote.FileInfo, error) { return c.info, c.statErr }

func (c readConn) ReadFile(string) (io.ReadCloser, error) {
	return remote.WithCloser{Reader: strings.NewReader(c.content), CloseFun: func() error { return c.closeErr }}, nil
}

// The mirror must tell a missing file from an unreadable one, and a folder must never reach remotefs, whose Read panics.
func TestReadBoardFile(t *testing.T) {
	exit1 := errors.New("exit status 1")
	for _, c := range []struct {
		name    string
		conn    readConn
		want    string
		wantErr error
	}{
		{"a file", readConn{content: "x"}, "x", nil},
		{"a file over SSH, whose close reports EOF", readConn{content: "x", closeErr: io.EOF}, "x", nil},
		{"a file cat could not read", readConn{closeErr: exit1}, "", exit1},
		{"a missing file", readConn{statErr: fs.ErrNotExist}, "", fs.ErrNotExist},
		{"a folder, or a link to one", readConn{info: remote.FileInfo{IsDir: true}}, "", syscall.EISDIR},
	} {
		if got, err := ReadBoardFile(c.conn, "/apps/demo/f"); got != c.want || !errors.Is(err, c.wantErr) {
			t.Errorf("%s: got %q, %v; want %q, %v", c.name, got, err, c.want, c.wantErr)
		}
	}
}

// The editor opens what the file tree lists, and the tree lists a link to a folder as a file: opening it panicked.
func TestGetFileContentRefusesAFolder(t *testing.T) {
	if _, err := GetFileContent("/apps/demo/lnk", readConn{info: remote.FileInfo{IsDir: true}}, nil); !errors.Is(err, syscall.EISDIR) {
		t.Errorf("err = %v, want EISDIR", err)
	}
	if got, err := GetFileContent("/apps/demo/README.md", readConn{content: "# Demo"}, nil); err != nil || got != "# Demo" {
		t.Errorf("got %q, %v; want the file's text", got, err)
	}
}

// copyConn is a board with one folder of files; it counts the readers left open.
type copyConn struct {
	remote.RemoteConn
	files      map[string]string
	open, peak int
	written    map[string]string
}

func (c *copyConn) List(p string) ([]remote.FileInfo, error) {
	if p != "/apps/old" {
		return nil, nil // a file: listing it gives nothing
	}
	var out []remote.FileInfo
	for name := range c.files {
		out = append(out, remote.FileInfo{Name: name})
	}
	return out, nil
}
func (c *copyConn) Stats(string) (remote.FileInfo, error) { return remote.FileInfo{}, nil }
func (c *copyConn) MkDirAll(string) error                 { return nil }
func (c *copyConn) ReadFile(p string) (io.ReadCloser, error) {
	c.open++
	c.peak = max(c.peak, c.open)
	return countedReader{Reader: strings.NewReader(c.files[strings.TrimPrefix(p, "/apps/old/")]), conn: c}, nil
}
func (c *copyConn) WriteFile(r io.Reader, p string) error {
	data, err := io.ReadAll(r)
	c.written[p] = string(data)
	return err
}

type countedReader struct {
	io.Reader
	conn *copyConn
}

func (r countedReader) Close() error {
	r.conn.open--
	return nil
}

// Each file's reader is closed once it is copied: one left open until the end held an adb or ssh process per file.
func TestCopyingAFolderClosesEachFileAsItGoes(t *testing.T) {
	conn := &copyConn{files: map[string]string{"a.py": "a", "b.py": "b", "c.py": "c"}, written: map[string]string{}}
	if err := copyDirectory(conn, "/apps/old", "/apps/new"); err != nil {
		t.Fatal(err)
	}
	if conn.peak != 1 || conn.open != 0 {
		t.Errorf("readers open at most %d at once and %d at the end, want 1 and 0", conn.peak, conn.open)
	}
	if len(conn.written) != 3 || conn.written["/apps/new/b.py"] != "b" {
		t.Errorf("written = %v, want the three files", conn.written)
	}
}
