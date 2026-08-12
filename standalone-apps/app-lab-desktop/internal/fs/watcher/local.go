package watcher

import (
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ensureFsnotifyLocked lazily creates the shared fsnotify watcher and starts the
// goroutine that drains its events. Must hold m.mu.
func (m *WatchManager) ensureFsnotifyLocked() error {
	if m.fsw != nil {
		return nil
	}
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	m.fsw = w
	go m.readLocalEvents(w)
	return nil
}

// readLocalEvents drains the shared fsnotify watcher, forwarding each change to
// onEvent and registering newly-created subdirectories (fsnotify isn't
// recursive) as they appear.
func (m *WatchManager) readLocalEvents(w *fsnotify.Watcher) {
	for {
		select {
		case ev, ok := <-w.Events:
			if !ok {
				return
			}
			// Ignore pure permission changes; they don't affect content or tree.
			if ev.Op == fsnotify.Chmod {
				continue
			}
			// A rename's source leaves (fsnotify.Rename on the old path); the
			// destination, if inside the tree, arrives as a separate Create — so
			// both halves map cleanly to remove/create.
			op := OpWrite
			switch {
			case ev.Op&(fsnotify.Remove|fsnotify.Rename) != 0:
				op = OpRemove
			case ev.Op&fsnotify.Create != 0:
				op = OpCreate
			}
			// A newly created directory under a recursive watch must itself be
			// watched, or we'd miss events inside it. Register it off the reader
			// (a stalled reader risks an inotify queue overflow and dropped
			// events), deduped so a burst on one path can't spawn duplicate walks.
			if ev.Op&fsnotify.Create != 0 {
				m.scheduleDirRegister(ev.Name)
			}
			m.onEvent(ev.Name, op)
		case err, ok := <-w.Errors:
			if !ok {
				return
			}
			runtime.LogErrorf(m.ctx, "[watcher] fsnotify error: %v", err)
		}
	}
}

// addLocalDirLocked registers a single directory with fsnotify. Must hold m.mu.
func (m *WatchManager) addLocalDirLocked(w *watch, dir string) error {
	if err := m.fsw.Add(dir); err != nil {
		return err
	}
	w.dirs[dir] = struct{}{}
	return nil
}

// registerLocalSubtree walks root and registers each directory (minus excluded
// names, capped at maxRecursiveDirs) with the shared fsnotify watcher. The walk
// runs off-lock — it must never hold m.mu, so a large tree can't block event
// classification or stall the fsnotify reader — and only the fsnotify/map
// mutations re-take the lock. Dirs are attributed to whichever app watch covers
// root; if none does (the watch was removed while we walked), it's a no-op.
func (m *WatchManager) registerLocalSubtree(root string) {
	root = path.Clean(root)

	dirs := make([]string, 0, 16)
	_ = filepath.Walk(root, func(p string, info os.FileInfo, err error) error {
		if err != nil || !info.IsDir() {
			return nil //nolint:nilerr // skip unreadable/non-dir entries
		}
		if p != root && excluded(info.Name()) {
			return filepath.SkipDir
		}
		if len(dirs) >= maxRecursiveDirs {
			return filepath.SkipDir
		}
		dirs = append(dirs, path.Clean(p))
		return nil
	})

	m.mu.Lock()
	defer m.mu.Unlock()

	w := m.coveringAppWatchLocked(root)
	if w == nil || m.fsw == nil {
		return // the watch was removed (or fsnotify torn down) while we walked
	}
	for _, d := range dirs {
		if len(w.dirs) >= maxRecursiveDirs {
			runtime.LogInfof(m.ctx, "[watcher] recursive watch cap (%d dirs) reached under %q", maxRecursiveDirs, w.path)
			break
		}
		if _, ok := w.dirs[d]; ok {
			continue
		}
		if err := m.fsw.Add(d); err != nil {
			continue // best-effort; a failed dir just isn't watched
		}
		w.dirs[d] = struct{}{}
	}
}

// coveringAppWatchLocked returns the local app watch whose recursive subtree
// contains p, or nil if none. Must hold m.mu.
func (m *WatchManager) coveringAppWatchLocked(p string) *watch {
	for root, w := range m.watches {
		if w.local && w.surface == surfaceApp && (p == root || strings.HasPrefix(p, root+"/")) {
			return w
		}
	}
	return nil
}

// scheduleDirRegister registers a newly-created directory's subtree off the
// fsnotify reader goroutine (a stalled reader risks an inotify queue overflow
// and dropped events), at most one in-flight walk per path so a burst of events
// on the same new directory can't spawn duplicate walks.
func (m *WatchManager) scheduleDirRegister(p string) {
	key := path.Clean(p)

	m.mu.Lock()
	if _, ok := m.registering[key]; ok {
		m.mu.Unlock()
		return
	}
	m.registering[key] = struct{}{}
	m.mu.Unlock()

	go func() {
		defer func() {
			m.mu.Lock()
			delete(m.registering, key)
			m.mu.Unlock()
		}()
		m.maybeAddNewLocalDir(key)
	}()
}

// maybeAddNewLocalDir registers a newly-created directory (and its subtree) if
// it falls under an active recursive watch.
func (m *WatchManager) maybeAddNewLocalDir(p string) {
	info, err := os.Stat(p)
	if err != nil || !info.IsDir() || excluded(info.Name()) {
		return
	}
	m.registerLocalSubtree(p)
}
