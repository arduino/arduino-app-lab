package app

import (
	"fmt"
	"log/slog"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"app-lab-desktop/internal/agent"
	"app-lab-desktop/internal/airuntime"
	"app-lab-desktop/internal/appmirror"
	"app-lab-desktop/internal/arduinoapps"
	"app-lab-desktop/internal/fs"
)

// boardFiles adapts App's board file access to appmirror.BoardFS (over the selected board's connection).
type boardFiles struct{ app *App }

// ListFiles flattens the board file tree under root into absolute file paths (no directories).
func (b boardFiles) ListFiles(root string) ([]string, error) {
	tree, err := b.app.GetFileTree(root)
	if err != nil {
		return nil, err
	}
	var files []string
	var walk func(n *fs.FSNode)
	walk = func(n *fs.FSNode) {
		if n == nil {
			return
		}
		if !n.IsDir {
			if n.MimeType != nil && strings.Contains(*n.MimeType, "image") {
				return // GetFileContent base64-encodes images to data URIs (not round-trippable); keep the mirror text-only
			}
			files = append(files, path.Join(root, n.Path)) // GetFileTree paths are relative to root; make them absolute board paths
			return
		}
		if n.Children != nil {
			for i := range *n.Children {
				walk(&(*n.Children)[i])
			}
		}
	}
	walk(tree)
	return files, nil
}

func (b boardFiles) ReadFile(path string) (string, error) { return b.app.GetFileContent(path) }
func (b boardFiles) WriteFile(path, content string) error {
	// suppressWatch=false: these are the agent's edits synced back to the board, so we WANT the editor to refresh.
	return b.app.WriteFileContent(path, content, false)
}
func (b boardFiles) MkDirAll(path string) error   { return b.app.CreateFolder(path, false) }
func (b boardFiles) RemoveFile(path string) error { return b.app.RemoveFile(path, false) }

// checkedApp is a board app the agent has checked out into a local mirror (edits sync back at turn-end).
type checkedApp struct {
	appPath  string    // board path of the app
	mirror   string    // local mirror dir
	baseline time.Time // set right after Populate; only edits after this are the agent's (not the initial copy)
	// hashes maps relative path → content hash of what was checked out: the set of paths known to exist on the board (for deletion detection) and what tells a real edit apart from an untouched file.
	hashes    map[string]string
	baselined bool // hashes cover every board file (from Populate/Reconcile), so they can replace the mtime gate; false for a reattached mirror
	dirty     bool // last sync failed; the next sync re-pushes every edited file so none is stranded
}

// checkoutApp mirrors an app's files locally and returns the mirror path. A re-checkout keeps the existing mirror
// so pending edits aren't clobbered, but reconciles it with the board first: without that the agent would keep
// reasoning about (and force-pushing) checkout-time content, reverting whatever the user saved in the editor.
func (a *App) checkoutApp(appID string) (string, error) {
	appID = strings.TrimSpace(appID)
	if appID == "" {
		return "", fmt.Errorf("app id is required")
	}

	a.checkoutMu.Lock()
	existing, ok := a.checkedOut[appID]
	a.checkoutMu.Unlock()
	if ok {
		// A failed reconcile (offline board) still hands back the mirror: it's stale, but refusing the checkout
		// leaves the agent with nothing, and SyncBack's hashes still stop it overwriting the user's work.
		hashes, err := appmirror.Reconcile(boardFiles{app: a}, existing.appPath, existing.mirror, existing.hashes)
		if err != nil {
			slog.Warn("agent mirror reconcile failed; reusing the existing mirror", "app", appID, "err", err)
			return existing.mirror, nil
		}
		a.checkoutMu.Lock()
		if cur, tracked := a.checkedOut[appID]; tracked {
			cur.hashes, cur.baselined = hashes, true
			a.checkedOut[appID] = cur
		}
		a.checkoutMu.Unlock()
		return existing.mirror, nil
	}

	orchestratorURL, err := a.InferOrchestratorURL()
	if err != nil {
		return "", err
	}
	appPath, err := arduinoapps.AppPath(a.ctx(), orchestratorURL, appID)
	if err != nil {
		return "", err
	}
	mirror, err := airuntime.MirrorDir(mirrorKey(a.selectedBoardID(), appID))
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(mirror, 0o755); err != nil {
		return "", err
	}
	hashes, err := appmirror.Populate(boardFiles{app: a}, appPath, mirror)
	if err != nil {
		return "", err
	}

	a.checkoutMu.Lock()
	a.checkedOut[appID] = checkedApp{appPath: appPath, mirror: mirror, baseline: time.Now(), hashes: hashes, baselined: true}
	a.checkoutMu.Unlock()
	return mirror, nil
}

// syncThreshold picks the mtime gate SyncBack should apply. The zero time drops it, leaving the per-file content
// hashes as the only thing deciding what to push — safe only for a baselined mirror, since a reattached one has no
// hashes for its pre-existing files and pushing those unconditionally is the force-push regression B4 was about.
func syncThreshold(since time.Time, c checkedApp, force bool) time.Time {
	if (force || c.dirty) && c.baselined {
		return time.Time{}
	}
	// Without hashes the mtime gate is the only guard, so it stays even under force — the callers pass the zero
	// time there, which would otherwise drop it anyway.
	if c.baseline.After(since) {
		return c.baseline // also skips the initial Populate copy, whose mtime predates the baseline
	}
	return since
}

// syncCheckouts pushes mirror edits back to the board (the watcher refreshes the editor); force ignores the mtime gate. The two outcomes stay apart because they call for opposite advice: a failed push is transient and self-heals (marked dirty, re-pushed next sync), while a conflict never clears by retrying — the agent has to re-checkout.
func (a *App) syncCheckouts(since time.Time, force bool) (failed, conflicts map[string]error) {
	a.checkoutMu.Lock()
	snapshot := make(map[string]checkedApp, len(a.checkedOut))
	for id, c := range a.checkedOut {
		snapshot[id] = c
	}
	gen := a.boardGen
	a.checkoutMu.Unlock()

	for appID, c := range snapshot {
		// A turn's deferred sync can outlive the board it was for: writing now would push these files over the next board's connection (X2), so drop it.
		if a.boardChanged(gen) {
			return failed, conflicts
		}
		// A clean checkout with no edits since Populate has nothing to flush — don't rewrite a whole untouched app over the board link.
		if force && !c.dirty && !mirrorEditedSince(c.mirror, c.baseline) {
			continue
		}
		res, err := appmirror.SyncBack(boardFiles{app: a}, c.appPath, c.mirror, syncThreshold(since, c, force), c.hashes)
		a.checkoutMu.Lock()
		cur, tracked := a.checkedOut[appID]
		if err != nil {
			if tracked {
				cur.dirty = true
				a.checkedOut[appID] = cur
			}
			a.checkoutMu.Unlock()
			slog.Warn("agent mirror sync-back failed", "app", appID, "err", err)
			if failed == nil {
				failed = map[string]error{}
			}
			failed[appID] = err
			continue
		}
		if tracked {
			cur.hashes = res.NewBase
			cur.dirty = false
			a.checkedOut[appID] = cur
		}
		a.checkoutMu.Unlock()
		if len(res.Conflicts) > 0 {
			// Both sides moved. Retrying can't resolve it, so report it without marking the app dirty.
			slog.Warn("agent mirror sync-back conflict", "app", appID, "files", res.Conflicts)
			if conflicts == nil {
				conflicts = map[string]error{}
			}
			conflicts[appID] = fmt.Errorf("changed on the board since checkout, so the agent's edits were not applied: %s (re-run apps_checkout to pick up the board's version)", strings.Join(res.Conflicts, ", "))
		}
		if force || len(res.Written) > 0 {
			slog.Info("[sync] pushed mirror to board", "app", appID, "force", force, "written", len(res.Written), "conflicts", len(res.Conflicts))
		}
	}
	return failed, conflicts
}

// mirrorKey turns a board + app id into a filesystem-safe dir name: app ids repeat across boards, so one key alone would reuse board A's mirror for board B's app of the same name. It separates the copies on disk, but doesn't make unflushed edits recoverable — A → B → A finds no checkout entry and re-Populates.
func mirrorKey(boardID, appID string) string {
	san := strings.NewReplacer(":", "-", "/", "-", "\\", "-")
	if boardID == "" {
		return san.Replace(appID) // no board identity (SBC/placeholder): keep the historical layout
	}
	return san.Replace(boardID) + "__" + san.Replace(appID)
}

// boardChangedReason marks the teardown reason on the restart event, so the reconnect prompt can explain itself.
const boardChangedReason = "board-changed"

// detachAgentForBoardChange unbinds the agent from the board that is about to be replaced. The order matters: pending
// mirror edits are pushed while the OLD board's connection is still up (afterwards they would land on the new board at
// the old board's paths — X2); then the agent is stopped, both because its system prompt describes the old board (X11)
// and so none of its goroutines reads selectedBoard while it is reassigned (W1); then the checkouts are dropped, since
// they mirror files that belong to the board we are leaving.
func (a *App) detachAgentForBoardChange() {
	a.agentMu.Lock()
	running := a.agentMgr != nil
	a.agentMu.Unlock()

	if failed, _ := a.syncCheckouts(time.Time{}, true); len(failed) > 0 {
		// The edits stay in the mirror, which is keyed by board, so they are still there if the user comes back.
		slog.Warn("[board] could not flush agent edits before the board change", "apps", flushFailureSummary(failed))
	}
	a.agentMu.Lock()
	a.stopAgentLocked()
	a.agentMu.Unlock()

	a.checkoutMu.Lock()
	a.checkedOut = map[string]checkedApp{}
	a.boardGen++ // anything already in flight for the old board must not land on the new one
	a.checkoutMu.Unlock()

	if running {
		// Same event a crash-out uses: the agent is down and won't come back on its own. The reason distinguishes them.
		a.emit("acp:restart", agent.RestartInfo{GaveUp: true, Reason: boardChangedReason})
	}
}

// boardChanged reports whether the selected board was swapped since gen was taken.
func (a *App) boardChanged(gen uint64) bool {
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	return a.boardGen != gen
}

// selectedBoardID identifies the selected board for mirror keying (serial, or address for a network board).
func (a *App) selectedBoardID() string {
	if sb := a.selectedBoard; sb != nil {
		return boardIdentity(sb.Info.Serial, sb.Info.Address)
	}
	return ""
}

// appIDForMirrorKey reverses a mirror dir name to the board app id (mirrorKey is lossy — ':' etc. → '-') by matching the board's app list.
// Returns (id, found, err): err flags a board/list failure so callers can tell it apart from a clean "no such app".
func (a *App) appIDForMirrorKey(orchestratorURL, key string) (string, bool, error) {
	boardID := a.selectedBoardID()
	apps, err := arduinoapps.List(a.ctx(), orchestratorURL)
	if err != nil {
		return "", false, err
	}
	for _, id := range apps {
		if mirrorKey(boardID, id) == key {
			return id, true, nil
		}
	}
	return "", false, nil
}

// reattachEditedMirrors registers persisted mirror dirs the agent edited this turn but never checked out
// (checkedOut is in-memory), so syncCheckouts propagates their edits back to the board instead of stranding them.
func (a *App) reattachEditedMirrors(since time.Time) {
	root, err := airuntime.MirrorRootDir()
	if err != nil {
		return
	}
	entries, err := os.ReadDir(root)
	if err != nil {
		return
	}
	boardID := a.selectedBoardID()
	a.checkoutMu.Lock()
	gen := a.boardGen
	tracked := make(map[string]bool, len(a.checkedOut))
	for id := range a.checkedOut {
		tracked[mirrorKey(boardID, id)] = true
	}
	a.checkoutMu.Unlock()

	if a.boardChanged(gen) { // see syncCheckouts: don't re-adopt the previous board's mirrors under the new one
		return
	}
	orchestratorURL := ""
	for _, e := range entries {
		if !e.IsDir() || tracked[e.Name()] {
			continue
		}
		mirror := filepath.Join(root, e.Name())
		if !mirrorEditedSince(mirror, since) {
			continue
		}
		if orchestratorURL == "" {
			if orchestratorURL, err = a.InferOrchestratorURL(); err != nil {
				return
			}
		}
		appID, ok, err := a.appIDForMirrorKey(orchestratorURL, e.Name())
		if err != nil || !ok {
			continue
		}
		appPath, err := arduinoapps.AppPath(a.ctx(), orchestratorURL, appID)
		if err != nil {
			continue
		}
		a.checkoutMu.Lock()
		if _, exists := a.checkedOut[appID]; !exists {
			// baseline=since → SyncBack writes only this turn's edits; no hashes → no deletion propagation, and not baselined, so the mtime gate stays.
			a.checkedOut[appID] = checkedApp{appPath: appPath, mirror: mirror, baseline: since, hashes: map[string]string{}}
		}
		a.checkoutMu.Unlock()
	}
}

// mirrorEditedSince reports whether any file under mirror was modified at/after since.
func mirrorEditedSince(mirror string, since time.Time) bool {
	edited := false
	_ = filepath.Walk(mirror, func(_ string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		if !info.ModTime().Before(since) {
			edited = true
			return filepath.SkipAll // one edited file is enough; stop walking the rest of the tree
		}
		return nil
	})
	return edited
}
