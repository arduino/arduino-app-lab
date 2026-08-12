// Package watcher watches the filesystem for changes made outside App Lab and turns
// them into "refresh" events the frontend listens for.
//
// The code is split by responsibility so the flow is easy to follow:
//
//	manager.go        - WatchManager: shared state, the public Watch*/Unwatch*
//	                    API, and add()/remove() which dispatch to a backend
//	suppress.go       - ignoring events caused by App Lab's own writes
//	events.go         - the raw-event -> debounce -> classify -> emit pipeline
//	local.go          - local backend: the fsnotify watcher on this machine
//	remote.go         - remote backend selection + session reconcile (board shell)
//	remote_inotify.go - remote backend: an inotifywait session on the board
//	remote_polling.go - remote backend: polling fallback when inotify is absent
//	fstree.go         - shared directory listing, size limits, shell-safety
//
// Typical flow: a caller invokes WatchApp / WatchAppsDir (here) -> add()
// dispatches to the local or remote backend -> the backend feeds raw changes
// into onEvent (events.go) -> which debounces, classifies, and emits a
// RefreshPayload to the frontend.
package watcher

import (
	"context"
	"path"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

type surface int

const (
	// surfaceApp is an open app, watched recursively (content + tree + manifest).
	surfaceApp surface = iota
	// surfaceApps is the apps root (ArduinoApps), watched non-recursively to
	// detect apps being added/removed/renamed.
	surfaceApps
)

// Target describes where a watch should be established: the active board
// connection and whether its filesystem is local to this process. When local,
// we use fsnotify directly; otherwise we watch over the board shell (a single
// inotifywait process, or polling if inotify-tools is unavailable).
type Target struct {
	Conn    remote.RemoteConn
	IsLocal bool
}

type watch struct {
	path    string
	surface surface
	local   bool
	// dirs holds every fsnotify path registered for this watch (local only): the
	// full recursive set for an app, or the single directory for the apps root.
	dirs map[string]struct{}
}

// WatchManager owns every active filesystem watch and translates raw fs events
// into "refresh" events for the frontend. It is safe for concurrent use.
//
// Local watches use one shared fsnotify (kernel inotify) watcher — event-driven
// and zero-cost at idle; an app is watched recursively (fsnotify isn't
// recursive, so subdirectories are added explicitly and as they appear). Remote
// watches are served by a single consolidated backend per connection: one
// `inotifywait` session (a recursive process for apps plus a shallow one for the
// apps-root), or a single polling loop when inotify-tools is missing on the board.
type WatchManager struct {
	ctx context.Context

	mu       sync.Mutex
	watches  map[string]*watch
	suppress map[string]time.Time // post-release grace window (catches trailing events)
	holds    map[string]int       // active self-write suppression, held for the op's duration
	debounce map[string]*pending
	// Paths with an in-flight new-dir subtree registration, so a burst of Create
	// events for the same directory doesn't spawn duplicate recursive walks.
	registering map[string]struct{}

	// Shared fsnotify watcher for all local watches; created lazily.
	fsw *fsnotify.Watcher

	// Single remote backend, shared by all remote watches on the connection.
	remoteConn   remote.RemoteConn
	remoteMode   remoteMode
	remoteGen    int                // bumped per session; used as a unique kill marker
	remoteCancel context.CancelFunc // cancels the current remote session
	remoteTimer  *time.Timer        // debounces reconcile
}

// NewWatchManager creates a manager bound to the Wails startup context (used as
// the parent for emitted events and remote watch goroutines).
func NewWatchManager(ctx context.Context) *WatchManager {
	return &WatchManager{
		ctx:         ctx,
		watches:     map[string]*watch{},
		suppress:    map[string]time.Time{},
		holds:       map[string]int{},
		debounce:    map[string]*pending{},
		registering: map[string]struct{}{},
	}
}

// WatchApp starts watching an open app recursively: content changes of its
// files, tree changes (add/delete/rename), and manifest changes.
func (m *WatchManager) WatchApp(t Target, p string) error {
	return m.add(t, p, surfaceApp)
}

// UnwatchApp stops watching an app.
func (m *WatchManager) UnwatchApp(p string) { m.remove(p) }

// WatchAppsDir starts watching the apps root (ArduinoApps), non-recursively,
// for apps being added/removed/renamed.
func (m *WatchManager) WatchAppsDir(t Target, p string) error {
	return m.add(t, p, surfaceApps)
}

// UnwatchAppsDir stops watching the apps root.
func (m *WatchManager) UnwatchAppsDir(p string) { m.remove(p) }

// UnwatchAll stops every active watch. Call on board switch (the connection is
// about to change) and on shutdown.
func (m *WatchManager) UnwatchAll() {
	m.mu.Lock()
	ws := m.watches
	m.watches = map[string]*watch{}
	fsw := m.fsw
	for _, t := range m.debounce {
		t.timer.Stop()
	}
	m.debounce = map[string]*pending{}
	m.suppress = map[string]time.Time{}
	m.holds = map[string]int{}
	if m.remoteTimer != nil {
		m.remoteTimer.Stop()
		m.remoteTimer = nil
	}
	remoteCancel := m.remoteCancel
	m.remoteCancel = nil
	m.remoteConn = nil
	m.remoteMode = remoteModeUnknown
	m.mu.Unlock()

	if fsw != nil {
		for _, w := range ws {
			for d := range w.dirs {
				_ = fsw.Remove(d)
			}
		}
	}
	if remoteCancel != nil {
		remoteCancel()
	}
}

// Close tears down all watches and the shared fsnotify watcher.
func (m *WatchManager) Close() {
	m.UnwatchAll()
	m.mu.Lock()
	fsw := m.fsw
	m.fsw = nil
	m.mu.Unlock()
	if fsw != nil {
		_ = fsw.Close()
	}
}

// add registers a watch for p and dispatches it to the local (fsnotify) or
// remote (board shell) backend depending on the target.
func (m *WatchManager) add(t Target, p string, s surface) error {
	// Remote watches reach the board over a shell (inotifywait, or the polling
	// fallback's conn.ReadFile/conn.List). Refuse shell-unsafe remote paths at
	// this single registration choke point so no backend hands one to the shell.
	if !t.IsLocal && !isShellSafePath(p) {
		runtime.LogErrorf(m.ctx, "[watcher] skipping remote watch of shell-unsafe path: %q", p)
		return nil
	}

	key := path.Clean(p)

	// Decline to watch an app that's too large (local check; the remote backends
	// enforce the same caps before they establish their watch/session).
	if t.IsLocal && s == surfaceApp && !treeWithinLimits(localLister, key) {
		runtime.LogInfof(m.ctx, "[watcher] app %q exceeds watch limits (>%d files or >%d dirs); not watching", key, maxWatchedFiles, maxRecursiveDirs)
		return nil
	}

	m.mu.Lock()
	if _, ok := m.watches[key]; ok {
		m.mu.Unlock()
		return nil // already watching
	}
	w := &watch{path: key, surface: s, local: t.IsLocal, dirs: map[string]struct{}{}}
	m.watches[key] = w

	if t.IsLocal {
		if err := m.ensureFsnotifyLocked(); err != nil {
			delete(m.watches, key)
			m.mu.Unlock()
			runtime.LogErrorf(m.ctx, "[watcher] fsnotify init failed for %q: %v", key, err)
			return err
		}
		if s == surfaceApp {
			// Register the recursive subtree off-lock: the expensive walk must
			// not hold m.mu (registerLocalSubtree re-takes it only to mutate the
			// fsnotify/watch maps). The watch entry is already in m.watches.
			m.mu.Unlock()
			m.registerLocalSubtree(key)
			return nil
		}
		if err := m.addLocalDirLocked(w, key); err != nil {
			delete(m.watches, key)
			m.mu.Unlock()
			runtime.LogErrorf(m.ctx, "[watcher] fsnotify add failed for %q: %v", key, err)
			return err
		}
		m.mu.Unlock()
		return nil
	}

	// Remote: (re)launch the single shared session for this connection.
	m.remoteConn = t.Conn
	m.scheduleRemoteReconcileLocked()
	m.mu.Unlock()
	return nil
}

// remove drops the watch for p, tearing down its fsnotify entries (local) or
// scheduling a remote-session reconcile (remote).
func (m *WatchManager) remove(p string) {
	key := path.Clean(p)
	m.mu.Lock()
	w, ok := m.watches[key]
	if !ok {
		m.mu.Unlock()
		return
	}
	delete(m.watches, key)

	if w.local {
		fsw := m.fsw
		dirs := w.dirs
		m.mu.Unlock()
		if fsw != nil {
			for d := range dirs {
				_ = fsw.Remove(d)
			}
		}
		return
	}

	m.scheduleRemoteReconcileLocked()
	m.mu.Unlock()
}
