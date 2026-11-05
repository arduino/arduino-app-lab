package app

// The user's "Always allow" answers, kept per workspace so a grant follows the app across chats and never reaches another; see toolgrants.go for why the engine can't hold them.

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"maps"
	"os"
	"path"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"

	"app-lab-desktop/internal/agent"
	"app-lab-desktop/internal/airuntime"
	"app-lab-desktop/internal/appid"
	"app-lab-desktop/internal/arduinoapps"
	"app-lab-desktop/internal/board"
)

const workspaceGrantsFile = "workspace-grants.json"

// boardGrantKey namespaces a workspace by the board holding it. An app id is base64 of "type:name", so the same
// app name on two boards yields the same id: without this they share one bucket, and an "always allow" given on
// one board answers for the other. The agent still passes bare app ids; this file is where the board is added.
func boardGrantKey(boardID, workspaceID string) string { return boardID + "\x00" + workspaceID }

// splitBoardGrantKey reverses it; a key with no separator predates board scoping and belongs to no board.
func splitBoardGrantKey(key string) (boardID, workspaceID string, ok bool) {
	board, workspace, found := strings.Cut(key, "\x00")
	if !found {
		return "", "", false
	}
	return board, workspace, true
}

// workspaceGrants owns the file behind agent.GrantStore; the agent package knows nothing about where it lives.
type workspaceGrants struct{ app *App }

// LoadGrants reads every workspace's grants; a missing or unreadable file reads as none, like the other client stores.
func (w workspaceGrants) LoadGrants() map[string][]string {
	dir, err := w.app.agentConfigDir()
	if err != nil {
		return nil
	}
	boardID := w.app.selectedBoardID()
	w.app.storeMu.Lock()
	defer w.app.storeMu.Unlock()
	all := readWorkspaceGrants(dir)
	// No call these keys answer can run (an earlier build saved an edit's whole text in some): removed once, from every board and workspace.
	if dropGrants(all, func(k string) bool { return agent.NeverAnswers(k) || deadAppScope(k) }) {
		_ = writeWorkspaceGrants(dir, all)
	}
	// Only this board's grants: an entry written before board scoping belongs to no board and is left alone
	// rather than adopted, since adopting it is exactly the cross-board approval this keying prevents.
	out := map[string][]string{}
	for key, keys := range all {
		if board, workspace, ok := splitBoardGrantKey(key); ok && board == boardID {
			out[workspace] = keys
		}
	}
	return out
}

// SaveGrants saves one workspace's grants as from a card checked now; the agent itself uses SaveGrantsAt, so only tests call it.
func (w workspaceGrants) SaveGrants(workspaceID string, keys []string) {
	w.SaveGrantsAt(workspaceID, keys, "", w.Revision())
}

// SaveGrantsAt saves a list for a card that opened at revision rev: after a rewrite of ours since then the list is stale, so only the added key joins the file's.
func (w workspaceGrants) SaveGrantsAt(workspaceID string, keys []string, added string, rev uint64) {
	dir, err := w.app.agentConfigDir()
	if err != nil {
		return
	}
	boardID := w.app.selectedBoardID()
	key := boardGrantKey(boardID, workspaceID)
	w.app.storeMu.Lock()
	defer w.app.storeMu.Unlock()
	all := readWorkspaceGrants(dir)
	stored := all[key]
	if w.app.grantsRev.Load() != rev {
		keys = slices.Clone(stored)
		if added != "" && !slices.Contains(keys, added) {
			keys = append(keys, added)
			sort.Strings(keys)
		}
	}
	_, retired := w.app.retiredGrants[key]
	// Only what this save adds is checked: a stored key either survived the rewrite or was given after it.
	if kept := slices.DeleteFunc(slices.Clone(keys), func(k string) bool {
		return !slices.Contains(stored, k) && (retired || w.app.namesRetiredApp(boardID, k, rev))
	}); len(kept) != len(keys) {
		w.app.grantsRev.Add(1) // so the agent also drops the grant it holds, which a later app of that name would get
		slog.Info("[permission] an always-allow for an app deleted or renamed in this run was not kept", "workspace", workspaceID, "dropped", len(keys)-len(kept))
		keys = kept
	}
	if kept := slices.DeleteFunc(slices.Clone(keys), deadAppScope); len(kept) != len(keys) {
		w.app.grantsRev.Add(1)
		slog.Info("[permission] an always-allow for a call whose app id the board cannot take was not kept", "workspace", workspaceID, "dropped", len(keys)-len(kept))
		keys = kept
	}
	if len(keys) == 0 {
		delete(all, key)
	} else {
		all[key] = keys
	}
	_ = writeWorkspaceGrants(dir, all)
}

// Revision lets the agent notice a rewrite it did not make, without re-reading the file on every permission.
func (w workspaceGrants) Revision() uint64 { return w.app.grantsRev.Load() }

func readWorkspaceGrants(dir string) map[string][]string {
	data, err := os.ReadFile(filepath.Join(dir, workspaceGrantsFile))
	if err != nil {
		return map[string][]string{}
	}
	grants := map[string][]string{}
	// A file holding null decodes to a nil map, which every writer would panic on.
	if err := json.Unmarshal(data, &grants); err != nil || grants == nil {
		return map[string][]string{} // an unreadable file costs the user a re-prompt, never a wrong auto-approval
	}
	return grants
}

// writeWorkspaceGrants persists the map atomically (temp file + rename) so an interrupted write can't corrupt it.
func writeWorkspaceGrants(dir string, grants map[string][]string) error {
	data, err := json.MarshalIndent(grants, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(dir, workspaceGrantsFile+".tmp")
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(dir, workspaceGrantsFile))
}

// RebindWorkspaceApp moves everything keyed on an app id when a rename mints a new one: otherwise the workspace loses its grants and sessions, and a later app of the old name inherits them.
func (a *App) RebindWorkspaceApp(oldID, newID, newName string) {
	release := a.holdRename(oldID, newID)
	defer release()
	a.rebindWorkspaceApp(oldID, newID, newName)
}

// holdRename keeps the sweep off both ids until release: mid-rename the old id is gone from the board while its chats and grants are still keyed on it.
func (a *App) holdRename(oldID, newID string) (release func()) {
	ids := []string{strings.TrimSpace(oldID), strings.TrimSpace(newID)}
	s := &a.appSweep
	s.mu.Lock()
	if s.renaming == nil {
		s.renaming = map[string]int{}
	}
	for _, id := range ids {
		s.renaming[id]++
	}
	s.mu.Unlock()
	return func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		s.releases++
		if s.released == nil {
			s.released = map[string]uint64{}
		}
		for _, id := range ids {
			s.renaming[id]--
			if s.renaming[id] <= 0 {
				delete(s.renaming, id)
			}
			s.released[id] = s.releases
		}
	}
}

// retiredApp is the mark of an app deleted or renamed away: its checkout folder, and the revision its rewrite ended at.
type retiredApp struct {
	folder string
	rev    uint64
}

// retireGrants marks an app deleted or renamed away, until a new chat on its id, a rename onto it, or a restart: a card left open across the change would save its grant again. The caller holds the store lock.
func (a *App) retireGrants(boardID, appID string, rev uint64) {
	if a.retiredGrants == nil {
		a.retiredGrants = map[string]retiredApp{}
	}
	a.retiredGrants[boardGrantKey(boardID, appID)] = retiredApp{folder: mirrorKey(boardID, appID), rev: rev}
}

// namesRetiredApp reports a key, from a card opened at revision rev, that names an app of this board retired after that: scoped to its id, or naming its checkout folder. The caller holds the store lock.
func (a *App) namesRetiredApp(boardID, key string, rev uint64) bool {
	for bucket, mark := range a.retiredGrants {
		board, appID, _ := splitBoardGrantKey(bucket)
		if board != boardID || mark.rev <= rev {
			continue // a card opened after the change answers for the app there now, one made again with that name included
		}
		if _, _, scope, ok := splitGrantKey(key); (ok && scope == appID) || namesFolder(key, mark.folder) {
			return true
		}
	}
	return false
}

// afterStoreRewrite runs right after a rewrite releases the store lock, a variable so a test can land a save there.
var afterStoreRewrite = func() {}

// unlockRewrittenStores releases the store lock after a rewrite, which must have bumped the revision already: a save taking the lock next has to see it.
func (a *App) unlockRewrittenStores() {
	a.storeMu.Unlock()
	afterStoreRewrite()
}

// rebindWorkspaceApp also tells every chat on the app, with its next prompt: the agent would otherwise try the old id and checkout folder first.
func (a *App) rebindWorkspaceApp(oldID, newID, newName string) string {
	oldID, newID = strings.TrimSpace(oldID), strings.TrimSpace(newID)
	if oldID == "" || newID == "" || oldID == newID {
		return ""
	}
	// Read before the rekey: the mirror dir carries the app's name, so both directories are needed to move the grants.
	oldMirror, newMirror := filepath.Base(a.workspaceMirrorDir(oldID)), filepath.Base(a.workspaceMirrorDir(newID))
	boardID := a.selectedBoardID() // the rename happened on this board: another board's app of the same id keeps its own name
	m, _ := a.agentManager()
	recipients := a.renameRecipients(m, oldID, boardID) // before the stores and the live sessions move to the new id
	a.rebindCheckout(oldID, newID)                      // the move on disk first, so the stores below describe where the files actually are
	// Every agent's stores, running or not: the one stopped now still answers with its grants once it is back.
	a.storeMu.Lock()
	for _, id := range airuntime.SupportedAgents() {
		dir, err := airuntime.AgentConfigDir(id)
		if err != nil {
			continue
		}
		rekeyWorkspaceApp(dir, oldID, newID, newName, boardID)
		remapGrantsToRenamedApp(dir, oldID, newID, oldMirror, newMirror, boardID)
	}
	a.retireGrants(boardID, oldID, a.grantsRev.Add(1)) // bumped before the unlock: a grant saved after it sees the rewrite (SaveGrantsAt)
	delete(a.retiredGrants, boardGrantKey(boardID, newID))
	a.unlockRewrittenStores()
	note := renameNote(oldID, newID, newName, a.workspaceMirrorDir(newID))
	// The stores are only half of it: a chat already open still resolves to the old id until the connection is told.
	if m != nil {
		m.RebindWorkspace(oldID, newID, newName)
		for _, sid := range recipients {
			m.Notify(sid, note)
		}
	}
	return note
}

// renameRecipients lists the chats a rename concerns: the ones opened on the app, and the live ones whose board tools named it.
func (a *App) renameRecipients(m *agent.Manager, appID, boardID string) []agent.SessionID {
	if m == nil {
		return nil
	}
	seen := map[agent.SessionID]bool{}
	var out []agent.SessionID
	add := func(sid agent.SessionID) {
		if !seen[sid] {
			seen[sid] = true
			out = append(out, sid)
		}
	}
	if dir, err := a.agentConfigDir(); err == nil {
		a.storeMu.Lock()
		chats := chatsOfWorkspaceApp(dir, appID, boardID, false)
		a.storeMu.Unlock()
		for _, sid := range chats {
			add(agent.SessionID(sid))
		}
	}
	for _, sid := range m.SessionsNamingApp(appID) {
		add(sid)
	}
	return out
}

// renameNote tells the agent an app it worked on has a new id, a new name and a new checkout folder.
func renameNote(oldID, newID, newName, mirror string) string {
	name := newName
	if name == "" {
		name = newID
	}
	note := fmt.Sprintf("The app with id %s was renamed to %q, which gave it the new id %s: the old id no longer resolves, so use the new one.", oldID, name, newID)
	if mirror != "" {
		note += " Its checkout folder is now " + mirror + "; call apps_checkout with the new id before reading or editing its files."
	}
	return note
}

// remapGrantsToRenamedApp rewrites what a rename invalidates inside the grants: the mirror dir in a file grant and the app id an app tool is scoped to.
func remapGrantsToRenamedApp(dir, oldID, newID, oldMirror, newMirror, boardID string) {
	grants := readWorkspaceGrants(dir)
	// Every workspace's: an app tool granted from Agent Mode is kept there under the old id, which a later app of that name gets.
	changed := rescopeAppGrants(grants, boardID, oldID, newID)
	if oldMirror != "" && newMirror != "" && oldMirror != newMirror && oldMirror != "." && newMirror != "." {
		// Every bucket: a file grant from another workspace names the folder too, and the folder name carries the board.
		for _, keys := range grants {
			for i, k := range keys {
				if moved := replaceFolder(k, oldMirror, newMirror); moved != k {
					keys[i], changed = moved, true
				}
			}
		}
	}
	if changed {
		_ = writeWorkspaceGrants(dir, grants)
	}
}

// replaceFolder rewrites each whole-name occurrence of a checkout folder in a grant key; a longer folder name holding it, another board's or app's, is left alone.
func replaceFolder(key, folder, with string) string {
	if folder == "" {
		return key
	}
	var b strings.Builder
	last := 0
	for i := 0; ; {
		j := strings.Index(key[i:], folder)
		if j < 0 {
			break
		}
		at, end := i+j, i+j+len(folder)
		if (at > 0 && mirrorNameByte(key[at-1])) || (end < len(key) && mirrorNameByte(key[end])) {
			i = at + 1
			continue
		}
		b.WriteString(key[last:at])
		b.WriteString(with)
		last, i = end, end
	}
	b.WriteString(key[last:])
	return b.String()
}

// namesFolder reports whether a grant key names a checkout folder, a file in it included.
func namesFolder(key, folder string) bool { return replaceFolder(key, folder, "") != key }

// mirrorNameByte reports whether c can be part of a checkout folder's name (see sanitizeMirrorSegment).
func mirrorNameByte(c byte) bool {
	return c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '.' || c == '_' || c == '-'
}

// deadAppScope reports an app tool's grant scoped to what is no app id: the board refuses its calls, and no rename or delete reaches it.
func deadAppScope(key string) bool {
	_, _, scope, ok := splitGrantKey(key)
	return ok && scope != "" && !appid.Valid(scope)
}

// splitGrantKey takes a grant apart into the three parts the agent packs into it: kind, title and scope.
func splitGrantKey(key string) (kind, title, scope string, ok bool) {
	parts := strings.Split(key, "\x00")
	if len(parts) != 3 {
		return "", "", "", false
	}
	return parts[0], parts[1], parts[2], true
}

// rekeyWorkspaceApp moves one app's grants and sessions onto a new id; the caller holds the store lock.
// Only the renaming board's are moved: app ids repeat across boards, so another board's same-named app keeps its own.
func rekeyWorkspaceApp(dir, oldID, newID, newName, boardID string) {
	from, to := boardGrantKey(boardID, oldID), boardGrantKey(boardID, newID)
	if grants := readWorkspaceGrants(dir); grants[from] != nil {
		grants[to] = grants[from]
		delete(grants, from)
		_ = writeWorkspaceGrants(dir, grants)
	}

	workspaces, err := readSessionWorkspaces(dir)
	if err != nil {
		return
	}
	changed := false
	for sessionID, ws := range workspaces {
		if ws.AppID != oldID || !ws.onBoard(boardID) {
			continue
		}
		// BoardID carried over: the rename doesn't move the session to another board, and losing it would unscope the row.
		workspaces[sessionID] = sessionWorkspaceEntry{AppID: newID, Name: strings.TrimSpace(newName), BoardID: ws.BoardID}
		changed = true
	}
	if changed {
		_ = writeSessionWorkspaces(dir, workspaces)
	}
}

// ForgetWorkspaceApp drops a deleted app's grants and chats: ids are derived from the name, so the next app of that name would inherit permissions nobody gave it.
// Only the local stores are rewritten before returning. Deleting the chats on the agent is several unbounded ACP round-trips each (with retries), so it
// runs in the background: the caller is either the delete dialog, which would sit on the spinner for an app the board has already removed, or the
// apps_delete tool handler, whose own agent is blocked awaiting its result and so cannot service those requests.
func (a *App) ForgetWorkspaceApp(appID string) {
	appID = strings.TrimSpace(appID)
	if appID == "" {
		return
	}
	a.checkoutMu.Lock()
	gen := a.boardGen // read before the board id: a board switch bumps it before the board changes
	a.checkoutMu.Unlock()
	boardID := a.selectedBoardID() // the app was deleted from this board: another board's app of the same id keeps its chats
	chats := a.forgetWorkspaceAppStores(appID, boardID, false)
	a.dropDeletedCheckout(appID, boardID, gen)
	// Told now, not once the chats are gone: a panel sitting on the deleted app has to move off straight away. This is
	// also the only notice the UI gets when the agent deleted the app itself, through apps_delete.
	a.emit("agent:workspace-app-forgotten", appID, forgottenChats(chats))
	go a.deleteWorkspaceAppChats(appID, chats)
}

// forgottenChats lists the forget's chats of every agent for the event, never null: the sidebar hides these and no other chat of the id.
func forgottenChats(chats map[airuntime.AgentID][]string) []string {
	ids := []string{}
	for _, sessions := range chats {
		ids = append(ids, sessions...)
	}
	sort.Strings(ids)
	return ids
}

// forgetWorkspaceAppStores covers every agent: a grant left with an agent not running answers for the next app of that name once it runs.
func (a *App) forgetWorkspaceAppStores(appID, boardID string, strict bool) map[airuntime.AgentID][]string {
	a.storeMu.Lock()
	defer a.unlockRewrittenStores()
	defer func() { a.retireGrants(boardID, appID, a.grantsRev.Add(1)) }() // bumped before the unlock: a grant saved after it sees the rewrite (SaveGrantsAt)
	chats := map[airuntime.AgentID][]string{}
	for _, id := range airuntime.SupportedAgents() {
		dir, err := airuntime.AgentConfigDir(id)
		if err != nil {
			continue
		}
		dropWorkspaceApp(dir, appID, boardID, mirrorKey(boardID, appID))
		if ids := chatsOfWorkspaceApp(dir, appID, boardID, strict); len(ids) > 0 {
			chats[id] = ids
		}
	}
	return chats
}

// chatsOfWorkspaceApp lists the sessions bound to one app on one board, strict leaving out those with no board (maybe another board's app); the caller holds the store lock.
func chatsOfWorkspaceApp(dir, appID, boardID string, strict bool) []string {
	if appID == "" {
		return nil // the general workspace is not an app and outlives every one of them
	}
	workspaces, err := readSessionWorkspaces(dir)
	if err != nil {
		return nil
	}
	var chats []string
	for sessionID, ws := range workspaces {
		if ws.AppID == appID && ws.onBoard(boardID) && (!strict || ws.BoardID == boardID) {
			chats = append(chats, sessionID)
		}
	}
	return chats
}

// deleteWorkspaceAppChats removes them one by one, skipping any with a turn in flight: the agent can delete an app from inside a chat about it.
// Runs on its own goroutine (see ForgetWorkspaceApp), so it takes the store lock itself and reports failures to the log rather than to a caller.
func (a *App) deleteWorkspaceAppChats(appID string, chats map[airuntime.AgentID][]string) {
	a.agentMu.Lock()
	running, m := a.agentMgrID, a.agentMgr
	a.agentMu.Unlock()
	for id, sessions := range chats {
		dir, err := airuntime.AgentConfigDir(id)
		if err != nil {
			continue
		}
		live := m != nil && id == running
		var streaming map[string]bool
		if live {
			streaming = m.StreamingSessions()
		}
		var pending []string
		for _, sessionID := range sessions {
			if streaming[sessionID] {
				continue // unbound below: the chat that deleted the app stays, about no app
			}
			var err error
			if live {
				err = a.AgentDeleteSession(sessionID)
			} else {
				// An engine that is not running is reached through its own CLI.
				ctx, cancel := context.WithTimeout(a.ctx(), probeDeleteTimeout)
				err = deleteSessionCLI(ctx, id, sessionID)
				cancel()
				if err == nil {
					a.storeMu.Lock()
					dropSessionEntries(dir, sessionID)
					a.storeMu.Unlock()
				}
			}
			if err != nil {
				slog.Info("[workspace] a chat of the deleted app is deleted when its engine next runs", "agent", id, "session", sessionID, "error", err)
				pending = append(pending, sessionID)
			}
		}
		a.storeMu.Lock()
		// Hidden from now on and deleted by the engine's next run: unbound, it would show as a chat about the whole board.
		pendSessionDeletes(dir, pending)
		dropWorkspaceAppSessions(dir, appID, sessions)
		a.storeMu.Unlock()
	}
}

// pendSessionDeletes adds chats to the engine's pending deletes, then drops their entries; the caller holds the store lock.
func pendSessionDeletes(dir string, sessionIDs []string) {
	if len(sessionIDs) == 0 {
		return
	}
	ids, err := readSessionPendingDeletes(dir)
	if err == nil {
		for _, sid := range sessionIDs {
			if !slices.Contains(ids, sid) {
				ids = append(ids, sid)
			}
		}
		err = writeSessionPendingDeletes(dir, ids)
	}
	if err != nil {
		// Neither pending nor bound, a chat would show on every board and never be deleted: it keeps its entries.
		slog.Warn("[workspace] could not add the deleted app's chats to the pending deletes", "dir", dir, "sessions", sessionIDs, "err", err)
		return
	}
	for _, sid := range sessionIDs {
		dropSessionEntries(dir, sid)
	}
}

// pendingSessionDeletes lists the chats an agent's next run deletes, which its session list hides until then.
func (a *App) pendingSessionDeletes(id airuntime.AgentID) []string {
	dir, err := airuntime.AgentConfigDir(id)
	if err != nil {
		return nil
	}
	a.storeMu.Lock()
	defer a.storeMu.Unlock()
	ids, _ := readSessionPendingDeletes(dir)
	return ids
}

// deletePendingChats deletes, at the engine's start, the chats of deleted apps an earlier delete left; an id is forgotten once the engine's list no longer holds it.
func (a *App) deletePendingChats(m *agent.Manager, id airuntime.AgentID, sessionIDs []string) {
	gone := a.deleteListedSessions(m, id, sessionIDs)
	if len(gone) == 0 {
		return
	}
	dir, err := airuntime.AgentConfigDir(id)
	if err != nil {
		return
	}
	a.storeMu.Lock()
	defer a.storeMu.Unlock()
	ids, err := readSessionPendingDeletes(dir)
	if err == nil {
		err = writeSessionPendingDeletes(dir, slices.DeleteFunc(ids, func(sid string) bool { return slices.Contains(gone, sid) }))
	}
	if err != nil {
		slog.Warn("[agent] could not update the pending deletes", "agent", id, "err", err)
		return
	}
	for _, sid := range gone {
		dropSessionEntries(dir, sid)
	}
}

// dropWorkspaceAppSessions unbinds the listed chats still on the deleted app, a running one included; a chat moved onto the id since is not one of them. The caller holds the store lock.
func dropWorkspaceAppSessions(dir, appID string, sessionIDs []string) {
	workspaces, err := readSessionWorkspaces(dir)
	if err != nil {
		return
	}
	changed := false
	for _, sessionID := range sessionIDs {
		ws, ok := workspaces[sessionID]
		if !ok || ws.AppID != appID {
			continue
		}
		if ws.BoardID == "" {
			delete(workspaces, sessionID)
		} else {
			// The app is gone, the board isn't: keep the board alone so a leftover stays scoped to it instead of showing on every board.
			workspaces[sessionID] = sessionWorkspaceEntry{BoardID: ws.BoardID}
		}
		changed = true
	}
	if changed {
		_ = writeSessionWorkspaces(dir, workspaces)
	}
}

// dropWorkspaceApp forgets one app's grants on the board it was deleted from, and every file grant naming its checkout folder; the caller holds the store lock.
func dropWorkspaceApp(dir, appID, boardID, mirror string) {
	grants := readWorkspaceGrants(dir)
	_, changed := grants[boardGrantKey(boardID, appID)]
	delete(grants, boardGrantKey(boardID, appID))
	// An app tool granted from another workspace, Agent Mode's included, is kept there under the app's id.
	if rescopeAppGrants(grants, boardID, appID, "") {
		changed = true
	}
	// A new app of that name gets the same folder back, so a file grant from any workspace would answer for it.
	if dropGrants(grants, func(k string) bool { return namesFolder(k, mirror) }) {
		changed = true
	}
	if changed {
		_ = writeWorkspaceGrants(dir, grants)
	}
}

// dropGrants removes the keys drop matches from every bucket, and the buckets it empties.
func dropGrants(grants map[string][]string, drop func(key string) bool) bool {
	changed := false
	for bucket, keys := range grants {
		kept := slices.DeleteFunc(slices.Clone(keys), drop)
		if len(kept) == len(keys) {
			continue
		}
		changed = true
		if len(kept) == 0 {
			delete(grants, bucket)
		} else {
			grants[bucket] = kept
		}
	}
	return changed
}

// rescopeAppGrants moves the board's grants scoped to one app onto another id, or drops them when newID is empty.
func rescopeAppGrants(grants map[string][]string, boardID, oldID, newID string) bool {
	changed := false
	for bucket, keys := range grants {
		if b, _, ok := splitBoardGrantKey(bucket); !ok || b != boardID {
			continue
		}
		kept := make([]string, 0, len(keys))
		for _, k := range keys {
			kind, title, scope, ok := splitGrantKey(k)
			if !ok || scope != oldID {
				kept = append(kept, k)
				continue
			}
			changed = true
			if newID != "" {
				kept = append(kept, kind+"\x00"+title+"\x00"+newID)
			}
		}
		if len(kept) == 0 {
			delete(grants, bucket)
		} else {
			grants[bucket] = kept
		}
	}
	return changed
}

// deletedAppSweepEvery spaces the board reads: the session list is fetched far more often than apps disappear.
const deletedAppSweepEvery = 2 * time.Minute

// deletedAppCheckTimeout bounds one folder check of a sweep: a hung board call must not hold this sweep, and with it every later one.
var deletedAppCheckTimeout = 15 * time.Second

// deletedAppSweep remembers when each board was last checked for apps deleted outside App Lab, and what the last check found.
type deletedAppSweep struct {
	mu       sync.Mutex
	running  bool
	last     map[string]time.Time
	gone     map[string]map[string]time.Time // board -> app id -> start of the first sweep in a row that found it gone
	renaming map[string]int                  // app ids a rename is moving (see holdRename)
	releases uint64                          // rename holds released so far
	released map[string]uint64               // app id -> the release count when a rename last let it go
}

// sweepDeletedApps forgets, in the background, the apps the selected board no longer has; at most once per board per interval.
func (a *App) sweepDeletedApps() {
	a.checkoutMu.Lock()
	gen := a.boardGen // read before the board id: a board switch bumps it before the board changes
	a.checkoutMu.Unlock()
	boardID := a.selectedBoardID()
	// No board identity means no way to tell this board's entries from old ones, except on the board itself.
	if boardID == "" && !board.IsSBC() {
		return
	}
	s := &a.appSweep
	s.mu.Lock()
	if s.running || time.Since(s.last[boardID]) < deletedAppSweepEvery {
		s.mu.Unlock()
		return
	}
	if s.last == nil {
		s.last = map[string]time.Time{}
	}
	started := time.Now()
	s.running, s.last[boardID] = true, started
	s.mu.Unlock()
	go func() {
		defer func() {
			s.mu.Lock()
			s.running = false
			s.mu.Unlock()
		}()
		a.forgetDeletedWorkspaceApps(a.ctx(), gen, boardID, started)
	}()
}

// forgetDeletedWorkspaceApps forgets the apps an outside delete (board CLI, the orchestrator API, another App Lab) took without ForgetWorkspaceApp.
func (a *App) forgetDeletedWorkspaceApps(ctx context.Context, gen uint64, boardID string, started time.Time) {
	for appID, chats := range a.dropDeletedWorkspaceApps(ctx, gen, boardID, started) {
		slog.Info("[workspace] forgetting an app deleted outside App Lab", "app", appID)
		a.dropDeletedCheckout(appID, boardID, gen)
		a.emit("agent:workspace-app-forgotten", appID, forgottenChats(chats))
		go a.deleteWorkspaceAppChats(appID, chats)
	}
}

// dropDeletedWorkspaceApps drops the stores of the apps two sweeps an interval apart found gone and returns their chats: one sighting may be a rename RebindWorkspaceApp has not reached yet.
func (a *App) dropDeletedWorkspaceApps(ctx context.Context, gen uint64, boardID string, started time.Time) map[string]map[airuntime.AgentID][]string {
	s := &a.appSweep
	s.mu.Lock()
	mark := s.releases // a rename that ends after this may have moved what the reads below saw
	s.mu.Unlock()
	var gone []string
	// A checkout counts too: an app checked out from Agent Mode may have no chat or grant of its own.
	stored := append(a.workspaceAppIDs(boardID), a.checkedOutIDs(gen)...)
	slices.Sort(stored)
	if stored = slices.Compact(stored); len(stored) > 0 {
		conn := a.boardConn()
		if conn == nil {
			return nil
		}
		listed, appsDir, err := boardApps(ctx, a)
		if err != nil {
			return nil // a list that failed, or was cut short, forgets nothing
		}
		hung := false
		gone = deletedWorkspaceApps(stored, listed, func(folder string) bool {
			if hung {
				return false
			}
			checkCtx, cancel := context.WithTimeout(ctx, deletedAppCheckTimeout)
			defer cancel()
			_, err := awaitBoard(checkCtx, func() (remote.FileInfo, error) { return conn.Stats(path.Join(appsDir, folder)) })
			hung = checkCtx.Err() != nil
			return errors.Is(err, fs.ErrNotExist)
		})
		if hung {
			return nil // a sweep that could not check every folder learns nothing
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if a.boardChanged(gen) {
		return nil // these ids may name apps of the board now selected
	}
	found := make(map[string]time.Time, len(gone))
	forgotten := map[string]map[airuntime.AgentID][]string{}
	for _, id := range gone {
		first, again := s.gone[boardID][id]
		if !again {
			first = started
		}
		// Under the lock holdRename takes, so a rename cannot start between this check and the forget.
		if again && started.Sub(first) >= deletedAppSweepEvery && s.renaming[id] == 0 && s.released[id] <= mark {
			forgotten[id] = a.forgetWorkspaceAppStores(id, boardID, true)
			continue
		}
		found[id] = first
	}
	if s.gone == nil {
		s.gone = map[string]map[string]time.Time{}
	}
	s.gone[boardID] = found
	return forgotten
}

// boardApps reads the board's full app list and its apps folder, a variable so tests run without an orchestrator.
var boardApps = func(ctx context.Context, a *App) (listed []string, appsDir string, err error) {
	base, err := a.InferOrchestratorURL()
	if err != nil {
		return nil, "", err
	}
	if listed, err = arduinoapps.List(ctx, base); err != nil {
		return nil, "", err
	}
	appsDir, err = board.UserAppsDir(ctx, base)
	return listed, appsDir, err
}

// deletedWorkspaceApps picks the stored user apps the board does not list and whose folder is gone: an app the board cannot load is missing from the list too.
func deletedWorkspaceApps(stored, listed []string, folderGone func(folder string) bool) []string {
	present := make(map[string]bool, len(listed))
	for _, id := range listed {
		if folder, ok := userAppFolder(id); ok {
			present[folder] = true
		}
	}
	var gone []string
	for _, id := range stored {
		if folder, ok := userAppFolder(id); ok && !present[folder] && folderGone(folder) {
			gone = append(gone, id)
		}
	}
	return gone
}

// userAppFolder reads the folder out of a user app's id (base64 of "user:<folder>", padded or not, either alphabet); false for any other id.
func userAppFolder(appID string) (string, bool) {
	trimmed := strings.TrimRight(appID, "=")
	for _, enc := range []*base64.Encoding{base64.RawURLEncoding, base64.RawStdEncoding} {
		if dec, err := enc.DecodeString(trimmed); err == nil {
			folder, ok := strings.CutPrefix(string(dec), "user:")
			return folder, ok && folder != "" && !strings.Contains(folder, "/") && folder != ".."
		}
	}
	return "", false
}

// checkedOutIDs lists the apps checked out on the board of gen; none once the board changed.
func (a *App) checkedOutIDs(gen uint64) []string {
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	if a.boardGen != gen {
		return nil
	}
	return slices.Collect(maps.Keys(a.checkedOut))
}

// workspaceAppIDs lists the apps any agent's stores hold chats or grants for on this board; an entry written before board scoping names no board, so it is left alone.
func (a *App) workspaceAppIDs(boardID string) []string {
	a.storeMu.Lock()
	defer a.storeMu.Unlock()
	ids := map[string]bool{}
	for _, agentID := range airuntime.SupportedAgents() {
		dir, err := airuntime.AgentConfigDir(agentID)
		if err != nil {
			continue
		}
		if workspaces, err := readSessionWorkspaces(dir); err == nil {
			for _, ws := range workspaces {
				if ws.AppID != "" && ws.BoardID == boardID {
					ids[ws.AppID] = true
				}
			}
		}
		for bucket, keys := range readWorkspaceGrants(dir) {
			b, workspace, ok := splitBoardGrantKey(bucket)
			if !ok || b != boardID {
				continue
			}
			if workspace != "" {
				ids[workspace] = true
			}
			for _, k := range keys {
				if _, _, scope, ok := splitGrantKey(k); ok && scope != "" {
					ids[scope] = true
				}
			}
		}
	}
	out := make([]string, 0, len(ids))
	for id := range ids {
		out = append(out, id)
	}
	sort.Strings(out)
	return out
}
