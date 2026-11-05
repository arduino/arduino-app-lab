package app

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"mime"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"app-lab-desktop/internal/airuntime"
	"app-lab-desktop/internal/appmirror"
	"app-lab-desktop/internal/arduinoapps"
	"app-lab-desktop/internal/boardmcp"
	"app-lab-desktop/internal/fs"
)

// boardFiles adapts App's board file access to appmirror.BoardFS (over the selected board's connection).
type boardFiles struct{ app *App }

// ListFiles returns the absolute board path of every file under root, skipping
// images: GetFileContent base64-encodes those into data URIs, which don't round
// trip, so the mirror stays text-only.
//
// A walk that could not read some subtrees hands back both the paths it did find
// and the error naming those subtrees, leaving each caller to decide: Populate
// mirrors what it got, the callers that compare against a full board listing
// still fail.
func (b boardFiles) ListFiles(root string) ([]string, error) {
	relPaths, err := fs.ListFilePaths(root, b.app.boardConn())
	var unreadable *fs.UnreadableDirsError
	if err != nil && !errors.As(err, &unreadable) {
		return nil, err
	}
	var files []string
	for _, rel := range relPaths {
		if strings.HasPrefix(mime.TypeByExtension(path.Ext(rel)), "image/") {
			continue
		}
		files = append(files, path.Join(root, rel))
	}
	return files, err
}

// ReadFile reads the raw bytes: the editor's GetFileContent also writes each file into the LSP copy of the app open in the editor, whatever app it belongs to.
func (b boardFiles) ReadFile(path string) (string, error) {
	return fs.ReadBoardFile(b.app.boardConn(), path)
}

// Writes and deletes leave the watcher on, so the editor refreshes and the open app's LSP copy follows; the editor's own helpers would also write any app into that copy.
func (b boardFiles) WriteFile(path, content string) error {
	return fs.WriteBoardFile(b.app.boardConn(), path, content)
}
func (b boardFiles) MkDirAll(path string) error   { return b.app.CreateFolder(path, false) }
func (b boardFiles) RemoveFile(path string) error { return b.app.boardConn().Remove(path) }

// checkedApp is a board app the agent has checked out into a local mirror (edits sync back at turn-end).
type checkedApp struct {
	appPath  string    // board path of the app
	mirror   string    // local mirror dir
	baseline time.Time // set right after Populate; only edits after this are the agent's (not the initial copy)
	// hashes maps relative path → content hash of what was checked out: the set of paths known to exist on the board (for deletion detection) and what tells a real edit apart from an untouched file.
	hashes    map[string]string
	readOnly  bool // built-in app: mirrored so the agent can read it, never pushed back to the board
	baselined bool // hashes cover every board file (from Populate/Reconcile), so they can replace the mtime gate; false for a reattached mirror
	dirty     bool // last sync failed, or a turn end left the app to another chat; the next sync re-pushes every edited file so none is stranded
}

// checkoutApp mirrors an app's files locally and returns the checkout. A re-checkout keeps the existing
// mirror so pending edits aren't clobbered, but reconciles it with the board first: without that the agent would
// keep reasoning about (and force-pushing) checkout-time content, reverting whatever the user saved in the editor.
func (a *App) checkoutApp(appID string) (boardmcp.Checkout, error) {
	appID = strings.TrimSpace(appID)
	if appID == "" {
		return boardmcp.Checkout{}, fmt.Errorf("app id is required")
	}
	lock := a.checkoutLock(appID)
	lock.Lock()
	defer lock.Unlock()

	a.checkoutMu.Lock()
	existing, ok := a.checkedOut[appID]
	a.checkoutMu.Unlock()
	if ok {
		// A built-in app reconciles against no baseline, so the shipped content is restored over any edit the agent
		// left behind: those edits can never be pushed, and Reconcile would otherwise preserve them and hand them
		// back as the example's real code on the next checkout.
		base := existing.hashes
		if existing.readOnly {
			base = nil
		}
		// A failed reconcile (offline board) still hands back the mirror: it's stale, but refusing the checkout
		// leaves the agent with nothing, and SyncBack's hashes still stop it overwriting the user's work.
		hashes, parked, err := appmirror.Reconcile(boardFiles{app: a}, existing.appPath, existing.mirror, base)
		if err != nil {
			slog.Warn("agent mirror reconcile failed; reusing the existing mirror", "app", appID, "err", err)
		}
		a.checkoutMu.Lock()
		if cur, tracked := a.checkedOut[appID]; tracked {
			// Adopt the partial baseline even on error: those files were rewritten/parked on disk, and the old hashes would misread them as local edits.
			cur.hashes = hashes
			cur.baselined = cur.baselined || err == nil
			a.checkedOut[appID] = cur
		}
		if len(parked) > 0 {
			a.holdParkedLocked(appID)
		}
		a.checkoutMu.Unlock()
		if err == nil {
			a.clearConflictIssue(appID) // Reconcile parked any divergence, so the sticky conflict warning is stale now
		}
		return boardmcp.Checkout{Path: existing.mirror, Parked: parked, ReadOnly: existing.readOnly, Stale: err}, nil
	}

	target, err := resolveApp(a, appID)
	if err != nil {
		return boardmcp.Checkout{}, err
	}
	mirror, err := airuntime.MirrorDir(mirrorKey(a.selectedBoardID(), appID))
	if err != nil {
		return boardmcp.Checkout{}, err
	}
	if err := a.clearDeletedLeftover(mirror); err != nil {
		return boardmcp.Checkout{}, err
	}
	if err := os.MkdirAll(mirror, 0o755); err != nil {
		return boardmcp.Checkout{}, err
	}
	hashes, err := appmirror.Populate(boardFiles{app: a}, target.Path, mirror)
	if err != nil {
		return boardmcp.Checkout{}, err
	}

	a.checkoutMu.Lock()
	a.checkedOut[appID] = checkedApp{appPath: target.Path, mirror: mirror, baseline: time.Now(), hashes: hashes, readOnly: target.ReadOnly, baselined: true}
	a.checkoutMu.Unlock()
	a.clearConflictIssue(appID)
	return boardmcp.Checkout{Path: mirror, ReadOnly: target.ReadOnly}, nil
}

// checkoutLock is the lock for one app's checkout; take it before checkoutMu, never while holding it.
func (a *App) checkoutLock(appID string) *sync.Mutex {
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	if a.checkoutLocks == nil {
		a.checkoutLocks = map[string]*sync.Mutex{}
	}
	lock, ok := a.checkoutLocks[appID]
	if !ok {
		lock = &sync.Mutex{}
		a.checkoutLocks[appID] = lock
	}
	return lock
}

// rebindCheckout moves a renamed app's checkout onto its new id: the entry holds the board path and mirror dir, and left behind it strands the pending edits and breaks every permission keyed on that path.
func (a *App) rebindCheckout(oldID, newID string) {
	if oldID == newID {
		return
	}
	// Both ids: a sync may still hold the old entry, and a checkout of the new id would fill the folder this moves into.
	for _, id := range []string{oldID, newID} {
		lock := a.checkoutLock(id)
		lock.Lock()
		defer lock.Unlock()
	}
	a.checkoutMu.Lock()
	entry, ok := a.checkedOut[oldID]
	a.checkoutMu.Unlock()
	if !ok {
		return
	}
	// Left tracked, the entry would sync into the folder the rename took away and make it again on the board.
	drop := func(err error) {
		slog.Warn("agent mirror rebind failed; the renamed app will re-checkout", "app", newID, "err", err)
		a.checkoutMu.Lock()
		delete(a.checkedOut, oldID)
		a.checkoutMu.Unlock()
	}
	mirror, err := airuntime.MirrorDir(mirrorKey(a.selectedBoardID(), newID))
	if err != nil {
		drop(err)
		return
	}
	// Resolved before the move so a lookup failure can't leave the mirror half-renamed.
	target, err := resolveApp(a, newID)
	if err != nil {
		drop(err)
		return
	}
	if entry.mirror != mirror {
		if err := moveCheckout(entry.mirror, mirror); err != nil {
			drop(err)
			return
		}
	}
	entry.appPath, entry.mirror = target.Path, mirror
	a.trackRenamedCheckout(oldID, newID, entry)
}

// trackRenamedCheckout keys a moved checkout on its new id, with the holds running turns have on its parked copies.
func (a *App) trackRenamedCheckout(oldID, newID string, entry checkedApp) {
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	delete(a.checkedOut, oldID)
	a.checkedOut[newID] = entry
	for _, t := range a.turns { // the parked copies moved with the folder
		if t.parked[oldID] {
			delete(t.parked, oldID)
			t.parked[newID] = true
		}
	}
}

// resolveApp looks an app up on the selected board's orchestrator, a variable so tests run without one.
var resolveApp = func(a *App, appID string) (arduinoapps.AppTarget, error) {
	orchestratorURL, err := a.InferOrchestratorURL()
	if err != nil {
		return arduinoapps.AppTarget{}, err
	}
	return arduinoapps.ResolveApp(a.ctx(), orchestratorURL, appID)
}

// moveCheckout renames a checkout folder; one already at the new name is left by an app gone since, so it moves aside.
func moveCheckout(from, to string) error {
	if _, err := os.Lstat(to); err == nil {
		if _, err := setAsideCheckout(to); err != nil {
			return err
		}
	}
	return os.Rename(from, to)
}

// setAsideCheckout renames a checkout folder to a dot folder beside it, which no sync reads and ghost detection skips.
func setAsideCheckout(dir string) (string, error) {
	aside := filepath.Join(filepath.Dir(dir), fmt.Sprintf(".%s-%d.old", filepath.Base(dir), time.Now().UnixNano()))
	return aside, os.Rename(dir, aside)
}

// dropDeletedCheckout stops tracking a deleted app's checkout and removes its folder, or moves it aside when it may hold an edit the board never got.
func (a *App) dropDeletedCheckout(appID, boardID string, gen uint64) {
	lock := a.checkoutLock(appID)
	lock.Lock()
	defer lock.Unlock()
	a.checkoutMu.Lock()
	entry, tracked := a.checkedOut[appID]
	tracked = tracked && a.boardGen == gen // after a board change the entry is another board's app
	if tracked {
		delete(a.checkedOut, appID)
		delete(a.pendingSyncIssues, appID)
	}
	a.checkoutMu.Unlock()
	dir := entry.mirror
	if !tracked {
		var err error
		if dir, err = airuntime.MirrorDir(mirrorKey(boardID, appID)); err != nil {
			return
		}
	}
	if _, err := os.Lstat(dir); err != nil {
		return
	}
	gone := func() {
		a.checkoutMu.Lock()
		delete(a.ghostMirrors, filepath.Base(dir)) // its edits left the workspace, so they hold no switch back
		a.checkoutMu.Unlock()
	}
	why := "App Lab cannot tell what in it reached the board"
	if tracked && entry.baselined {
		why = "it holds files no sync pushed"
		if appmirror.HoldsOnlyBaseline(dir, entry.hashes) {
			err := os.RemoveAll(dir)
			if err == nil {
				gone()
				slog.Info("[mirror] removed the checkout of a deleted app", "app", appID, "dir", dir)
				return
			}
			why = fmt.Sprintf("it could not be removed: %v", err)
		}
	}
	aside, err := setAsideCheckout(dir)
	if err != nil {
		a.checkoutMu.Lock()
		if a.deletedLeftovers == nil {
			a.deletedLeftovers = map[string]bool{}
		}
		a.deletedLeftovers[dir] = true
		a.checkoutMu.Unlock()
		slog.Warn("[mirror] kept the checkout of a deleted app in place; a new checkout of that id moves it aside first", "app", appID, "dir", dir, "why", why, "err", err)
		return
	}
	gone()
	slog.Warn("[mirror] kept the checkout of a deleted app, moved aside", "app", appID, "dir", aside, "why", why)
}

// clearDeletedLeftover moves aside a deleted app's folder in the way of a new checkout: Populate keeps extra files, and a sync would push them into the new app.
func (a *App) clearDeletedLeftover(mirror string) error {
	a.checkoutMu.Lock()
	left := a.deletedLeftovers[mirror]
	a.checkoutMu.Unlock()
	if !left {
		return nil
	}
	if _, err := setAsideCheckout(mirror); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("files a deleted app of the same name left in %s could not be moved out of the way (%v): call apps_checkout again later", mirror, err)
	}
	a.checkoutMu.Lock()
	delete(a.deletedLeftovers, mirror)
	a.checkoutMu.Unlock()
	return nil
}

// refreshManagedFiles copies the board's app.yaml and sketch.yaml into a checked-out app's mirror after a tool changed them on the board.
func (a *App) refreshManagedFiles(appID string) {
	a.checkoutMu.Lock()
	c, ok := a.checkedOut[appID]
	gen := a.boardGen
	a.checkoutMu.Unlock()
	if !ok || c.readOnly {
		return
	}
	fresh := appmirror.RefreshManaged(boardFiles{app: a}, c.appPath, c.mirror, c.hashes)
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	cur, tracked := a.checkedOut[appID]
	if !tracked || a.boardGen != gen || len(fresh) == 0 {
		return
	}
	// A new map: a sync running now still reads the old one.
	hashes := make(map[string]string, len(cur.hashes)+len(fresh))
	for rel, h := range cur.hashes {
		hashes[rel] = h
	}
	for rel, h := range fresh {
		hashes[rel] = h
	}
	cur.hashes = hashes
	a.checkedOut[appID] = cur
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

// syncCheckouts pushes mirror edits back to the board (the watcher refreshes the editor); force ignores the mtime gate. The three outcomes stay apart because they call for different advice: a failed push is transient and self-heals (marked dirty, re-pushed next sync), a conflict never clears by retrying (the agent has to re-checkout), and edits withheld from a built-in app can only ever land in a clone.
// The bool is "I looked at everything": three empty maps otherwise read as "nothing to push".
func (a *App) syncCheckoutsComplete(since time.Time, force bool) (failed, conflicts, withheld map[string]error, complete bool) {
	failed, conflicts, withheld, _ = a.syncCheckouts(since, force, nil)
	a.checkoutMu.Lock()
	stopped := a.syncStoppedEarly
	a.syncStoppedEarly = false
	a.checkoutMu.Unlock()
	return failed, conflicts, withheld, !stopped
}

// keep picks the apps a run pushes (nil: all); notes are per app, for the caller to hand to the chats they concern.
func (a *App) syncCheckouts(since time.Time, force bool, keep func(appID string) bool) (failed, conflicts, withheld map[string]error, notes map[string][]string) {
	a.checkoutMu.Lock()
	// Cleared per run, not by its one reader: a stale flag refused the next switch with nothing unsaved.
	a.syncStoppedEarly = false
	snapshot := make(map[string]checkedApp, len(a.checkedOut))
	for id, c := range a.checkedOut {
		snapshot[id] = c
	}
	gen := a.boardGen
	a.checkoutMu.Unlock()
	addNote := func(appID, text string) {
		if notes == nil {
			notes = map[string][]string{}
		}
		notes[appID] = append(notes[appID], text)
	}

	for appID, c := range snapshot {
		// A turn's deferred sync can outlive the board it was for: writing now would push these files over the next board's connection (X2), so drop it.
		if a.boardChanged(gen) {
			a.checkoutMu.Lock()
			a.syncStoppedEarly = true
			a.checkoutMu.Unlock()
			return failed, conflicts, withheld, notes
		}
		if keep != nil && !keep(appID) {
			if !since.IsZero() && mirrorEditedSince(c.mirror, since) {
				lock := a.checkoutLock(appID) // a sync of this app running now writes the flag too
				lock.Lock()
				a.checkoutMu.Lock()
				if cur, tracked := a.checkedOut[appID]; tracked {
					cur.dirty = true
					a.checkedOut[appID] = cur
				}
				a.checkoutMu.Unlock()
				lock.Unlock()
			}
			continue
		}
		lock := a.checkoutLock(appID)
		lock.Lock()
		// Read again under the lock: a checkout reset may have swapped the folder and its baseline since the snapshot.
		a.checkoutMu.Lock()
		cur, tracked := a.checkedOut[appID]
		a.checkoutMu.Unlock()
		if !tracked {
			lock.Unlock()
			continue
		}
		c = cur
		// A built-in app's or a release's board copy is read-only: never push, and report the withheld edits so silence can't read as success.
		if c.readOnly {
			if c.editedLocally() {
				if withheld == nil {
					withheld = map[string]error{}
				}
				withheld[appID] = fmt.Errorf("this app is read-only on the board (a built-in example, an installed App release, or an app outside the user's apps folder), so these edits were not applied")
			}
			lock.Unlock()
			continue
		}
		// A clean checkout with no edits since Populate has nothing to flush — don't rewrite a whole untouched app over the board link.
		if force && !c.dirty && !mirrorEditedSince(c.mirror, c.baseline) {
			lock.Unlock()
			continue
		}
		res, err := appmirror.SyncBack(boardFiles{app: a}, c.appPath, c.mirror, syncThreshold(since, c, force), c.hashes)
		a.checkoutMu.Lock()
		if cur, tracked := a.checkedOut[appID]; tracked {
			// Adopt the baseline even on failure: it keeps the advances verified before the error, which a retry would otherwise misread as conflicts.
			cur.hashes = res.NewBase
			cur.dirty = err != nil
			a.checkedOut[appID] = cur
		}
		// A forced sync runs mid-turn, and a running turn may not have re-applied its parked copies yet.
		expire := err == nil && !force && !a.parkedHeldLocked(appID)
		a.checkoutMu.Unlock()
		if expire {
			appmirror.RemoveParked(c.mirror) // still under the app's lock: a checkout cannot park a copy between the check and the removal
		}
		lock.Unlock()
		if len(res.Withheld) > 0 {
			slog.Info("[sync] withheld agent edits to files App Lab manages", "app", appID, "files", res.Withheld)
			addNote(appID, withheldManagedNote(appID, res.Withheld))
		}
		if len(res.Unpaired) > 0 {
			slog.Info("[sync] held back a sketch file added or removed without the other one", "app", appID, "files", res.Unpaired)
			addNote(appID, unpairedSketchNote(appID, res.Unpaired))
		}
		// A run can conflict AND fail; the two carry opposite advice, so neither may shadow the other.
		var cErr error
		if len(res.Conflicts) > 0 {
			slog.Warn("agent mirror sync-back conflict", "app", appID, "files", res.Conflicts)
			cErr = fmt.Errorf("changed on the board since checkout, so the agent's edits were not applied: %s (re-run apps_checkout to pick up the board's version; the conflicting edits are preserved next to it as %s files to re-apply)", strings.Join(res.Conflicts, ", "), appmirror.ParkedSuffix)
			if conflicts == nil {
				conflicts = map[string]error{}
			}
			conflicts[appID] = cErr
		}
		a.recordSyncIssue(appID, err, cErr)
		if err != nil {
			slog.Warn("agent mirror sync-back failed", "app", appID, "err", err)
			if failed == nil {
				failed = map[string]error{}
			}
			failed[appID] = err
			continue
		}
		if force || len(res.Written) > 0 {
			slog.Info("[sync] pushed mirror to board", "app", appID, "force", force, "written", len(res.Written), "conflicts", len(res.Conflicts))
		}
	}
	return failed, conflicts, withheld, notes
}

// editedLocally lets the hashes decide on a baselined checkout: a re-checkout of a read-only app rewrites every file, so file times say nothing.
func (c checkedApp) editedLocally() bool {
	if c.baselined {
		return !appmirror.MatchesBaseline(c.mirror, c.hashes)
	}
	return mirrorEditedSince(c.mirror, c.baseline)
}

// agentTurn is one AgentPrompt: when it started, and its error once done is closed.
type agentTurn struct {
	since  time.Time
	done   chan struct{}
	err    error
	parked map[string]bool // apps whose parked copies this turn may still re-apply; guarded by checkoutMu
}

func (t *agentTurn) running() bool {
	select {
	case <-t.done:
		return false
	default:
		return true
	}
}

// holdParkedLocked keeps an app's parked copies for every running turn, as the board MCP server cannot tell which chat called apps_checkout; call under checkoutMu.
func (a *App) holdParkedLocked(appID string) {
	for _, t := range a.turns {
		if !t.running() {
			continue
		}
		if t.parked == nil {
			t.parked = map[string]bool{}
		}
		t.parked[appID] = true
	}
}

// parkedHeldLocked reports whether a running turn may still re-apply the app's parked copies; call under checkoutMu.
func (a *App) parkedHeldLocked(appID string) bool {
	for _, t := range a.turns {
		if t.parked[appID] && t.running() {
			return true
		}
	}
	return false
}

// releaseParked drops the turn's hold on parked copies when it ends: a finished turn re-applies nothing.
func (a *App) releaseParked(t *agentTurn) {
	a.checkoutMu.Lock()
	t.parked = nil
	a.checkoutMu.Unlock()
}

// beginTurn records a session's new turn, replacing its last one.
func (a *App) beginTurn(sessionID string) *agentTurn {
	t := &agentTurn{since: time.Now(), done: make(chan struct{})}
	a.checkoutMu.Lock()
	if a.turns == nil {
		a.turns = map[string]*agentTurn{}
	}
	a.turns[sessionID] = t
	a.checkoutMu.Unlock()
	return t
}

// finishTurn records the turn's outcome, then releases whoever awaits it.
func (a *App) finishTurn(t *agentTurn, err error) {
	a.checkoutMu.Lock()
	t.err = err
	a.checkoutMu.Unlock()
	close(t.done)
}

// earliestTurnStart is the oldest running turn's start (zero with none): a mirror adopted from a later one would hide what an older turn wrote.
func (a *App) earliestTurnStart() time.Time {
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	var earliest time.Time
	for _, t := range a.turns {
		select {
		case <-t.done:
			continue
		default:
		}
		if earliest.IsZero() || t.since.Before(earliest) {
			earliest = t.since
		}
	}
	return earliest
}

// appsOf is the set of apps a turn touched: the ones its board tools named, and the checkouts holding the files it edited.
func (a *App) appsOf(apps, paths []string) map[string]bool {
	out := make(map[string]bool, len(apps))
	for _, app := range apps {
		out[app] = true
	}
	if len(paths) == 0 {
		return out
	}
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	for _, p := range paths {
		for appID, c := range a.checkedOut {
			if pathWithin(c.mirror, p) {
				out[appID] = true
				break
			}
		}
	}
	return out
}

// pathWithin reports whether path sits inside dir; both are absolute, and ".." cannot walk out.
func pathWithin(dir, path string) bool {
	rel, err := filepath.Rel(dir, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

// turnEndKeep skips only an app another running turn touched and this one did not; an app both touched is pushed, as holding it would strand this turn's edits.
func turnEndKeep(mine, others map[string]bool) func(appID string) bool {
	return func(appID string) bool { return mine[appID] || !others[appID] }
}

// noteRecipients picks the sessions a note about an app goes to: those whose turn edited it, else the one that synced it.
func noteRecipients(appID, self string, edited map[string]map[string]bool) []string {
	var out []string
	for sid, apps := range edited {
		if apps[appID] {
			out = append(out, sid)
		}
	}
	if len(out) == 0 {
		return []string{self}
	}
	sort.Strings(out)
	return out
}

// workspaceMirrorDir is where an app's checkout lives, computed from the id alone: the permission layer needs it before any checkout exists.
func (a *App) workspaceMirrorDir(appID string) string {
	if strings.TrimSpace(appID) == "" {
		return ""
	}
	dir, err := airuntime.MirrorDir(mirrorKey(a.selectedBoardID(), appID))
	if err != nil {
		return ""
	}
	return dir
}

// mirrorKey turns a board + app id into a filesystem-safe dir name: app ids repeat across boards, so one key alone would reuse board A's mirror for board B's app of the same name. It separates the copies on disk, but doesn't make unflushed edits recoverable — A → B → A finds no checkout entry and re-Populates.
func mirrorKey(boardID, appID string) string {
	if boardID == "" {
		return mirrorAppSegment(appID) // no board identity (SBC/placeholder): app-only key
	}
	san := strings.NewReplacer(":", "-", "/", "-", "\\", "-")
	return san.Replace(boardID) + "__" + mirrorAppSegment(appID)
}

// mirrorAppSegment names the app's mirror dir readably — the agent retypes these paths and raw base64 ids get mangled into stranded ghost dirs — by decoding the id (base64 of "type:name") and suffixing a hash of the raw id so distinct ids never collide through sanitization.
func mirrorAppSegment(appID string) string {
	name := appID
	if dec, err := base64.RawStdEncoding.DecodeString(appID); err == nil {
		name = string(dec)
	} else if dec, err := base64.StdEncoding.DecodeString(appID); err == nil {
		name = string(dec)
	}
	sum := sha256.Sum256([]byte(appID))
	suffix := hex.EncodeToString(sum[:3])
	if seg := sanitizeMirrorSegment(name); seg != "" {
		return seg + "-" + suffix
	}
	return suffix
}

// checkoutAppName names the app whose checkout folder holds path, from its id or else its folder name; "" outside every checkout folder.
func (a *App) checkoutAppName(path string) string {
	root, err := airuntime.MirrorRootDir()
	if err != nil {
		return ""
	}
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return ""
	}
	folder, _, inFolder := strings.Cut(filepath.ToSlash(rel), "/")
	if !inFolder || folder == ".." || strings.HasPrefix(folder, ".") {
		return ""
	}
	a.checkoutMu.Lock()
	appID := ""
	for id, c := range a.checkedOut {
		if filepath.Base(c.mirror) == folder {
			appID = id
			break
		}
	}
	a.checkoutMu.Unlock()
	if name := appIDName(appID); name != "" {
		return name
	}
	return folderAppName(folder)
}

// appIDName is the name inside an app id (base64 of "type:name"), the board folder the app lives in; "" when it does not decode.
func appIDName(appID string) string {
	trimmed := strings.TrimRight(appID, "=")
	for _, enc := range []*base64.Encoding{base64.RawURLEncoding, base64.RawStdEncoding} {
		if dec, err := enc.DecodeString(trimmed); err == nil {
			if _, name, ok := strings.Cut(string(dec), ":"); ok && name != "" {
				return path.Base(name)
			}
		}
	}
	return ""
}

// folderAppName reads the app back from a checkout folder name (see mirrorKey): no board prefix, no hash suffix, no "user-".
func folderAppName(folder string) string {
	name := folder
	if i := strings.LastIndex(name, "__"); i >= 0 {
		name = name[i+len("__"):]
	}
	if i := strings.LastIndex(name, "-"); i >= 0 && len(name)-i-1 == 6 {
		name = name[:i]
	}
	if trimmed := strings.TrimPrefix(name, "user-"); trimmed != "" {
		name = trimmed
	}
	return name
}

// sanitizeMirrorSegment maps anything outside [A-Za-z0-9._-] to '-', collapses dash runs, trims edge '-'/'.' and caps at 40 chars.
func sanitizeMirrorSegment(s string) string {
	var b strings.Builder
	dash := false
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '.', r == '_':
			b.WriteRune(r)
			dash = false
		case !dash:
			b.WriteByte('-')
			dash = true
		}
	}
	out := strings.Trim(b.String(), "-.")
	if len(out) > 40 {
		out = strings.Trim(out[:40], "-.")
	}
	return out
}

// boardChangedReason marks the teardown reason on the restart event, so the reconnect prompt can explain itself.
const boardChangedReason = "board-changed"

// boardFlashedReason is the flash teardown. It is the same board, so the prompt must not say it changed, and a
// board switch the user confirmed must not be spent reviving the agent onto a board that is still rebooting.
const boardFlashedReason = "board-flashed"

// detachAgentForBoardChange unbinds the agent from the board that is about to be replaced. The order matters: pending
// mirror edits are pushed while the OLD board's connection is still up (afterwards they would land on the new board at
// the old board's paths — X2); then the agent is stopped, both because its system prompt describes the old board (X11)
// and so none of its goroutines reads selectedBoard while it is reassigned (W1); then the checkouts are dropped, since
// they mirror files that belong to the board we are leaving.
// It reports whether an agent was actually torn down; announcing that is the caller's job, and must wait until the new
// board is in place — the frontend restarts the agent on that event, and a restart racing the assignment would snapshot
// the board it was told about (X11 again).
func (a *App) detachAgentForBoardChange() bool {
	// The flush below runs for seconds over the connection, and the answer is read at both ends of it: an agent
	// that crashes out or is stopped in that window still has to be announced, or the sidebar keeps the previous
	// board's chats, and one the user opened during it is torn down here and has to be announced too.
	a.agentMu.Lock()
	running := a.agentMgr != nil
	a.agentMu.Unlock()

	if failed, _, _, _ := a.syncCheckouts(time.Time{}, true, nil); len(failed) > 0 {
		// The edits stay in the mirror, which is keyed by board, so they are still there if the user comes back.
		slog.Warn("[board] could not flush agent edits before the board change", "apps", flushFailureSummary(failed))
	}
	return a.dropAgent() || running
}

// dropAgent stops the agent and forgets its checkouts without flushing: for a board that was just flashed, a flush would push pre-flash files onto a wiped, rebooting board.
func (a *App) dropAgent() bool {
	a.agentMu.Lock()
	running := a.agentMgr != nil
	a.stopAgentLocked()
	a.agentMu.Unlock()

	a.checkoutMu.Lock()
	a.checkedOut = map[string]checkedApp{}
	a.boardGen++ // anything already in flight for the old board must not land on the new one
	a.checkoutMu.Unlock()

	return running
}

// boardChanged reports whether the selected board was swapped since gen was taken.
func (a *App) boardChanged(gen uint64) bool {
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	return a.boardGen != gen
}

// selectedBoardID identifies the selected board for mirror keying (serial, or address for a network board).
func (a *App) selectedBoardID() string {
	sb := a.boardSnapshot()
	return boardIdentity(sb.Info.Serial, sb.Info.Address)
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

// mirrorDirClass buckets an edited dir under the mirror root at reattach time.
type mirrorDirClass int

const (
	mirrorDirSkip     mirrorDirClass = iota // dot-dir (.claude is the agent runtime's own), tracked, or a transient board failure
	mirrorDirReattach                       // reverse-maps to a board app: adopt it so its edits sync back
	mirrorDirGhost                          // matches no board app: the agent's edits are stranded off any checkout
)

// classifyMirrorDir decides an edited dir's fate; lookup runs the reverse-map lazily so tracked/dot dirs never hit the board, and its error means "can't tell this turn", never "ghost".
func classifyMirrorDir(name string, tracked bool, lookup func() (bool, error)) mirrorDirClass {
	if tracked || strings.HasPrefix(name, ".") {
		return mirrorDirSkip
	}
	ok, err := lookup()
	switch {
	case err != nil:
		return mirrorDirSkip
	case ok:
		return mirrorDirReattach
	default:
		return mirrorDirGhost
	}
}

// reattachEditedMirrors registers persisted mirror dirs the agent edited this turn but never checked out
// (checkedOut is in-memory), so syncCheckouts propagates their edits back to the board instead of stranding them.
// Edited dirs matching no board app are recorded as ghosts, so tools can warn that those edits are not on the board.
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
	present := make(map[string]bool, len(entries))
	ghosts := map[string]bool{}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		present[name] = true
		mirror := filepath.Join(root, name)
		if !mirrorEditedSince(mirror, since) {
			continue
		}
		var appID string
		switch classifyMirrorDir(name, tracked[name], func() (bool, error) {
			if orchestratorURL == "" {
				u, err := a.InferOrchestratorURL()
				if err != nil {
					return false, err
				}
				orchestratorURL = u
			}
			id, ok, err := a.appIDForMirrorKey(orchestratorURL, name)
			appID = id
			return ok, err
		}) {
		case mirrorDirGhost:
			ghosts[name] = true
		case mirrorDirReattach:
			target, err := arduinoapps.ResolveApp(a.ctx(), orchestratorURL, appID)
			if err != nil {
				continue
			}
			a.checkoutMu.Lock()
			if _, exists := a.checkedOut[appID]; !exists {
				// baseline=since → SyncBack writes only this turn's edits; no hashes → no deletion propagation, and not baselined, so the mtime gate stays.
				a.checkedOut[appID] = checkedApp{appPath: target.Path, mirror: mirror, baseline: since, hashes: map[string]string{}, readOnly: target.ReadOnly}
			}
			delete(a.ghostMirrors, name)
			a.checkoutMu.Unlock()
		}
	}

	a.recordGhostMirrors(present, ghosts)
}

// recordGhostMirrors merges newly-detected ghosts (logging once each) and drops entries whose dir vanished; a
// re-detected ghost re-arms its warning, so the agent hears about each edit burst once instead of forever.
func (a *App) recordGhostMirrors(present, ghosts map[string]bool) {
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	for name := range a.ghostMirrors {
		if !present[name] {
			delete(a.ghostMirrors, name)
		}
	}
	for name := range ghosts {
		if _, known := a.ghostMirrors[name]; !known {
			slog.Warn("agent edits are stranded in a mirror dir that matches no board app", "dir", name)
		}
		a.ghostMirrors[name] = false
	}
}

// dueGhostWarnings returns the ghosts whose warning hasn't been delivered yet and marks them delivered.
func (a *App) dueGhostWarnings() []string {
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	out := make([]string, 0, len(a.ghostMirrors))
	for name, warned := range a.ghostMirrors {
		if !warned {
			out = append(out, name)
			a.ghostMirrors[name] = true
		}
	}
	sort.Strings(out)
	return out
}

// sweepGhostMirrors is the on-demand (mid-turn) ghost detector: unlike reattachEditedMirrors it never adopts mappable dirs — reattach stays a turn-end concern — it only records stranded ones.
func (a *App) sweepGhostMirrors() {
	since := a.earliestTurnStart()
	if since.IsZero() { // no turn runs, so nothing was agent-written
		return
	}
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
	tracked := make(map[string]bool, len(a.checkedOut))
	for id := range a.checkedOut {
		tracked[mirrorKey(boardID, id)] = true
	}
	a.checkoutMu.Unlock()

	orchestratorURL := ""
	present := make(map[string]bool, len(entries))
	ghosts := map[string]bool{}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		present[name] = true
		if !mirrorEditedSince(filepath.Join(root, name), since) {
			continue
		}
		if classifyMirrorDir(name, tracked[name], func() (bool, error) {
			if orchestratorURL == "" {
				u, err := a.InferOrchestratorURL()
				if err != nil {
					return false, err
				}
				orchestratorURL = u
			}
			_, ok, err := a.appIDForMirrorKey(orchestratorURL, name)
			return ok, err
		}) == mirrorDirGhost {
			ghosts[name] = true
		}
	}
	a.recordGhostMirrors(present, ghosts)
}

// pendingGhostEdits sweeps for ghosts written this turn before snapshotting — apps_start/apps_clone/board_exec fire mid-turn, and the turn-end sweep would warn one turn too late — returning the dirs sorted so warnings render stably.
func (a *App) pendingGhostEdits() []string {
	a.sweepGhostMirrors()
	return a.dueGhostWarnings()
}

// syncIssue holds an app's pending sync warnings: the failure half clears on any clean sync, the conflict half only
// on a successful re-checkout — a quiet sync proves nothing about a conflict its mtime gate never re-read.
type syncIssue struct {
	fail     string
	conflict string
}

// recordSyncIssue keeps the latest sync failure/conflict per app for tool-result warnings; a clean sync clears only the failure half.
func (a *App) recordSyncIssue(appID string, failed, conflict error) {
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	cur := a.pendingSyncIssues[appID]
	cur.fail = ""
	if failed != nil {
		cur.fail = fmt.Sprintf("warning: edits to app %s from a previous turn did NOT reach the board: %v — they will be re-pushed automatically at the next sync or app start; check the board connection.", appID, failed)
	}
	if conflict != nil {
		cur.conflict = fmt.Sprintf("warning: edits to app %s from a previous turn did NOT reach the board: %v", appID, conflict)
	}
	if cur == (syncIssue{}) {
		delete(a.pendingSyncIssues, appID)
		return
	}
	a.pendingSyncIssues[appID] = cur
}

// withheldManagedNote tells the agent which tool makes the change it tried by editing a managed file; said once, as the sync already reset the file.
func withheldManagedNote(appID string, files []string) string {
	return fmt.Sprintf("warning: your edits to %s in app %s were NOT applied, and the checkout matches the board again: App Lab changes these files only through its own tools. Use apps_edit for the name, icon or description, app_bricks_add/app_bricks_update/app_bricks_remove for bricks, and sketch_libraries_add/sketch_libraries_remove for sketch libraries. If no tool covers the change, tell the user it cannot be made from the chat.", strings.Join(files, ", "), appID)
}

// unpairedSketchNote tells the agent why its change to one of the two sketch files did not reach the board; said once, like withheldManagedNote.
func unpairedSketchNote(appID string, files []string) string {
	return fmt.Sprintf("warning: the change to %s in app %s was NOT applied, and the checkout matches the board again: an app whose sketch/ holds only one of sketch.ino and sketch.yaml does not load. To add or remove the sketch, write or delete both files together.", strings.Join(files, ", "), appID)
}

// clearConflictIssue drops an app's sticky conflict warning: a successful (re-)checkout is what actually resolves it.
func (a *App) clearConflictIssue(appID string) {
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	cur, ok := a.pendingSyncIssues[appID]
	if !ok {
		return
	}
	cur.conflict = ""
	if cur == (syncIssue{}) {
		delete(a.pendingSyncIssues, appID)
		return
	}
	a.pendingSyncIssues[appID] = cur
}

// pendingSyncWarnings snapshots the per-app sync warnings, sorted by app id so they render stably.
func (a *App) pendingSyncWarnings() []string {
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	ids := make([]string, 0, len(a.pendingSyncIssues))
	for id := range a.pendingSyncIssues {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		iss := a.pendingSyncIssues[id]
		if iss.fail != "" {
			out = append(out, iss.fail)
		}
		if iss.conflict != "" {
			out = append(out, iss.conflict)
		}
	}
	return out
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
