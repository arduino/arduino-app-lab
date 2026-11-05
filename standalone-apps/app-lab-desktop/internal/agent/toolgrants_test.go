package agent

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	acp "github.com/coder/acp-go-sdk"
)

func permissionFor(sid SessionID, title string) PermissionRequest {
	return PermissionRequest{
		SessionID: sid,
		ToolCall:  &ToolCall{Title: title, Kind: "other", Input: map[string]any{"id": "dXNlcjpibGluaw"}},
		Options: []PermissionOption{
			{ID: "allow_always", Kind: "allow_always"},
			{ID: "allow", Kind: "allow_once"},
			{ID: "reject", Kind: "reject_once"},
		},
	}
}

// Auto-approval happens without the user, so what may be granted — and to whom — is the security-relevant part.
func TestToolGrants(t *testing.T) {
	const startApp = "mcp__arduino-board__apps_start"

	t.Run("an always-allow answers the next identical call", func(t *testing.T) {
		var g toolGrants
		g.record("app-x", permissionFor("s1", startApp), "allow_always", noCard)
		opt, ok, _ := g.autoAllow("app-x", permissionFor("s1", startApp))
		if !ok {
			t.Fatal("the second call still prompts")
		}
		if opt != "allow" { // the one-off allow: replying "always" again re-persists a rule the engine can't read back
			t.Errorf("answered with %q, want the one-off allow", opt)
		}
	})

	t.Run("a one-off allow grants nothing", func(t *testing.T) {
		var g toolGrants
		g.record("app-x", permissionFor("s1", startApp), "allow", noCard)
		if _, ok, _ := g.autoAllow("app-x", permissionFor("s1", startApp)); ok {
			t.Error("a single Allow was taken as a standing grant")
		}
	})

	t.Run("a reject grants nothing", func(t *testing.T) {
		var g toolGrants
		g.record("app-x", permissionFor("s1", startApp), "reject", noCard)
		if _, ok, _ := g.autoAllow("app-x", permissionFor("s1", startApp)); ok {
			t.Error("a Reject was taken as a grant")
		}
	})

	// toPermissionRequest already strips board_exec's always options, so this stands in for that filter regressing.
	t.Run("board_exec can never be granted", func(t *testing.T) {
		var g toolGrants
		exec := permissionFor("s1", "mcp__arduino-board__board_exec")
		g.record("app-x", exec, "allow_always", noCard)
		if _, ok, _ := g.autoAllow("app-x", exec); ok {
			t.Error("arbitrary board shell was auto-approved")
		}
	})

	t.Run("a grant does not leak into another workspace", func(t *testing.T) {
		var g toolGrants
		g.record("app-x", permissionFor("s1", startApp), "allow_always", noCard)
		if _, ok, _ := g.autoAllow("app-y", permissionFor("s2", startApp)); ok {
			t.Error("another app inherited the grant")
		}
	})

	t.Run("a grant does not cover a different tool", func(t *testing.T) {
		var g toolGrants
		g.record("app-x", permissionFor("s1", startApp), "allow_always", noCard)
		if _, ok, _ := g.autoAllow("app-x", permissionFor("s1", "mcp__arduino-board__apps_delete")); ok {
			t.Error("the grant widened to another tool")
		}
	})
}

// fakeGrantStore stands in for the file App Lab keeps, recording what the registry asks it to persist.
type fakeGrantStore struct {
	loaded map[string][]string
	saved  map[string][]string
	loads  int
	rev    uint64
	onLoad func() // runs while the file is being read, to stand in for a grant landing at the same moment
	onSave func() // runs while the file is being written, to stand in for a slow disk
	mu     sync.Mutex
}

func (f *fakeGrantStore) Revision() uint64 { return f.rev }

func (f *fakeGrantStore) LoadGrants() map[string][]string {
	f.mu.Lock()
	f.loads++
	run := f.onLoad
	f.onLoad = nil
	f.mu.Unlock()
	// Outside the lock: the hook records a grant, which locks the store again.
	if run != nil {
		run()
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.loaded
}
func (f *fakeGrantStore) SaveGrants(ws string, keys []string) {
	f.mu.Lock()
	run := f.onSave
	f.onSave = nil
	f.mu.Unlock()
	if run != nil {
		run()
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.saved == nil {
		f.saved = map[string][]string{}
	}
	f.saved[ws] = keys
}

// A grant outlives the chat that gave it, so the file is the whole feature: losing it re-prompts, and reading another workspace's entry auto-approves what the user never saw.
func TestToolGrantsPersist(t *testing.T) {
	const startApp = "mcp__arduino-board__apps_start"

	t.Run("a grant is written under its own workspace", func(t *testing.T) {
		store := &fakeGrantStore{}
		var g toolGrants
		g.attach(store)
		g.record("app-x", permissionFor("s1", startApp), "allow_always", noCard)

		if got := store.saved["app-x"]; len(got) != 1 {
			t.Fatalf("workspace entry not saved: %+v", store.saved)
		}
		if _, other := store.saved["app-y"]; other {
			t.Error("saving one workspace touched another")
		}
	})

	t.Run("a grant from an earlier run answers without prompting", func(t *testing.T) {
		key, _ := grantKey(permissionFor("s1", startApp).ToolCall)
		var g toolGrants
		g.attach(&fakeGrantStore{loaded: map[string][]string{"app-x": {key}}})

		if _, ok, _ := g.autoAllow("app-x", permissionFor("s-new", startApp)); !ok {
			t.Error("a session opened after a restart prompted again")
		}
		if _, ok, _ := g.autoAllow("app-y", permissionFor("s-new", startApp)); ok {
			t.Error("another workspace inherited the persisted grant")
		}
	})

	t.Run("board_exec stays unpersistable even if the file claims it", func(t *testing.T) {
		exec := permissionFor("s1", "mcp__arduino-board__board_exec")
		var g toolGrants
		g.attach(&fakeGrantStore{loaded: map[string][]string{"app-x": {exec.ToolCall.Kind + "\x00" + exec.ToolCall.Title}}})

		if _, ok, _ := g.autoAllow("app-x", exec); ok {
			t.Error("a tampered or stale file auto-approved arbitrary board shell")
		}
	})
}

// attach runs inside the agent start, which holds the lock the store needs: reading there deadlocked the start, so the read waits for the first permission and happens once.
func TestToolGrantsLoadsLazily(t *testing.T) {
	store := &fakeGrantStore{loaded: map[string][]string{}}
	var g toolGrants
	g.attach(store)

	if store.loads != 0 {
		t.Fatalf("attach read the store during the agent start (%d reads)", store.loads)
	}

	// Answers come from memory; only the store saying it changed underneath — a rename or a delete — costs a read.
	g.autoAllow("app-x", permissionFor("s1", "mcp__arduino-board__apps_start"))
	g.autoAllow("app-x", permissionFor("s2", "mcp__arduino-board__apps_stop"))
	if store.loads != 1 {
		t.Errorf("the file should be read once on first use, got %d reads", store.loads)
	}

	store.rev++
	g.autoAllow("app-x", permissionFor("s3", "mcp__arduino-board__apps_start"))
	if store.loads != 2 {
		t.Errorf("a rewrite by App Lab was not picked up, got %d reads", store.loads)
	}
}

// The file is merged into what is already there, not swapped in: a grant given before the first read would otherwise be dropped.
func TestToolGrantsMergesTheStoredFile(t *testing.T) {
	const startApp = "mcp__arduino-board__apps_start"
	const cloneApp = "mcp__arduino-board__apps_clone"
	storedKey, _ := grantKey(permissionFor("s1", cloneApp).ToolCall)

	var g toolGrants
	g.attach(&fakeGrantStore{loaded: map[string][]string{"app-x": {storedKey}}})
	g.record("app-x", permissionFor("s1", startApp), "allow_always", noCard)

	if _, ok, _ := g.autoAllow("app-x", permissionFor("s2", startApp)); !ok {
		t.Error("the grant given in this run was lost when the file was read")
	}
	if _, ok, _ := g.autoAllow("app-x", permissionFor("s2", cloneApp)); !ok {
		t.Error("the grant from the file was lost")
	}
}

// The workspace alone is too coarse: within one the agent still reaches other apps, and a grant given on a call that stayed home must not answer for one that did not.
func TestGrantsAreScopedToWhatTheCallActsOn(t *testing.T) {
	perm := func(tc *ToolCall) PermissionRequest {
		p := permissionFor("s1", tc.Title)
		p.ToolCall = tc
		return p
	}
	edit := func(path string, outside bool) *ToolCall {
		return &ToolCall{Title: "Edit " + path, Kind: "edit", OutsideWorkspace: outside}
	}
	appTool := func(id string) *ToolCall {
		return &ToolCall{Title: "mcp__arduino-board__apps_start", Kind: "execute", Input: map[string]any{"id": id}}
	}

	t.Run("an inside grant does not cover a call that left the workspace", func(t *testing.T) {
		var g toolGrants
		g.record("app-x", perm(edit("mine/main.py", false)), "allow_always", noCard)
		if _, ok, _ := g.autoAllow("app-x", perm(edit("theirs/main.py", true))); ok {
			t.Error("editing another app was auto-approved by a grant given on this one")
		}
	})

	t.Run("an app tool is granted for the app it names, not for the next one", func(t *testing.T) {
		var g toolGrants
		g.record("app-x", perm(appTool("dXNlcjo0")), "allow_always", noCard)
		if _, ok, _ := g.autoAllow("app-x", perm(appTool("dXNlcjo5"))); ok {
			t.Error("starting one app auto-approved starting another")
		}
		if _, ok, _ := g.autoAllow("app-x", perm(appTool("dXNlcjo0"))); !ok {
			t.Error("the same app still prompts")
		}
	})

	t.Run("a file delete is granted for the app it names, not for the next one", func(t *testing.T) {
		var g toolGrants
		del := func(id string) *ToolCall {
			return &ToolCall{Title: "mcp__arduino-board__app_files_delete", Kind: "other", Input: map[string]any{"id": id, "path": "old"}}
		}
		g.record("app-x", perm(del("dXNlcjo0")), "allow_always", noCard)
		if _, ok, _ := g.autoAllow("app-x", perm(del("dXNlcjo5"))); ok {
			t.Error("deleting in one app auto-approved deleting in another")
		}
	})

	t.Run("an outside grant answers the same outside call again", func(t *testing.T) {
		var g toolGrants
		g.record("app-x", perm(edit("theirs/main.py", true)), "allow_always", noCard)
		if _, ok, _ := g.autoAllow("app-x", perm(edit("theirs/main.py", true))); !ok {
			t.Error("Always allow on a disclosed outside call did nothing")
		}
	})
}

// A request whose arguments never arrived names no app, and a grant on it would answer for every app in the workspace.
func TestAnAppToolThatNamesNoAppIsNeverGranted(t *testing.T) {
	for _, title := range []string{"mcp__arduino-board__apps_edit", "arduino-board_apps_edit"} {
		bare := permissionFor("s1", title)
		bare.ToolCall.Input = map[string]any{}
		var g toolGrants
		g.attach(&fakeGrantStore{loaded: map[string][]string{"app-x": {"other\x00" + title + "\x00"}}}) // written before this rule
		g.record("app-x", bare, "allow_always", noCard)
		if _, ok, _ := g.autoAllow("app-x", bare); ok {
			t.Errorf("%s: a call naming no app was auto-approved", title)
		}
		if _, ok, _ := g.autoAllow("app-x", permissionFor("s2", title)); ok {
			t.Errorf("%s: a grant naming no app answered for one", title)
		}
	}

	// apps_create makes a new app, so its grant has no app to name.
	create := permissionFor("s1", "arduino-board_apps_create")
	create.ToolCall.Input = map[string]any{"name": "Blink"}
	var g toolGrants
	g.record("app-x", create, "allow_always", noCard)
	if _, ok, _ := g.autoAllow("app-x", create); !ok {
		t.Error("Always allow on apps_create did nothing")
	}
}

// models_delete, wifi_connect and the like name no app, so a grant on one call must not answer for another target.
func TestABoardToolAimedAtNoAppIsGrantedForItsArguments(t *testing.T) {
	call := func(title string, input map[string]any) PermissionRequest {
		p := permissionFor("s1", title)
		p.ToolCall.Input = input
		return p
	}
	for _, title := range []string{"mcp__arduino-board__models_delete", "arduino-board_models_delete"} {
		var g toolGrants
		g.attach(&fakeGrantStore{loaded: map[string][]string{"app-x": {"other\x00" + title + "\x00"}}}) // written before this rule
		g.record("app-x", call(title, map[string]any{"id": "yolo"}), "allow_always", noCard)
		if _, ok, _ := g.autoAllow("app-x", call(title, map[string]any{"id": "face-detect"})); ok {
			t.Errorf("%s: deleting one model auto-approved deleting another", title)
		}
		if _, ok, _ := g.autoAllow("app-x", call(title, map[string]any{"id": "yolo"})); !ok {
			t.Errorf("%s: the same call still prompts", title)
		}
	}

	none := call("arduino-board_wifi_connect", map[string]any{})
	var g toolGrants
	g.record("app-x", none, "allow_always", noCard)
	if _, ok, _ := g.autoAllow("app-x", none); ok {
		t.Error("a board call whose arguments never arrived was granted")
	}
}

// A grant on a call that names no single target would answer, unasked, for every call of that tool: such a call gets no grant, and one an older build saved answers nothing.
func TestAGrantThatCoversManyTargetsIsNeitherKeptNorHonoured(t *testing.T) {
	req := func(tc *ToolCall) PermissionRequest {
		p := permissionFor("s1", tc.Title)
		p.ToolCall = tc
		return p
	}
	wide := map[string]*ToolCall{
		"a loop of any tool":   {Title: "doom_loop", Kind: "other", Input: map[string]any{"tool": "edit", "input": map[string]any{"filePath": "/m/a/x.py"}}},
		"a read with no file":  {Title: "read", Kind: "read", Input: map[string]any{}},
		"an edit on two files": {Title: "2 files", Kind: "edit", Paths: []string{"/m/a/x.py", "/m/b/y.py"}},
		"board_exec":           {Title: "arduino-board_board_exec", Kind: "other", Input: map[string]any{"command": "ls"}},
		"an app tool, no app":  {Title: "arduino-board_apps_start", Kind: "other", Input: map[string]any{}},
	}
	for name, tc := range wide {
		var g toolGrants
		g.record("app-x", req(tc), "allow_always", noCard)
		if _, ok, _ := g.autoAllow("app-x", req(tc)); ok {
			t.Errorf("%s: an Always allow on it answered the next one", name)
		}
	}

	var g toolGrants
	g.attach(&fakeGrantStore{loaded: map[string][]string{"app-x": {"read\x00read\x00", "other\x00doom_loop\x00"}}}) // what an older build saved
	for _, tc := range []*ToolCall{wide["a loop of any tool"], {Title: "read", Kind: "read", Input: map[string]any{"filePath": "/m/a/.env"}}} {
		if _, ok, _ := g.autoAllow("app-x", req(tc)); ok {
			t.Errorf("%s: a saved wide grant answered it", tc.Title)
		}
	}
}

// OpenCode asks before reading an .env file, and an "Always allow" on one must not open the others.
func TestAnEnvReadIsGrantedForItsOwnFile(t *testing.T) {
	read := func(path string) PermissionRequest {
		p := permissionFor("s1", "read")
		p.ToolCall = &ToolCall{Title: "read", Kind: "read", Input: map[string]any{"filePath": path}}
		return p
	}
	var g toolGrants
	g.record("app-x", read("/m/a/.env"), "allow_always", noCard)
	if _, ok, _ := g.autoAllow("app-x", read("/m/a/.env")); !ok {
		t.Error("the file that was granted still asks")
	}
	if _, ok, _ := g.autoAllow("app-x", read("/m/a/.env.local")); ok {
		t.Error("a grant on one .env file answered a read of another")
	}
}

// The engine's own always-rule is per tool for a whole session, so the user's "Always allow" must never reach it — one approved Edit would cover any other app.
func TestAlwaysAllowIsNotForwardedToTheEngine(t *testing.T) {
	req := permissionFor("s1", "Edit mine/main.py")

	if got := engineAnswer(req, "allow_always"); got != "allow" {
		t.Errorf("the engine was told %q, want the one-off allow", got)
	}
	if got := engineAnswer(req, "allow"); got != "allow" {
		t.Errorf("a one-off allow was rewritten to %q", got)
	}
	if got := engineAnswer(req, "reject"); got != "reject" {
		t.Errorf("a reject was rewritten to %q", got)
	}
}

// Deleting an app drops its grants, and ids are reusable: a running agent keeping its copy would auto-approve the next app of that name.
func TestARevokedGrantStopsAnsweringWithoutARestart(t *testing.T) {
	store := &fakeGrantStore{loaded: map[string][]string{}}
	var g toolGrants
	g.attach(store)
	g.record("app-gone", permissionFor("s1", "mcp__arduino-board__apps_start"), "allow_always", noCard)
	if _, ok, _ := g.autoAllow("app-gone", permissionFor("s2", "mcp__arduino-board__apps_start")); !ok {
		t.Fatal("the grant never took")
	}

	store.loaded = map[string][]string{} // App Lab dropped the deleted app's grants behind the agent's back
	store.rev++

	if _, ok, _ := g.autoAllow("app-gone", permissionFor("s3", "mcp__arduino-board__apps_start")); ok {
		t.Error("a revoked grant still auto-approved: a later app reusing the id inherits it")
	}
}

// A request offering no one-off allow must not be auto-approved into the engine's "always" option: the user gets the prompt instead.
func TestNoOneOffAllowMeansNoAutoApproval(t *testing.T) {
	const tool = "mcp__arduino-board__apps_start"
	onlyAlways := PermissionRequest{
		SessionID: "s1",
		ToolCall:  &ToolCall{Title: tool, Kind: "other", Input: map[string]any{"id": "dXNlcjpibGluaw"}},
		Options: []PermissionOption{
			{ID: "allow_always", Kind: "allow_always"},
			{ID: "reject", Kind: "reject_once"},
		},
	}

	if _, ok := allowOptionID(onlyAlways.Options); ok {
		t.Error("the persistent option was offered as if it were a one-off")
	}
	var g toolGrants
	g.record("app-x", onlyAlways, "allow_always", noCard)
	if _, ok, _ := g.autoAllow("app-x", onlyAlways); ok {
		t.Error("auto-approval answered with the engine's session-wide option")
	}
}

// Two calls that both left the workspace are not the same call: allowing one file must not answer for another, even when the titles match.
func TestOutsideGrantsAreScopedToWhereTheyLand(t *testing.T) {
	perm := func(path string) PermissionRequest {
		p := permissionFor("s1", "Edit")
		p.ToolCall = &ToolCall{Title: "Edit", Kind: "edit", Paths: []string{path}, OutsideWorkspace: true}
		return p
	}
	var g toolGrants
	g.record("app-x", perm("/mirror/app-b/main.py"), "allow_always", noCard)

	if _, ok, _ := g.autoAllow("app-x", perm("/mirror/app-c/main.py")); ok {
		t.Error("an edit in one app auto-approved an edit in another")
	}
	if _, ok, _ := g.autoAllow("app-x", perm("/mirror/app-b/main.py")); !ok {
		t.Error("the same file prompts again")
	}
}

// A grant recorded while a reload was reading isn't in that snapshot: replacing the map would lose the answer the user just gave.
func TestAReloadDoesNotDropAGrantRecordedMeanwhile(t *testing.T) {
	store := &fakeGrantStore{loaded: map[string][]string{}}
	var g toolGrants
	g.attach(store)
	g.autoAllow("app-x", permissionFor("s1", "mcp__arduino-board__apps_start")) // first read, map now loaded

	recorded := make(chan struct{})
	store.onLoad = func() {
		go func() {
			g.record("app-x", permissionFor("s2", "mcp__arduino-board__apps_stop"), "allow_always", noCard)
			close(recorded)
		}()
	}
	store.rev++
	g.autoAllow("app-x", permissionFor("s3", "mcp__arduino-board__apps_start"))
	select {
	case <-recorded:
	case <-time.After(5 * time.Second):
		t.Fatal("the grant answered during the reload was never recorded")
	}

	if _, ok, _ := g.autoAllow("app-x", permissionFor("s4", "mcp__arduino-board__apps_stop")); !ok {
		t.Error("the grant recorded during the reload was wiped by the file snapshot")
	}
}

// A reload waits for an answer being saved, so no grant lands between its read and its replace, and then takes the file as the truth.
func TestAReloadWaitsForASaveThenTakesTheFile(t *testing.T) {
	pX := permissionFor("s1", "mcp__arduino-board__apps_start")
	kX, _ := grantKey(pX.ToolCall)
	store := &fakeGrantStore{loaded: map[string][]string{"": {kX}}}
	var g toolGrants
	g.attach(store)
	if _, ok, _ := g.autoAllow("", pX); !ok {
		t.Fatal("setup: the grant does not answer")
	}

	store.mu.Lock()
	store.loaded, store.rev = map[string][]string{}, store.rev+1 // App Lab deleted the app the grant is for
	store.mu.Unlock()
	g.writeMu.Lock() // an answer is being saved
	answered := make(chan bool, 1)
	go func() {
		_, ok, _ := g.autoAllow("", pX)
		answered <- ok
	}()
	select {
	case <-answered:
		t.Fatal("the reload ran while an answer was being saved")
	case <-time.After(100 * time.Millisecond):
	}
	g.writeMu.Unlock()
	select {
	case ok := <-answered:
		if ok {
			t.Error("the deleted app's grant still answers after the reload")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("the reload never ran")
	}
}

// Two answers can be in flight at once — a background turn and the open one each waiting on a permission — and
// SaveGrants replaces the workspace's whole list, so an older snapshot landing last silently drops the newer grant.
func TestConcurrentGrantsBothSurvive(t *testing.T) {
	store := &fakeGrantStore{onSave: func() { time.Sleep(30 * time.Millisecond) }}
	var g toolGrants
	g.attach(store)

	var wg sync.WaitGroup
	for _, title := range []string{"mcp__arduino-board__apps_start", "mcp__arduino-board__apps_stop"} {
		wg.Add(1)
		go func(title string) {
			defer wg.Done()
			g.record("ws", permissionFor("s1", title), "allow_always", noCard)
		}(title)
	}
	wg.Wait()

	store.mu.Lock()
	defer store.mu.Unlock()
	if got := len(store.saved["ws"]); got != 2 {
		t.Errorf("the file kept %d of the 2 grants: %q", got, store.saved["ws"])
	}
}

// An edit's title holds its path, and a mirror folder is "<board>__<app>": the grant is the file's, on both engines, and holds none of the edit's text.
func TestAnEditInAMirrorFolderIsGrantedForItsFile(t *testing.T) {
	const rel = "2923045065__user-blink-6b812e/python/main.py"
	const abs = "/root/ai-mirror/" + rel
	claude := func(title string, input map[string]any) PermissionRequest {
		p := permissionFor("s1", title)
		p.ToolCall = &ToolCall{ID: "c", Title: title, Kind: "edit", Input: input}
		return p
	}
	openCode := func(path, diff string) PermissionRequest {
		p := permissionFor("s1", path)
		p.ToolCall = &ToolCall{ID: "c", Title: path, Kind: "edit", Paths: []string{path}, Input: map[string]any{"filepath": path, "diff": diff}}
		return p
	}
	cases := map[string]struct{ first, next, other PermissionRequest }{
		"Claude": {
			first: claude("Edit "+rel, map[string]any{"file_path": abs, "old_string": "a", "new_string": "b"}),
			next:  claude("Edit "+rel, map[string]any{"file_path": abs, "old_string": "c", "new_string": "d"}),
			other: claude("Edit 2923045065__user-blink-6b812e/python/secrets.py", map[string]any{"file_path": "/root/ai-mirror/2923045065__user-blink-6b812e/python/secrets.py", "old_string": "a", "new_string": "b"}),
		},
		"OpenCode": {
			first: openCode(abs, "@@ -1 +1 @@\n-a\n+b\n"),
			next:  openCode(abs, "@@ -1 +1 @@\n-c\n+d\n"),
			other: openCode("/root/ai-mirror/2923045065__user-blink-6b812e/python/secrets.py", "@@ -1 +1 @@\n-a\n+b\n"),
		},
	}
	for name, c := range cases {
		store := &fakeGrantStore{}
		var g toolGrants
		g.attach(store)
		g.record("app-x", c.first, "allow_always", noCard)
		if _, ok, _ := g.autoAllow("app-x", c.next); !ok {
			t.Errorf("%s: the next edit of the granted file still prompts", name)
		}
		if _, ok, _ := g.autoAllow("app-x", c.other); ok {
			t.Errorf("%s: a grant on one file answered an edit of another", name)
		}
		for _, k := range store.saved["app-x"] {
			if strings.Contains(k, "args\x00") {
				t.Errorf("%s: the saved grant holds the edit's arguments: %q", name, k)
			}
		}
	}

	write := &ToolCall{Title: "Write " + rel, Kind: "edit", Input: map[string]any{"file_path": abs, "content": "API_KEY = 'secret'\n"}}
	if key, _ := grantKey(write); strings.Contains(key, "secret") {
		t.Errorf("a Write's grant key holds the file's content: %q", key)
	}
}

// A file edit's key scoped by its arguments answers no call; App Lab's store removes it from the file, so a grant writes its own workspace alone.
func TestAKeyScopedByAFileEditsArgumentsIsDropped(t *testing.T) {
	const title = "Edit 2923045065__user-blink-6b812e/python/main.py"
	stale := "edit\x00" + title + "\x00args\x00" + `{"file_path":"/m/main.py","new_string":"KEY = 'secret'","old_string":"a"}`
	board := "other\x00mcp__arduino-board__models_delete\x00args\x00" + `{"id":"yolo"}`
	store := &fakeGrantStore{loaded: map[string][]string{"app-x": {stale}, "": {stale, board}}}
	var g toolGrants
	g.attach(store)
	edit := permissionFor("s1", title)
	edit.ToolCall = &ToolCall{Title: title, Kind: "edit", Input: map[string]any{"file_path": "/m/main.py", "old_string": "a", "new_string": "KEY = 'secret'"}}
	if _, ok, _ := g.autoAllow("app-x", edit); ok {
		t.Fatal("the edit was answered without asking")
	}

	g.record("app-y", permissionFor("s2", "mcp__arduino-board__apps_start"), "allow_always", noCard)
	if len(store.saved) != 1 || store.saved["app-y"] == nil {
		t.Errorf("written = %q, want the granted workspace alone", store.saved)
	}
}

// atGrantStore is also told the revision a list was computed at, as App Lab's store is.
type atGrantStore struct {
	fakeGrantStore
	added string
	rev   uint64
}

func (s *atGrantStore) SaveGrantsAt(ws string, keys []string, added string, rev uint64) {
	s.mu.Lock()
	s.added, s.rev = added, rev
	s.mu.Unlock()
	s.SaveGrants(ws, keys)
}

// A card opened before a delete or rename may name the app it retired: the store is told the revision the card opened at, not the one of the list.
func TestAGrantCarriesTheRevisionItsCardOpenedAt(t *testing.T) {
	store := &atGrantStore{fakeGrantStore: fakeGrantStore{loaded: map[string][]string{}, rev: 3}}
	var g toolGrants
	g.attach(store)
	req := permissionFor("s1", "mcp__arduino-board__apps_start")
	_, ok, opened := g.autoAllow("", req)
	if ok {
		t.Fatal("setup: the call was answered without a card")
	}

	store.fakeGrantStore.rev = 5 // App Lab deletes or renames an app while the card is open
	g.record("", req, "allow_always", opened)

	key, _ := grantKey(req.ToolCall)
	if store.added != key || store.rev != 3 {
		t.Errorf("saved with key %q at revision %d, want %q at 3", store.added, store.rev, key)
	}
}

// A call already granted, whose prompt offers no one-off allow, is shown on a card: that card's answer is saved at the revision it opened at too.
func TestAGrantedCallAskedOnACardKeepsItsRevision(t *testing.T) {
	req := PermissionRequest{
		SessionID: "s1",
		ToolCall:  &ToolCall{Title: "mcp__arduino-board__apps_start", Kind: "other", Input: map[string]any{"id": "dXNlcjpibGluaw"}},
		Options:   []PermissionOption{{ID: "allow_always", Kind: "allow_always"}, {ID: "reject", Kind: "reject_once"}},
	}
	key, _ := grantKey(req.ToolCall)
	store := &atGrantStore{fakeGrantStore: fakeGrantStore{loaded: map[string][]string{"": {key}}, rev: 3}}
	var g toolGrants
	g.attach(store)
	_, ok, opened := g.autoAllow("", req)
	if ok {
		t.Fatal("setup: the call was answered without a card")
	}

	store.fakeGrantStore.rev = 5 // App Lab deletes or renames an app while the card is open
	g.record("", req, "allow_always", opened)

	if store.added != key || store.rev != 3 {
		t.Errorf("saved with key %q at revision %d, want %q at 3", store.added, store.rev, key)
	}
}

// noCard is the card revision of an answer a test gives with no card before it: record then uses its list's revision.
const noCard = ^uint64(0)

// A list computed before App Lab rewrote the file would put back what the rewrite removed: the store gets the list's revision and the key just granted.
func TestAGrantIsSavedWithTheRevisionItsListCameFrom(t *testing.T) {
	store := &atGrantStore{fakeGrantStore: fakeGrantStore{loaded: map[string][]string{}, rev: 3}}
	var g toolGrants
	g.attach(store)
	req := permissionFor("s1", "mcp__arduino-board__apps_start")

	g.record("app-x", req, "allow_always", noCard)

	key, _ := grantKey(req.ToolCall)
	if store.added != key || store.rev != 3 {
		t.Errorf("saved with key %q at revision %d, want %q at 3", store.added, store.rev, key)
	}
}

// A board call that takes no arguments has one possible call, so its grant is exactly as narrow as it.
func TestABoardCallWithNoArgumentsCanBeGranted(t *testing.T) {
	for _, title := range []string{"mcp__arduino-board__wifi_disconnect", "arduino-board_wifi_disconnect"} {
		none := permissionFor("s1", title)
		none.ToolCall.Input, none.ToolCall.noArguments = map[string]any{}, true
		var g toolGrants
		g.record("app-x", none, "allow_always", noCard)
		if _, ok, _ := g.autoAllow("app-x", none); !ok {
			t.Errorf("%s: Always allow on a call with no arguments did nothing", title)
		}
		unknown := permissionFor("s2", title)
		unknown.ToolCall.Input = map[string]any{}
		if _, ok, _ := g.autoAllow("app-x", unknown); ok {
			t.Errorf("%s: a call whose arguments never arrived was answered", title)
		}
	}
}

// models_import_custom names its app in an argument; scoped to it, the grant goes with the app's delete or rename.
func TestModelsImportCustomIsGrantedForTheAppItTargets(t *testing.T) {
	importInto := func(app string) PermissionRequest {
		p := permissionFor("s1", "mcp__arduino-board__models_import_custom")
		p.ToolCall.Input = map[string]any{"appId": app, "brickId": "arduino:object_detection"}
		return p
	}
	var g toolGrants
	g.record("", importInto("dXNlcjpibGluaw"), "allow_always", noCard)
	if _, ok, _ := g.autoAllow("", importInto("dXNlcjpibGluaw")); !ok {
		t.Error("the same app still prompts")
	}
	if _, ok, _ := g.autoAllow("", importInto("dXNlcjpvdGhlcg")); ok {
		t.Error("importing into one app answered importing into another")
	}
	for _, spelling := range []string{"dXNlcjpibGluaw=", "user:blink"} {
		if _, ok, _ := g.autoAllow("", importInto(spelling)); !ok {
			t.Errorf("the same app, spelled %q, still prompts", spelling)
		}
	}
	key, _ := grantKey(importInto("dXNlcjpibGluaw").ToolCall)
	if parts := strings.Split(key, "\x00"); len(parts) != 3 || parts[2] != "dXNlcjpibGluaw" {
		t.Errorf("key = %q, want kind, title and the app id, the shape a delete or rename rescopes", key)
	}
}

// cardStore is safe for concurrent use and records the revision each added key was saved at.
type cardStore struct {
	rev   atomic.Uint64
	mu    sync.Mutex
	saved map[string][]string
	at    map[string]uint64
}

func (s *cardStore) Revision() uint64 { return s.rev.Load() }
func (s *cardStore) LoadGrants() map[string][]string {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := map[string][]string{}
	for ws, keys := range s.saved {
		out[ws] = append([]string(nil), keys...)
	}
	return out
}
func (s *cardStore) SaveGrants(ws string, keys []string) { s.SaveGrantsAt(ws, keys, "", s.rev.Load()) }
func (s *cardStore) SaveGrantsAt(ws string, keys []string, added string, rev uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.saved[ws] = append([]string(nil), keys...)
	if added != "" {
		s.at[added] = rev
	}
}

// cardHandler shows the target's card until it is answered, and ends every other card the way a Stop does.
type cardHandler struct {
	target string
	asked  chan struct{}
	answer chan string
}

func (h *cardHandler) HandleUpdate(SessionID, Update) {}
func (h *cardHandler) HandlePermission(_ context.Context, req PermissionRequest) PermissionOutcome {
	if req.ToolCall.ID != h.target {
		return PermissionOutcome{Cancelled: true}
	}
	close(h.asked)
	return PermissionOutcome{OptionID: <-h.answer}
}
func (h *cardHandler) HandleElicitation(context.Context, SessionID, []ChoiceRequest) []ChoiceSubmission {
	return nil
}

// Through the connection: an open card keeps the revision it was checked at, however many other cards end with no answer meanwhile.
func TestAnOpenCardKeepsItsRevisionThroughTheConnection(t *testing.T) {
	store := &cardStore{saved: map[string][]string{}, at: map[string]uint64{}}
	store.rev.Store(3)
	h := &cardHandler{target: "target", asked: make(chan struct{}), answer: make(chan string)}
	c := &sdkConn{dialect: claudeDialect, handler: h}
	c.grants.attach(store)
	c.rememberSession("s1", "/mirror", SessionWorkspace{})
	c.rememberSession("s2", "/mirror", SessionWorkspace{AppID: "dXNlcjpvdGhlcg"})
	ask := func(sid, callID, appID string) acp.RequestPermissionRequest {
		title := "mcp__arduino-board__apps_start"
		return acp.RequestPermissionRequest{
			SessionId: acp.SessionId(sid),
			ToolCall:  acp.ToolCallUpdate{ToolCallId: acp.ToolCallId(callID), Title: &title, RawInput: map[string]any{"id": appID}},
			Options:   alwaysAndOnceOptions(),
		}
	}
	ctx := context.Background()
	done := make(chan struct{})
	go func() {
		defer close(done)
		_, _ = c.RequestPermission(ctx, ask("s1", "target", "dXNlcjpibGluaw"))
	}()
	<-h.asked
	for i := 0; i < 100; i++ {
		_, _ = c.RequestPermission(ctx, ask("s2", fmt.Sprintf("stopped-%d", i), "dXNlcjpvdGhlcg"))
	}
	store.rev.Store(5) // App Lab deletes the app the open card names
	h.answer <- "allow_always"
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("the answer never returned")
	}

	key, _ := grantKey(&ToolCall{ID: "target", Title: "mcp__arduino-board__apps_start", Input: map[string]any{"id": "dXNlcjpibGluaw"}})
	store.mu.Lock()
	defer store.mu.Unlock()
	if got, ok := store.at[key]; !ok || got != 3 {
		t.Errorf("the answer was saved at revision %d (saved %v), want 3, the revision its card was checked at", got, ok)
	}
}
