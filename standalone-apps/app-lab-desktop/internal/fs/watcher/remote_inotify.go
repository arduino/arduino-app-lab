package watcher

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

// inotifyEvents is the set of inotify events we care about.
const inotifyEvents = "modify,create,delete,moved_to,moved_from,close_write"

// inotifyMarker returns a per-generation literal embedded in inotifywait's
// output format. The trailing ':' keeps it unique (so `AALW5:` doesn't match
// `AALW50:`), letting us kill exactly this session with `pkill -f <marker>`.
func inotifyMarker(gen int) string {
	return fmt.Sprintf("AALW%d:", gen)
}

// inotifyOp maps an inotifywait "%e" event list to a refresh op. A path leaving
// (DELETE / MOVED_FROM) is a remove; a path arriving (CREATE / MOVED_TO) is a
// create; anything else (MODIFY / CLOSE_WRITE) is a content write. Remove wins
// over create if both appear for the same coalesced line.
func inotifyOp(events string) string {
	op := OpWrite
	for _, e := range strings.Split(events, ",") {
		switch e {
		case "DELETE", "MOVED_FROM":
			return OpRemove
		case "CREATE", "MOVED_TO":
			op = OpCreate
		}
	}
	return op
}

// runRemoteInotify runs the inotifywait -m session for a connection: a recursive
// (-r) process over the watched apps plus a separate shallow process over the
// apps-root, so the apps-root isn't recursively watched (which would cover every
// app on the board and blow past the per-app limits). Both processes carry this
// session's marker, so one `pkill -f <marker>` reaps them; the closers are reaped
// detached so an unwatch never blocks on the remote Wait().
func (m *WatchManager) runRemoteInotify(ctx context.Context, conn remote.RemoteConn, paths map[string]surface, gen int) {
	marker := inotifyMarker(gen)

	// Partition remote paths by recursion need, mirroring the polling backend:
	// apps are watched recursively, the apps-root shallowly.
	lister := remoteLister(conn)
	var recursivePaths, shallowPaths []string
	for p, s := range paths {
		if !isShellSafePath(p) {
			runtime.LogErrorf(m.ctx, "[watcher] skipping remote watch of shell-unsafe path: %q", p)
			continue
		}
		if s == surfaceApp {
			if !treeWithinLimits(lister, p) {
				runtime.LogInfof(m.ctx, "[watcher] app %q exceeds watch limits (>%d files or >%d dirs); not watching", p, maxWatchedFiles, maxRecursiveDirs)
				continue
			}
			recursivePaths = append(recursivePaths, p)
		} else {
			shallowPaths = append(shallowPaths, p)
		}
	}
	if len(recursivePaths) == 0 && len(shallowPaths) == 0 {
		return
	}

	var (
		stdins  []io.WriteCloser
		closers []remote.Closer
		wg      sync.WaitGroup
	)
	// start launches one inotifywait -m process over watchPaths and streams its
	// events into onEvent. All processes share this session's marker.
	start := func(recursive bool, watchPaths []string) {
		if len(watchPaths) == 0 {
			return
		}
		args := []string{"-m", "-q", "-e", inotifyEvents}
		if recursive {
			args = append(args, "-r")
			if len(excludedDirs) > 0 {
				// Single-quote the regex so its metacharacters survive the SSH/ADB
				// transports: both hand a no-space, quoted token to the board shell,
				// which strips the quotes and passes the regex to inotifywait. Skips
				// watching (and reporting) excluded subtrees — the point on the board.
				args = append(args, "--exclude", "'"+excludeInotifyRegex()+"'")
			}
		}
		// "%w/%f" + path.Clean tolerates inotifywait's trailing-slash quirk on %w
		// (a doubled slash is normalised away). The marker prefixes every line and
		// appears in the cmdline for a precise kill.
		args = append(args, "--format="+marker+"%e@%w/%f")
		args = append(args, watchPaths...)

		cmd := conn.GetCmd("inotifywait", args...)
		stdin, stdout, _, closer, err := cmd.Interactive()
		if err != nil {
			runtime.LogErrorf(m.ctx, "[watcher] failed to start inotifywait (gen=%d, recursive=%v): %v", gen, recursive, err)
			return
		}
		stdins = append(stdins, stdin)
		closers = append(closers, closer)

		wg.Add(1)
		go func() {
			defer wg.Done()
			sc := bufio.NewScanner(stdout)
			for sc.Scan() {
				line := strings.TrimSpace(sc.Text())
				if !strings.HasPrefix(line, marker) {
					continue // warnings / non-event output
				}
				line = strings.TrimPrefix(line, marker)
				at := strings.IndexByte(line, '@')
				if at < 0 {
					continue
				}
				events, full := line[:at], line[at+1:]
				if full == "" || full == "/" {
					continue
				}
				m.onEvent(full, inotifyOp(events))
			}
		}()
	}

	start(true, recursivePaths)
	start(false, shallowPaths)

	if len(closers) == 0 {
		return // nothing started
	}

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-ctx.Done():
	case <-done:
	}

	for _, s := range stdins {
		_ = s.Close()
	}
	go func() {
		// Reliable, targeted teardown: kill this session's inotifywait processes by
		// their shared marker. Detached so we never block the unwatch.
		_ = conn.GetCmd("pkill", "-f", marker).Run(context.Background())
		for _, c := range closers {
			_ = c()
		}
	}()
}
