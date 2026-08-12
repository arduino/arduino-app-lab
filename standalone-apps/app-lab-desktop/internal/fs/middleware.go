package fs

import (
	"app-lab-desktop/internal/board"
	"app-lab-desktop/internal/context"
	"errors"
	"io"
	"io/fs"
	"os"
	"reflect"
	"time"

	"net/http"
	"path"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type fileContentAssetMiddleware struct {
	ctxHolder     *context.Holder
	selectedBoard *board.Board
}

var _ http.Handler = (*fileContentAssetMiddleware)(nil)

const pathPrefix = "/file-content-assets/"
const sshTimeout = 100 * time.Millisecond

func (m *fileContentAssetMiddleware) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := m.ctxHolder.Get()
	p := strings.TrimPrefix(r.URL.Path, pathPrefix)
	dir, file := splitAssetPath(p)
	runtime.LogInfof(ctx, "Serving asset %s", file)
	f, err := m.getAsset(dir, file)

	if err != nil {
		if errors.Is(err, fs.ErrInvalid) {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		runtime.LogErrorf(ctx, "failed to open app asset %s: %v", p, err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	defer f.Close()

	_, err = io.Copy(w, f)
	if err != nil {
		runtime.LogErrorf(ctx, "failed to read app asset %s: %v", p, err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}

func FileContentAssetMiddleware(ctxHolder *context.Holder, selectedBoard *board.Board) assetserver.Middleware {
	m := &fileContentAssetMiddleware{
		ctxHolder:     ctxHolder,
		selectedBoard: selectedBoard,
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, pathPrefix) {
				m.ServeHTTP(w, r)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// splitAssetPath splits a request path (with the route prefix already removed)
// into the directory to open and the name to read inside it.
//
// The remainder names an absolute path on the board, and is anchored at "/"
// before it is split: the frontend builds these URLs by concatenation, so
// whether the leading slash survives the prefix depends on the accident of a
// double slash in the middle. Anchoring keeps the confinement check below
// comparing two absolute paths either way - a relative dir matches no root, so
// without this a normalized URL would turn every asset into a 404.
func splitAssetPath(p string) (dir string, file string) {
	p = path.Join("/", p)
	return path.Dir(p), path.Base(p)
}

// isAllowedAssetPath reports whether the asset route may serve dir. Markdown
// assets are rewritten to app-relative paths by the frontend, so every
// legitimate request resolves inside one of the app file roots. dir comes
// straight from the request URL, so anything else is a traversal attempt
// rather than a missing asset.
func isAllowedAssetPath(dir string, file string, roots []string) bool {
	if !fs.ValidPath(file) || file == "." {
		return false
	}
	return board.IsWithinAnyDir(dir, roots)
}

func (m *fileContentAssetMiddleware) getAsset(dir string, file string) (fs.File, error) {
	// The roots are read from the board, over a request the app's context bounds.
	roots := m.selectedBoard.AppFileRoots(m.ctxHolder.Get())
	if !isAllowedAssetPath(dir, file, roots) {
		return nil, fs.ErrInvalid
	}

	selectedConn := m.selectedBoard.Conn

	if reflect.DeepEqual(selectedConn, board.NoopConn()) {
		// The app filesystem belongs to the board. Off-board it is only ever
		// reachable through a connection, so reading locally here would target
		// the machine running App Lab instead of the board.
		if !board.IsSBC() {
			return nil, fs.ErrInvalid
		}
		return os.DirFS(dir).Open(file)
	} else {
		remoteFS := getFS(dir, selectedConn)
		selectedConn.Stats("/")    // warm up the connection
		time.Sleep(sshTimeout)     // add a small delay
		return remoteFS.Open(file) // and finally open the file
	}
}
