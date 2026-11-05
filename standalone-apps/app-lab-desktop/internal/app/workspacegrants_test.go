package app

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"

	"app-lab-desktop/internal/agent"
	"app-lab-desktop/internal/airuntime"
)

// agentStoreDirs makes every agent's config dir, as an install would, and returns them by agent.
func agentStoreDirs(t *testing.T) map[airuntime.AgentID]string {
	t.Helper()
	dirs := map[airuntime.AgentID]string{}
	for _, id := range airuntime.SupportedAgents() {
		dir, err := airuntime.AgentConfigDir(id)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.MkdirAll(dir, 0o700); err != nil {
			t.Fatal(err)
		}
		dirs[id] = dir
	}
	return dirs
}

// Every agent's stores, not only the running one's: the other's grant would otherwise approve, unasked, the next app of that name.
func TestRenameAndDeleteReachEveryAgentsStores(t *testing.T) {
	a := testApp(t)
	dirs := agentStoreDirs(t)
	const oldID, newID = "dXNlcjpibGluaw", "dXNlcjpibGluay0y"
	const start = "other\x00mcp__arduino-board__apps_start\x00" + oldID
	for _, dir := range dirs {
		if err := writeWorkspaceGrants(dir, map[string][]string{boardGrantKey("", oldID): {start}}); err != nil {
			t.Fatal(err)
		}
	}

	a.RebindWorkspaceApp(oldID, newID, "Blink 2")
	for id, dir := range dirs {
		grants := readWorkspaceGrants(dir)
		if got := grants[boardGrantKey("", newID)]; len(got) != 1 || got[0] != "other\x00mcp__arduino-board__apps_start\x00"+newID {
			t.Errorf("%s: grants after the rename = %q, want the grant on the new id", id, grants)
		}
	}

	a.forgetWorkspaceAppStores(newID, "", false)
	for id, dir := range dirs {
		if got := readWorkspaceGrants(dir)[boardGrantKey("", newID)]; got != nil {
			t.Errorf("%s: the deleted app kept its grants %q", id, got)
		}
	}
}

// A grant given from Agent Mode is kept in the general workspace under the app's id: a later app of that name would inherit it.
func TestTheGeneralWorkspaceGrantsFollowTheApp(t *testing.T) {
	a := testApp(t)
	dirs := agentStoreDirs(t)
	const oldID, newID, otherID = "dXNlcjpibGluaw", "dXNlcjpibGluay0y", "dXNlcjpvdGhlcg"
	scoped := func(id string) string { return "other\x00mcp__arduino-board__app_files_rename\x00" + id }
	const outside = "edit\x00Edit /m/x.py\x00outside\x00/m/x.py"
	for _, dir := range dirs {
		if err := writeWorkspaceGrants(dir, map[string][]string{
			boardGrantKey("", ""):   {scoped(oldID), scoped(otherID), outside},
			boardGrantKey("B2", ""): {scoped(oldID)},
		}); err != nil {
			t.Fatal(err)
		}
	}

	a.RebindWorkspaceApp(oldID, newID, "Blink 2")
	for id, dir := range dirs {
		got := readWorkspaceGrants(dir)[boardGrantKey("", "")]
		if !slices.Contains(got, scoped(newID)) || slices.Contains(got, scoped(oldID)) {
			t.Errorf("%s: general grants after the rename = %q, want the app's on its new id", id, got)
		}
	}

	a.forgetWorkspaceAppStores(newID, "", false)
	for id, dir := range dirs {
		grants := readWorkspaceGrants(dir)
		got := grants[boardGrantKey("", "")]
		if slices.Contains(got, scoped(newID)) {
			t.Errorf("%s: the deleted app's grant stayed in the general workspace: %q", id, got)
		}
		if !slices.Contains(got, scoped(otherID)) || !slices.Contains(got, outside) {
			t.Errorf("%s: another app's grant or an outside grant went with it: %q", id, got)
		}
		if b2 := grants[boardGrantKey("B2", "")]; !slices.Contains(b2, scoped(oldID)) {
			t.Errorf("%s: another board's grant went with it: %q", id, b2)
		}
	}
}

// An app the board cannot load is missing from its list too: only a list without it and a folder that is gone mean it was deleted.
func TestDeletedWorkspaceAppsNeedTheFolderGone(t *testing.T) {
	id := func(s string) string { return base64.RawURLEncoding.EncodeToString([]byte(s)) }
	gone, broken := id("user:gone"), id("user:broken")
	listed := []string{id("user:blink"), id("examples:blink")}
	stored := []string{gone, broken, "dXNlcjpibGluaw==", id("examples:blink")} // blink stored padded, listed bare
	folderGone := func(folder string) bool { return folder == "gone" }

	got := deletedWorkspaceApps(stored, listed, folderGone)
	if len(got) != 1 || got[0] != gone {
		t.Errorf("forgotten = %q, want only the app whose folder is gone", got)
	}
}

// Only this board's entries: one written before board scoping may belong to another board's app of the same name.
func TestWorkspaceAppIDsComeFromThisBoardsChatsAndGrants(t *testing.T) {
	a := testApp(t)
	dirs := agentStoreDirs(t)
	if err := writeSessionWorkspaces(dirs[airuntime.AgentClaude], map[string]sessionWorkspaceEntry{
		"s1": {AppID: "chatApp", BoardID: "B1"},
		"s2": {AppID: "legacyApp"},
		"s3": {AppID: "otherBoardApp", BoardID: "B2"},
	}); err != nil {
		t.Fatal(err)
	}
	if err := writeWorkspaceGrants(dirs[airuntime.AgentOpenCode], map[string][]string{
		boardGrantKey("B1", "bucketApp"): {"other\x00mcp__arduino-board__apps_start\x00bucketApp"},
		boardGrantKey("B1", ""):          {"other\x00mcp__arduino-board__apps_start\x00generalApp", "other\x00mcp__arduino-board__models_delete\x00args\x00{}"},
		boardGrantKey("B2", ""):          {"other\x00mcp__arduino-board__apps_start\x00otherBoardGrant"},
	}); err != nil {
		t.Fatal(err)
	}

	got := a.workspaceAppIDs("B1")
	if want := []string{"bucketApp", "chatApp", "generalApp"}; !slices.Equal(got, want) {
		t.Errorf("app ids = %q, want %q", got, want)
	}
}

// A stopped engine still holds the deleted app's chats: the one with a delete command loses them now, the other's wait, hidden, for its next run.
func TestAppDeleteRemovesTheChatsOfAStoppedEngine(t *testing.T) {
	a := testApp(t)
	dirs := agentStoreDirs(t)
	const gone = "dXNlcjpnb25l"
	seed := map[airuntime.AgentID]map[string]sessionWorkspaceEntry{
		airuntime.AgentOpenCode: {"oc-1": {AppID: gone, BoardID: "board-a"}, "oc-2": {AppID: gone, BoardID: "board-a"}, "oc-keep": {AppID: "other", BoardID: "board-a"}},
		airuntime.AgentClaude:   {"cl-1": {AppID: gone, BoardID: "board-a"}, "cl-keep": {AppID: "other", BoardID: "board-a"}},
	}
	for id, entries := range seed {
		if err := writeSessionWorkspaces(dirs[id], entries); err != nil {
			t.Fatal(err)
		}
	}
	if err := writeSessionTitles(dirs[airuntime.AgentOpenCode], map[string]string{"oc-1": "Gone chat"}); err != nil {
		t.Fatal(err)
	}
	ocPicks, clPicks := agent.PickFileOf(airuntime.AgentOpenCode), agent.PickFileOf(airuntime.AgentClaude)
	ocPicks.SavePick("oc-1", agent.SessionPick{Model: "m"})
	clPicks.SavePick("cl-1", agent.SessionPick{Mode: "plan"})
	var mu sync.Mutex
	var deleted []string
	orig := deleteSessionCLI
	deleteSessionCLI = func(ctx context.Context, id airuntime.AgentID, sid string) error {
		if id != airuntime.AgentOpenCode {
			return orig(ctx, id, sid) // refuses at once: no delete command to run
		}
		mu.Lock()
		deleted = append(deleted, sid)
		mu.Unlock()
		return nil
	}
	t.Cleanup(func() { deleteSessionCLI = orig })

	a.deleteWorkspaceAppChats(gone, a.forgetWorkspaceAppStores(gone, "board-a", false))

	sort.Strings(deleted)
	if len(deleted) != 2 || deleted[0] != "oc-1" || deleted[1] != "oc-2" {
		t.Errorf("chats deleted through the CLI = %v, want OpenCode's two", deleted)
	}
	oc, _ := readSessionWorkspaces(dirs[airuntime.AgentOpenCode])
	if _, ok := oc["oc-1"]; ok || oc["oc-keep"].AppID != "other" {
		t.Errorf("OpenCode entries = %+v, want the deleted chats gone and the other app's kept", oc)
	}
	if titles, _ := readSessionTitles(dirs[airuntime.AgentOpenCode]); titles["oc-1"] != "" {
		t.Error("a deleted chat kept its title")
	}
	if oc, cl := ocPicks.Pick("oc-1"), clPicks.Pick("cl-1"); oc != (agent.SessionPick{}) || cl != (agent.SessionPick{}) {
		t.Errorf("picks left: deleted chat %+v, pending chat %+v; want both dropped with the chats' other entries", oc, cl)
	}
	claude := dirs[airuntime.AgentClaude]
	if cl, _ := readSessionWorkspaces(claude); cl["cl-1"] != (sessionWorkspaceEntry{}) || cl["cl-keep"].AppID != "other" {
		t.Errorf("Claude entries = %+v, want the deleted app's chat bound to nothing: unbound, it lists as a chat about the whole board", cl)
	}
	if pending, _ := readSessionPendingDeletes(claude); !slices.Equal(pending, []string{"cl-1"}) {
		t.Fatalf("Claude's pending deletes = %v, want the chat it could not delete", pending)
	}

	f := &engineFake{listed: map[string]bool{"cl-1": true, "cl-keep": true}, deletes: true}
	m := startEngineFake(t, a, f)
	a.agentMgrID = airuntime.AgentClaude
	sessions, err := a.AgentListSessions()
	if err != nil {
		t.Fatal(err)
	}
	if len(sessions) != 1 || sessions[0].ID != "cl-keep" {
		t.Errorf("listed %+v, want the deleted app's chat hidden until Claude's next start deletes it", sessions)
	}
	a.deletePendingChats(m, airuntime.AgentClaude, a.pendingSessionDeletes(airuntime.AgentClaude))
	f.mu.Lock()
	listed := f.listed["cl-1"]
	f.mu.Unlock()
	if pending, _ := readSessionPendingDeletes(claude); listed || len(pending) != 0 {
		t.Errorf("after the start: still listed %v, pending %v; want the chat deleted and its id forgotten", listed, pending)
	}
}

// The chat that deleted its own app is running then: it stays, about no app, so no later sweep finds the app again and deletes it.
func TestTheChatThatDeletedItsAppStays(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	const gone = "dXNlcjpnb25l"
	if err := writeSessionWorkspaces(dir, map[string]sessionWorkspaceEntry{
		"s-run":  {AppID: gone, BoardID: "B1"},
		"s-idle": {AppID: gone, BoardID: "B1"},
	}); err != nil {
		t.Fatal(err)
	}
	f := &engineFake{listed: map[string]bool{"s-run": true, "s-idle": true}, turn: make(chan struct{})}
	m := startEngineFake(t, a, f)
	stubDeleteCLI(t, func(_ context.Context, _ airuntime.AgentID, sid string) error {
		f.mu.Lock()
		delete(f.listed, sid)
		f.mu.Unlock()
		return nil
	})
	prompted := make(chan error, 1)
	go func() { prompted <- a.AgentPrompt("s-run", "delete this app", nil) }()
	for deadline := time.Now().Add(5 * time.Second); !m.StreamingSessions()["s-run"]; time.Sleep(5 * time.Millisecond) {
		if time.Now().After(deadline) {
			t.Fatal("the chat's turn never started")
		}
	}

	a.deleteWorkspaceAppChats(gone, a.forgetWorkspaceAppStores(gone, "B1", false))
	_ = m.Cancel(context.Background(), "s-run")
	select {
	case <-prompted:
	case <-time.After(5 * time.Second):
		t.Fatal("the stopped turn never ended")
	}

	f.mu.Lock()
	running, idle := f.listed["s-run"], f.listed["s-idle"]
	f.mu.Unlock()
	if !running || idle {
		t.Errorf("still listed: running chat %v, idle chat %v; want only the running one kept", running, idle)
	}
	if left, _ := readSessionWorkspaces(dir); left["s-run"] != (sessionWorkspaceEntry{BoardID: "B1"}) {
		t.Errorf("the running chat's entry = %+v, want its board and no app", left["s-run"])
	}
	if ids := a.workspaceAppIDs("B1"); slices.Contains(ids, gone) {
		t.Errorf("the next sweep's candidates %q still hold the deleted app", ids)
	}
}

// An app id is base64 of "type:name": a rename mints a new one and a freed name can be retaken, silently losing grants or handing them to a different app.
func TestWorkspaceGrantsRekeying(t *testing.T) {
	const oldID, newID = "dXNlcjpibGluaw", "dXNlcjpibGluay0y"

	seed := func(t *testing.T) string {
		t.Helper()
		dir := t.TempDir()
		if err := writeWorkspaceGrants(dir, map[string][]string{
			boardGrantKey("board-a", oldID):  {"other\x00mcp__arduino-board__apps_start"},
			boardGrantKey("board-b", oldID):  {"other\x00mcp__arduino-board__apps_start"},
			boardGrantKey("board-a", "keep"): {"other\x00mcp__arduino-board__apps_stop"},
		}); err != nil {
			t.Fatal(err)
		}
		if err := writeSessionWorkspaces(dir, map[string]sessionWorkspaceEntry{
			"s1": {AppID: oldID, Name: "Blink", BoardID: "board-a"},
			"s2": {AppID: "other", Name: "Other"},
			// Same app id, another board: ids are derived from the name, so two boards can both hold a "Blink".
			"s3": {AppID: oldID, Name: "Blink", BoardID: "board-b"},
		}); err != nil {
			t.Fatal(err)
		}
		return dir
	}

	t.Run("a rename carries the grants and the sessions over", func(t *testing.T) {
		dir := seed(t)
		rekeyWorkspaceApp(dir, oldID, newID, "Blink 2", "board-a")

		grants := readWorkspaceGrants(dir)
		if len(grants[boardGrantKey("board-a", newID)]) != 1 || grants[boardGrantKey("board-a", oldID)] != nil {
			t.Errorf("grants did not follow the rename: %+v", grants)
		}
		if len(grants[boardGrantKey("board-a", "keep")]) != 1 {
			t.Error("another app's grants were touched")
		}
		// The other board holds an app of the same id: its grants are not the renaming board's to move.
		if len(grants[boardGrantKey("board-b", oldID)]) != 1 {
			t.Error("another board's grants were moved by this board's rename")
		}

		ws, err := readSessionWorkspaces(dir)
		if err != nil {
			t.Fatal(err)
		}
		if ws["s1"].AppID != newID || ws["s1"].Name != "Blink 2" {
			t.Errorf("the session still points at the old app: %+v", ws["s1"])
		}
		// A rename is not a move to another board: losing the board would list the session on every one of them.
		if ws["s1"].BoardID != "board-a" {
			t.Errorf("the rename dropped the session's board: %+v", ws["s1"])
		}
		if ws["s2"].AppID != "other" {
			t.Error("another app's session was rewritten")
		}
		// The rename happened on board A: board B's app of that id was not renamed and must keep its own name and id.
		if ws["s3"].AppID != oldID || ws["s3"].Name != "Blink" {
			t.Errorf("another board's app was renamed too: %+v", ws["s3"])
		}
	})

	t.Run("a delete drops the grants so a same-named app cannot inherit them", func(t *testing.T) {
		dir := seed(t)
		dropWorkspaceApp(dir, oldID, "board-a", mirrorKey("board-a", oldID))

		grants := readWorkspaceGrants(dir)
		if grants[boardGrantKey("board-a", oldID)] != nil {
			t.Error("a deleted app kept its grants")
		}
		if len(grants[boardGrantKey("board-a", "keep")]) != 1 {
			t.Error("another app's grants were dropped too")
		}
		// Deleting on one board must not disarm the same-named app on the other.
		if len(grants[boardGrantKey("board-b", oldID)]) != 1 {
			t.Error("another board's grants were dropped too")
		}
	})

	t.Run("an unknown app changes nothing", func(t *testing.T) {
		dir := seed(t)
		before, err := os.ReadFile(filepath.Join(dir, workspaceGrantsFile))
		if err != nil {
			t.Fatal(err)
		}
		rekeyWorkspaceApp(dir, "nope", "also-nope", "", "board-a")
		dropWorkspaceApp(dir, "nope", "board-a", mirrorKey("board-a", "nope"))
		after, _ := os.ReadFile(filepath.Join(dir, workspaceGrantsFile))
		if string(before) != string(after) {
			t.Error("the file was rewritten for an app it does not hold")
		}
	})
}

// A rename moves the mirror directory every file grant's title carries: left behind, the grants sit under the new id matching nothing and the user is asked again.
func TestRenameFollowsTheGrantsOntoTheNewMirror(t *testing.T) {
	dir := t.TempDir()
	const old, new = "board__user-blink-blue-039ad4", "board__user-blink-azure-7c1e2b"
	write := func(grants map[string][]string) {
		if err := writeWorkspaceGrants(dir, grants); err != nil {
			t.Fatal(err)
		}
	}
	write(map[string][]string{
		boardGrantKey("board-a", "newid"): {
			"edit\x00Edit " + old + "/python/main.py\x00",
			"other\x00mcp__arduino-board__apps_start\x00oldid",
			"other\x00mcp__arduino-board__apps_start\x00someoneelse",
		},
	})

	remapGrantsToRenamedApp(dir, "oldid", "newid", old, new, "board-a")

	got := readWorkspaceGrants(dir)[boardGrantKey("board-a", "newid")]
	if got[0] != "edit\x00Edit "+new+"/python/main.py\x00" {
		t.Errorf("the file grant still points at the old mirror: %q", got[0])
	}
	// An app tool is scoped to the app id, so that half has to move as well or the permission stops matching.
	if got[1] != "other\x00mcp__arduino-board__apps_start\x00newid" {
		t.Errorf("the app tool's grant still names the old app: %q", got[1])
	}
	if got[2] != "other\x00mcp__arduino-board__apps_start\x00someoneelse" {
		t.Errorf("another app's grant was rewritten: %q", got[2])
	}
}

// A file grant given from another workspace names the app's checkout folder: a new app of that name gets the folder back, so a delete drops it and a rename moves it.
func TestFileGrantsFromOtherWorkspacesFollowTheApp(t *testing.T) {
	a := testApp(t)
	dirs := agentStoreDirs(t)
	id := func(s string) string { return base64.RawURLEncoding.EncodeToString([]byte(s)) }
	blink, renamed, other := id("user:blink"), id("user:blink-2"), id("user:other")
	folder, mirror := mirrorKey("", blink), a.workspaceMirrorDir(blink)
	general := "edit\x00Edit " + folder + "/sketch/sketch.ino\x00" // Claude titles an edit with the path from the mirror root
	outside := "edit\x00Edit " + mirror + "/python/main.py\x00outside\x00" + mirror + "/python/main.py"
	longer := "edit\x00Edit " + folder + "-copy/main.py\x00" // a folder whose name starts with this one's
	seed := func() {
		for _, dir := range dirs {
			if err := writeWorkspaceGrants(dir, map[string][]string{
				boardGrantKey("", ""):    {general, longer},
				boardGrantKey("", other): {outside},
			}); err != nil {
				t.Fatal(err)
			}
		}
	}

	seed()
	a.RebindWorkspaceApp(blink, renamed, "Blink 2")
	moved := func(k string) string { return strings.ReplaceAll(k, folder+"/", mirrorKey("", renamed)+"/") }
	for agentID, dir := range dirs {
		g := readWorkspaceGrants(dir)
		if got := g[boardGrantKey("", "")]; !slices.Equal(got, []string{moved(general), longer}) {
			t.Errorf("%s: general grants after the rename = %q, want the file grant on the new folder and the other folder's untouched", agentID, got)
		}
		if got := g[boardGrantKey("", other)]; !slices.Equal(got, []string{moved(outside)}) {
			t.Errorf("%s: another app's outside grant after the rename = %q, want it on the new folder", agentID, got)
		}
	}

	seed()
	a.forgetWorkspaceAppStores(blink, "", false)
	for agentID, dir := range dirs {
		g := readWorkspaceGrants(dir)
		if got := g[boardGrantKey("", "")]; !slices.Equal(got, []string{longer}) {
			t.Errorf("%s: general grants after the delete = %q, want only the other folder's", agentID, got)
		}
		if got, ok := g[boardGrantKey("", other)]; ok {
			t.Errorf("%s: another app's outside grant on the deleted app's folder survived: %q", agentID, got)
		}
	}
}

// A chat outlives the app it was about only to fail at its first checkout, so deleting the app takes its chats with it.
func TestDeletingAnAppFindsItsChats(t *testing.T) {
	dir := t.TempDir()
	if err := writeSessionWorkspaces(dir, map[string]sessionWorkspaceEntry{
		"s-doomed":  {AppID: "gone", Name: "Gone", BoardID: "board-a"},
		"s-doomed2": {AppID: "gone", Name: "Gone"}, // written before board scoping: kept, like the sidebar keeps it
		"s-other":   {AppID: "stays", Name: "Stays"},
		"s-general": {},
		// Another board's app of the same id: its chats are about an app that still exists.
		"s-elsewhere": {AppID: "gone", Name: "Gone", BoardID: "board-b"},
	}); err != nil {
		t.Fatal(err)
	}

	got := chatsOfWorkspaceApp(dir, "gone", "board-a", false)

	sort.Strings(got)
	if len(got) != 2 || got[0] != "s-doomed" || got[1] != "s-doomed2" {
		t.Errorf("the deleted app's chats came out as %v", got)
	}
	// The sweep's forget is strict: an entry with no board may be about another board's app of that name.
	if got := chatsOfWorkspaceApp(dir, "gone", "board-a", true); len(got) != 1 || got[0] != "s-doomed" {
		t.Errorf("strict: the deleted app's chats came out as %v, want only the one stamped with the board", got)
	}
	if len(chatsOfWorkspaceApp(dir, "", "board-a", false)) != 0 {
		t.Error("an empty app id swept up the general chats")
	}
}

// No chat may go on claiming a deleted app, the running one that deleted it included: the next sweep would find the app again and delete that chat.
func TestDeletingAnAppLeavesNoChatClaimingIt(t *testing.T) {
	dir := t.TempDir()
	if err := writeSessionWorkspaces(dir, map[string]sessionWorkspaceEntry{
		"s-draft":     {AppID: "gone", Name: "Gone"},
		"s-running":   {AppID: "gone", Name: "Gone", BoardID: "board-a"},
		"s-other":     {AppID: "stays", Name: "Stays"},
		"s-elsewhere": {AppID: "gone", Name: "Gone", BoardID: "board-b"},
	}); err != nil {
		t.Fatal(err)
	}

	listed := chatsOfWorkspaceApp(dir, "gone", "board-a", false)
	// After the forget listed them, a rename moves another app's chat onto the freed id: it is not one of the deleted app's.
	moved, _ := readSessionWorkspaces(dir)
	moved["s-moved"] = sessionWorkspaceEntry{AppID: "gone", Name: "Renamed", BoardID: "board-a"}
	if err := writeSessionWorkspaces(dir, moved); err != nil {
		t.Fatal(err)
	}
	dropWorkspaceAppSessions(dir, "gone", listed)

	left, err := readSessionWorkspaces(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := left["s-draft"]; ok {
		t.Error("an entry written before board scoping still claims the deleted app")
	}
	// The app is gone, the board isn't: dropping the entry outright would list the chat on every board.
	if ws, ok := left["s-running"]; !ok || ws.AppID != "" || ws.BoardID != "board-a" {
		t.Errorf("the running chat = %+v (kept %v), want it kept with its board and no app", ws, ok)
	}
	if _, ok := left["s-other"]; !ok {
		t.Error("another app's chat was swept up")
	}
	// The delete happened on board A; board B's app of that id is still there, so its chats keep pointing at it.
	if ws := left["s-elsewhere"]; ws.AppID != "gone" || ws.BoardID != "board-b" {
		t.Errorf("another board's chat lost the app it is about: %+v", ws)
	}
	if ws := left["s-moved"]; ws.AppID != "gone" {
		t.Errorf("a chat moved onto the id after the forget lost its app: %+v", ws)
	}
}

// These writers run with whatever board is connected, so "no board" must never widen to "every board".
func TestNoConnectedBoardTouchesOnlyUnscopedSessions(t *testing.T) {
	dir := t.TempDir()
	seed := map[string]sessionWorkspaceEntry{
		"s-legacy":  {AppID: "gone", Name: "Gone"},
		"s-board-a": {AppID: "gone", Name: "Gone", BoardID: "board-a"},
	}
	if err := writeSessionWorkspaces(dir, seed); err != nil {
		t.Fatal(err)
	}

	if got := chatsOfWorkspaceApp(dir, "gone", "", false); len(got) != 1 || got[0] != "s-legacy" {
		t.Errorf("chats came out as %v, want only the unscoped one", got)
	}
	dropWorkspaceAppSessions(dir, "gone", chatsOfWorkspaceApp(dir, "gone", "", false))
	rekeyWorkspaceApp(dir, "gone", "renamed", "Renamed", "")

	left, err := readSessionWorkspaces(dir)
	if err != nil {
		t.Fatal(err)
	}
	if ws := left["s-board-a"]; ws.AppID != "gone" || ws.BoardID != "board-a" {
		t.Errorf("a board's session was rewritten with no board connected: %+v", ws)
	}
}

// An "always allow" is answered for one board's app, not for whatever app of that name another board happens to
// hold: ids come from the name, so without the board in the key an app tool granted on A auto-approves on B.
func TestGrantsDoNotCrossBoards(t *testing.T) {
	dir := t.TempDir()
	const blink = "dXNlcjpibGluaw"
	const start = "other\x00mcp__arduino-board__apps_start\x00" + blink
	if err := writeWorkspaceGrants(dir, map[string][]string{
		boardGrantKey("board-a", blink): {start},
		blink:                           {start}, // written before board scoping: belongs to no board
	}); err != nil {
		t.Fatal(err)
	}

	all := readWorkspaceGrants(dir)
	if _, ok := all[boardGrantKey("board-b", blink)]; ok {
		t.Fatal("the seed already holds board B")
	}

	// What LoadGrants hands the agent for each board, mirrored here so the test does not need an App.
	forBoard := func(boardID string) map[string][]string {
		out := map[string][]string{}
		for key, keys := range all {
			if board, workspace, ok := splitBoardGrantKey(key); ok && board == boardID {
				out[workspace] = keys
			}
		}
		return out
	}

	if len(forBoard("board-a")[blink]) != 1 {
		t.Error("the granting board lost its own grant")
	}
	if got := forBoard("board-b")[blink]; got != nil {
		t.Errorf("board B inherited board A's always-allow: %q", got)
	}
	// A pre-scoping entry names no board, and adopting it for the connected one is the same cross-board approval.
	if got := forBoard("")[blink]; got != nil {
		t.Errorf("an unscoped legacy entry was adopted: %q", got)
	}
}

// stubBoardApps replaces the sweep's read of the board's app list for one test.
func stubBoardApps(t *testing.T, fn func(context.Context, *App) ([]string, string, error)) {
	t.Helper()
	orig := boardApps
	boardApps = fn
	t.Cleanup(func() { boardApps = orig })
}

// sweptApps runs one sweep of board B1 started at the given time and returns the apps it forgot.
func sweptApps(a *App, gen uint64, started time.Time) []string {
	return slices.Sorted(maps.Keys(a.dropDeletedWorkspaceApps(context.Background(), gen, "B1", started)))
}

// An app is forgotten once two sweeps an interval apart found it gone and no rename holds it: a rename takes the old id off the board before its chats move.
func TestTheSweepForgetsAnAppTwoSweepsFoundGone(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	id := func(s string) string { return base64.RawURLEncoding.EncodeToString([]byte(s)) }
	gone, renaming, back := id("user:gone"), id("user:renaming"), id("user:back")
	if err := writeSessionWorkspaces(dir, map[string]sessionWorkspaceEntry{
		"s-gone":     {AppID: gone, BoardID: "B1"},
		"s-legacy":   {AppID: gone},
		"s-b2":       {AppID: gone, BoardID: "B2"},
		"s-renaming": {AppID: renaming, BoardID: "B1"},
		"s-back":     {AppID: back, BoardID: "B1"},
	}); err != nil {
		t.Fatal(err)
	}
	conn := &memBoardConn{files: map[string]string{}}
	a.selectedBoard.Conn = conn
	stubBoardApps(t, func(context.Context, *App) ([]string, string, error) { return nil, "/apps", nil })
	t0 := time.Now()

	if got := sweptApps(a, 0, t0); len(got) != 0 {
		t.Fatalf("the first sweep that found them gone forgot %q", got)
	}
	conn.files["/apps/back"] = "" // its folder is there again
	release := a.holdRename(renaming, id("user:renamed"))
	forgotten := a.dropDeletedWorkspaceApps(context.Background(), 0, "B1", t0.Add(deletedAppSweepEvery))
	release()
	if len(forgotten) != 1 || !slices.Equal(forgotten[gone][airuntime.AgentOpenCode], []string{"s-gone"}) {
		t.Errorf("the second sweep forgot %v, want the gone app's chat on this board alone", forgotten)
	}
	delete(conn.files, "/apps/back")
	if got := sweptApps(a, 0, t0.Add(2*deletedAppSweepEvery)); !slices.Equal(got, []string{renaming}) {
		t.Errorf("the third sweep forgot %q, want the app the rename no longer holds (the other was seen again in between)", got)
	}

	stubDeleteCLI(t, func(context.Context, airuntime.AgentID, string) error { return nil })
	a.deleteWorkspaceAppChats(gone, forgotten[gone])
	left, _ := readSessionWorkspaces(dir)
	if _, ok := left["s-gone"]; ok || left["s-legacy"].AppID != gone || left["s-b2"].AppID != gone {
		t.Errorf("entries after the sweep's delete = %+v, want its chat gone and the ones with no board or another board's kept", left)
	}
}

// emitted is an event App Lab sent, with its data.
type emitted struct {
	event string
	data  []any
}

// stubEmit records the events App Lab sends, for one test.
func stubEmit(t *testing.T) func() []emitted {
	t.Helper()
	var mu sync.Mutex
	var events []emitted
	orig := emitEvent
	emitEvent = func(_ context.Context, event string, data ...any) {
		mu.Lock()
		events = append(events, emitted{event, data})
		mu.Unlock()
	}
	t.Cleanup(func() { emitEvent = orig })
	return func() []emitted {
		mu.Lock()
		defer mu.Unlock()
		return slices.Clone(events)
	}
}

// ForgetWorkspaceApp (App Lab's delete, apps_delete) and the sweep drop the checkout, the sweep also of an app only a checkout knew.
func TestEveryDeleteDropsTheAppsCheckout(t *testing.T) {
	const app = "dXNlcjpibGluaw" // user:blink
	checkout := func(t *testing.T, a *App) string {
		t.Helper()
		mirror := a.workspaceMirrorDir(app)
		writeFiles(t, mirror, map[string]string{"main.py": "print(1)"})
		sum := sha256.Sum256([]byte("print(1)"))
		a.checkedOut[app] = checkedApp{appPath: "/apps/blink", mirror: mirror, baseline: time.Now(), hashes: map[string]string{"main.py": hex.EncodeToString(sum[:])}, baselined: true}
		return mirror
	}
	dropped := func(t *testing.T, a *App, mirror string) {
		t.Helper()
		if _, tracked := a.checkedOut[app]; tracked {
			t.Error("the deleted app is still checked out")
		}
		if _, err := os.Stat(mirror); !errors.Is(err, os.ErrNotExist) {
			t.Errorf("its checkout is still at %s (%v)", mirror, err)
		}
	}
	// The event names the app, then exactly the chats the forget took, of every agent: the sidebar hides those and no other chat of the id.
	told := func(t *testing.T, events []emitted, chats []string) {
		t.Helper()
		for _, e := range events {
			if e.event != "agent:workspace-app-forgotten" {
				continue
			}
			if got, _ := e.data[len(e.data)-1].([]string); len(e.data) != 2 || e.data[0] != app || got == nil || !slices.Equal(got, chats) {
				t.Errorf("event data = %#v, want the app id, then %q (never null)", e.data, chats)
			}
			return
		}
		t.Error("no agent:workspace-app-forgotten event")
	}
	// deleted waits for the background delete of the chats, so it ends before the test's stubs are put back.
	deleted := func(t *testing.T, dir string, chats ...string) {
		t.Helper()
		for start := time.Now(); ; time.Sleep(10 * time.Millisecond) {
			left, _ := readSessionWorkspaces(dir)
			if !slices.ContainsFunc(chats, func(id string) bool { _, ok := left[id]; return ok }) {
				return
			}
			if time.Since(start) > 5*time.Second {
				t.Fatalf("chats %q were never deleted", chats)
			}
		}
	}
	t.Run("ForgetWorkspaceApp", func(t *testing.T) {
		a := testApp(t)
		events := stubEmit(t)
		stubDeleteCLI(t, func(context.Context, airuntime.AgentID, string) error { return nil })
		dirs := agentStoreDirs(t)
		if err := writeSessionWorkspaces(dirs[airuntime.AgentOpenCode], map[string]sessionWorkspaceEntry{"ses_a": {AppID: app}, "ses_other": {AppID: "dXNlcjpvdGhlcg"}}); err != nil {
			t.Fatal(err)
		}
		if err := writeSessionWorkspaces(dirs[airuntime.AgentClaude], map[string]sessionWorkspaceEntry{"c-b": {AppID: app}}); err != nil {
			t.Fatal(err)
		}
		mirror := checkout(t, a)
		a.ForgetWorkspaceApp(app)
		dropped(t, a, mirror)
		told(t, events(), []string{"c-b", "ses_a"})
		deleted(t, dirs[airuntime.AgentOpenCode], "ses_a")
		deleted(t, dirs[airuntime.AgentClaude], "c-b")
	})
	t.Run("the sweep", func(t *testing.T) {
		a := testApp(t)
		events := stubEmit(t)
		stubDeleteCLI(t, func(context.Context, airuntime.AgentID, string) error { return nil })
		dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
		if err := writeSessionWorkspaces(dir, map[string]sessionWorkspaceEntry{"ses_a": {AppID: app, BoardID: "B1"}, "ses_legacy": {AppID: app}}); err != nil {
			t.Fatal(err)
		}
		a.selectedBoard.Conn = &memBoardConn{files: map[string]string{}}
		stubBoardApps(t, func(context.Context, *App) ([]string, string, error) { return nil, "/apps", nil })
		mirror := checkout(t, a)
		t0 := time.Now()
		if got := sweptApps(a, 0, t0); len(got) != 0 {
			t.Fatalf("the first sweep forgot %q", got)
		}
		a.forgetDeletedWorkspaceApps(context.Background(), 0, "B1", t0.Add(deletedAppSweepEvery))
		dropped(t, a, mirror)
		told(t, events(), []string{"ses_a"}) // the sweep leaves an entry with no board alone
		deleted(t, dir, "ses_a")
	})
	t.Run("no chat", func(t *testing.T) {
		a := testApp(t)
		events := stubEmit(t)
		a.ForgetWorkspaceApp(app)
		told(t, events(), []string{})
	})
}

// hungBoardConn stops answering once hang is set, as a half-open SSH link does.
type hungBoardConn struct {
	memBoardConn
	hang     atomic.Bool
	released chan struct{}
}

func (c *hungBoardConn) Stats(p string) (remote.FileInfo, error) {
	if c.hang.Load() {
		<-c.released
	}
	return c.memBoardConn.Stats(p)
}

// A sweep that could not finish (a failed read, a board switch, a hung board call) learns nothing: what an earlier sweep saw still counts.
func TestASweepThatCannotFinishForgetsNothing(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	gone := base64.RawURLEncoding.EncodeToString([]byte("user:gone"))
	if err := writeSessionWorkspaces(dir, map[string]sessionWorkspaceEntry{"s-gone": {AppID: gone, BoardID: "B1"}}); err != nil {
		t.Fatal(err)
	}
	conn := &hungBoardConn{memBoardConn: memBoardConn{files: map[string]string{}}, released: make(chan struct{})}
	t.Cleanup(func() { close(conn.released) })
	a.selectedBoard.Conn = conn
	read := func(context.Context, *App) ([]string, string, error) { return nil, "/apps", nil }
	stubBoardApps(t, read)
	t0 := time.Now()
	if got := sweptApps(a, 0, t0); len(got) != 0 {
		t.Fatalf("the first sweep forgot %q", got)
	}

	stubBoardApps(t, func(context.Context, *App) ([]string, string, error) { return nil, "", errors.New("board unreachable") })
	if got := sweptApps(a, 0, t0.Add(deletedAppSweepEvery)); len(got) != 0 {
		t.Errorf("a sweep whose list failed forgot %q", got)
	}
	stubBoardApps(t, func(_ context.Context, a *App) ([]string, string, error) {
		a.checkoutMu.Lock()
		a.boardGen++ // the board switches during the read
		a.checkoutMu.Unlock()
		return nil, "/apps", nil
	})
	if got := sweptApps(a, 0, t0.Add(2*deletedAppSweepEvery)); len(got) != 0 {
		t.Errorf("a sweep across a board switch forgot %q", got)
	}
	stubBoardApps(t, read)
	conn.hang.Store(true)
	orig := deletedAppCheckTimeout
	deletedAppCheckTimeout = 50 * time.Millisecond
	t.Cleanup(func() { deletedAppCheckTimeout = orig })
	done := make(chan []string, 1)
	go func() { done <- sweptApps(a, 1, t0.Add(3*deletedAppSweepEvery)) }()
	select {
	case got := <-done:
		if len(got) != 0 {
			t.Errorf("a sweep whose folder check hung forgot %q", got)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("a hung board call held the sweep")
	}

	conn.hang.Store(false)
	if got := sweptApps(a, 1, t0.Add(4*deletedAppSweepEvery)); !slices.Equal(got, []string{gone}) {
		t.Errorf("the next full sweep forgot %q, want the app the first sweep found gone", got)
	}
}

// A sweep reads the board at most once per board per interval, one at a time: the session list that starts it is read far more often.
func TestASweepRunsOncePerBoardPerInterval(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	if err := writeSessionWorkspaces(dir, map[string]sessionWorkspaceEntry{"s1": {AppID: "dXNlcjpibGluaw", BoardID: "B1"}}); err != nil {
		t.Fatal(err)
	}
	a.selectedBoard.Info.Serial = "B1"
	a.selectedBoard.Conn = &memBoardConn{files: map[string]string{}}
	reads, release := make(chan struct{}, 4), make(chan struct{})
	stubBoardApps(t, func(context.Context, *App) ([]string, string, error) {
		reads <- struct{}{}
		<-release
		return nil, "", errors.New("board unreachable")
	})
	idle := func() {
		for deadline := time.Now().Add(5 * time.Second); ; time.Sleep(5 * time.Millisecond) {
			a.appSweep.mu.Lock()
			running := a.appSweep.running
			a.appSweep.mu.Unlock()
			if !running {
				return
			}
			if time.Now().After(deadline) {
				t.Fatal("the sweep never ended")
			}
		}
	}

	a.sweepDeletedApps()
	<-reads
	a.sweepDeletedApps() // while the first one reads the board
	close(release)
	idle()
	a.sweepDeletedApps() // within the interval
	idle()
	if len(reads) != 0 {
		t.Errorf("%d more board reads, want none until the interval has passed", len(reads))
	}
	a.appSweep.mu.Lock()
	a.appSweep.last["B1"] = time.Now().Add(-deletedAppSweepEvery)
	a.appSweep.mu.Unlock()
	a.sweepDeletedApps()
	select {
	case <-reads:
	case <-time.After(5 * time.Second):
		t.Error("no sweep once the interval had passed")
	}
	idle()
}

// statsHookConn runs before a folder check, to stand in for what happens on the board meanwhile.
type statsHookConn struct {
	memBoardConn
	hookMu sync.Mutex
	before func(path string)
}

func (c *statsHookConn) Stats(p string) (remote.FileInfo, error) {
	c.hookMu.Lock()
	before := c.before
	c.hookMu.Unlock()
	if before != nil {
		before(p)
	}
	return c.memBoardConn.Stats(p)
}

// A rename that ends while a sweep checks the board may move chats onto an id the sweep just saw gone: that id waits for the next sweep.
func TestTheSweepSkipsAnIdARenameTouchedDuringIt(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	id := func(s string) string { return base64.RawURLEncoding.EncodeToString([]byte(s)) }
	blink, blink2, cafe := id("user:blink"), id("user:blink-2"), id("user:cafe") // blink's folder is checked before cafe's
	if err := writeSessionWorkspaces(dir, map[string]sessionWorkspaceEntry{
		"old-blink": {AppID: blink, BoardID: "B1"},
		"s-mine":    {AppID: blink2, BoardID: "B1"},
		"old-cafe":  {AppID: cafe, BoardID: "B1"},
	}); err != nil {
		t.Fatal(err)
	}
	conn := &statsHookConn{memBoardConn: memBoardConn{files: map[string]string{"/apps/blink-2": ""}}}
	a.selectedBoard.Info.Serial, a.selectedBoard.Conn = "B1", conn
	stubBoardApps(t, func(context.Context, *App) ([]string, string, error) { return []string{blink2}, "/apps", nil })
	t0 := time.Now()
	if got := sweptApps(a, 0, t0); len(got) != 0 {
		t.Fatalf("the first sweep forgot %q", got)
	}

	conn.before = func(p string) {
		if p != "/apps/cafe" {
			return
		}
		// The user renames blink-2 to blink, the name the deleted app had: the board moves the folder, App Lab rebinds.
		conn.mu.Lock()
		delete(conn.files, "/apps/blink-2")
		conn.files["/apps/blink"] = ""
		conn.mu.Unlock()
		a.RebindWorkspaceApp(blink2, blink, "blink")
	}
	forgotten := a.dropDeletedWorkspaceApps(context.Background(), 0, "B1", t0.Add(deletedAppSweepEvery))

	if chats, ok := forgotten[blink]; ok {
		t.Errorf("the sweep forgot the id the rename moved chats onto, with %v", chats)
	}
	if _, ok := forgotten[cafe]; !ok {
		t.Errorf("forgotten = %v, want the other gone app", forgotten)
	}
	if ws, _ := readSessionWorkspaces(dir); ws["s-mine"].AppID != blink {
		t.Errorf("the renamed app's chat = %+v, want it on the new id", ws["s-mine"])
	}
}

// An unreadable pending list is not replaced, or the ids it holds would be lost: the chat it could not take keeps its entries.
func TestAnUnreadablePendingListIsLeftAlone(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentClaude]
	const gone = "dXNlcjpnb25l"
	if err := writeSessionWorkspaces(dir, map[string]sessionWorkspaceEntry{"cl-1": {AppID: gone, BoardID: "B1"}}); err != nil {
		t.Fatal(err)
	}
	if err := writeSessionTitles(dir, map[string]string{"cl-1": "Kept"}); err != nil {
		t.Fatal(err)
	}
	pendingFile := filepath.Join(dir, sessionPendingDeletesFile)
	if err := os.WriteFile(pendingFile, []byte("not json"), 0o600); err != nil {
		t.Fatal(err)
	}
	stubDeleteCLI(t, func(context.Context, airuntime.AgentID, string) error { return errors.New("no delete command") })

	a.deleteWorkspaceAppChats(gone, a.forgetWorkspaceAppStores(gone, "B1", false))

	if data, _ := os.ReadFile(pendingFile); string(data) != "not json" {
		t.Errorf("the pending list was replaced with %q", data)
	}
	if titles, _ := readSessionTitles(dir); titles["cl-1"] != "Kept" {
		t.Errorf("the chat lost its title: %v", titles)
	}
	if ws, _ := readSessionWorkspaces(dir); ws["cl-1"] != (sessionWorkspaceEntry{BoardID: "B1"}) {
		t.Errorf("the chat's entry = %+v, want its board kept and the app dropped", ws["cl-1"])
	}
}

// A list the agent computed before App Lab rewrote the file would put back what the rewrite removed: only the key just granted joins the file.
func TestAGrantSavedAcrossARewriteKeepsTheRewrite(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	startEngineFake(t, a, &engineFake{})
	const gone = "dXNlcjpnb25l"
	onGone := "edit\x00Edit " + mirrorKey("", gone) + "/main.py\x00"
	const kept, added = "edit\x00Edit stays/a.py\x00", "edit\x00Edit new/b.py\x00"
	if err := writeWorkspaceGrants(dir, map[string][]string{boardGrantKey("", ""): {kept, onGone}}); err != nil {
		t.Fatal(err)
	}
	store := workspaceGrants{app: a}
	rev := store.Revision() // the agent computes its list here

	a.forgetWorkspaceAppStores(gone, "", false) // the delete drops the grant on the app's folder
	store.SaveGrantsAt("", []string{added, kept, onGone}, added, rev)

	if got := readWorkspaceGrants(dir)[boardGrantKey("", "")]; !slices.Equal(got, []string{added, kept}) {
		t.Errorf("grants after the save = %q, want the new key added to what the delete left", got)
	}
	store.SaveGrantsAt("", []string{kept}, "", store.Revision())
	if got := readWorkspaceGrants(dir)[boardGrantKey("", "")]; !slices.Equal(got, []string{kept}) {
		t.Errorf("grants after an up-to-date save = %q, want the agent's list", got)
	}
}

// Keys no call the board takes can match (an edit's text, an app tool scoped to an app's name) go at the first read, from every bucket.
func TestDeadGrantKeysAreDroppedWhenTheFileIsRead(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	startEngineFake(t, a, &engineFake{})
	dead := "edit\x00Edit B1__user-blink-6b812e/main.py\x00args\x00" + `{"new_string":"KEY = 'secret'"}`
	byName := "other\x00arduino-board_apps_edit\x00qa-imp-l4-095837-d"
	board := "other\x00mcp__arduino-board__models_delete\x00args\x00" + `{"id":"m1"}`
	if err := writeWorkspaceGrants(dir, map[string][]string{
		boardGrantKey("", ""):    {dead, byName, board},
		boardGrantKey("B2", "x"): {dead, byName},
		"legacy":                 {dead},
	}); err != nil {
		t.Fatal(err)
	}

	got := workspaceGrants{app: a}.LoadGrants()

	if !slices.Equal(got[""], []string{board}) {
		t.Errorf("loaded %q, want the board tool's grant alone", got[""])
	}
	if file := readWorkspaceGrants(dir); len(file) != 1 || !slices.Equal(file[boardGrantKey("", "")], []string{board}) {
		t.Errorf("file after the read = %q, want the dead key gone from every bucket", file)
	}
}

// An "Always allow" for a call whose app id the board refuses is not kept, and the agent is told to drop it too.
func TestAGrantScopedToNoAppIDIsNotKept(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	startEngineFake(t, a, &engineFake{})
	store := workspaceGrants{app: a}
	byName := "other\x00arduino-board_apps_edit\x00qa-imp-l4-095837-d"
	byID := "other\x00arduino-board_apps_edit\x00dXNlcjpxYS1pbXAtbDQtMDk1ODM3LWQ"
	before := store.Revision()
	store.SaveGrantsAt("", []string{byName, byID}, byName, before)
	if got := readWorkspaceGrants(dir)[boardGrantKey("", "")]; !slices.Equal(got, []string{byID}) {
		t.Errorf("general workspace grants = %q, want the grant on the app's id alone", got)
	}
	if store.Revision() == before {
		t.Error("the agent was not told to drop the grant it holds in memory")
	}
}

// A grants file holding null decodes to no map at all: every path that reads or writes it must still work.
func TestAGrantsFileHoldingNullIsReadAsEmpty(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	startEngineFake(t, a, &engineFake{})
	store := workspaceGrants{app: a}
	const key = "edit\x00Edit a.py\x00"
	for name, use := range map[string]func(){
		"save":                        func() { store.SaveGrants("", []string{key}) },
		"save at the revision":        func() { store.SaveGrantsAt("", []string{key}, key, store.Revision()) },
		"save after a revision moved": func() { store.SaveGrantsAt("", []string{key}, key, store.Revision()+1) },
		"load":                        func() { store.LoadGrants() },
		"rename":                      func() { a.RebindWorkspaceApp("dXNlcjpibGluaw", "dXNlcjpibGluay0y", "Blink 2") },
		"delete":                      func() { a.forgetWorkspaceAppStores("dXNlcjpibGluaw", "", false) },
		"the sweep's list of app ids": func() { a.workspaceAppIDs("") },
	} {
		if err := os.WriteFile(filepath.Join(dir, workspaceGrantsFile), []byte("null"), 0o600); err != nil {
			t.Fatal(err)
		}
		func() {
			defer func() {
				if r := recover(); r != nil {
					t.Errorf("%s panicked on a file holding null: %v", name, r)
				}
			}()
			use()
		}()
	}
}

// A grant saved into the bucket of a deleted or renamed-away app would bring it back for the next app of that name: it is dropped until a new chat on that id clears the mark.
func TestAGrantForADeletedOrRenamedAppIsNotKept(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	startEngineFake(t, a, &engineFake{})
	store := workspaceGrants{app: a}
	id := func(s string) string { return base64.RawURLEncoding.EncodeToString([]byte(s)) }
	gone, old := id("user:gone"), id("user:old")
	onGone := "other\x00mcp__arduino-board__apps_start\x00" + gone
	onOld := "other\x00mcp__arduino-board__apps_start\x00" + old

	a.forgetWorkspaceAppStores(gone, "", false)
	before := store.Revision()
	const neutral = "edit\x00Edit elsewhere/a.py\x00"            // names no app, so only the bucket says whose it is
	store.SaveGrantsAt(gone, []string{neutral}, neutral, before) // a card left open across the delete
	if got, ok := readWorkspaceGrants(dir)[boardGrantKey("", gone)]; ok {
		t.Errorf("the deleted app's bucket came back with %q", got)
	}
	if store.Revision() == before {
		t.Error("the agent was not told to drop the grant it holds in memory")
	}

	a.RebindWorkspaceApp(old, id("user:new"), "New")
	store.SaveGrants(old, []string{onOld})
	if got, ok := readWorkspaceGrants(dir)[boardGrantKey("", old)]; ok {
		t.Errorf("the renamed app's old bucket came back with %q", got)
	}

	a.rememberSessionWorkspace("s-new", agent.SessionWorkspace{AppID: gone}) // an app of that name again, with a chat
	store.SaveGrants(gone, []string{onGone})
	if got := readWorkspaceGrants(dir)[boardGrantKey("", gone)]; !slices.Equal(got, []string{onGone}) {
		t.Errorf("the new app's grants = %q, want them saved", got)
	}
}

// A rewrite bumps the revision before it releases the store lock: a save landing right after the unlock, with a list from before, must not put back what the rewrite removed.
func TestASaveRightAfterARewriteSeesItsRevision(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	startEngineFake(t, a, &engineFake{})
	store := workspaceGrants{app: a}
	id := func(s string) string { return base64.RawURLEncoding.EncodeToString([]byte(s)) }
	for name, rewrite := range map[string]func(app string){
		"delete": func(app string) { a.forgetWorkspaceAppStores(app, "", false) },
		"rename": func(app string) { a.RebindWorkspaceApp(app, id("user:renamed-"+app), "Renamed") },
	} {
		t.Run(name, func(t *testing.T) {
			app := id("user:" + name)
			onApp := "edit\x00Edit " + mirrorKey("", app) + "/main.py\x00" // a general chat's grant on the app's folder
			moved := strings.ReplaceAll(onApp, mirrorKey("", app), mirrorKey("", id("user:renamed-"+app)))
			const added = "edit\x00Edit other/b.py\x00"
			if err := writeWorkspaceGrants(dir, map[string][]string{boardGrantKey("", ""): {onApp}}); err != nil {
				t.Fatal(err)
			}
			rev, landed, seen := store.Revision(), false, uint64(0) // the agent computed its general list at rev
			orig := afterStoreRewrite
			afterStoreRewrite = func() {
				if !landed {
					landed, seen = true, store.Revision()
					store.SaveGrantsAt("", []string{added, onApp}, added, rev)
				}
			}
			t.Cleanup(func() { afterStoreRewrite = orig })

			rewrite(app)

			if !landed || seen == rev {
				t.Errorf("revision right after the unlock = %d (save landed %v), want it moved from %d", seen, landed, rev)
			}
			got := readWorkspaceGrants(dir)[boardGrantKey("", "")]
			if slices.Contains(got, onApp) || !slices.Contains(got, added) {
				t.Errorf("general grants = %q, want the new key added and the old one gone", got)
			}
			if name == "rename" && !slices.Contains(got, moved) {
				t.Errorf("general grants = %q, want the grant the rename moved to the new folder kept", got)
			}
		})
	}
}

// The start's cleanup never replaces a pending list it cannot read: the ids it holds would be lost.
func TestAStartLeavesAnUnreadablePendingListAlone(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	m := startEngineFake(t, a, &engineFake{listed: map[string]bool{}})
	pendingFile := filepath.Join(dir, sessionPendingDeletesFile)
	if err := os.WriteFile(pendingFile, []byte("not json"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := writeSessionTitles(dir, map[string]string{"p-1": "Kept"}); err != nil {
		t.Fatal(err)
	}

	a.deletePendingChats(m, airuntime.AgentOpenCode, []string{"p-1"}) // the engine no longer lists it

	if data, _ := os.ReadFile(pendingFile); string(data) != "not json" {
		t.Errorf("the pending list was replaced with %q", data)
	}
	if titles, _ := readSessionTitles(dir); titles["p-1"] != "Kept" {
		t.Errorf("entries dropped although the list was not updated: %v", titles)
	}
}

// A card opened before a delete or rename and answered after it can name that app from another workspace too: an app tool on its id, a file in its folder.
func TestALateGrantNamingARetiredAppIsNotKeptAnywhere(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	startEngineFake(t, a, &engineFake{})
	store := workspaceGrants{app: a}
	id := func(s string) string { return base64.RawURLEncoding.EncodeToString([]byte(s)) }
	gone, old := id("user:gone"), id("user:old")
	const other = "edit\x00Edit stays/a.py\x00"
	onFolder := "edit\x00Edit " + mirrorKey("", gone) + "/python/main.py\x00" // Agent Mode editing the app's file
	onApp := "other\x00mcp__arduino-board__apps_start\x00" + gone
	onOldFolder := "edit\x00Edit " + mirrorKey("", old) + "/main.py\x00"
	opened := store.Revision() // the cards open here
	a.forgetWorkspaceAppStores(gone, "", false)
	a.RebindWorkspaceApp(old, id("user:new"), "New")

	before := store.Revision()
	for _, k := range []string{other, onFolder, onApp, onOldFolder} {
		store.SaveGrantsAt("", []string{k}, k, opened) // each card answered after the changes
	}

	if got := readWorkspaceGrants(dir)[boardGrantKey("", "")]; !slices.Equal(got, []string{other}) {
		t.Errorf("general grants = %q, want only the key that names no retired app", got)
	}
	if store.Revision() == before {
		t.Error("the agent was not told to drop the grants it holds in memory")
	}
}

// A rename back gives the app its first id again: the mark the first rename left there clears, and the id renamed away from gets one.
func TestARenameBackClearsTheMark(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	startEngineFake(t, a, &engineFake{})
	store := workspaceGrants{app: a}
	x, y := "dXNlcjpibGluaw", "dXNlcjpibGluay0y"
	onX, onY := "other\x00mcp__arduino-board__apps_start\x00"+x, "other\x00mcp__arduino-board__apps_start\x00"+y

	a.RebindWorkspaceApp(x, y, "Blink 2")
	a.RebindWorkspaceApp(y, x, "Blink")
	store.SaveGrants(x, []string{onX})
	store.SaveGrants(y, []string{onY})

	grants := readWorkspaceGrants(dir)
	if got := grants[boardGrantKey("", x)]; !slices.Equal(got, []string{onX}) {
		t.Errorf("after the rename back, the app's grants = %q, want them saved", got)
	}
	if got, ok := grants[boardGrantKey("", y)]; ok {
		t.Errorf("the id renamed away from kept a save: %q", got)
	}
}

// The mark is per board: app ids repeat across boards, so an id deleted on one board stays live on another.
func TestAMarkIsPerBoard(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	startEngineFake(t, a, &engineFake{})
	store := workspaceGrants{app: a}
	const x = "dXNlcjpibGluaw"
	key := "other\x00mcp__arduino-board__apps_start\x00" + x

	a.selectedBoard.Info.Serial = "B1"
	opened := store.Revision() // cards open on each board before B1 deletes the app
	a.forgetWorkspaceAppStores(x, "B1", false)
	store.SaveGrantsAt("", []string{key}, key, opened)
	a.selectedBoard.Info.Serial = "B2"
	store.SaveGrantsAt("", []string{key}, key, opened)
	a.selectedBoard.Info.Serial = "B1"
	store.SaveGrants(x, []string{key})
	a.selectedBoard.Info.Serial = "B2"
	store.SaveGrants(x, []string{key})
	a.rememberSessionWorkspace("s-b2", agent.SessionWorkspace{AppID: x}) // a new chat on B2's app of that name
	a.selectedBoard.Info.Serial = "B1"
	store.SaveGrants(x, []string{key})

	grants := readWorkspaceGrants(dir)
	if got, ok := grants[boardGrantKey("B1", x)]; ok {
		t.Errorf("B1's deleted app kept a save: %q", got)
	}
	if got := grants[boardGrantKey("B2", x)]; !slices.Equal(got, []string{key}) {
		t.Errorf("B2's app of that name = %q, want its grant saved", got)
	}
	if got := grants[boardGrantKey("B1", "")]; slices.Contains(got, key) {
		t.Errorf("B1's Agent Mode kept a late grant on the deleted app: %q", got)
	}
	if got := grants[boardGrantKey("B2", "")]; !slices.Contains(got, key) {
		t.Errorf("B2's Agent Mode lost its grant on B2's app of that name: %q", got)
	}
}

// An app made again with a retired app's name (same id, same folder) is a live app: grants from cards opened after the change are kept, from any workspace.
func TestARecreatedAppKeepsTheGrantsGivenForIt(t *testing.T) {
	id := func(s string) string { return base64.RawURLEncoding.EncodeToString([]byte(s)) }
	for name, retire := range map[string]func(a *App, x string){
		"after a delete": func(a *App, x string) { a.forgetWorkspaceAppStores(x, "", false) },
		"after a rename": func(a *App, x string) { a.RebindWorkspaceApp(x, id("user:blink-old"), "Blink old") },
	} {
		t.Run(name, func(t *testing.T) {
			a := testApp(t)
			dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
			startEngineFake(t, a, &engineFake{})
			store := workspaceGrants{app: a}
			x, z := id("user:blink"), id("user:other")
			checkout := "other\x00mcp__arduino-board__apps_checkout\x00" + x
			edit := "edit\x00Edit " + mirrorKey("", x) + "/python/main.py\x00"
			outside := "edit\x00Edit\x00outside\x00/mirror/" + mirrorKey("", x) + "/python/main.py"
			early := store.Revision() // a card opened before the change
			retire(a, x)

			store.SaveGrantsAt("", []string{edit}, edit, early)
			if got := readWorkspaceGrants(dir)[boardGrantKey("", "")]; slices.Contains(got, edit) {
				t.Errorf("a card opened before the change brought back %q", edit)
			}
			// A new app named blink is made, from the UI or apps_create: Go is not told. Cards opened from now on are for it.
			store.SaveGrantsAt("", []string{checkout, edit}, edit, store.Revision())
			if got := readWorkspaceGrants(dir)[boardGrantKey("", "")]; !slices.Contains(got, checkout) || !slices.Contains(got, edit) {
				t.Errorf("Agent Mode grants for the new app = %q, want both kept", got)
			}
			store.SaveGrantsAt(z, []string{outside}, outside, store.Revision())
			if got := readWorkspaceGrants(dir)[boardGrantKey("", z)]; !slices.Contains(got, outside) {
				t.Errorf("another app's grant on the new app's file = %q, want it kept", got)
			}
		})
	}
}

// The folder check matches the folder's whole name: a longer folder name that holds the retired one is another app's, or another board's.
func TestTheRetiredFolderCheckMatchesTheWholeName(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	startEngineFake(t, a, &engineFake{})
	store := workspaceGrants{app: a}
	gone := base64.RawURLEncoding.EncodeToString([]byte("user:gone"))
	folder := mirrorKey("", gone)
	opened := store.Revision()
	a.forgetWorkspaceAppStores(gone, "", false)
	exact := "edit\x00Edit " + folder + "/a.py\x00"
	longer := []string{"edit\x00Edit " + folder + "-copy/a.py\x00", "edit\x00Edit x" + folder + "/a.py\x00", "edit\x00Edit " + folder + ".bak/a.py\x00"}

	store.SaveGrantsAt("", append([]string{exact}, longer...), exact, opened)
	for _, k := range longer {
		store.SaveGrantsAt("", []string{k}, k, opened)
	}

	got := readWorkspaceGrants(dir)[boardGrantKey("", "")]
	if slices.Contains(got, exact) {
		t.Errorf("the retired folder's own grant was kept: %q", got)
	}
	for _, k := range longer {
		if !slices.Contains(got, k) {
			t.Errorf("%q, a longer folder name, was dropped: %q", k, got)
		}
	}
}

// A card checked right after the delete, with no rewrite in between, carries the mark's own revision: it is a card for the app there now.
func TestACardAtTheMarksOwnRevisionIsKept(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	startEngineFake(t, a, &engineFake{})
	store := workspaceGrants{app: a}
	x := base64.RawURLEncoding.EncodeToString([]byte("user:blink"))
	edit := "edit\x00Edit " + mirrorKey("", x) + "/python/main.py\x00"

	a.forgetWorkspaceAppStores(x, "", false)
	store.SaveGrantsAt("", []string{edit}, edit, store.Revision())

	if got := readWorkspaceGrants(dir)[boardGrantKey("", "")]; !slices.Contains(got, edit) {
		t.Errorf("general grants = %q, want the grant from a card checked at the mark's revision kept", got)
	}
}

// An old card answered after the app was made again must not take away what was granted for the new app: the stale merge checks only its own key.
func TestAnOldCardKeepsWhatWasGrantedForTheNewApp(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	startEngineFake(t, a, &engineFake{})
	store := workspaceGrants{app: a}
	x := base64.RawURLEncoding.EncodeToString([]byte("user:blink"))
	forNew := "other\x00mcp__arduino-board__apps_checkout\x00" + x
	oldEdit := "edit\x00Edit " + mirrorKey("", x) + "/python/main.py\x00"
	opened := store.Revision() // the old card opens here

	a.forgetWorkspaceAppStores(x, "", false)
	store.SaveGrantsAt("", []string{forNew}, forNew, store.Revision()) // a card for the app made again
	store.SaveGrantsAt("", []string{oldEdit}, oldEdit, opened)         // the old card, answered now

	got := readWorkspaceGrants(dir)[boardGrantKey("", "")]
	if !slices.Contains(got, forNew) {
		t.Errorf("general grants = %q, want the new app's grant kept", got)
	}
	if slices.Contains(got, oldEdit) {
		t.Errorf("general grants = %q, want the old card's grant dropped", got)
	}
}
