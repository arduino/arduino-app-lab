// Package appmirror keeps a local working copy of a board app's files so the agent can edit them with its
// native tools, then syncs the edits back to the board. The board stays authoritative and App Lab does all
// board I/O; this only moves bytes between a local dir and the board over the BoardFS seam.
package appmirror

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

// BoardFS is the board-side file access the mirror needs, implemented by App Lab over its board connection.
// Kept minimal so the mirror stays decoupled/testable and a future LSP-shared workspace can back it.
type BoardFS interface {
	// ListFiles returns the absolute board paths of every file (no directories) under root. A walk that read
	// everything but a few subtrees returns those paths together with an error implementing partialListing.
	ListFiles(root string) ([]string, error)
	ReadFile(path string) (string, error)
	// WriteFile writes a file on the board; the parent directory must already exist (see MkDirAll).
	WriteFile(path, content string) error
	// MkDirAll creates a board directory (and any missing parents), for mirror dirs the board doesn't have yet.
	MkDirAll(path string) error
	// RemoveFile deletes a file on the board, to propagate mirror deletions/renames back.
	RemoveFile(path string) error
}

// skipDir names directories that never belong in the mirror (build output, VCS, deps).
var skipDir = map[string]bool{".cache": true, ".git": true, "node_modules": true}

// ParkedSuffix marks the local-only copy of an edit that lost a checkout conflict (see Reconcile); these files are never synced.
const ParkedSuffix = ".claude-local"

// managed are the files App Lab changes only through its own operations (apps_edit, app_bricks_*, sketch_libraries_*), as its editor does: SyncBack never overwrites the board's copy.
var managed = map[string]bool{"app.yaml": true, "sketch/sketch.yaml": true}

// sketchPair are the two files arduino-app-cli wants together: it does not load an app whose sketch/ holds only one of them.
var sketchPair = [2]string{"sketch/sketch.ino", "sketch/sketch.yaml"}

func pairedWith(rel string) string {
	switch rel {
	case sketchPair[0]:
		return sketchPair[1]
	case sketchPair[1]:
		return sketchPair[0]
	}
	return ""
}

// contentHash fingerprints a file's bytes; it is the pivot for three-way reasoning — at checkout the local and board copies share this hash, so a later divergence says which side moved.
func contentHash(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
}

// partialListing is the ListFiles error that still carries a usable list: some directories could not be read,
// the rest of the walk is complete.
type partialListing interface{ UnreadablePaths() []string }

// Populate copies the app's files from the board (under remoteRoot) into localRoot and returns the baseline:
// relative path → content hash of what was checked out. It doubles as the set of paths known to exist on the
// board (for deletion detection) and as the "both sides agreed here" marker SyncBack compares against.
//
// A first checkout takes what the walk could read: one folder the board won't let us list (a root-owned .venv,
// say) would otherwise leave the agent with no mirror at all, and the missing paths cost nothing here — they are
// absent from the baseline, so SyncBack neither pushes nor deletes them.
func Populate(bfs BoardFS, remoteRoot, localRoot string) (map[string]string, error) {
	files, err := bfs.ListFiles(remoteRoot)
	if err != nil {
		var partial partialListing
		if !errors.As(err, &partial) {
			return nil, fmt.Errorf("list board files: %w", err)
		}
		slog.Warn("checking out an app with directories the board would not list",
			"root", remoteRoot, "dirs", partial.UnreadablePaths())
	}
	rels := make([]string, len(files)) // rels[i] pairs with files[i]; "" = not mirrored
	for i, remote := range files {
		if rel := relTo(remoteRoot, remote); rel != "" && !skipped(rel) {
			rels[i] = rel
		}
	}
	if err := mirrorable(rels, localRoot); err != nil {
		return nil, err
	}
	baseline := map[string]string{}
	for i, remote := range files {
		rel := rels[i]
		if rel == "" {
			continue
		}
		content, err := bfs.ReadFile(remote)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", remote, err)
		}
		local := filepath.Join(localRoot, filepath.FromSlash(rel))
		if err := os.MkdirAll(filepath.Dir(local), 0o755); err != nil {
			return nil, err
		}
		if err := os.WriteFile(local, []byte(content), 0o644); err != nil {
			return nil, err
		}
		baseline[rel] = contentHash([]byte(content))
	}
	return baseline, nil
}

// Reconcile refreshes an existing mirror from the board so a re-checkout sees the user's editor saves instead of
// the checkout-time copy: files the agent hasn't touched (local content still hashes to its baseline) are rewritten
// from the board, files the board gained are added, and ones the board lost are dropped with the folders that leaves
// empty. A locally edited file whose board copy is still the checked-out one is left for SyncBack to push; one the
// board ALSO changed is resolved here — the board wins, the local edit is parked as <rel>.claude-local — because
// SyncBack never picks a winner, so without this no tool path could clear the conflict. Returns the updated baseline
// and the parked rel paths.
func Reconcile(bfs BoardFS, remoteRoot, localRoot string, base map[string]string) (map[string]string, []string, error) {
	files, err := bfs.ListFiles(remoteRoot)
	if err != nil {
		return base, nil, fmt.Errorf("list board files: %w", err) // nothing touched: the old baseline still holds
	}
	next := make(map[string]string, len(base))
	for rel, h := range base {
		next[rel] = h
	}
	var parked []string
	onBoard := map[string]bool{}
	for _, remote := range files {
		rel := relTo(remoteRoot, remote)
		if rel == "" || skipped(rel) {
			continue
		}
		onBoard[rel] = true
		content, err := bfs.ReadFile(remote)
		if err != nil {
			// Return what we have: files already rewritten are on disk, and an old baseline would make SyncBack read them as local edits.
			return next, parked, fmt.Errorf("read %s: %w", remote, err)
		}
		// Checked after the board read, which is slow, so an edit written during it is parked or kept instead of overwritten.
		local := filepath.Join(localRoot, filepath.FromSlash(rel))
		baseHash, tracked := base[rel]
		edited := tracked && !localMatches(local, baseHash)
		if edited && contentHash([]byte(content)) == baseHash {
			continue // only the local side moved: SyncBack pushes the edit
		}
		// Park what the write below would overwrite — a conflicted tracked edit, or an untracked local change (stranded
		// edits on a reattached mirror; nil base is the read-only restore, which deliberately parks nothing) — and only
		// content that differs from the incoming copy, so a re-run can't clobber a parked copy with board bytes.
		if edited || (!tracked && base != nil) {
			if cur, rerr := os.ReadFile(local); rerr == nil && contentHash(cur) != contentHash([]byte(content)) {
				if err := os.Rename(local, local+ParkedSuffix); err != nil {
					return next, parked, err
				}
				parked = append(parked, rel)
			}
		}
		if err := os.MkdirAll(filepath.Dir(local), 0o755); err != nil {
			return next, parked, err
		}
		if err := os.WriteFile(local, []byte(content), 0o644); err != nil {
			return next, parked, err
		}
		next[rel] = contentHash([]byte(content))
	}
	for rel, baseHash := range base { // deleted on the board: drop the stale copy, unless the agent has edits in it
		local := filepath.Join(localRoot, filepath.FromSlash(rel))
		if !onBoard[rel] && localMatches(local, baseHash) {
			_ = dropLocal(localRoot, rel)
			delete(next, rel)
		}
	}
	return next, parked, nil
}

// localMatches reports whether the local file still holds exactly what was checked out (an unreadable file counts as changed).
func localMatches(local, baseHash string) bool {
	content, err := os.ReadFile(local)
	return err == nil && contentHash(content) == baseHash
}

// MatchesBaseline reports whether the mirror holds exactly the files of base, unchanged: a SyncBack would push and delete nothing.
func MatchesBaseline(localRoot string, base map[string]string) bool {
	return matchesBaseline(localRoot, base, false)
}

// HoldsOnlyBaseline is MatchesBaseline with nothing skipped: a parked copy or a file in a skipped folder is lost with the folder.
func HoldsOnlyBaseline(localRoot string, base map[string]string) bool {
	return matchesBaseline(localRoot, base, true)
}

func matchesBaseline(localRoot string, base map[string]string, strict bool) bool {
	seen, matches := 0, true
	err := filepath.WalkDir(localRoot, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if skipDir[d.Name()] && !strict {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasSuffix(d.Name(), ParkedSuffix) && !strict {
			return nil
		}
		rel, err := filepath.Rel(localRoot, p)
		if err != nil {
			return err
		}
		if h, tracked := base[filepath.ToSlash(rel)]; !tracked || !localMatches(p, h) {
			matches = false
			return filepath.SkipAll
		}
		seen++
		return nil
	})
	return err == nil && matches && seen == len(base)
}

// SyncResult reports what one SyncBack did.
type SyncResult struct {
	Written   []string          // board paths written
	Deleted   []string          // board paths removed to propagate a local deletion
	Conflicts []string          // relative paths changed on BOTH sides since checkout — left untouched on the board
	Withheld  []string          // managed files the agent changed locally: not pushed, and the mirror matches the board again
	Unpaired  []string          // sketch files added or removed without the other one: not applied, and the mirror matches the board again
	NewBase   map[string]string // relative path → content hash, to carry into the next sync
}

// SyncBack pushes local edits back to the board and propagates deletions/renames.
//
// `base` is the per-file content hash recorded at checkout (or by the previous sync). A file still hashing to its
// baseline wasn't edited locally and is never written — that is what stops a force sync, which deliberately drops
// the mtime gate, from re-pushing the whole mirror over the user's own board-side saves. A file that WAS edited
// locally (or is about to be deleted on the board) is checked against the board first: if the board copy no longer
// matches the baseline both sides moved, so it is reported as a conflict and left alone.
//
// `since` still gates the incremental path (zero considers every file); it is a cheap pre-filter, the hashes are
// the authority. Every write is verified by reading the file back and comparing hashes; only then does the file's
// baseline advance. A file whose write or read-back fails is recorded and skipped so the rest keep pushing; the
// run then errors naming the failures, keeping `base` plus the advances that did get through, and deletions are
// skipped entirely.
//
// A managed file the board has is never overwritten, and a local change to it goes in Withheld; the two sketch files reach or leave the board only together, and a change that would split them goes in Unpaired.
func SyncBack(bfs BoardFS, remoteRoot, localRoot string, since time.Time, base map[string]string) (SyncResult, error) {
	res := SyncResult{}
	current := map[string]bool{}
	newBase := map[string]string{}
	root := path.Clean(remoteRoot)
	madeDirs := map[string]bool{} // board dirs ensured this run — the board write seam can't create parents itself
	var failed []string
	pairAdds := map[string]string{} // sketch files the board lacks, pushed after the walk once both are known
	push := func(relSlash, content, localHash string) {
		remote := path.Join(remoteRoot, relSlash)
		if dir := path.Dir(remote); dir != root && !madeDirs[dir] {
			if err := bfs.MkDirAll(dir); err != nil {
				failed = append(failed, fmt.Sprintf("%s: %v", relSlash, err))
				return // record and keep walking: one bad file must not strand the rest
			}
			madeDirs[dir] = true
		}
		if err := bfs.WriteFile(remote, content); err != nil {
			failed = append(failed, fmt.Sprintf("%s: %v", relSlash, err))
			return
		}
		// Read back before advancing the baseline: an unpersisted write recorded as "in sync" is never retried, and the next Reconcile overwrites the local edit with the stale board copy.
		if back, rerr := bfs.ReadFile(remote); rerr != nil || contentHash([]byte(back)) != localHash {
			failed = append(failed, relSlash+": write did not persist on the board (disk full? permissions?)")
			return
		}
		newBase[relSlash] = localHash
		res.Written = append(res.Written, remote)
	}
	err := filepath.WalkDir(localRoot, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if skipDir[d.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasSuffix(d.Name(), ParkedSuffix) {
			return nil // parked conflict copies stay local: never pushed, never counted in current
		}
		rel, err := filepath.Rel(localRoot, p)
		if err != nil {
			return err
		}
		relSlash := filepath.ToSlash(rel)
		current[relSlash] = true
		info, err := d.Info()
		if err != nil {
			return err
		}
		content, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		localHash := contentHash(content)
		baseHash, tracked := base[relSlash]
		if tracked && baseHash == localHash {
			newBase[relSlash] = baseHash // untouched locally since checkout: the board keeps whatever it holds now
			return nil
		}
		if !since.IsZero() && info.ModTime().Before(since) {
			if tracked {
				newBase[relSlash] = baseHash // outside this turn's window; keep the baseline so a later flush still sees the edit
			}
			return nil
		}
		if managed[relSlash] {
			boardContent, rerr := bfs.ReadFile(path.Join(remoteRoot, relSlash))
			switch {
			case errors.Is(rerr, fs.ErrNotExist) && !tracked:
				// A new file, handled below like any other: that is how an app without a sketch gains one.
			case errors.Is(rerr, fs.ErrNotExist):
				// The board lost it since checkout: a removal made outside the checkout, which the agent must not undo.
				if dropLocal(localRoot, relSlash) != nil {
					newBase[relSlash] = baseHash
					return nil
				}
				res.Withheld = append(res.Withheld, relSlash)
				return nil
			default:
				if rerr == nil && contentHash([]byte(boardContent)) != localHash {
					if rerr = writeLocalFile(localRoot, relSlash, boardContent); rerr == nil {
						res.Withheld = append(res.Withheld, relSlash)
					}
				}
				switch {
				case rerr == nil:
					newBase[relSlash] = contentHash([]byte(boardContent))
				case tracked:
					newBase[relSlash] = baseHash // board copy unreadable or checkout not writable: a later sync tries again
				}
				return nil
			}
		}
		paired := pairedWith(relSlash) != ""
		var boardErr error
		if tracked || paired { // a sketch file is read too, to see whether it is new on the board
			var boardContent string
			boardContent, boardErr = bfs.ReadFile(path.Join(remoteRoot, relSlash))
			if tracked && boardErr == nil && contentHash([]byte(boardContent)) != baseHash { // edited locally — the board copy must still be the one we checked out
				res.Conflicts = append(res.Conflicts, relSlash)
				newBase[relSlash] = baseHash // unresolved: re-detect it next sync rather than picking a winner
				return nil
			}
		}
		if paired && boardErr != nil {
			if errors.Is(boardErr, fs.ErrNotExist) {
				pairAdds[relSlash] = string(content)
			} else if tracked {
				newBase[relSlash] = baseHash // can't tell whether this adds a sketch file: a later sync tries again
			}
			return nil
		}
		if tracked && boardErr != nil && !errors.Is(boardErr, fs.ErrNotExist) {
			failed = append(failed, fmt.Sprintf("%s: could not read the board copy to compare: %v", relSlash, boardErr))
			newBase[relSlash] = baseHash // can't tell whether the board moved: a later sync tries again
			return nil
		}
		push(relSlash, string(content), localHash)
		return nil
	})
	for rel, content := range pairAdds {
		if err != nil {
			break
		}
		other := pairedWith(rel)
		_, otherAdded := pairAdds[other]
		otherOnBoard, known := otherAdded, true
		if !otherAdded {
			otherOnBoard, known = boardHas(bfs, path.Join(remoteRoot, other))
		}
		switch {
		case !known:
			if h, tracked := base[rel]; tracked {
				newBase[rel] = h // can't tell: a later sync tries again
			}
		case otherOnBoard:
			push(rel, content, contentHash([]byte(content)))
		default: // the board would hold this file alone, so the checkout goes back to the board's state: neither file
			if dropLocal(localRoot, rel) != nil {
				if h, tracked := base[rel]; tracked {
					newBase[rel] = h
				}
				continue
			}
			res.Unpaired = append(res.Unpaired, rel)
			if current[other] && dropLocal(localRoot, other) == nil {
				delete(newBase, other)
				res.Unpaired = append(res.Unpaired, other)
			}
		}
	}
	if err == nil && len(failed) > 0 {
		detail := failed
		if len(detail) > 3 {
			detail = append(detail[:3:3], fmt.Sprintf("and %d more", len(failed)-3))
		}
		err = fmt.Errorf("could not sync some files to the board: %s", strings.Join(detail, "; "))
	}
	if err != nil {
		// Keep the advances of the files that were written and verified: reverting them makes the retry misread them as conflicts (local edit + moved board copy).
		merged := make(map[string]string, len(base))
		for rel, h := range base {
			merged[rel] = h
		}
		for rel, h := range newBase {
			merged[rel] = h
		}
		res.NewBase = merged // deletions still skipped
		return res, err
	}
	// A suddenly-empty mirror is almost certainly a local error, not the agent deleting every file — don't wipe the board.
	if len(current) == 0 && len(base) > 0 {
		res.NewBase = base
		return res, nil
	}
	dels := map[string]string{} // sketch files deleted locally that the board still holds unchanged → the board's copy
	for _, rel := range sketchPair {
		baseHash, tracked := base[rel]
		if !tracked || current[rel] {
			continue
		}
		boardContent, rerr := bfs.ReadFile(path.Join(remoteRoot, rel))
		switch {
		case errors.Is(rerr, fs.ErrNotExist):
			// gone from the board too
		case rerr != nil:
			newBase[rel] = baseHash // can't tell: a later sync tries again
		case contentHash([]byte(boardContent)) != baseHash:
			res.Conflicts = append(res.Conflicts, rel)
			newBase[rel] = baseHash
		default:
			dels[rel] = boardContent
		}
	}
	for rel, boardContent := range dels {
		other := pairedWith(rel)
		_, otherGoes := dels[other]
		if !otherGoes {
			has, known := boardHas(bfs, path.Join(remoteRoot, other))
			if !known {
				newBase[rel] = base[rel] // can't tell: a later sync tries again
				continue
			}
			otherGoes = !has
		}
		if remote := path.Join(remoteRoot, rel); otherGoes {
			if bfs.RemoveFile(remote) == nil {
				res.Deleted = append(res.Deleted, remote)
			}
			continue
		}
		// The board would keep the other file alone, so this one comes back into the checkout.
		if writeLocalFile(localRoot, rel, boardContent) != nil {
			newBase[rel] = base[rel]
			continue
		}
		newBase[rel] = contentHash([]byte(boardContent))
		res.Unpaired = append(res.Unpaired, rel)
	}
	sort.Strings(res.Unpaired)
	for rel, baseHash := range base {
		if current[rel] || pairedWith(rel) != "" {
			continue
		}
		remote := path.Join(remoteRoot, rel)
		if managed[rel] {
			content, rerr := bfs.ReadFile(remote)
			if errors.Is(rerr, fs.ErrNotExist) {
				continue // gone from the board too: nothing to put back
			}
			if rerr == nil {
				rerr = writeLocalFile(localRoot, rel, content)
			}
			if rerr != nil {
				newBase[rel] = baseHash // still missing locally, so the next sync tries again
				continue
			}
			res.Withheld = append(res.Withheld, rel)
			newBase[rel] = contentHash([]byte(content))
			continue
		}
		// Deleting is as destructive as overwriting: keep the file when the board has moved since checkout.
		boardContent, rerr := bfs.ReadFile(remote)
		switch {
		case rerr == nil && contentHash([]byte(boardContent)) != baseHash:
			res.Conflicts = append(res.Conflicts, rel)
			newBase[rel] = baseHash
			continue
		case rerr != nil && !errors.Is(rerr, fs.ErrNotExist):
			newBase[rel] = baseHash // can't tell whether the board moved: a later sync tries again
			continue
		}
		if bfs.RemoveFile(remote) == nil { // best-effort: a failed delete just leaves an orphan, no abort
			res.Deleted = append(res.Deleted, remote)
		}
	}
	res.NewBase = newBase
	return res, nil
}

// RefreshManaged copies the managed files the agent has not edited from the board into the mirror and returns their new baseline hashes.
func RefreshManaged(bfs BoardFS, remoteRoot, localRoot string, base map[string]string) map[string]string {
	fresh := map[string]string{}
	for rel := range managed {
		if h, tracked := base[rel]; tracked && !localMatches(filepath.Join(localRoot, filepath.FromSlash(rel)), h) {
			continue
		}
		content, err := bfs.ReadFile(path.Join(remoteRoot, rel))
		if err != nil || writeLocalFile(localRoot, rel, content) != nil {
			continue
		}
		fresh[rel] = contentHash([]byte(content))
	}
	return fresh
}

// writeLocalFile writes one mirror file, creating its parent dirs.
func writeLocalFile(localRoot, rel, content string) error {
	local := filepath.Join(localRoot, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(local), 0o755); err != nil {
		return err
	}
	return os.WriteFile(local, []byte(content), 0o644)
}

// dropLocal removes a mirror file the board does not have, and the folders that leaves empty.
func dropLocal(localRoot, rel string) error {
	local := filepath.Join(localRoot, filepath.FromSlash(rel))
	if err := os.Remove(local); err != nil {
		return err
	}
	inside := filepath.Clean(localRoot) + string(filepath.Separator)
	for dir := filepath.Dir(local); strings.HasPrefix(dir, inside); dir = filepath.Dir(dir) {
		if os.Remove(dir) != nil { // fails unless empty
			break
		}
	}
	return nil
}

// boardHas reports whether the board holds the file at p; known is false when the board could not be read.
func boardHas(bfs BoardFS, p string) (has, known bool) {
	_, err := bfs.ReadFile(p)
	if err == nil {
		return true, true
	}
	return false, errors.Is(err, fs.ErrNotExist)
}

// RemoveParked best-effort deletes every parked conflict copy under localRoot, leaving everything else alone.
func RemoveParked(localRoot string) {
	_ = filepath.WalkDir(localRoot, func(p string, d fs.DirEntry, err error) error {
		if err == nil && !d.IsDir() && strings.HasSuffix(d.Name(), ParkedSuffix) {
			_ = os.Remove(p)
		}
		return nil
	})
}

// mirrorable refuses the checkout before anything is written when the local filesystem can't hold the board's
// names (case collision or Windows-illegal name); the errors steer the agent to ask the user, not rename.
func mirrorable(rels []string, localRoot string) error {
	if runtime.GOOS == "windows" {
		for _, rel := range rels {
			if rel != "" && winIllegal(rel) {
				return fmt.Errorf("cannot check out this app on this computer: %q is not a valid file name on Windows, so it cannot be mirrored locally. Do not rename or touch board files to work around this — report the problem to the user and ask them to rename that file, then check out again", rel)
			}
		}
	}
	if a, b := caseCollision(rels); a != "" && foldsCase(localRoot) {
		return fmt.Errorf("cannot check out this app on this computer: the board has both %q and %q, and this computer's filesystem treats those names as the same file, so a local copy cannot hold both. Do not rename or touch board files to work around this — renames can break code that references them by exact name; report the clash to the user and ask them to rename one of the two, then check out again", a, b)
	}
	return nil
}

// caseCollision returns two board paths (file pair or file-vs-dir) a case-folding filesystem would map onto
// the same local path, or "", "" when there are none.
func caseCollision(rels []string) (string, string) {
	files := map[string]string{} // folded path → first exact rel
	dirs := map[string]string{}  // folded dir path → first exact dir
	for _, rel := range rels {
		if rel == "" {
			continue
		}
		folded := strings.ToLower(rel)
		if prev, ok := files[folded]; ok && prev != rel {
			return prev, rel
		}
		files[folded] = rel
		for d := path.Dir(rel); d != "."; d = path.Dir(d) {
			if _, ok := dirs[strings.ToLower(d)]; !ok {
				dirs[strings.ToLower(d)] = d
			}
		}
	}
	for folded, rel := range files {
		if d, ok := dirs[folded]; ok {
			return d + "/", rel
		}
	}
	return "", ""
}

// foldsCase reports whether dir's filesystem folds case — measured, not GOOS-inferred; a failed probe counts as folding.
func foldsCase(dir string) bool {
	f, err := os.CreateTemp(dir, "caseprobe-aA*")
	if err != nil {
		return true
	}
	name := filepath.Base(f.Name())
	_ = f.Close()
	defer os.Remove(f.Name())
	_, err = os.Lstat(filepath.Join(dir, strings.ToUpper(name)))
	return err == nil
}

// windowsReserved are basenames Windows refuses regardless of extension (CON, NUL, COM1…).
var windowsReserved = func() map[string]bool {
	m := map[string]bool{"con": true, "prn": true, "aux": true, "nul": true}
	for i := 1; i <= 9; i++ {
		m[fmt.Sprintf("com%d", i)] = true
		m[fmt.Sprintf("lpt%d", i)] = true
	}
	return m
}()

// winIllegal reports whether a segment of rel can't exist on Windows ('\' included — it'd become a separator); callers gate on GOOS.
func winIllegal(rel string) bool {
	for _, seg := range strings.Split(rel, "/") {
		if strings.ContainsAny(seg, `<>:"|?*\`) || strings.IndexFunc(seg, func(r rune) bool { return r < 0x20 }) >= 0 {
			return true
		}
		if seg != strings.TrimRight(seg, ". ") {
			return true
		}
		base := strings.ToLower(seg)
		if i := strings.IndexByte(base, '.'); i >= 0 {
			base = base[:i]
		}
		if windowsReserved[base] {
			return true
		}
	}
	return false
}

// relTo returns child relative to root using board ("/") separators, or "" when child isn't under root.
func relTo(root, child string) string {
	root = strings.TrimSuffix(root, "/")
	if child == root {
		return ""
	}
	if !strings.HasPrefix(child, root+"/") {
		return ""
	}
	return strings.TrimPrefix(child, root+"/")
}

// skipped reports whether a relative board path sits inside a skipped directory or carries the parked suffix.
func skipped(rel string) bool {
	if strings.HasSuffix(rel, ParkedSuffix) {
		return true // never track a board file with our suffix: SyncBack skips it locally, so a baseline entry would read as a deletion and remove it from the board
	}
	for _, seg := range strings.Split(rel, "/") {
		if skipDir[seg] {
			return true
		}
	}
	return false
}
