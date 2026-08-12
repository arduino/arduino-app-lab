package watcher

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"path"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

const (
	// pollInterval is the cadence of the remote polling fallback (only used when
	// inotify-tools is absent on the board).
	pollInterval = 1500 * time.Millisecond
	// maxFingerprintBytes caps how much of a polled file is hashed, so one huge
	// file can't dominate the poll loop's bandwidth.
	maxFingerprintBytes = 1 << 20 // 1 MiB
)

// runRemotePolling is the fallback when inotify-tools is unavailable. For an app
// it recursively fingerprints the tree (content) and diffs the path set
// (structural); for the apps root it diffs the top-level entry names.
func (m *WatchManager) runRemotePolling(ctx context.Context, conn remote.RemoteConn, paths map[string]surface) {
	type appState struct {
		files map[string]string   // path -> content hash
		all   map[string]struct{} // every path (files + dirs) for structural diff
	}
	appStates := map[string]*appState{}
	listStates := map[string]map[string]struct{}{}

	snapshot := func(root string) *appState {
		files, dirs := walkRemoteTree(conn, root)
		st := &appState{files: map[string]string{}, all: map[string]struct{}{}}
		for _, d := range dirs {
			st.all[d] = struct{}{}
		}
		for _, f := range files {
			st.files[f] = fingerprintFile(conn, f)
			st.all[f] = struct{}{}
		}
		return st
	}

	lister := remoteLister(conn)
	for root, s := range paths {
		if s == surfaceApp {
			if !treeWithinLimits(lister, root) {
				runtime.LogInfof(m.ctx, "[watcher] app %q exceeds watch limits (>%d files or >%d dirs); not polling", root, maxWatchedFiles, maxRecursiveDirs)
				continue
			}
			appStates[root] = snapshot(root)
		} else {
			listStates[root] = listDirNames(conn, root)
		}
	}

	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			for root, prev := range appStates {
				next := snapshot(root)
				for f, h := range next.files {
					if old, ok := prev.files[f]; ok && old != h {
						m.onEvent(f, OpWrite) // content change
					}
				}
				for p := range next.all {
					if _, ok := prev.all[p]; !ok {
						m.onEvent(p, OpCreate) // added
					}
				}
				for p := range prev.all {
					if _, ok := next.all[p]; !ok {
						m.onEvent(p, OpRemove) // removed
					}
				}
				appStates[root] = next
			}
			for root, prev := range listStates {
				next := listDirNames(conn, root)
				for name := range next {
					if _, ok := prev[name]; !ok {
						m.onEvent(path.Join(root, name), OpCreate) // added
					}
				}
				for name := range prev {
					if _, ok := next[name]; !ok {
						m.onEvent(path.Join(root, name), OpRemove) // removed
					}
				}
				listStates[root] = next
			}
		}
	}
}

// walkRemoteTree lists a directory subtree over the connection, skipping
// excluded dirs and stopping at maxRecursiveDirs.
func walkRemoteTree(conn remote.RemoteConn, root string) (files, dirs []string) {
	list := remoteLister(conn)
	queue := []string{root}
	for len(queue) > 0 && len(dirs) < maxRecursiveDirs {
		dir := queue[0]
		queue = queue[1:]
		dirs = append(dirs, dir)

		entries, err := list(dir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			child := path.Join(dir, e.name)
			if e.isDir {
				if !excluded(e.name) {
					queue = append(queue, child)
				}
			} else {
				files = append(files, child)
			}
		}
	}
	return files, dirs
}

func fingerprintFile(conn remote.RemoteConn, p string) string {
	reader, err := conn.ReadFile(p)
	if err != nil {
		return "unreadable"
	}
	defer reader.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, io.LimitReader(reader, maxFingerprintBytes)); err != nil {
		return "unreadable"
	}
	return hex.EncodeToString(hasher.Sum(nil))
}

func listDirNames(conn remote.RemoteConn, p string) map[string]struct{} {
	set := make(map[string]struct{})
	entries, err := conn.List(p)
	if err != nil {
		return set
	}
	for _, e := range entries {
		set[e.Name] = struct{}{}
	}
	return set
}
