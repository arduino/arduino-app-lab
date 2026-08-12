package watcher

import (
	"context"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

// remoteReconcileDelay debounces (re)launching the single remote watcher
// session so a burst of watch/unwatch calls resolves to one restart.
const remoteReconcileDelay = 250 * time.Millisecond

// remoteMode is the detection strategy used for a remote (non-local) board.
type remoteMode int

const (
	remoteModeUnknown remoteMode = iota
	remoteModeInotify            // event-driven: a single inotifywait on the board
	remoteModePolling            // fallback: periodic fingerprinting over the shell
)

// scheduleRemoteReconcileLocked debounces reconcileRemote. Must hold m.mu.
func (m *WatchManager) scheduleRemoteReconcileLocked() {
	if m.remoteTimer != nil {
		m.remoteTimer.Reset(remoteReconcileDelay)
		return
	}
	m.remoteTimer = time.AfterFunc(remoteReconcileDelay, m.reconcileRemote)
}

// reconcileRemote stops the current remote session and starts a fresh one
// watching the current set of remote paths. Exactly one session exists per
// connection at a time.
func (m *WatchManager) reconcileRemote() {
	m.mu.Lock()
	m.remoteTimer = nil
	if m.remoteCancel != nil {
		m.remoteCancel() // triggers the old session's teardown (kills its own gen)
		m.remoteCancel = nil
	}

	paths := make(map[string]surface)
	for p, w := range m.watches {
		if !w.local {
			paths[p] = w.surface
		}
	}
	conn := m.remoteConn
	if conn == nil || len(paths) == 0 {
		m.mu.Unlock()
		return
	}

	mode := m.remoteMode
	m.remoteGen++
	gen := m.remoteGen
	ctx, cancel := context.WithCancel(m.ctx)
	m.remoteCancel = cancel
	m.mu.Unlock()

	// Probe once per connection (off-lock; it's a shell round-trip).
	if mode == remoteModeUnknown {
		mode = m.probeRemoteMode(conn)
		m.mu.Lock()
		m.remoteMode = mode
		m.mu.Unlock()
	}

	if mode == remoteModePolling {
		go m.runRemotePolling(ctx, conn, paths)
		return
	}
	go m.runRemoteInotify(ctx, conn, paths, gen)
}

// probeRemoteMode selects the remote backend. inotifywait mode requires both
// `inotifywait` (to watch) and `pkill` (to tear the monitor process down
// cleanly); if either is missing we use polling, which stops with just a
// cancelled goroutine and needs no board tooling.
func (m *WatchManager) probeRemoteMode(conn remote.RemoteConn) remoteMode {
	if !remoteHasCmd(m.ctx, conn, "inotifywait") {
		runtime.LogInfof(m.ctx, "[watcher] inotifywait not found on board; using polling")
		return remoteModePolling
	}
	if !remoteHasCmd(m.ctx, conn, "pkill") {
		runtime.LogInfof(m.ctx, "[watcher] pkill not found on board; using polling (inotifywait cannot be torn down cleanly)")
		return remoteModePolling
	}
	runtime.LogInfof(m.ctx, "[watcher] using inotifywait for remote watches")
	return remoteModeInotify
}

func remoteHasCmd(ctx context.Context, conn remote.RemoteConn, name string) bool {
	out, err := conn.GetCmd("which", name).Output(ctx)
	return err == nil && strings.TrimSpace(string(out)) != ""
}
