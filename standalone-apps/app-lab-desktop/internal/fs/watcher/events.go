package watcher

import (
	"log/slog"
	"path"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"app-lab-desktop/internal/lsp"
)

// refreshEvent is the single Wails event name the frontend listens on. The
// payload's Kind tells the frontend which queries to invalidate.
const refreshEvent = "refresh"

// Event kinds carried in the refresh payload.
const (
	KindFile     = "file"     // an open file's content changed
	KindDir      = "dir"      // the app tree changed (add/delete/rename)
	KindManifest = "manifest" // app.yaml / sketch.yaml changed
	KindApps     = "apps"     // an app was added/removed/renamed under the apps root
)

// Ops carried in the refresh payload. They tell the frontend what happened to
// the path so a `dir` change can be routed to the matching file operation
// (remove -> close the tab / prune the folder; create/write -> refetch the
// tree). A move/rename surfaces as OpRemove of the old path plus OpCreate of the
// new one — the fs backends can't correlate the two halves into a single rename.
const (
	OpCreate = "create"
	OpRemove = "remove"
	OpWrite  = "write"
)

// structuralOp reports whether an op changes the tree (vs a pure content write).
func structuralOp(op string) bool { return op == OpCreate || op == OpRemove }

// debounceInterval coalesces bursts of events for the same path (e.g. a write
// that surfaces as WRITE followed by CLOSE_WRITE).
const debounceInterval = 150 * time.Millisecond

// manifestBasenames are the files whose changes drive a manifest refresh
// (bricks, libraries, title). Matched by base name only.
var manifestBasenames = map[string]bool{
	"app.yaml":    true,
	"sketch.yaml": true,
}

// RefreshPayload is the JSON payload sent with the refresh event.
type RefreshPayload struct {
	Kind string `json:"kind"`
	Path string `json:"path"`
	// Op is what happened to the path: create, remove, or write. See the Op*
	// constants; the frontend routes `dir` changes on it.
	Op string `json:"op"`
}

// pending is a debounced, not-yet-emitted change for a path. `op` holds the
// change to report: a structural op (create/remove) is retained over a content
// write seen in the same window, and the latest structural op wins so a
// create-then-remove burst nets to remove.
type pending struct {
	timer *time.Timer
	op    string
}

// onEvent is the single entry point for every backend. It applies suppression
// and per-path debouncing, then classifies and emits. `op` is one of the Op*
// constants (structural create/remove, or a content write).
func (m *WatchManager) onEvent(raw string, op string) {
	p := path.Clean(raw)

	m.mu.Lock()
	defer m.mu.Unlock()

	// A held path is mid self-originated op: drop its events for the hold's
	// duration, independent of time.
	if m.holds[p] > 0 {
		return
	}
	if until, ok := m.suppress[p]; ok {
		if time.Now().Before(until) {
			return
		}
		delete(m.suppress, p)
	}

	if e, ok := m.debounce[p]; ok {
		// A structural op dominates a content write in the same burst; among
		// structural ops the latest wins (a create then a remove nets to remove).
		if structuralOp(op) {
			e.op = op
		}
		e.timer.Reset(debounceInterval)
		return
	}
	e := &pending{op: op}
	e.timer = time.AfterFunc(debounceInterval, func() {
		m.mu.Lock()
		// Guard against a stale fire: if a concurrent onEvent already Reset this
		// timer after it fired (or replaced the entry), the current map entry is
		// no longer e — do nothing, so we neither double-emit nor drop a newer one.
		if m.debounce[p] != e {
			m.mu.Unlock()
			return
		}
		delete(m.debounce, p)
		op := e.op
		kind, ok := m.classifyLocked(p, op)
		m.mu.Unlock()
		if ok {
			// Mirror the change into the LSP temp workspace BEFORE emitting:
			// everything downstream of the event reads the mirror — the
			// frontend's trackFileFromDisk/getLspWorkspaceFile fetches, and
			// the language server itself when our forwarded
			// didChangeWatchedFiles makes it stat the path. Emitting first
			// raced them against the copy: pyright would stat a just-Created
			// file before it existed, cache the negative import resolution,
			// and never re-resolve — the importing file's diagnostics then
			// stay frozen until app restart (observed as an ENOENT "LSP
			// opening file error" plus a missing workspace rescan).
			m.mirrorToLspWorkspace(p, op)
			runtime.EventsEmit(m.ctx, refreshEvent, RefreshPayload{Kind: kind, Path: p, Op: op})
		}
	})
	m.debounce[p] = e
}

// mirrorToLspWorkspace keeps the LSP temp workspace copy in sync with external
// (watcher-detected) changes, using the same helpers as UI-driven fs mutations.
// Guards inside the lsp package scope this to desktop board-apps LSP files, so
// SBC, examples and host files are safe no-ops. Runs outside m.mu (does IO).
func (m *WatchManager) mirrorToLspWorkspace(p string, op string) {
	if !lsp.ShouldSyncRemoteFileToLspWorkspace(p) {
		return
	}
	switch op {
	case OpRemove:
		lsp.RemoveWorkspaceFile(p)
	case OpCreate, OpWrite:
		// Snapshot the connection under the lock: it's mutated on board
		// switch/shutdown (add / UnwatchAll), so reading the field off-lock
		// would race and could nil-deref between the check and the call.
		m.mu.Lock()
		conn := m.remoteConn
		m.mu.Unlock()
		if conn == nil {
			return
		}
		reader, err := conn.ReadFile(p)
		if err != nil {
			slog.Error("lsp workspace mirror: read failed", "path", p, "err", err)
			return
		}
		defer reader.Close()
		lsp.SyncRemoteFileToLspWorkspace(p, reader)
	}
}

// coveringSurfaceLocked finds the watch responsible for a path and returns its
// surface. A recursive app watch covers its whole subtree; the apps-root watch
// covers only its direct children. Longest match wins. Must hold m.mu.
func (m *WatchManager) coveringSurfaceLocked(p string) (surface, bool) {
	var best string
	var bestSurface surface
	for root, w := range m.watches {
		match := false
		if w.surface == surfaceApp {
			match = p == root || strings.HasPrefix(p, root+"/")
		} else { // surfaceApps: the root itself or a direct child
			match = p == root || path.Dir(p) == root
		}
		if match && len(root) >= len(best) {
			best = root
			bestSurface = w.surface
		}
	}
	return bestSurface, best != ""
}

// classifyLocked maps a changed path + op to a refresh kind. Returns false if
// no active watch covers the path (stale event). Must hold m.mu.
func (m *WatchManager) classifyLocked(p string, op string) (string, bool) {
	s, ok := m.coveringSurfaceLocked(p)
	if !ok {
		return "", false
	}
	if s == surfaceApps {
		return KindApps, true
	}
	if manifestBasenames[path.Base(p)] {
		return KindManifest, true
	}
	if structuralOp(op) {
		return KindDir, true
	}
	return KindFile, true
}
