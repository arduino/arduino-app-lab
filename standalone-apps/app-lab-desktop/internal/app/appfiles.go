package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"

	"app-lab-desktop/internal/appmirror"
	"app-lab-desktop/internal/arduinoapps"
	"app-lab-desktop/internal/board"
	"app-lab-desktop/internal/fs"
	"app-lab-desktop/internal/lsp"
)

// appAgentRenamedFileEvent tells the FE the agent renamed or moved a file or folder, so its open tabs follow as after a rename in the file tree.
const appAgentRenamedFileEvent = "app:agent-renamed-file"

// errBoardChanged stops a tool that checked one board from changing the next.
var errBoardChanged = errors.New("the board changed during the operation, so nothing was changed")

// RenameAppFile renames a file or folder of a user app on the board, then checks the app out again (see boardmcp.BoardAccess).
func (b boardAccess) RenameAppFile(ctx context.Context, appID, from, to string) (string, error) {
	gen := b.app.boardGeneration()
	appPath, err := b.app.writableAppPath(ctx, appID)
	if err != nil {
		return "", err
	}
	if err := b.app.refuseStaleCheckout(appID, from); err != nil {
		return "", err
	}
	isDir, err := b.app.renameAppPath(appPath, from, to, gen)
	if err != nil {
		return "", err
	}
	// The rename holds the watcher off its paths, as the file tree's does: this event is what moves the open tabs.
	b.app.emit(appAgentRenamedFileEvent, appID, appPath, from, to, isDir)
	return b.app.resetCheckout(appID), nil
}

// DeleteAppFile deletes a file or folder of a user app on the board, then checks the app out again (see boardmcp.BoardAccess).
func (b boardAccess) DeleteAppFile(ctx context.Context, appID, rel string) (string, error) {
	gen := b.app.boardGeneration()
	appPath, err := b.app.writableAppPath(ctx, appID)
	if err != nil {
		return "", err
	}
	if err := b.app.refuseStaleCheckout(appID, rel); err != nil {
		return "", err
	}
	if err := b.app.deleteAppPath(appPath, rel, gen); err != nil {
		return "", err
	}
	return b.app.resetCheckout(appID), nil
}

// boardGeneration reads the counter a board switch bumps.
func (a *App) boardGeneration() uint64 {
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	return a.boardGen
}

// writableAppPath resolves a user app's folder on the board, refusing an app whose files are read-only.
func (a *App) writableAppPath(ctx context.Context, appID string) (string, error) {
	orchestratorURL, err := a.InferOrchestratorURL()
	if err != nil {
		return "", err
	}
	target, err := arduinoapps.ResolveApp(ctx, orchestratorURL, appID)
	if err != nil {
		return "", err
	}
	if target.ReadOnly {
		return "", fmt.Errorf("this app is read-only: its files on the board cannot be changed. To change them, apps_clone it and change the copy")
	}
	return target.Path, nil
}

// renameAppPath renames or moves a file or folder inside the app folder at appPath; from and to are relative to it.
func (a *App) renameAppPath(appPath, from, to string, gen uint64) (isDir bool, err error) {
	conn := a.boardConn()
	if conn == nil {
		return false, fmt.Errorf("no board connected")
	}
	src, _, err := appEntry(conn, appPath, from, "")
	if err != nil {
		return false, err
	}
	if src == nil {
		return false, fmt.Errorf("%s does not exist in this app", from)
	}
	dst, parentExists, err := appEntry(conn, appPath, to, from)
	if err != nil {
		return false, err
	}
	// mv -n would move the source into an existing folder, and skip an existing file without an error.
	if dst != nil {
		return false, fmt.Errorf("%s already exists in this app: ask the user for another name, or whether to delete it first", to)
	}
	if a.boardChanged(gen) {
		return false, errBoardChanged
	}
	// mv needs the destination folder; the watcher shows a new one in the tree.
	if !parentExists {
		if err := a.CreateFolder(path.Join(appPath, path.Dir(to)), false); err != nil {
			return false, err
		}
	}
	fromAbs, toAbs := path.Join(appPath, from), path.Join(appPath, to)
	inode, err := boardInode(conn, fromAbs)
	if err != nil {
		return false, err
	}
	moveErr := a.moveOnBoard(conn, fromAbs, toAbs)
	// A rename keeps the inode, so the destination says whether the source moved, even if an editor save has recreated the source since.
	at, err := boardInode(conn, toAbs)
	if err != nil {
		if moveErr != nil {
			return false, moveErr
		}
		return false, fmt.Errorf("could not check that %s was renamed: %w", from, err)
	}
	// mv -n leaves a taken name alone: GNU mv 9.2 to 9.4 then fail, the other versions skip without an error.
	if at != inode {
		return false, fmt.Errorf("%s already exists in this app: ask the user for another name, or whether to delete it first", to)
	}
	// The editor's language servers read a copy of the open app, which no watcher event updates after a move.
	if !board.IsSBC() && a.watcher != nil && a.watcher.WatchesApp(appPath) {
		lsp.RenameWorkspacePath(fromAbs, toAbs)
	}
	return src.IsDir, nil
}

// moveTimeout bounds a stuck adb or local command (SSH ignores the context); the mv itself only rewrites directory entries.
const moveTimeout = time.Minute

// moveOnBoard is one mv, not the file tree's RenameFolder: its copy then delete can lose files, and an editor save that lands mid-copy.
func (a *App) moveOnBoard(conn remote.RemoteConn, fromAbs, toAbs string) error {
	// Held as the file tree holds them, so the watcher does not close the tabs the rename event moves.
	a.suppressHold(fromAbs, toAbs)
	defer a.suppressRelease(fromAbs, toAbs)
	ctx, cancel := context.WithTimeout(context.Background(), moveTimeout)
	defer cancel()
	// -n: a name the listing misread as free is never replaced.
	if out, err := conn.GetCmd("mv", "-n", "--", fromAbs, toAbs).Output(ctx); err != nil {
		return fmt.Errorf("could not rename %s: %w: %s", path.Base(fromAbs), err, strings.TrimSpace(string(out)))
	}
	return nil
}

// boardInode reads the inode of a board path, which a rename keeps and a new file does not.
func boardInode(conn remote.RemoteConn, abs string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), moveTimeout)
	defer cancel()
	out, err := conn.GetCmd("ls", "-di", "--", abs).Output(ctx)
	if err == nil {
		// adb mixes its own notices, such as a daemon restart, into the output.
		for _, line := range strings.Split(string(out), "\n") {
			if fields := strings.Fields(line); len(fields) > 1 && strings.Trim(fields[0], "0123456789") == "" {
				return fields[0], nil
			}
		}
	}
	return "", fmt.Errorf("could not read %s on the board: %v: %s", path.Base(abs), err, strings.TrimSpace(string(out)))
}

// deleteAppPath deletes a file or folder inside the app folder at appPath; the watcher closes its tabs and updates the open app's LSP copy.
func (a *App) deleteAppPath(appPath, rel string, gen uint64) error {
	conn := a.boardConn()
	if conn == nil {
		return fmt.Errorf("no board connected")
	}
	entry, _, err := appEntry(conn, appPath, rel, "")
	if err != nil {
		return err
	}
	if entry == nil {
		return fmt.Errorf("%s does not exist in this app", rel)
	}
	if a.boardChanged(gen) {
		return errBoardChanged
	}
	// The board side of the file tree's RemoveFile: its LSP step would delete the open app's file at the same path, whatever app this is.
	return conn.Remove(path.Join(appPath, rel))
}

// appEntry walks rel through the app folder one listing at a time (file -L calls a folder whose name holds ':' a file), returning the entry or nil, and whether its folder exists.
func appEntry(conn remote.RemoteConn, appPath, rel, source string) (*remote.FileInfo, bool, error) {
	dir, walked := appPath, ""
	parts := strings.Split(rel, "/")
	for i, name := range parts {
		entries, err := fs.ListConnEntries(conn, dir)
		if err != nil {
			return nil, false, err
		}
		walked = path.Join(walked, name)
		entry := findEntry(entries, name)
		if entry == nil {
			if clash := caseTwin(entries, name, path.Dir(walked), source); clash != "" {
				return nil, false, fmt.Errorf("%s differs only in letter case from %s, and a checkout on macOS or Windows cannot tell them apart: pick another name", walked, clash)
			}
			return nil, i == len(parts)-1, nil
		}
		if i == len(parts)-1 {
			return entry, true, nil
		}
		// mv and rm act on a symlink itself, but a path through one would act wherever it points.
		if entry.IsSymlink {
			return nil, false, fmt.Errorf("%s is a symbolic link, and these tools do not follow links: it could lead outside the app", walked)
		}
		if !entry.IsDir {
			return nil, false, fmt.Errorf("%s is a file, not a folder", walked)
		}
		dir = path.Join(dir, name)
	}
	return nil, false, nil
}

func findEntry(entries []remote.FileInfo, name string) *remote.FileInfo {
	for i := range entries {
		if entries[i].Name == name {
			return &entries[i]
		}
	}
	return nil
}

// caseTwin names the entry a new name differs from only in letter case, other than the rename's own source; "" when source is empty, which a walk to an existing path passes.
func caseTwin(entries []remote.FileInfo, name, dir, source string) string {
	if source == "" {
		return ""
	}
	for _, e := range entries {
		if twin := path.Join(dir, e.Name); strings.EqualFold(e.Name, name) && twin != source {
			return twin
		}
	}
	return ""
}

// refuseStaleCheckout stops a tool when a checkout an earlier run left on disk holds the path: deleting it there may lose edits, keeping it would push them back.
func (a *App) refuseStaleCheckout(appID, rel string) error {
	a.checkoutMu.Lock()
	_, tracked := a.checkedOut[appID]
	a.checkoutMu.Unlock()
	dir := a.workspaceMirrorDir(appID)
	if tracked || dir == "" {
		return nil
	}
	if _, err := os.Lstat(filepath.Join(dir, filepath.FromSlash(rel))); err != nil {
		return nil
	}
	return fmt.Errorf("a local copy of this app from an earlier session still holds %s: call apps_checkout for this app first, then try again", rel)
}

// resetCheckout swaps a fresh checkout in after a tool renamed or deleted files on the board, unless the old one holds changes the board lacks.
func (a *App) resetCheckout(appID string) string {
	a.checkoutMu.Lock()
	c, tracked := a.checkedOut[appID]
	gen := a.boardGen
	a.checkoutMu.Unlock()
	if !tracked {
		return ""
	}
	// Filled beside the old checkout, which stays tracked meanwhile: a sync walking that one still finds every file it knows.
	stamp := fmt.Sprintf(".%s-%d", filepath.Base(c.mirror), time.Now().UnixNano())
	fresh, aside := filepath.Join(filepath.Dir(c.mirror), stamp+".new"), filepath.Join(filepath.Dir(c.mirror), stamp+".old")
	err := os.MkdirAll(fresh, 0o755)
	var hashes map[string]string
	if err == nil {
		hashes, err = appmirror.Populate(boardFiles{app: a}, c.appPath, fresh)
	}
	if err == nil {
		lock := a.checkoutLock(appID)
		lock.Lock()
		err = a.swapInCheckout(appID, c, fresh, aside, gen, hashes)
		lock.Unlock()
	}
	if err != nil {
		_ = os.RemoveAll(fresh)
		return fmt.Sprintf("Your checkout of this app could not be refreshed (%v): call apps_checkout before you edit its files.", err)
	}
	a.clearConflictIssue(appID)
	return "Your checkout of this app was refreshed from the board: read a file again before you edit it."
}

// swapInCheckout replaces the old checkout and its baseline with the fresh ones; the caller holds the app's checkout lock, so no sync is walking either folder.
func (a *App) swapInCheckout(appID string, old checkedApp, fresh, aside string, gen uint64, hashes map[string]string) error {
	a.checkoutMu.Lock()
	cur, tracked := a.checkedOut[appID]
	a.checkoutMu.Unlock()
	// A sync or a checkout since the fill began may have changed what the fresh copy should hold.
	if !tracked || cur.mirror != old.mirror || !maps.Equal(cur.hashes, old.hashes) || a.boardChanged(gen) {
		return errors.New("the checkout or the board changed meanwhile")
	}
	// An edit, a new file or a deletion that no sync pushed yet, from any session, would go with the old folder.
	if !appmirror.MatchesBaseline(cur.mirror, cur.hashes) {
		return errors.New("the checkout holds changes the board does not have yet")
	}
	swapStart := time.Now()
	if err := os.Rename(old.mirror, aside); err != nil {
		return err
	}
	if err := os.Rename(fresh, old.mirror); err != nil {
		if rerr := os.Rename(aside, old.mirror); rerr != nil {
			// Something created the folder again meanwhile: tracked like a reattached checkout, a sync only pushes newer writes and deletes nothing.
			a.checkoutMu.Lock()
			if a.boardGen == gen {
				a.checkedOut[appID] = checkedApp{appPath: old.appPath, mirror: old.mirror, baseline: swapStart, hashes: map[string]string{}}
			}
			a.checkoutMu.Unlock()
			slog.Warn("agent mirror reset could not put the old checkout back", "path", aside, "err", rerr)
		}
		return err
	}
	keepParkedCopies(aside, old.mirror)
	// A dot folder left behind is never synced, and ghost detection skips it.
	if err := os.RemoveAll(aside); err != nil {
		slog.Warn("agent mirror left an old checkout behind", "path", aside, "err", err)
	}
	a.checkoutMu.Lock()
	if a.boardGen == gen {
		a.checkedOut[appID] = checkedApp{appPath: old.appPath, mirror: old.mirror, baseline: time.Now(), hashes: hashes, baselined: true}
	}
	a.checkoutMu.Unlock()
	return nil
}

// keepParkedCopies moves the conflict copies the agent was told to re-apply into the fresh checkout.
func keepParkedCopies(oldRoot, newRoot string) {
	_ = filepath.WalkDir(oldRoot, func(p string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(d.Name(), appmirror.ParkedSuffix) {
			return nil
		}
		rel, err := filepath.Rel(oldRoot, p)
		if err != nil {
			return nil
		}
		dst := filepath.Join(newRoot, rel)
		if os.MkdirAll(filepath.Dir(dst), 0o755) == nil {
			_ = os.Rename(p, dst)
		}
		return nil
	})
}
