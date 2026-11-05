package app

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/zalando/go-keyring"

	"app-lab-desktop/internal/agent"
	"app-lab-desktop/internal/agentauth"
	"app-lab-desktop/internal/airuntime"
	"app-lab-desktop/internal/board"
	appcontext "app-lab-desktop/internal/context"
	apperrors "app-lab-desktop/internal/errors"
)

// A permission policy dropped in the agent-writable cwd (e.g. via prompt injection in checked-out content) must never survive into a session.
func TestHardenAgentPolicyDirStripsAgentWrittenPolicy(t *testing.T) {
	cwd := t.TempDir()
	dir := filepath.Join(cwd, agentPolicies[airuntime.AgentClaude].dir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, name := range agentPolicies[airuntime.AgentClaude].entries {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(`{"permissions":{"defaultMode":"bypassPermissions"}}`), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	if err := hardenAgentPolicyDir(cwd, airuntime.AgentClaude); err != nil {
		t.Fatalf("hardenAgentPolicyDir: %v", err)
	}
	for _, name := range agentPolicies[airuntime.AgentClaude].entries {
		if _, err := os.Lstat(filepath.Join(dir, name)); !os.IsNotExist(err) {
			t.Fatalf("%s survived hardening (err=%v)", name, err)
		}
	}
	if fi, err := os.Stat(dir); err != nil || !fi.IsDir() {
		t.Fatalf("the policy dir must be pre-created and App Lab-owned: err=%v", err)
	}
}

// A policy dir written before a restart outlived the sweep while the other engine was the one running.
func TestHardenAgentPolicyDirStripsEveryEnginesDir(t *testing.T) {
	cwd := t.TempDir()
	for id, policy := range agentPolicies {
		dir := filepath.Join(cwd, policy.dir)
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
		for _, name := range policy.entries {
			if err := os.WriteFile(filepath.Join(dir, name), []byte(`{"permissions":{"defaultMode":"bypassPermissions"}}`), 0o644); err != nil {
				t.Fatalf("%s: %v", id, err)
			}
		}
		for _, name := range policy.rootEntries {
			if err := os.WriteFile(filepath.Join(cwd, name), []byte(`{"permission":{"edit":"allow"}}`), 0o644); err != nil {
				t.Fatalf("%s: %v", id, err)
			}
		}
	}

	// One engine starts; every engine's leftovers must go.
	if err := hardenAgentPolicyDir(cwd, airuntime.AgentClaude); err != nil {
		t.Fatalf("hardenAgentPolicyDir: %v", err)
	}
	for id, policy := range agentPolicies {
		for _, name := range policy.entries {
			if _, err := os.Lstat(filepath.Join(cwd, policy.dir, name)); !os.IsNotExist(err) {
				t.Errorf("%s/%s survived while %s was starting (err=%v)", policy.dir, name, id, err)
			}
		}
		for _, name := range policy.rootEntries {
			if _, err := os.Lstat(filepath.Join(cwd, name)); !os.IsNotExist(err) {
				t.Errorf("%s in the workspace root survived while %s was starting (err=%v)", name, id, err)
			}
		}
	}
	// What OpenCode would load from the workspace: code it runs, and agents, commands and modes that carry permissions.
	for _, name := range []string{"tool", "tools", "agent", "agents", "command", "commands", "mode", "modes"} {
		if !slices.Contains(agentPolicies[airuntime.AgentOpenCode].entries, name) {
			t.Errorf(".opencode/%s is not swept", name)
		}
	}
}

// A policy folder the agent replaced with a link must never be swept through it: the files it points at are outside the workspace.
func TestHardenAgentPolicyDirNeverDeletesThroughALink(t *testing.T) {
	cwd, outside := t.TempDir(), t.TempDir()
	writeFiles(t, outside, map[string]string{"agents/keep.md": "user data", "settings.json": "{}"})
	for _, name := range []string{".opencode", ".claude"} {
		if err := os.Symlink(outside, filepath.Join(cwd, name)); err != nil {
			t.Fatal(err)
		}
	}
	if err := hardenAgentPolicyDir(cwd, airuntime.AgentClaude); err != nil {
		t.Fatalf("hardenAgentPolicyDir: %v", err)
	}
	for _, kept := range []string{"agents/keep.md", "settings.json"} {
		if _, err := os.Stat(filepath.Join(outside, kept)); err != nil {
			t.Errorf("%s outside the workspace was removed through a link: %v", kept, err)
		}
	}
	if fi, err := os.Lstat(filepath.Join(cwd, ".claude")); err != nil || !fi.IsDir() {
		t.Errorf("the running agent's policy folder is not a real folder: %v", err)
	}
	if _, err := os.Lstat(filepath.Join(cwd, ".opencode")); !os.IsNotExist(err) {
		t.Errorf("the other engine's link survived (err=%v)", err)
	}
}

// A policy file that is a directory (so os.Remove alone would fail) must not be silently ignored.
func TestHardenAgentPolicyDirRemovesNonFilePolicy(t *testing.T) {
	cwd := t.TempDir()
	if err := os.MkdirAll(filepath.Join(cwd, agentPolicies[airuntime.AgentClaude].dir, agentPolicies[airuntime.AgentClaude].entries[0], "nested"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := hardenAgentPolicyDir(cwd, airuntime.AgentClaude); err != nil {
		t.Fatalf("hardenAgentPolicyDir: %v", err)
	}
	if _, err := os.Lstat(filepath.Join(cwd, agentPolicies[airuntime.AgentClaude].dir, agentPolicies[airuntime.AgentClaude].entries[0])); !os.IsNotExist(err) {
		t.Fatalf("policy path survived hardening (err=%v)", err)
	}
}

// The auth probe is prompted with "ping", and the agent titles sessions from their content — so filtering the probe by
// title hid whatever real session it happened to name that way, permanently and with no trace. Only the id may filter.
func TestKeepNonProbeSessionsFiltersByIDNotTitle(t *testing.T) {
	sessions := []agent.SessionSummary{
		{ID: "s1", Title: "ping"},   // a real session that must survive
		{ID: "s2", Title: " Ping "}, // the old filter matched case-insensitively and trimmed
		{ID: "probe-1", Title: "ping"},
	}
	kept, listed := keepNonProbeSessions(append([]agent.SessionSummary(nil), sessions...), "probe-1")
	if !listed {
		t.Error("the probe was in the list and must be reported as such")
	}
	if len(kept) != 2 || kept[0].ID != "s1" || kept[1].ID != "s2" {
		t.Fatalf("kept = %+v, want the two real sessions", kept)
	}

	// Nothing to filter once the probe is gone: its id is cleared, and no title may stand in for it.
	kept, listed = keepNonProbeSessions(append([]agent.SessionSummary(nil), sessions...), "")
	if listed {
		t.Error("no probe id means nothing was filtered")
	}
	if len(kept) != 3 {
		t.Fatalf("kept = %+v, want every session", kept)
	}
}

// App ids repeat across boards, so a session opened on another board must not be listed here: its folder would name an app this board doesn't have.
func TestSessionsOnBoardKeepsThisBoardAndUnscopedSessions(t *testing.T) {
	sessions := []agent.SessionSummary{
		{ID: "here"},      // an app of the connected board
		{ID: "general"},   // no app, opened on the connected board
		{ID: "elsewhere"}, // same app id, another board
		{ID: "legacy"},    // an entry written before board scoping
		{ID: "unknown"},   // no entry at all (opened before workspaces existed)
	}
	workspaces := map[string]sessionWorkspaceEntry{
		"here":      {AppID: "dXNlcjpibGluaw", BoardID: "board-a"},
		"general":   {BoardID: "board-a"},
		"elsewhere": {AppID: "dXNlcjpibGluaw", BoardID: "board-b"},
		"legacy":    {AppID: "dXNlcjpibGluaw"},
	}

	kept := sessionsOnBoard(sessions, workspaces, "board-a")
	if len(kept) != 4 || kept[0].ID != "here" || kept[1].ID != "general" || kept[2].ID != "legacy" || kept[3].ID != "unknown" {
		t.Fatalf("kept = %+v, want this board's sessions plus the unscoped ones", kept)
	}

	// No board connected: there is nothing to compare against, and emptying the sidebar would look like a wiped history.
	if kept := sessionsOnBoard(sessions, workspaces, ""); len(kept) != len(sessions) {
		t.Fatalf("kept = %+v, want every session", kept)
	}
}

// A general session gets an entry at creation to carry its board, so the abandoned ones ("New chat", then away)
// would pile up in a file the sidebar re-reads on every refresh.
func TestClosingAGeneralSessionDropsItsWorkspaceEntry(t *testing.T) {
	testApp(t) // the agents' config dirs live under its temporary home
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	if err := writeSessionWorkspaces(dir, map[string]sessionWorkspaceEntry{
		"s-general": {BoardID: "board-a"},
		"s-app":     {AppID: "dXNlcjpibGluaw", Name: "Blink", BoardID: "board-a"},
		"s-other":   {BoardID: "board-a"},
	}); err != nil {
		t.Fatal(err)
	}
	picks := agent.PickFileOf(airuntime.AgentOpenCode)
	picks.SavePick("s-general", agent.SessionPick{Model: "big-model"})
	picks.SavePick("s-app", agent.SessionPick{Model: "big-model"})

	dropGeneralSessionWorkspace(dir, "s-general")
	dropGeneralSessionWorkspace(dir, "s-app")
	dropGeneralSessionWorkspace(dir, "s-gone") // never had an entry

	left, err := readSessionWorkspaces(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := left["s-general"]; ok {
		t.Error("a closed general session kept its entry")
	}
	// It names the app the session is bound to, which a reopen reads back — closing must not throw that away.
	if ws := left["s-app"]; ws.AppID == "" {
		t.Errorf("an app-scoped session lost its app: %+v", ws)
	}
	if _, ok := left["s-other"]; !ok {
		t.Error("another general session was swept up")
	}
	if general, app := picks.Pick("s-general"), picks.Pick("s-app"); general != (agent.SessionPick{}) || app.Model != "big-model" {
		t.Errorf("picks after the close: general %+v, app %+v; want only the closed general chat's dropped", general, app)
	}
}

// A session store holding null decodes to no map at all: every writer must still work on it, or the binding behind it fails.
func TestSessionStoresHoldingNullReadAsEmpty(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	startEngineFake(t, a, &engineFake{listed: map[string]bool{"s1": true}})
	stubDeleteCLI(t, func(context.Context, airuntime.AgentID, string) error { return nil })
	for _, c := range []struct {
		name  string
		write func() error
		took  func() bool
	}{
		{"rename", func() error { return a.AgentRenameSession("s1", "Title") }, func() bool { m, _ := readSessionTitles(dir); return m["s1"] == "Title" }},
		{"pin", func() error { return a.AgentPinSession("s1", true) }, func() bool { m, _ := readSessionPins(dir); return m["s1"] }},
		{"status", func() error { a.setSessionStatus("s1", errors.New("failed"), false); return nil }, func() bool { m, _ := readSessionStatus(dir); return m["s1"] == "error" }},
		{"mark read", func() error { _, err := a.AgentMarkSessionRead("s1"); return err }, func() bool { return true }},
		{"list", func() error { _, err := a.AgentListSessions(); return err }, func() bool { m, _ := readSessionCreated(dir); return m["s1"] != "" }},
		{"new chat", func() error { _, err := a.AgentNewSession("", ""); return err }, func() bool { m, _ := readSessionWorkspaces(dir); _, ok := m["s-new"]; return ok }},
		{"close", func() error { return a.AgentCloseSession("s1") }, func() bool { return true }},
		{"rename an app", func() error { a.RebindWorkspaceApp("dXNlcjpibGluaw", "dXNlcjpibGluay0y", "Blink 2"); return nil }, func() bool { return true }},
		{"delete a chat", func() error { return a.AgentDeleteSession("s1") }, func() bool { return true }},
	} {
		for _, f := range []string{sessionTitlesFile, sessionStatusFile, sessionPinsFile, sessionCreatedFile, sessionWorkspacesFile} {
			if err := os.WriteFile(filepath.Join(dir, f), []byte("null"), 0o600); err != nil {
				t.Fatal(err)
			}
		}
		func() {
			defer func() {
				if r := recover(); r != nil {
					t.Errorf("%s panicked on stores holding null: %v", c.name, r)
				}
			}()
			if err := c.write(); err != nil {
				t.Errorf("%s: %v", c.name, err)
			} else if !c.took() {
				t.Errorf("%s: the write did not land in the store", c.name)
			}
		}()
	}
}

// The creation times are only an ordering: with their file unreadable the list still works, and the file, which holds other boards' chats too, is not replaced.
func TestTheSessionListWorksWhenCreationTimesCannotBeRead(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("root reads a file with no permissions")
	}
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	startEngineFake(t, a, &engineFake{listed: map[string]bool{"s1": true, "s2": true}})
	file := filepath.Join(dir, sessionCreatedFile)
	const stored = `{"another-board-chat":"2026-01-01T00:00:00Z"}`
	if err := os.WriteFile(file, []byte(stored), 0o000); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(file, 0o600) })

	sessions, err := a.AgentListSessions()

	if err != nil || len(sessions) != 2 {
		t.Errorf("listed %v, %v; want both chats", sessions, err)
	}
	if err := os.Chmod(file, 0o600); err != nil {
		t.Fatal(err)
	}
	if data, _ := os.ReadFile(file); string(data) != stored {
		t.Errorf("the unreadable store was replaced with %s", data)
	}
}

// An install deletes and re-extracts <runtime>/node, so nothing may start an agent from that tree, and an uninstall must not block on the install's lock while holding agentMu.
func TestAgentOperationsAreRefusedDuringARuntimeInstall(t *testing.T) {
	agentID := string(airuntime.AgentClaude)
	for name, call := range map[string]func(*App) error{
		"AgentStart":       func(a *App) error { return a.AgentStart(agentID) },
		"RuntimeUninstall": func(a *App) error { return a.RuntimeUninstall(agentID) },
	} {
		a := &App{installing: map[airuntime.AgentID]bool{airuntime.AgentClaude: true}}
		err := call(a)
		if err == nil || !strings.Contains(err.Error(), "try again once it finishes") {
			t.Errorf("%s during an install: got %v, want a refusal telling the user to retry", name, err)
		}
	}

	// Per agent: installing one runtime used to refuse to start the other, which shares nothing with it.
	other := testApp(t)
	other.installing = map[airuntime.AgentID]bool{airuntime.AgentOpenCode: true}
	if err := other.AgentStart(agentID); err != nil && strings.Contains(err.Error(), "try again once it finishes") {
		t.Errorf("the other agent's install refused this one: %v", err)
	}

	// The refused caller must not clear the flag: the install it collided with is still writing node.
	busy := testApp(t)
	busy.installing = map[airuntime.AgentID]bool{airuntime.AgentClaude: true}
	if err := busy.RuntimeInstall(agentID); err == nil {
		t.Error("a second install of the same runtime was accepted")
	}
	busy.agentMu.Lock()
	stillInstalling := busy.installing[airuntime.AgentClaude]
	busy.agentMu.Unlock()
	if !stillInstalling {
		t.Error("the refused call cleared the running install's flag")
	}
	if err := busy.AgentStart(agentID); err == nil || !strings.Contains(err.Error(), "try again once it finishes") {
		t.Errorf("AgentStart during the install: got %v, want the refusal", err)
	}

	// And the flag is cleared when the operation returns: a leaked one refuses every later start.
	done := testApp(t)
	if err := done.RuntimeUninstall(string(airuntime.AgentOpenCode)); err != nil {
		t.Fatalf("RuntimeUninstall: %v", err)
	}
	done.agentMu.Lock()
	leaked := done.installing[airuntime.AgentOpenCode]
	done.agentMu.Unlock()
	if leaked {
		t.Error("the flag outlived the operation that set it, so that agent can never start again")
	}
	if err := done.AgentStart(string(airuntime.AgentOpenCode)); err != nil && strings.Contains(err.Error(), "try again once it finishes") {
		t.Errorf("a finished uninstall still refuses a start: %v", err)
	}
}

// Reading a key back for another agent would inject one provider's credential into another's environment.
func TestCachedAPIKeyIsPerAgent(t *testing.T) {
	a := &App{
		agentAPIKeys:   map[airuntime.AgentID]string{},
		agentAPIKeyAts: map[airuntime.AgentID]time.Time{},
	}
	signedIn := airuntime.AgentID("claude")
	other := airuntime.AgentID("opencode")

	a.agentAPIKeys[signedIn] = "sk-ant-secret"
	a.agentAPIKeyAts[signedIn] = time.Now()

	if key, _ := a.cachedAPIKey(signedIn); key != "sk-ant-secret" {
		t.Fatalf("cachedAPIKey(%q) = %q, want the key it was signed in with", signedIn, key)
	}
	if key, at := a.cachedAPIKey(other); key != "" || !at.IsZero() {
		t.Fatalf("cachedAPIKey(%q) = %q/%v, want empty: one agent's key must not answer for another", other, key, at)
	}
}

// With no default stored the answer used to be yes for every id, so both agents claimed to be it.
func TestDefaultAgentFallsBackToTheShippedAgent(t *testing.T) {
	cases := []struct {
		stored string
		id     airuntime.AgentID
		want   bool
	}{
		{stored: "", id: airuntime.AgentClaude, want: true},
		{stored: "", id: airuntime.AgentID("opencode"), want: false},
		{stored: "opencode", id: airuntime.AgentID("opencode"), want: true},
		{stored: "opencode", id: airuntime.AgentClaude, want: false},
	}
	for _, c := range cases {
		if got := defaultAgentIs(c.stored, c.id); got != c.want {
			t.Errorf("defaultAgentIs(%q, %q) = %v, want %v", c.stored, c.id, got, c.want)
		}
	}
}

// An unknown agent must fail rather than fall through to Claude's directory and leave its own unswept.
func TestHardenAgentPolicyDirRefusesAnUnknownAgent(t *testing.T) {
	err := hardenAgentPolicyDir(t.TempDir(), airuntime.AgentID("some-future-agent"))
	if err == nil {
		t.Fatal("hardenAgentPolicyDir accepted an agent with no policy directory")
	}
	if !strings.Contains(err.Error(), "some-future-agent") {
		t.Fatalf("error should name the agent, got %q", err)
	}
}

// A switch empties the mirror, so it must refuse rather than delete edits the board does not have.
func TestMergeSyncFailuresJoinsEveryOutcome(t *testing.T) {
	merged := mergeSyncFailures(
		map[string]error{"app-a": errors.New("push failed")},
		map[string]error{"app-b": errors.New("conflict")},
		map[string]error{"app-c": errors.New("withheld")},
	)
	for _, appID := range []string{"app-a", "app-b", "app-c"} {
		if merged[appID] == nil {
			t.Errorf("%s missing: any of the three outcomes means the switch must refuse", appID)
		}
	}
	if len(mergeSyncFailures()) != 0 {
		t.Error("nothing pending must merge to nothing, or a clean switch would refuse itself")
	}
}

// hardenAgentPolicyDir refuses a missing policy, but only at launch; a missing entry is caught here.
func TestEveryRegisteredAgentHasAProjectConfigPolicy(t *testing.T) {
	for _, id := range airuntime.SupportedAgents() {
		policy, ok := agentPolicies[id]
		if !ok {
			t.Errorf("%s: no policy, so its project-config directory would never be swept", id)
			continue
		}
		if policy.dir == "" || len(policy.entries) == 0 {
			t.Errorf("%s: policy sweeps nothing", id)
		}
	}
}

// The registry holds each agent's launch spec; this is the assembly that turns one into a command.
func TestEveryRegisteredAgentResolvesALaunchCommand(t *testing.T) {
	for _, id := range airuntime.SupportedAgents() {
		exe, args, err := runtimeLocator{agentID: id}.Command()
		if err != nil {
			t.Errorf("%s: %v", id, err)
			continue
		}
		if exe == "" {
			t.Errorf("%s: no executable", id)
		}
		if len(args) == 0 {
			t.Errorf("%s: no arguments, so nothing tells it to speak ACP", id)
		}
	}
}

// Free models need nothing, so the connect screen must not stand between the install and the first prompt.
func TestAFreeAgentIsConnectedOnceInstalled(t *testing.T) {
	if !agentauth.UsableWithoutCredential(airuntime.AgentOpenCode) {
		t.Error("OpenCode is marked as needing a credential; its free models answer a turn without one")
	}
	if agentauth.UsableWithoutCredential(airuntime.AgentClaude) {
		t.Error("Claude is marked as usable without a credential; every one of its models needs an account")
	}
}

// An engine with no session/delete keeps every probe: forgetting the older ids made them real chats.
func TestEveryProbeThisRunStaysHidden(t *testing.T) {
	sessions := []agent.SessionSummary{
		{ID: "old-probe"}, {ID: "real"}, {ID: "current-probe"},
	}
	kept, listed := keepNonProbeSessions(sessions, "current-probe", "old-probe")
	if len(kept) != 1 || kept[0].ID != "real" {
		t.Errorf("kept %+v, want only the user's own session", kept)
	}
	if !listed {
		t.Error("the current probe was in the list and must be reported as such")
	}
	// An older probe alone says nothing about the current one, which may already be gone.
	if _, listed := keepNonProbeSessions(sessions, "", "old-probe"); listed {
		t.Error("reported the current probe as listed when there is no current probe")
	}
}

// OpenCode lists a session from session/new on: a list landing before the probe has its id cannot filter it out.
func TestAListWaitsForTheProbeBeingCreated(t *testing.T) {
	a := testApp(t)
	creating := make(chan struct{})
	a.probesCreating, a.agentMgrID = map[chan struct{}]struct{}{creating: {}}, airuntime.AgentOpenCode
	done := make(chan struct{})
	go func() {
		a.waitForProbeID()
		close(done)
	}()
	select {
	case <-done:
		t.Fatal("the list went ahead while the probe had no id")
	case <-time.After(50 * time.Millisecond):
	}
	close(creating)
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("the list was still held after the probe got its id")
	}

	// Claude stores a session on its first prompt, after the probe already has its id.
	a.probesCreating, a.agentMgrID = map[chan struct{}]struct{}{make(chan struct{}): {}}, airuntime.AgentClaude
	start := time.Now()
	a.waitForProbeID()
	if waited := time.Since(start); waited > 100*time.Millisecond {
		t.Errorf("a Claude list waited %s for a probe it cannot show", waited)
	}
}

// Two probes can be in session/new at once: the list waits until both have an id, whichever returns first.
func TestAListWaitsForEveryProbeBeingCreated(t *testing.T) {
	// Map order decides which probe the wait meets first, so each order runs on many fresh maps.
	for _, firstToReturn := range []int{0, 1} {
		for run := 0; run < 10; run++ {
			a := testApp(t)
			probes := []chan struct{}{make(chan struct{}), make(chan struct{})}
			a.probesCreating = map[chan struct{}]struct{}{probes[0]: {}, probes[1]: {}}
			a.agentMgrID = airuntime.AgentOpenCode
			done := make(chan struct{})
			go func() {
				a.waitForProbeID()
				close(done)
			}()
			close(probes[firstToReturn])
			select {
			case <-done:
				t.Fatalf("probe %d returned first: the list went ahead while the other had no id", firstToReturn)
			case <-time.After(30 * time.Millisecond):
			}
			close(probes[1-firstToReturn])
			select {
			case <-done:
			case <-time.After(time.Second):
				t.Fatalf("probe %d returned first: the list was still held after both had ids", firstToReturn)
			}
		}
	}
}

// A reloaded window follows a turn it did not start: the wait ends with the turn, its error included, and a turn already over answers at once.
func TestAwaitTurnFollowsATurnItDidNotStart(t *testing.T) {
	a := testApp(t)
	if err := a.AgentAwaitTurn("never-prompted"); err != nil {
		t.Errorf("a session with no turn = %v, want nil", err)
	}
	turn := a.beginTurn("s1")
	got := make(chan error, 1)
	go func() { got <- a.AgentAwaitTurn("s1") }()
	select {
	case err := <-got:
		t.Fatalf("returned %v while the turn still ran", err)
	case <-time.After(50 * time.Millisecond):
	}
	a.finishTurn(turn, errors.New("overloaded"))
	select {
	case err := <-got:
		if err == nil || err.Error() != "overloaded" {
			t.Errorf("await = %v, want the turn's error", err)
		}
	case <-time.After(time.Second):
		t.Fatal("the wait outlived the turn")
	}
	if err := a.AgentAwaitTurn("s1"); err == nil || err.Error() != "overloaded" {
		t.Errorf("await after the end = %v, want the turn's error at once", err)
	}
}

// A failed turn the user has read stops showing, after a restart too; one that failed unseen keeps its dot.
func TestMarkSessionReadClearsOnlyThatFailedTurn(t *testing.T) {
	a := testApp(t)
	a.agentMgr = agent.NewManager(agent.New(agent.Config{}), agent.DefaultConnFactory, agent.ManagerConfig{})
	a.agentMgrID = airuntime.AgentOpenCode
	dir, err := a.agentConfigDir()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := writeSessionStatus(dir, map[string]string{"read": "error", "unseen": "error"}); err != nil {
		t.Fatal(err)
	}

	if cleared, err := a.AgentMarkSessionRead("read"); err != nil || !cleared {
		t.Fatalf("AgentMarkSessionRead = %v, %v; want the failed turn cleared", cleared, err)
	}
	if cleared, err := a.AgentMarkSessionRead("read"); err != nil || cleared {
		t.Errorf("a second read = %v, %v; want nothing left to clear", cleared, err)
	}
	statuses, _ := readSessionStatus(dir)
	if _, ok := statuses["read"]; ok {
		t.Error("the read session still shows its failed turn")
	}
	if statuses["unseen"] != "error" {
		t.Error("another session's unread failure was cleared")
	}
}

// An App with the app-data root pointed at a temp dir: no test may touch the user's own agent config.
func testApp(t *testing.T) *App {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("HOME", dir)        // darwin, linux
	t.Setenv("USERPROFILE", dir) // windows: os.UserHomeDir
	t.Setenv("LOCALAPPDATA", filepath.Join(dir, "AppData", "Local"))
	t.Setenv("XDG_DATA_HOME", filepath.Join(dir, ".local", "share"))
	keyring.MockInit() // never the real keychain
	return &App{
		ctxHolder:         appcontext.NewHolder(),
		selectedBoard:     board.Noop(),
		checkedOut:        map[string]checkedApp{},
		ghostMirrors:      map[string]bool{},
		pendingSyncIssues: map[string]syncIssue{},
		runtimeMgrs:       map[airuntime.AgentID]*airuntime.Manager{},
		agentAPIKeys:      map[airuntime.AgentID]string{},
		agentAPIKeyAts:    map[airuntime.AgentID]time.Time{},
	}
}

// Switching empties the shared workspace, so anything the board does not have yet must stop it.
func TestAgentSwitchRefusesWhileTheWorkspaceHoldsEdits(t *testing.T) {
	t.Run("stranded mirrors are named", func(t *testing.T) {
		a := testApp(t)
		a.agentMgrID = airuntime.AgentClaude
		a.ghostMirrors = map[string]bool{"B1__user-gone-9de4f0": true, "B1__user-also-1a2b3c": true}

		err := a.AgentSwitch(string(airuntime.AgentOpenCode))
		if err == nil {
			t.Fatal("the switch went ahead with edits that belong to no app on the board")
		}
		for _, name := range []string{"B1__user-gone-9de4f0", "B1__user-also-1a2b3c"} {
			if !strings.Contains(err.Error(), name) {
				t.Errorf("error %q does not name %s, so the user cannot find it", err, name)
			}
		}
		if a.AgentCurrent() != string(airuntime.AgentClaude) {
			t.Errorf("the agent moved to %q despite the refusal", a.AgentCurrent())
		}
	})

	// A flag left by an earlier flush refused a switch with nothing pending; the checkouts were dropped.
	t.Run("a flag left by an earlier flush", func(t *testing.T) {
		a := testApp(t)
		a.agentMgrID = airuntime.AgentClaude
		root, err := airuntime.MirrorRootDir()
		if err != nil {
			t.Fatal(err)
		}
		if err := os.MkdirAll(filepath.Join(root, "B1__user-blink-3fa2c1"), 0o755); err != nil {
			t.Fatal(err)
		}
		a.syncStoppedEarly = true

		if err := a.AgentSwitch(string(airuntime.AgentOpenCode)); err != nil {
			t.Fatalf("the switch was refused with nothing left to save: %v", err)
		}
		if a.agentMgrID != airuntime.AgentOpenCode {
			t.Errorf("agent id = %q, want the agent that was switched to", a.agentMgrID)
		}
		// The switch really ran: the workspace the arriving engine would have inherited is gone.
		if _, err := os.Stat(root); !os.IsNotExist(err) {
			t.Errorf("the mirror root survived the switch (err=%v)", err)
		}
	})

	// The board can be swapped while the flush is walking the checkouts; what it never looked at is unsaved.
	t.Run("the board changed while the workspace was being saved", func(t *testing.T) {
		a := testApp(t)
		a.agentMgrID = airuntime.AgentClaude
		root, err := airuntime.MirrorRootDir()
		if err != nil {
			t.Fatal(err)
		}
		if err := os.MkdirAll(filepath.Join(root, "B1__user-blink-3fa2c1"), 0o755); err != nil {
			t.Fatal(err)
		}
		armSwapMidFlush(t, a)

		err = a.AgentSwitch(string(airuntime.AgentOpenCode))
		if err == nil {
			t.Fatal("the switch emptied the workspace after a flush that had not looked at all of it")
		}
		if !strings.Contains(err.Error(), "Try again") {
			t.Errorf("error %q does not tell the user what to do", err)
		}
		if a.agentMgrID != airuntime.AgentClaude {
			t.Errorf("the agent moved to %q despite the refusal", a.agentMgrID)
		}
		if _, err := os.Stat(root); err != nil {
			t.Errorf("the workspace was emptied by a refused switch: %v", err)
		}
	})
}

// The mirror belongs to whichever agent runs, so a clean switch empties it and moves the id.

// A flush that never reached the board leaves its only copy here, so a switch moves it aside, not away.
func TestASwitchSetsTheWorkspaceAsideInsteadOfDeletingIt(t *testing.T) {
	a := testApp(t)
	a.agentMgrID = airuntime.AgentClaude
	root, err := airuntime.MirrorRootDir()
	if err != nil {
		t.Fatal(err)
	}
	edited := filepath.Join(root, "B1__user-blink-3fa2c1", "python")
	if err := os.MkdirAll(edited, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(edited, "main.py"), []byte("print('unsent')"), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := a.AgentSwitch(string(airuntime.AgentOpenCode)); err != nil {
		t.Fatalf("AgentSwitch: %v", err)
	}

	if _, err := os.Stat(root); !os.IsNotExist(err) {
		t.Errorf("the mirror root survived the switch (err=%v)", err)
	}
	saved := savedWorkspaces(t, filepath.Dir(root))
	if len(saved) != 1 {
		t.Fatalf("saved workspaces = %v, want exactly one", saved)
	}
	kept := filepath.Join(filepath.Dir(root), saved[0], "B1__user-blink-3fa2c1", "python", "main.py")
	if data, err := os.ReadFile(kept); err != nil || string(data) != "print('unsent')" {
		t.Errorf("the agent's edit did not survive at %s (err=%v)", kept, err)
	}
}

// The common case: everything was pushed and the workspace is empty, so a switch leaves nothing behind.
func TestAnEmptyWorkspaceLeavesNothingBehind(t *testing.T) {
	a := testApp(t)
	a.agentMgrID = airuntime.AgentClaude
	root, err := airuntime.MirrorRootDir()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatal(err)
	}

	if err := a.AgentSwitch(string(airuntime.AgentOpenCode)); err != nil {
		t.Fatalf("AgentSwitch: %v", err)
	}
	if saved := savedWorkspaces(t, filepath.Dir(root)); len(saved) != 0 {
		t.Errorf("an empty workspace was kept anyway: %v", saved)
	}
}

// A move that fails leaves the workspace in place, so the agent restarted on it keeps what the switch would have dropped.
func TestAFailedSetAsideKeepsTheWorkspaceTracked(t *testing.T) {
	a := testApp(t)
	root, err := airuntime.MirrorRootDir()
	if err != nil {
		t.Fatal(err)
	}
	mirror := filepath.Join(root, "B1__user-blink-3fa2c1")
	if err := os.MkdirAll(mirror, 0o755); err != nil {
		t.Fatal(err)
	}
	const appID = "dXNlcjpibGluaw"
	a.checkedOut[appID] = checkedApp{mirror: mirror, hashes: map[string]string{"python/main.py": "h"}, baselined: true}
	a.pendingSyncIssues[appID] = syncIssue{conflict: "both sides changed python/main.py"}
	a.ghostMirrors["B1__user-gone-9de4f0"] = true
	orig := renameMirror
	renameMirror = func(string, string) error { return errors.New("the folder is in use") }
	t.Cleanup(func() { renameMirror = orig })

	if err := a.clearAgentMirror(); err == nil {
		t.Fatal("clearAgentMirror reported success for a workspace it could not move")
	}
	if c, ok := a.checkedOut[appID]; !ok || c.hashes["python/main.py"] != "h" {
		t.Error("the checkout lost its baseline, so the deletions made after the restart would never reach the board")
	}
	if _, ok := a.pendingSyncIssues[appID]; !ok {
		t.Error("the pending conflict warning was dropped")
	}
	if !a.ghostMirrors["B1__user-gone-9de4f0"] {
		t.Error("the stranded folder was forgotten, so the next switch would not stop for it")
	}
	if _, err := os.Stat(mirror); err != nil {
		t.Errorf("the workspace did not stay in place: %v", err)
	}
}

// A board change while the move fails has dropped the checkouts for good: putting them back would push old-board files.
func TestAFailedSetAsideAfterABoardChangeRestoresNothing(t *testing.T) {
	a := testApp(t)
	root, err := airuntime.MirrorRootDir()
	if err != nil {
		t.Fatal(err)
	}
	mirror := filepath.Join(root, "B1__user-blink-3fa2c1")
	if err := os.MkdirAll(mirror, 0o755); err != nil {
		t.Fatal(err)
	}
	a.checkedOut["dXNlcjpibGluaw"] = checkedApp{mirror: mirror, hashes: map[string]string{"python/main.py": "h"}, baselined: true}
	orig := renameMirror
	renameMirror = func(string, string) error {
		a.dropAgent()
		return errors.New("the folder is in use")
	}
	t.Cleanup(func() { renameMirror = orig })

	if err := a.clearAgentMirror(); err == nil {
		t.Fatal("clearAgentMirror reported success for a workspace it could not move")
	}
	if len(a.checkedOut) != 0 {
		t.Errorf("checkouts = %v, want none: the board change dropped them", a.checkedOut)
	}
}

// Kept copies would otherwise pile up one per switch, for the life of the install.
func TestOnlyTheNewestSavedWorkspacesAreKept(t *testing.T) {
	testApp(t) // for its isolated app-data dir
	root, err := airuntime.MirrorRootDir()
	if err != nil {
		t.Fatal(err)
	}
	parent := filepath.Dir(root)
	for i := 0; i < savedMirrorsKept+2; i++ {
		if err := os.MkdirAll(filepath.Join(root, "app"), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := setAsideMirror(root); err != nil {
			t.Fatalf("setAsideMirror: %v", err)
		}
	}

	if saved := savedWorkspaces(t, parent); len(saved) != savedMirrorsKept {
		t.Errorf("saved workspaces = %v, want the newest %d", saved, savedMirrorsKept)
	}
}

func savedWorkspaces(t *testing.T, parent string) []string {
	t.Helper()
	entries, err := os.ReadDir(parent)
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for _, e := range entries {
		if e.IsDir() && strings.HasPrefix(e.Name(), savedMirrorPrefix) {
			out = append(out, e.Name())
		}
	}
	return out
}

func TestAgentSwitchEmptiesTheWorkspaceAndMovesTheAgent(t *testing.T) {
	a := testApp(t)
	a.agentMgrID = airuntime.AgentClaude
	root, err := airuntime.MirrorRootDir()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "B1__user-blink-3fa2c1", "python"), 0o755); err != nil {
		t.Fatal(err)
	}
	genBefore := a.boardGen

	if err := a.AgentSwitch(string(airuntime.AgentOpenCode)); err != nil {
		t.Fatalf("AgentSwitch: %v", err)
	}
	// The id follows the switch: left on the old one, a switch back skipped the flush as a no-op.
	if a.agentMgrID != airuntime.AgentOpenCode {
		t.Errorf("agent id = %q, want the agent that was switched to", a.agentMgrID)
	}
	if _, err := os.Stat(root); !os.IsNotExist(err) {
		t.Errorf("the mirror root survived the switch (err=%v); the arriving engine would inherit it", err)
	}
	// Bumped so a sync still in flight cannot recreate the directories it was told to forget.
	if a.boardGen == genBefore {
		t.Error("the board generation did not move, so an in-flight sync would write into the new workspace")
	}
	if len(a.checkedOut) != 0 || len(a.ghostMirrors) != 0 {
		t.Errorf("checkouts survived the switch: %v / %v", a.checkedOut, a.ghostMirrors)
	}
}

// Switching to the agent already selected must not empty a workspace it is still using.
func TestAgentSwitchToTheSameAgentChangesNothing(t *testing.T) {
	a := testApp(t)
	a.agentMgrID = airuntime.AgentClaude
	root, err := airuntime.MirrorRootDir()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "B1__user-blink-3fa2c1"), 0o755); err != nil {
		t.Fatal(err)
	}

	if err := a.AgentSwitch(string(airuntime.AgentClaude)); err != nil {
		t.Fatalf("AgentSwitch to the same agent: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "B1__user-blink-3fa2c1")); err != nil {
		t.Errorf("the workspace was emptied for a switch that had nowhere to go: %v", err)
	}
}

// A second switch between the first one's phases would hand a started agent a deleted cwd.
func TestAgentSwitchRefusesASecondSwitchInFlight(t *testing.T) {
	a := testApp(t)
	a.agentMgrID = airuntime.AgentClaude
	a.switching = true

	if err := a.AgentSwitch(string(airuntime.AgentOpenCode)); err == nil {
		t.Fatal("a second switch was allowed while the first was between its phases")
	}
	// And nothing may start onto the workspace that is about to go.
	if err := a.AgentStart(string(airuntime.AgentOpenCode)); err == nil {
		t.Error("an agent was started while a switch was in progress")
	}
}

// The id comes from the webview; an unknown one must fail before any of this touches the workspace.
func TestTheAgentBindingsRefuseAnUnknownAgent(t *testing.T) {
	a := testApp(t)
	for name, call := range map[string]func(string) error{
		"AgentSwitch":     a.AgentSwitch,
		"AgentStart":      a.AgentStart,
		"AgentSetDefault": a.AgentSetDefault,
		"AgentDisconnect": a.AgentDisconnect,
		"RuntimeUninstall": func(id string) error {
			return a.RuntimeUninstall(id)
		},
		"AgentConnectWithoutCredential": a.AgentConnectWithoutCredential,
		"AgentCancelLogin":              a.AgentCancelLogin,
		"AgentDeleteProviderKey": func(id string) error {
			return a.AgentDeleteProviderKey(id, "openai")
		},
		"AgentSetProviderKey": func(id string) error {
			_, err := a.AgentSetProviderKey(id, "openai", "sk-test-not-a-real-key")
			return err
		},
		"AgentProviderSignIn": func(id string) error {
			return a.AgentProviderSignIn(id, "github-copilot")
		},
		"AgentCancelProviderSignIn": a.AgentCancelProviderSignIn,
	} {
		for _, id := range []string{"", "some-future-agent", "../../../etc"} {
			if err := call(id); err == nil {
				t.Errorf("%s(%q) was accepted", name, id)
			}
		}
	}
}

// One answer for every surface: the running agent, else the one a start would pick.
func TestAgentCurrentIsTheRunningAgentElseTheDefault(t *testing.T) {
	a := testApp(t)
	// Nothing running and no default stored: the shipped agent, not an empty string.
	if got := a.AgentCurrent(); got != string(airuntime.DefaultAgent) {
		t.Errorf("AgentCurrent = %q, want the shipped default", got)
	}
	if err := a.AgentSetDefault(string(airuntime.AgentOpenCode)); err != nil {
		t.Fatalf("AgentSetDefault: %v", err)
	}
	if got := a.AgentCurrent(); got != string(airuntime.AgentOpenCode) {
		t.Errorf("AgentCurrent = %q, want the stored default", got)
	}
	// A default written by an older build, or withdrawn since: the shipped agent answers instead.
	if err := writeDefaultAgent("some-former-agent"); err != nil {
		t.Fatal(err)
	}
	if got := a.AgentCurrent(); got != string(airuntime.DefaultAgent) {
		t.Errorf("AgentCurrent = %q for an unrecognised stored default, want the shipped one", got)
	}
	// A stopped agent leaves its id set, and the manager slot empty: the default still answers.
	a.agentMgrID = airuntime.AgentClaude
	if got := a.AgentCurrent(); got != string(airuntime.DefaultAgent) {
		t.Errorf("AgentCurrent = %q with no manager, want the default", got)
	}
}

// Uninstalling one agent must not sign the other out: their credentials are separate stores.
func TestUninstallClearsOnlyTheNamedAgentsCredentials(t *testing.T) {
	a := testApp(t)
	if err := agentauth.MarkConnected(airuntime.AgentOpenCode); err != nil {
		t.Fatal(err)
	}
	if err := agentauth.MarkConnected(airuntime.AgentClaude); err != nil {
		t.Fatal(err)
	}
	if err := agentauth.StoreAPIKey(airuntime.AgentClaude, "sk-ant-test-not-a-real-key"); err != nil {
		t.Fatal(err)
	}

	if err := a.RuntimeUninstall(string(airuntime.AgentOpenCode)); err != nil {
		t.Fatalf("RuntimeUninstall: %v", err)
	}
	if at := agentauth.ConnectedAt(airuntime.AgentOpenCode); !at.IsZero() {
		t.Errorf("the uninstalled agent is still connected (%v)", at)
	}
	if at := agentauth.ConnectedAt(airuntime.AgentClaude); at.IsZero() {
		t.Error("uninstalling one agent disconnected the other")
	}
	if key, _ := agentauth.ReadAPIKey(airuntime.AgentClaude); key == "" {
		t.Error("uninstalling one agent dropped the other's stored key")
	}
}

// The id has to follow the switch, or coming back is read as "already there" and the flush is skipped.
func TestSwitchingBackStillFlushesTheWorkspace(t *testing.T) {
	a := testApp(t)
	a.agentMgrID = airuntime.AgentClaude

	if err := a.AgentSwitch(string(airuntime.AgentOpenCode)); err != nil {
		t.Fatalf("first switch: %v", err)
	}
	a.checkoutMu.Lock()
	before := a.boardGen
	a.checkoutMu.Unlock()

	if err := a.AgentSwitch(string(airuntime.AgentClaude)); err != nil {
		t.Fatalf("switch back: %v", err)
	}
	// Emptying the mirror bumps the generation, so an unmoved one means the switch never got that far.
	a.checkoutMu.Lock()
	after := a.boardGen
	a.checkoutMu.Unlock()
	if after == before {
		t.Error("switching back was treated as a no-op, so the workspace was never flushed")
	}

	// A real flush, not a bump beside it: what it reports must stop the next move (a push the board refused).
	mirror := t.TempDir()
	if err := os.WriteFile(filepath.Join(mirror, "main.py"), []byte("print('edited')"), 0o644); err != nil {
		t.Fatal(err)
	}
	sb := board.Noop()
	sb.Conn = &refusingBoardConn{memBoardConn{files: map[string]string{}}}
	a.selectedBoard = sb
	a.checkedOut["dXNlcjplZGl0ZWQ"] = checkedApp{ // base64("user:edited")
		appPath:   "/home/arduino/ArduinoApps/edited",
		mirror:    mirror,
		baseline:  time.Now().Add(-time.Hour),
		hashes:    map[string]string{},
		baselined: true,
	}

	err := a.AgentSwitch(string(airuntime.AgentOpenCode))
	if err == nil {
		t.Fatal("the switch went ahead with edits the flush said were not on the board")
	}
	var refusal *switchRefusal
	if !errors.As(err, &refusal) || refusal.Code != "agent_switch_unsaved_edits" || len(refusal.Apps) != 1 || refusal.Apps[0] != "edited" {
		t.Errorf("error %#v does not name the app whose edits are unsaved", err)
	}
	if a.agentMgrID != airuntime.AgentClaude {
		t.Errorf("the agent moved to %q despite the refusal", a.agentMgrID)
	}
}

// A conflict refuses the switch with a code of its own, and says what clears it: trying again never would.
func TestASwitchRefusedOverAConflictSaysHowToClearIt(t *testing.T) {
	a := testApp(t)
	a.agentMgrID = airuntime.AgentClaude
	mirror := t.TempDir()
	writeFiles(t, mirror, map[string]string{"main.py": "print('agent edit')"})
	sb := board.Noop()
	sb.Conn = &memBoardConn{files: map[string]string{"/home/arduino/ArduinoApps/edited/main.py": "print('saved in the editor')"}}
	a.selectedBoard = sb
	sum := sha256.Sum256([]byte("print('checked out')"))
	a.checkedOut["dXNlcjplZGl0ZWQ"] = checkedApp{ // base64("user:edited")
		appPath:   "/home/arduino/ArduinoApps/edited",
		mirror:    mirror,
		baseline:  time.Now().Add(-time.Hour),
		hashes:    map[string]string{"main.py": hex.EncodeToString(sum[:])},
		baselined: true,
	}

	err := a.AgentSwitch(string(airuntime.AgentOpenCode))
	var refusal *switchRefusal
	if !errors.As(err, &refusal) || refusal.Code != "agent_switch_conflicting_edits" || !slices.Equal(refusal.Apps, []string{"edited"}) || !slices.Equal(refusal.ConflictingApps, []string{"edited"}) {
		t.Fatalf("AgentSwitch = %#v, want the conflict refusal naming the app", err)
	}
	for _, want := range []string{"conflict with changes made on the board", "check out edited again"} {
		if !strings.Contains(refusal.Message, want) {
			t.Errorf("message %q does not say %q", refusal.Message, want)
		}
	}
	if a.agentMgrID != airuntime.AgentClaude {
		t.Errorf("the agent moved to %q despite the refusal", a.agentMgrID)
	}
}

// With one app in conflict and another whose push failed, the refusal says which is which: only the first needs a new checkout.
func TestAMixedRefusalSendsTheConflictingAppsApart(t *testing.T) {
	a := testApp(t)
	a.agentMgrID = airuntime.AgentClaude
	sb := board.Noop()
	sb.Conn = &refusingBoardConn{memBoardConn{files: map[string]string{
		"/home/arduino/ArduinoApps/edited/main.py": "print('saved in the editor')",
		"/home/arduino/ArduinoApps/other/main.py":  "print('checked out')",
	}}}
	a.selectedBoard = sb
	sum := sha256.Sum256([]byte("print('checked out')"))
	for id, name := range map[string]string{"dXNlcjplZGl0ZWQ": "edited", "dXNlcjpvdGhlcg": "other"} {
		mirror := t.TempDir()
		writeFiles(t, mirror, map[string]string{"main.py": "print('agent edit')"})
		a.checkedOut[id] = checkedApp{appPath: "/home/arduino/ArduinoApps/" + name, mirror: mirror, baseline: time.Now().Add(-time.Hour), hashes: map[string]string{"main.py": hex.EncodeToString(sum[:])}, baselined: true}
	}

	err := a.AgentSwitch(string(airuntime.AgentOpenCode))
	var refusal *switchRefusal
	if !errors.As(err, &refusal) || refusal.Code != "agent_switch_conflicting_edits" {
		t.Fatalf("AgentSwitch = %#v, want the conflict refusal", err)
	}
	if !slices.Equal(refusal.Apps, []string{"edited", "other"}) || !slices.Equal(refusal.ConflictingApps, []string{"edited"}) {
		t.Errorf("apps %q, conflicting %q; want both apps, and the one in conflict alone as conflicting", refusal.Apps, refusal.ConflictingApps)
	}
	format := apperrors.ChainErrorMiddleware([]apperrors.ErrorMiddleware{apperrors.CodedErrorMiddleware()})
	if wire, _ := format(err).(string); !strings.Contains(wire, `"conflictingApps":["edited"]`) {
		t.Errorf("wire = %s, want the conflicting apps in their own field", wire)
	}
}

// refusingBoardConn is a board that takes no write.
type refusingBoardConn struct{ memBoardConn }

func (*refusingBoardConn) WriteFile(io.Reader, string) error {
	return errors.New("read-only file system")
}

// A built-in example's edits can never reach the board, so they must not block every switch until a restart; the set-aside workspace keeps them.
func TestAWithheldEditDoesNotBlockASwitch(t *testing.T) {
	a := testApp(t)
	a.agentMgrID = airuntime.AgentClaude
	root, err := airuntime.MirrorRootDir()
	if err != nil {
		t.Fatal(err)
	}
	mirror := filepath.Join(root, "B1__examples-blink-abc123")
	writeFiles(t, mirror, map[string]string{"python/main.py": "print('edited example')"})
	a.checkedOut["examples:blink"] = checkedApp{appPath: "/var/lib/arduino-app-cli/examples/blink", mirror: mirror, baseline: time.Now().Add(-time.Hour), hashes: map[string]string{}, readOnly: true, baselined: true}

	if err := a.AgentSwitch(string(airuntime.AgentOpenCode)); err != nil {
		t.Fatalf("the switch was refused over edits no switch can save: %v", err)
	}
	saved := savedWorkspaces(t, filepath.Dir(root))
	if len(saved) != 1 {
		t.Fatalf("saved workspaces = %v, want the one holding the example's edit", saved)
	}
}

// A refusal must leave the chats as they were: the checks run before the stop, so the engine is still there after one.
func TestARefusedSwitchLeavesTheAgentRunning(t *testing.T) {
	a := testApp(t)
	m := agent.NewManager(agent.New(agent.Config{}), agent.DefaultConnFactory, agent.ManagerConfig{})
	a.agentMgr, a.agentMgrID = m, airuntime.AgentClaude
	a.ghostMirrors = map[string]bool{"B1__user-gone-9de4f0": true}

	err := a.AgentSwitch(string(airuntime.AgentOpenCode))
	var refusal *switchRefusal
	if !errors.As(err, &refusal) || refusal.Code != "agent_switch_stranded_edits" || len(refusal.Folders) != 1 {
		t.Fatalf("AgentSwitch = %#v, want the stranded-edits refusal naming the folder", err)
	}
	if a.agentMgr != m {
		t.Error("the refused switch stopped the agent")
	}
}

// hookedBoardConn runs onWrite before each write lands; an error from it refuses the write.
type hookedBoardConn struct {
	memBoardConn
	onWrite func() error
}

func (c *hookedBoardConn) WriteFile(r io.Reader, p string) error {
	if err := c.onWrite(); err != nil {
		return err
	}
	return c.memBoardConn.WriteFile(r, p)
}

// editedCheckout is an app whose checkout holds an edit the board does not have, on a board that runs onWrite on each push.
func editedCheckout(t *testing.T, a *App, onWrite func() error) (mirror string) {
	t.Helper()
	mirror = t.TempDir()
	if err := os.WriteFile(filepath.Join(mirror, "main.py"), []byte("print('edited')"), 0o644); err != nil {
		t.Fatal(err)
	}
	sb := board.Noop()
	sb.Conn = &hookedBoardConn{memBoardConn: memBoardConn{files: map[string]string{}}, onWrite: onWrite}
	a.selectedBoard = sb
	a.checkedOut["dXNlcjplZGl0ZWQ"] = checkedApp{appPath: "/home/arduino/ArduinoApps/edited", mirror: mirror, baseline: time.Now().Add(-time.Hour), hashes: map[string]string{}, baselined: true}
	return mirror
}

// Stopping the agent ends every turn, so a switch is refused while a chat answers: before the flush, and again right before the stop.
func TestASwitchIsRefusedWhileAChatAnswers(t *testing.T) {
	t.Run("a turn running when the switch starts", func(t *testing.T) {
		a := testApp(t)
		m := startEngineFake(t, a, &engineFake{})
		a.beginTurn("s1")
		if err := a.AgentSwitch(string(airuntime.AgentClaude)); err == nil || !strings.Contains(err.Error(), "still answering") {
			t.Fatalf("AgentSwitch = %v, want the busy refusal", err)
		}
		if a.agentMgr != m {
			t.Error("the refused switch stopped the agent")
		}
	})
	t.Run("a prompt sent during the flush", func(t *testing.T) {
		a := testApp(t)
		m := startEngineFake(t, a, &engineFake{})
		editedCheckout(t, a, func() error {
			a.beginTurn("s1")
			return nil
		})
		if err := a.AgentSwitch(string(airuntime.AgentClaude)); err == nil || !strings.Contains(err.Error(), "still answering") {
			t.Fatalf("AgentSwitch = %v, want the busy refusal", err)
		}
		if a.agentMgr != m {
			t.Error("the switch stopped the agent under the turn that began during its flush")
		}
	})
}

// A refusal after the stop starts the old agent again, and says whether it runs: the frontend resets its chats only for a new process.
func TestARefusalAfterTheStopStartsTheOldAgentAgain(t *testing.T) {
	a := testApp(t)
	f := &engineFake{}
	startEngineFake(t, a, f)
	pushes := 0
	mirror := editedCheckout(t, a, func() error {
		if pushes++; pushes > 1 {
			return errors.New("read-only file system")
		}
		return nil
	})
	// A turn edits again between the first push and the stop.
	f.onStop = func() { _ = os.WriteFile(filepath.Join(mirror, "main.py"), []byte("print('edited again')"), 0o644) }

	err := a.AgentSwitch(string(airuntime.AgentClaude))
	var refusal *switchRefusal
	if !errors.As(err, &refusal) || refusal.Code != "agent_switch_unsaved_edits" {
		t.Fatalf("AgentSwitch = %#v, want the unsaved-edits refusal", err)
	}
	// No runtime is installed here, so the start fails and the agent stays stopped.
	if !refusal.RestartFailed || refusal.Restarted || a.agentMgr != nil {
		t.Errorf("restarted %v, restart failed %v, manager %v; want the failed restart said", refusal.Restarted, refusal.RestartFailed, a.agentMgr)
	}
	format := apperrors.ChainErrorMiddleware([]apperrors.ErrorMiddleware{apperrors.CodedErrorMiddleware()})
	if wire, _ := format(err).(string); !strings.Contains(wire, `"restartFailed":true`) || strings.Contains(wire, `"restarted"`) {
		t.Errorf("wire = %s, want restartFailed alone", wire)
	}
	started := afterRestart(&switchRefusal{Code: "agent_switch_stranded_edits"}, airuntime.AgentOpenCode, nil)
	if wire, _ := format(started).(string); !strings.Contains(wire, `"restarted":true`) || strings.Contains(wire, "restartFailed") {
		t.Errorf("wire = %s, want restarted alone", wire)
	}
}

// Any other failure after the stop goes out coded as well, as the fields are what tell the frontend the old agent's state.
func TestAnyFailureAfterTheStopIsCoded(t *testing.T) {
	a := testApp(t)
	f := &engineFake{}
	startEngineFake(t, a, f)
	stopped := false
	sb := board.Noop()
	sb.Conn = &hookedBoardConn{memBoardConn: memBoardConn{files: map[string]string{}}, onWrite: func() error {
		if stopped { // the board changes under the flush that follows the stop
			a.checkoutMu.Lock()
			a.boardGen++
			a.checkoutMu.Unlock()
		}
		return nil
	}}
	a.selectedBoard = sb
	var mirrors []string
	for _, name := range []string{"one", "two"} {
		mirror := t.TempDir()
		if err := os.WriteFile(filepath.Join(mirror, "main.py"), []byte("print('edited')"), 0o644); err != nil {
			t.Fatal(err)
		}
		a.checkedOut["user:"+name] = checkedApp{appPath: "/apps/" + name, mirror: mirror, baseline: time.Now().Add(-time.Hour), hashes: map[string]string{}, baselined: true}
		mirrors = append(mirrors, mirror)
	}
	f.onStop = func() {
		stopped = true
		for _, mirror := range mirrors {
			_ = os.WriteFile(filepath.Join(mirror, "main.py"), []byte("print('edited again')"), 0o644)
		}
	}

	err := a.AgentSwitch(string(airuntime.AgentClaude))
	var failed *switchRefusal
	if !errors.As(err, &failed) || failed.Code != "agent_switch_failed" || !strings.Contains(failed.Message, "the board changed") {
		t.Fatalf("AgentSwitch = %#v, want agent_switch_failed with the plain text", err)
	}
	if !failed.RestartFailed || failed.Restarted {
		t.Errorf("restarted %v, restart failed %v; want the failed restart said", failed.Restarted, failed.RestartFailed)
	}
	started, ok := afterRestart(errors.New("clear the agent workspace: busy"), airuntime.AgentOpenCode, nil).(*switchRefusal)
	if !ok || started.Code != "agent_switch_failed" || !started.Restarted || started.Message != "clear the agent workspace: busy" {
		t.Errorf("after a restart = %#v, want agent_switch_failed with restarted and the plain text", started)
	}
}

// A key is checked before it is stored, and only the provider's own refusal may reject it.
func TestSetProviderKeyStoresOnlyWhatWasNotRefused(t *testing.T) {
	const key = "sk-test-not-a-real-key-SECRETPART"
	status := http.StatusOK
	var keyed atomic.Int32
	// Refuses a keyless request, which is what lets its 200 mean the key itself was accepted.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		keyed.Add(1)
		w.WriteHeader(status)
		if status == http.StatusUnauthorized {
			_, _ = io.WriteString(w, `{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}`)
		}
	}))
	defer srv.Close()

	newApp := func(t *testing.T) *App {
		a := testApp(t)
		// A provider id of our own, so no test can reach a real provider's endpoint.
		catalogue := fmt.Sprintf(`{"localtest":{"name":"Local Test","env":["LOCALTEST_API_KEY"],"api":%q},
			"openrouter":{"name":"OpenRouter","env":["OPENROUTER_API_KEY"],"api":%q},
			"anthropic":{"name":"Anthropic","env":["ANTHROPIC_API_KEY"]},
			"opencode":{"name":"OpenCode Zen","models":{"big-pickle":{"cost":{"input":0,"output":0}}}}}`, srv.URL, srv.URL)
		dir, err := airuntime.AgentConfigDir(airuntime.AgentOpenCode)
		if err != nil {
			t.Fatal(err)
		}
		path := filepath.Join(dir, "cache", "opencode", "models.json")
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(catalogue), 0o600); err != nil {
			t.Fatal(err)
		}
		return a
	}

	t.Run("a refusal is reported and nothing is kept", func(t *testing.T) {
		a := newApp(t)
		status = http.StatusUnauthorized
		_, err := a.AgentSetProviderKey(string(airuntime.AgentOpenCode), "localtest", key)
		if err == nil {
			t.Fatal("a key the provider refused was accepted")
		}
		if !strings.Contains(err.Error(), "Local Test") {
			t.Errorf("error %q does not name the provider", err)
		}
		var refusal *providerKeyRefusal
		if !errors.As(err, &refusal) || refusal.Code != "provider_key_rejected" || refusal.Provider != "Local Test" ||
			refusal.Reason != "invalid x-api-key" {
			t.Errorf("error = %#v, want provider_key_rejected naming Local Test, with its own words", err)
		}
		if strings.Contains(err.Error(), "SECRETPART") {
			t.Errorf("the key is in the error shown to the user: %v", err)
		}
		if got, _ := agentauth.ReadProviderKey(airuntime.AgentOpenCode, "localtest"); got != "" {
			t.Error("a refused key was stored anyway")
		}
		if creds, _ := agentauth.ConfiguredProviders(airuntime.AgentOpenCode); len(creds) != 0 {
			t.Errorf("a refused key reached the index: %+v", creds)
		}
	})

	t.Run("another provider's key is refused by name and sent nowhere", func(t *testing.T) {
		a := newApp(t)
		status = http.StatusOK
		before := keyed.Load()
		_, err := a.AgentSetProviderKey(string(airuntime.AgentOpenCode), "localtest", "sk-ant-api03-not-a-real-key-SECRETPART")
		var refusal *providerKeyRefusal
		if !errors.As(err, &refusal) || refusal.Code != "provider_key_for_another_provider" ||
			refusal.Provider != "Local Test" || refusal.KeyProvider != "Anthropic" {
			t.Fatalf("error = %#v, want provider_key_for_another_provider naming Local Test and Anthropic", err)
		}
		if strings.Contains(err.Error(), "SECRETPART") {
			t.Errorf("the key is in the error shown to the user: %v", err)
		}
		if keyed.Load() != before {
			t.Error("the key was sent to a provider it does not belong to")
		}
		if got, _ := agentauth.ReadProviderKey(airuntime.AgentOpenCode, "localtest"); got != "" {
			t.Error("another provider's key was stored")
		}
	})

	t.Run("a mangled paste is refused before any request", func(t *testing.T) {
		a := newApp(t)
		status = http.StatusOK
		for key, code := range map[string]string{
			"sk-or-v1-not-a-real key":                "provider_key_has_spaces",
			"OPENROUTER_API_KEY=sk-or-v1-not-a-real": "provider_key_text_before",
			"sk-or-v1-not-a-realsk-or-v1-not-a-real": "provider_key_repeated",
		} {
			before := keyed.Load()
			_, err := a.AgentSetProviderKey(string(airuntime.AgentOpenCode), "openrouter", key)
			var refusal *providerKeyRefusal
			if !errors.As(err, &refusal) || refusal.Code != code || refusal.Provider != "OpenRouter" || refusal.Prefix != "sk-or-" {
				t.Errorf("%q: error = %#v, want %s naming OpenRouter and its prefix", key, err, code)
			}
			if keyed.Load() != before {
				t.Errorf("%q was sent to the provider", key)
			}
		}
		if got, _ := agentauth.ReadProviderKey(airuntime.AgentOpenCode, "openrouter"); got != "" {
			t.Error("a mangled key was stored")
		}
	})

	t.Run("an accepted key is trimmed and kept", func(t *testing.T) {
		a := newApp(t)
		status = http.StatusOK
		verified, err := a.AgentSetProviderKey(string(airuntime.AgentOpenCode), "localtest", "  "+key+"\n")
		if err != nil {
			t.Fatalf("AgentSetProviderKey: %v", err)
		}
		// Untrimmed, the newline makes the header invalid and every engine request fails.
		if got, _ := agentauth.ReadProviderKey(airuntime.AgentOpenCode, "localtest"); got != key {
			t.Errorf("stored %q, want the key without the whitespace around it", got)
		}
		creds, err := a.AgentProviderCredentials(string(airuntime.AgentOpenCode))
		if err != nil {
			t.Fatalf("AgentProviderCredentials: %v", err)
		}
		if len(creds) != 1 || creds[0].ProviderID != "localtest" || creds[0].EnvVar != "LOCALTEST_API_KEY" {
			t.Fatalf("credentials = %+v, want the one that was just added", creds)
		}
		// The settings row shows a mask, never the key.
		if strings.Contains(creds[0].MaskedKey, "SECRETPART") || creds[0].AddedAt == "" {
			t.Errorf("credential row = %+v, want a masked key and a date", creds[0])
		}
		if !verified {
			t.Error("a key the provider accepted was not reported as verified")
		}
	})

	t.Run("a new key drops a free model picked for new chats, and keeps a paid one", func(t *testing.T) {
		status = http.StatusOK
		picks := agent.PickFileOf(airuntime.AgentOpenCode)
		for picked, want := range map[string]string{"opencode/big-pickle": "", "anthropic/sonnet": "anthropic/sonnet"} {
			a := newApp(t)
			picks.SavePick(agent.NewChatPick, agent.SessionPick{Model: picked})
			if _, err := a.AgentSetProviderKey(string(airuntime.AgentOpenCode), "localtest", key); err != nil {
				t.Fatalf("AgentSetProviderKey: %v", err)
			}
			if got := picks.Pick(agent.NewChatPick).Model; got != want {
				t.Errorf("after a key, new chats start on %q, want %q (picked %q)", got, want, picked)
			}
		}
	})

	t.Run("a provider that cannot answer is not blamed on the key", func(t *testing.T) {
		a := newApp(t)
		status = http.StatusInternalServerError
		verified, err := a.AgentSetProviderKey(string(airuntime.AgentOpenCode), "localtest", key)
		if err != nil {
			t.Fatalf("a key we could not check was refused: %v", err)
		}
		// Said out loud, or the user reads an unchecked key as a checked one and finds out on the first turn.
		if verified {
			t.Error("a key nobody could check was reported as verified")
		}
		if got, _ := agentauth.ReadProviderKey(airuntime.AgentOpenCode, "localtest"); got != key {
			t.Error("the key was not stored after an unverifiable check")
		}
	})

	t.Run("an empty key never reaches the provider", func(t *testing.T) {
		a := newApp(t)
		status = http.StatusOK
		for _, empty := range []string{"", "   ", "\n\t"} {
			if _, err := a.AgentSetProviderKey(string(airuntime.AgentOpenCode), "localtest", empty); err == nil {
				t.Errorf("AgentSetProviderKey(%q) was accepted", empty)
			}
		}
		if creds, _ := agentauth.ConfiguredProviders(airuntime.AgentOpenCode); len(creds) != 0 {
			t.Errorf("an empty key reached the index: %+v", creds)
		}
	})
}

// Pretends an install finished: a manifest plus a non-empty node_modules is what Status reads.
func fakeInstalled(t *testing.T, id airuntime.AgentID) {
	t.Helper()
	dir, err := airuntime.RuntimeDir(id)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "node_modules", "installed"), 0o755); err != nil {
		t.Fatal(err)
	}
	manifest := `{"schema":2,"nodeVersion":"v18.20.4","lockfileSha256":"x","installedAt":"2026-01-02T03:04:05Z"}`
	if err := os.WriteFile(filepath.Join(dir, "version.json"), []byte(manifest), 0o644); err != nil {
		t.Fatal(err)
	}
}

// Installed is not connected: the runtime can be on disk without the user having chosen the agent.
func TestAFreeAgentIsConnectedOnlyOnceTheUserSaysSo(t *testing.T) {
	a := testApp(t)
	id := string(airuntime.AgentOpenCode)

	// Nothing to run yet, so there is nothing to connect.
	if err := a.AgentConnectWithoutCredential(id); err == nil {
		t.Error("connected an agent that is not installed")
	}
	fakeInstalled(t, airuntime.AgentOpenCode)
	status, err := a.AgentAuthStatus(id)
	if err != nil {
		t.Fatalf("AgentAuthStatus: %v", err)
	}
	if status.Authenticated {
		t.Errorf("status = %+v, want not authenticated: only installed", status)
	}

	if err := a.AgentConnectWithoutCredential(id); err != nil {
		t.Fatalf("AgentConnectWithoutCredential: %v", err)
	}
	status, err = a.AgentAuthStatus(id)
	if err != nil {
		t.Fatalf("AgentAuthStatus: %v", err)
	}
	if !status.Authenticated || status.ConnectedAt == "" {
		t.Errorf("status = %+v, want authenticated with the date it was connected", status)
	}
	if status.Method != "" || status.Account != "" {
		t.Errorf("status = %+v, want no credential method: there is no credential", status)
	}
}

// An agent whose every model needs an account must not be connectable by the credential-free route.
func TestAnAgentThatNeedsACredentialCannotBeConnectedWithoutOne(t *testing.T) {
	a := testApp(t)
	id := string(airuntime.AgentClaude)
	fakeInstalled(t, airuntime.AgentClaude)

	if err := a.AgentConnectWithoutCredential(id); err == nil {
		t.Error("connected an agent that needs a credential without giving it one")
	}
	// Even with the marker written by hand, the status must not report it as connected.
	if err := agentauth.MarkConnected(airuntime.AgentClaude); err != nil {
		t.Fatal(err)
	}
	status, err := a.AgentAuthStatus(id)
	if err != nil {
		t.Fatalf("AgentAuthStatus: %v", err)
	}
	if status.Authenticated {
		t.Errorf("status = %+v, want not authenticated: the marker is only for the free tier", status)
	}
}

// The engine reads its instructions from a file in its own config dir; the wrong dir is silent.
func TestAgentInstructionsAreWrittenWhereTheEngineReadsThem(t *testing.T) {
	testApp(t)
	dialect, err := agent.DialectFor(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	if dialect.LaunchInstructions == nil {
		t.Skip("this engine takes its prompt in the session envelope")
	}
	in := agent.LaunchInput{BoardName: "Arduino VentunoQ"}
	if err := writeAgentInstructions(airuntime.AgentOpenCode, dialect, in); err != nil {
		t.Fatalf("writeAgentInstructions: %v", err)
	}
	dir, err := agentauth.EngineConfigDir(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	rel, want := dialect.LaunchInstructions(in)
	got, err := os.ReadFile(filepath.Join(dir, rel))
	if err != nil {
		t.Fatalf("read %s: %v", rel, err)
	}
	if string(got) != string(want) {
		t.Error("the file does not hold what the dialect built")
	}

	// Rewritten every launch: the board it describes may have changed since the last one.
	second := agent.LaunchInput{BoardName: "Arduino UNO Q"}
	if err := writeAgentInstructions(airuntime.AgentOpenCode, dialect, second); err != nil {
		t.Fatalf("second write: %v", err)
	}
	got, err = os.ReadFile(filepath.Join(dir, rel))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(got), "Arduino UNO Q") || strings.Contains(string(got), "VentunoQ") {
		t.Error("the instructions still describe the previous board")
	}
}

// A key left behind at sign-out would be injected again at the next start, silently signing them in.
func TestDisconnectClearsOnlyTheNamedAgentsProviderKeys(t *testing.T) {
	a := testApp(t)
	dir, err := airuntime.AgentConfigDir(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "cache", "opencode", "models.json")
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	catalogue := `{"localtest":{"name":"Local Test","env":["LOCALTEST_API_KEY"]}}`
	if err := os.WriteFile(path, []byte(catalogue), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := agentauth.StoreProviderKey(airuntime.AgentOpenCode, "localtest", "sk-test-not-a-real-key"); err != nil {
		t.Fatal(err)
	}
	if err := agentauth.MarkConnected(airuntime.AgentOpenCode); err != nil {
		t.Fatal(err)
	}
	if err := agentauth.StoreAPIKey(airuntime.AgentClaude, "sk-ant-test-not-a-real-key"); err != nil {
		t.Fatal(err)
	}

	if err := a.AgentDisconnect(string(airuntime.AgentOpenCode)); err != nil {
		t.Fatalf("AgentDisconnect: %v", err)
	}
	if key, _ := agentauth.ReadProviderKey(airuntime.AgentOpenCode, "localtest"); key != "" {
		t.Error("a provider key survived the sign-out; the next start would inject it")
	}
	if creds, _ := agentauth.ConfiguredProviders(airuntime.AgentOpenCode); len(creds) != 0 {
		t.Errorf("the index still lists %+v", creds)
	}
	if at := agentauth.ConnectedAt(airuntime.AgentOpenCode); !at.IsZero() {
		t.Errorf("still connected at %v after a sign-out", at)
	}
	status, err := a.AgentAuthStatus(string(airuntime.AgentOpenCode))
	if err != nil {
		t.Fatalf("AgentAuthStatus: %v", err)
	}
	if status.Authenticated {
		t.Errorf("status = %+v, want not authenticated after a sign-out", status)
	}
	// The other agent's credential is its own.
	if key, _ := agentauth.ReadAPIKey(airuntime.AgentClaude); key == "" {
		t.Error("signing one agent out dropped the other's key")
	}
}

// The engine prints its device login behind box-drawing characters and colour codes.
func TestTheDeviceLoginIsReadFromTheEnginesOutput(t *testing.T) {
	var url, code string
	for _, line := range []string{
		"┌  Add credential",
		"\x1b[32m●\x1b[39m  Go to: https://github.com/login/device",
		"│",
		"●  Enter code: 1A2B-C3D4",
		"◒  Waiting for authorization...",
	} {
		clean := ansiEscapeRe.ReplaceAllString(line, "")
		if u := deviceLoginURL(clean); u != "" {
			url = u
		}
		if c := deviceLoginCode(clean); c != "" {
			code = c
		}
	}
	if url != "https://github.com/login/device" {
		t.Errorf("url = %q", url)
	}
	if code != "1A2B-C3D4" {
		t.Errorf("code = %q", code)
	}
}

// Copilot is connected by the engine's own login, so it takes no key and signing out goes through the engine.
func TestASignInProviderTakesNoKeyAndSignsOutThroughTheEngine(t *testing.T) {
	a := testApp(t)
	dir, err := airuntime.AgentConfigDir(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "cache", "opencode", "models.json")
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(`{"github-copilot":{"name":"GitHub Copilot","env":["GITHUB_TOKEN"]}}`), 0o600); err != nil {
		t.Fatal(err)
	}

	if _, err := a.AgentSetProviderKey(string(airuntime.AgentOpenCode), "github-copilot", "ghp-test-not-a-real-token"); err == nil {
		t.Error("a key was accepted for a provider that is signed in to")
	}
	if key, _ := agentauth.ReadProviderKey(airuntime.AgentOpenCode, "github-copilot"); key != "" {
		t.Error("the refused key was stored anyway")
	}

	// Listed only while the engine holds the login, whatever our own list remembers.
	if err := agentauth.RecordProviderSignIn(airuntime.AgentOpenCode, "github-copilot"); err != nil {
		t.Fatal(err)
	}
	if creds, _ := a.AgentProviderCredentials(string(airuntime.AgentOpenCode)); len(creds) != 0 {
		t.Fatalf("credentials = %+v with no login in the engine, want none", creds)
	}
	auth := filepath.Join(dir, "data", "opencode", "auth.json")
	if err := os.MkdirAll(filepath.Dir(auth), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(auth, []byte(`{"github-copilot":{"type":"oauth","refresh":"not-a-real-token"}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	creds, err := a.AgentProviderCredentials(string(airuntime.AgentOpenCode))
	if err != nil {
		t.Fatal(err)
	}
	if len(creds) != 1 || !creds[0].SignedIn || creds[0].MaskedKey != "" || creds[0].AddedAt == "" {
		t.Fatalf("credentials = %+v, want copilot signed in, dated, with no masked key", creds)
	}
	// No runtime here, so the engine's logout cannot run: the provider must stay listed, not look signed out.
	if err := a.AgentDeleteProviderKey(string(airuntime.AgentOpenCode), "github-copilot"); err == nil {
		t.Error("signing out reported success without the engine's logout")
	}
	if left, _ := agentauth.ConfiguredProviders(airuntime.AgentOpenCode); len(left) != 1 {
		t.Errorf("configured after a failed sign-out = %+v, want copilot still listed", left)
	}
}

// engineFake is an engine without session/delete, as OpenCode is, unless deletes is set; a prompt runs until Cancel when turn is set.
type engineFake struct {
	handler       agent.ClientHandler
	mu            sync.Mutex
	listed        map[string]bool
	befores       map[agent.SessionID][][]string
	closed        []agent.SessionID
	turn          chan struct{}
	during        func(sid agent.SessionID) // runs inside a prompt
	storesOnClose bool                      // closing a session writes it back to the engine's store
	deletes       bool                      // has session/delete, as Claude does
	deleteErr     error
	onStop        func() // runs when the manager stops the engine
}

func (f *engineFake) Initialize(context.Context) ([]agent.AuthMethod, error) { return nil, nil }
func (f *engineFake) Authenticate(context.Context, string) error             { return nil }
func (f *engineFake) NewSession(context.Context, string, agent.SessionWorkspace) (agent.NewSessionResult, error) {
	return agent.NewSessionResult{SessionID: "s-new"}, nil
}
func (f *engineFake) ListSessions(context.Context, string) ([]agent.SessionSummary, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []agent.SessionSummary
	for id := range f.listed {
		out = append(out, agent.SessionSummary{ID: id})
	}
	return out, nil
}
func (f *engineFake) LoadSession(_ context.Context, sid agent.SessionID, _ string, _ agent.SessionWorkspace) (agent.NewSessionResult, error) {
	return agent.NewSessionResult{SessionID: sid}, nil
}
func (f *engineFake) Prompt(_ context.Context, sid agent.SessionID, _ string, before []string) (bool, error) {
	f.mu.Lock()
	if f.befores == nil {
		f.befores = map[agent.SessionID][][]string{}
	}
	f.befores[sid] = append(f.befores[sid], before)
	turn, during := f.turn, f.during
	f.mu.Unlock()
	if during != nil {
		during(sid)
	}
	if turn != nil {
		<-turn
		return true, nil
	}
	return false, nil
}
func (f *engineFake) Cancel(context.Context, agent.SessionID) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.turn != nil {
		close(f.turn)
		f.turn = nil
	}
	return nil
}
func (f *engineFake) CloseSession(_ context.Context, sid agent.SessionID) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.closed = append(f.closed, sid)
	if f.storesOnClose {
		f.listed[string(sid)] = true
	}
	return nil
}
func (f *engineFake) DeleteSession(_ context.Context, sid agent.SessionID) error {
	if !f.deletes {
		return agent.ErrDeleteSessionUnsupported
	}
	if f.deleteErr != nil {
		return f.deleteErr
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.listed, string(sid))
	return nil
}
func (f *engineFake) DeletesSessions() bool                                   { return f.deletes }
func (f *engineFake) SetModel(context.Context, agent.SessionID, string) error { return nil }
func (f *engineFake) SetMode(context.Context, agent.SessionID, string) error  { return nil }
func (f *engineFake) SetMCPServers([]agent.MCPServer)                         {}
func (f *engineFake) SetDialect(agent.Dialect)                                {}
func (f *engineFake) SetBoardName(string)                                     {}
func (f *engineFake) Close() error {
	if f.onStop != nil {
		f.onStop()
	}
	return nil
}

// startEngineFake runs an OpenCode manager on the fake, as the running agent of a.
func startEngineFake(t *testing.T, a *App, f *engineFake) *agent.Manager {
	t.Helper()
	m := agent.NewManager(agent.New(agent.Config{Locator: agent.StaticLocator{NodePath: "/bin/sh", AdapterEntry: "-c", ExtraArgs: []string{"cat"}}}),
		func(_ io.Writer, _ io.Reader, h agent.ClientHandler) (agent.AgentConn, error) {
			f.handler = h
			return f, nil
		}, agent.ManagerConfig{})
	if err := m.Start(context.Background()); err != nil {
		t.Fatalf("start: %v", err)
	}
	t.Cleanup(func() { _ = m.Stop() })
	a.agentMgr, a.agentMgrID = m, airuntime.AgentOpenCode
	return m
}

// A Stop that reaches the manager while AgentPrompt is still on its own work, before the prompt is sent, ends that turn unsent; the next prompt runs.
func TestAStopBeforeThePromptIsSentEndsItsTurnUnsent(t *testing.T) {
	a := testApp(t)
	f := &engineFake{}
	m := startEngineFake(t, a, f)
	sent := func() int {
		f.mu.Lock()
		defer f.mu.Unlock()
		return len(f.befores["s1"])
	}
	orig := promptHeld
	t.Cleanup(func() { promptHeld = orig })
	promptHeld = func(sessionID string) {
		if err := a.AgentCancel(sessionID); err != nil {
			t.Errorf("stop: %v", err)
		}
	}

	if err := a.AgentPrompt("s1", "count to 1000", nil); err != nil {
		t.Fatalf("the stopped prompt: %v", err)
	}
	if sent() != 0 || !m.TurnStopped("s1") {
		t.Errorf("the engine got %d prompts, turn stopped %v; want the turn ended unsent", sent(), m.TurnStopped("s1"))
	}

	promptHeld = orig
	if err := a.AgentPrompt("s1", "count to 10", nil); err != nil {
		t.Fatalf("the next prompt: %v", err)
	}
	if sent() != 1 || m.TurnStopped("s1") {
		t.Errorf("the engine got %d prompts, turn stopped %v; want the next prompt sent and not stopped", sent(), m.TurnStopped("s1"))
	}
}

// stubDeleteCLI replaces the engine CLI's delete for one test.
func stubDeleteCLI(t *testing.T, fn func(ctx context.Context, id airuntime.AgentID, sid string) error) {
	t.Helper()
	orig := deleteSessionCLI
	deleteSessionCLI = fn
	t.Cleanup(func() { deleteSessionCLI = orig })
}

// A CLI failure keeps the chat and its entries; a chat in a turn is stopped and waited for, sync included, before the CLI deletes it.
func TestDeletingAChatThroughTheEnginesCLI(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	f := &engineFake{listed: map[string]bool{"s1": true}}
	m := startEngineFake(t, a, f)
	if err := writeSessionTitles(dir, map[string]string{"s1": "Counting"}); err != nil {
		t.Fatal(err)
	}
	if err := writeSessionCreated(dir, map[string]string{"s1": "2026-10-21T10:00:00Z"}); err != nil {
		t.Fatal(err)
	}
	picks := agent.PickFileOf(airuntime.AgentOpenCode)
	picks.SavePick("s1", agent.SessionPick{Model: "big-model"})
	var mu sync.Mutex
	var cliErr error = errors.New("database is locked")
	turnWasOpen := false
	stubDeleteCLI(t, func(_ context.Context, _ airuntime.AgentID, sid string) error {
		mu.Lock()
		defer mu.Unlock()
		turnWasOpen = turnWasOpen || a.turnOpen(sid)
		if cliErr != nil {
			return cliErr
		}
		f.mu.Lock()
		delete(f.listed, sid)
		f.mu.Unlock()
		return nil
	})

	if err := a.AgentDeleteSession("s1"); err == nil {
		t.Fatal("a delete the CLI refused reported success")
	}
	if titles, _ := readSessionTitles(dir); titles["s1"] != "Counting" || len(f.closed) != 0 || picks.Pick("s1").Model != "big-model" {
		t.Fatalf("a failed delete dropped the chat: titles %v, closed %v, pick %+v", titles, f.closed, picks.Pick("s1"))
	}

	mu.Lock()
	cliErr = nil
	mu.Unlock()
	f.mu.Lock()
	f.turn = make(chan struct{})
	f.mu.Unlock()
	prompted := make(chan error, 1)
	go func() { prompted <- a.AgentPrompt("s1", "count to 1000", nil) }()
	for !m.StreamingSessions()["s1"] {
		time.Sleep(5 * time.Millisecond)
	}
	if err := a.AgentDeleteSession("s1"); err != nil {
		t.Fatalf("delete during a turn: %v", err)
	}
	<-prompted
	if turnWasOpen {
		t.Error("the CLI deleted the chat before its turn had ended")
	}
	titles, _ := readSessionTitles(dir)
	created, _ := readSessionCreated(dir)
	statuses, _ := readSessionStatus(dir)
	if titles["s1"] != "" || created["s1"] != "" || statuses["s1"] != "" || picks.Pick("s1") != (agent.SessionPick{}) {
		t.Errorf("entries left after the delete: title %q, created %q, status %q, pick %+v", titles["s1"], created["s1"], statuses["s1"], picks.Pick("s1"))
	}
	if len(f.closed) != 1 || f.closed[0] != "s1" {
		t.Errorf("closed = %v, want the deleted chat freed on the engine", f.closed)
	}
}

// Closing the chat after its CLI delete can store it again; it is deleted again, or it comes back with the next start.
func TestAChatClosingStoredAgainIsDeletedAgain(t *testing.T) {
	a := testApp(t)
	agentStoreDirs(t)
	f := &engineFake{listed: map[string]bool{"s1": true}, storesOnClose: true}
	startEngineFake(t, a, f)
	deletes := 0
	stubDeleteCLI(t, func(_ context.Context, _ airuntime.AgentID, sid string) error {
		deletes++
		f.mu.Lock()
		delete(f.listed, sid)
		f.mu.Unlock()
		return nil
	})
	if err := a.AgentDeleteSession("s1"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	f.mu.Lock()
	listed := f.listed["s1"]
	f.mu.Unlock()
	if deletes != 2 || listed {
		t.Errorf("CLI deletes = %d, still listed = %v; want the chat the close stored again deleted again", deletes, listed)
	}
}

// A probe's id is what hides it, so it is forgotten only once the engine's list no longer holds the probe.
func TestAProbeIsForgottenOnlyOnceTheEngineDropsIt(t *testing.T) {
	a := testApp(t)
	agentStoreDirs(t)
	f := &engineFake{listed: map[string]bool{"probe-left": true}}
	m := startEngineFake(t, a, f)
	a.rememberProbe(airuntime.AgentOpenCode, "probe-left")
	stubDeleteCLI(t, func(context.Context, airuntime.AgentID, string) error { return nil }) // reports success, removes nothing
	stored := func(sid string) bool { return slices.Contains(a.storedProbes(airuntime.AgentOpenCode), sid) }

	a.deleteLeftoverProbes(m, airuntime.AgentOpenCode, a.storedProbes(airuntime.AgentOpenCode))
	if !stored("probe-left") {
		t.Error("a leftover probe the engine still lists was forgotten")
	}
	a.deleteProbeThroughCLI(m, airuntime.AgentOpenCode, "probe-left")
	if !stored("probe-left") {
		t.Error("a probe the CLI did not remove was forgotten")
	}
	// An engine with session/delete whose delete fails.
	f.deletes, f.deleteErr = true, errors.New("session busy")
	if _, err := a.AgentNewSessionState(); err != nil {
		t.Fatalf("AgentNewSessionState: %v", err)
	}
	if !stored("s-new") {
		t.Error("a probe whose delete failed was forgotten")
	}
}

// A probe a quit left stays hidden from the list, and the next start deletes it and forgets its id once the engine no longer has it.
func TestAProbeAQuitLeftIsHiddenThenDeleted(t *testing.T) {
	a := testApp(t)
	agentStoreDirs(t)
	f := &engineFake{listed: map[string]bool{"probe-left": true, "real": true}}
	m := startEngineFake(t, a, f)
	a.rememberProbe(airuntime.AgentOpenCode, "probe-left")
	a.rememberProbe(airuntime.AgentOpenCode, "probe-never-stored")
	picks := agent.PickFileOf(airuntime.AgentOpenCode)
	picks.SavePick("probe-left", agent.SessionPick{Mode: "build"})
	var deleted []string
	stubDeleteCLI(t, func(_ context.Context, _ airuntime.AgentID, sid string) error {
		deleted = append(deleted, sid)
		f.mu.Lock()
		delete(f.listed, sid)
		f.mu.Unlock()
		return nil
	})

	sessions, err := a.AgentListSessions()
	if err != nil {
		t.Fatal(err)
	}
	if len(sessions) != 1 || sessions[0].ID != "real" {
		t.Errorf("listed %+v, want the user's chat alone", sessions)
	}
	a.deleteLeftoverProbes(m, airuntime.AgentOpenCode, a.storedProbes(airuntime.AgentOpenCode))
	if len(deleted) != 1 || deleted[0] != "probe-left" {
		t.Errorf("deleted %v, want the probe the engine still held", deleted)
	}
	if left := a.storedProbes(airuntime.AgentOpenCode); len(left) != 0 {
		t.Errorf("stored probes = %v, want none once the engine no longer lists them", left)
	}
	if got := picks.Pick("probe-left"); got != (agent.SessionPick{}) {
		t.Errorf("the deleted probe kept its pick %+v", got)
	}
}

// Ids repeat across boards: a chat of another board's app loads without it, or it would get this board's app of that name, grants and checkout included.
func TestAChatOfAnotherBoardsAppLoadsWithoutIt(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	const blink = "dXNlcjpibGluaw"
	if err := writeSessionWorkspaces(dir, map[string]sessionWorkspaceEntry{
		"s-here":   {AppID: blink, Name: "Blink", BoardID: "B1"},
		"s-there":  {AppID: blink, Name: "Blink", BoardID: "B2"},
		"s-legacy": {AppID: blink, Name: "Blink"},
	}); err != nil {
		t.Fatal(err)
	}
	startEngineFake(t, a, &engineFake{})
	a.selectedBoard.Info.Serial = "B1"

	for sid, want := range map[string]string{"s-here": blink, "s-there": "", "s-legacy": blink} {
		if got := a.sessionWorkspaceFor(sid).AppID; got != want {
			t.Errorf("%s loads on app %q, want %q", sid, got, want)
		}
	}
}

// A rename reaches the chats bound to the app and the live ones that only used it, with their next prompt.
func TestARenameIsToldToEveryChatThatUsedTheApp(t *testing.T) {
	a := testApp(t)
	dir := agentStoreDirs(t)[airuntime.AgentOpenCode]
	const oldID, newID = "dXNlcjpibGluaw", "dXNlcjpibGluay0y"
	if err := writeSessionWorkspaces(dir, map[string]sessionWorkspaceEntry{"s-bound": {AppID: oldID, Name: "Blink"}}); err != nil {
		t.Fatal(err)
	}
	f := &engineFake{}
	m := startEngineFake(t, a, f)
	ctx := context.Background()
	f.during = func(sid agent.SessionID) {
		f.handler.HandleUpdate(sid, agent.Update{Type: "tool_call", ToolCall: &agent.ToolCall{ID: "c1", Title: "arduino-board_apps_checkout", Kind: "other", Input: map[string]any{"id": oldID}}})
	}
	_ = m.Prompt(ctx, "s-other", "check Blink out", nil)
	f.during = nil

	a.RebindWorkspaceApp(oldID, newID, "Blink 2")
	for _, sid := range []agent.SessionID{"s-bound", "s-other"} {
		_ = m.Prompt(ctx, sid, "go on", nil)
		f.mu.Lock()
		sent := f.befores[sid]
		f.mu.Unlock()
		last := sent[len(sent)-1]
		if len(last) == 0 || !strings.Contains(last[0], "<app-lab-note>") || !strings.Contains(last[0], newID) {
			t.Errorf("%s: next prompt carried %q, want the rename note with the new id", sid, last)
		}
	}
}

// The card looks the app up by the id the board tools act on: a padded or decoded id, and a brick tool's appId, still name it.
func TestTheCardLooksUpTheAppTheCallActsOn(t *testing.T) {
	for name, tc := range map[string]struct {
		input map[string]any
		want  string
	}{
		"the board's id":       {map[string]any{"id": "dXNlcjpibGluaw"}, "dXNlcjpibGluaw"},
		"a padded id":          {map[string]any{"id": "dXNlcjpibGluaw=="}, "dXNlcjpibGluaw"},
		"a decoded id":         {map[string]any{"id": "user:blink"}, "dXNlcjpibGluaw"},
		"a brick tool's appId": {map[string]any{"appId": "user:blink", "brickId": "arduino:web_ui"}, "dXNlcjpibGluaw"},
		"padding alone":        {map[string]any{"id": "=="}, ""},
		"no id":                {map[string]any{"name": "Blink"}, ""},
	} {
		if got := permissionAppID(tc.input); got != tc.want {
			t.Errorf("%s: permissionAppID = %q, want %q", name, got, tc.want)
		}
	}
}

func recordBatcher(window time.Duration) (*updateBatcher, func() []string) {
	var mu sync.Mutex
	var got []string
	b := newUpdateBatcher(window, func(sid agent.SessionID, u agent.Update) {
		mu.Lock()
		defer mu.Unlock()
		got = append(got, string(sid)+" "+u.Type+" "+u.Delta)
	})
	return b, func() []string {
		mu.Lock()
		defer mu.Unlock()
		return append([]string(nil), got...)
	}
}

// A run's first delta leaves alone, the next ones as one update before anything that follows them; sessions and kinds never mix.
func TestTextDeltasLeaveTogetherInOrder(t *testing.T) {
	b, got := recordBatcher(time.Hour)
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: "Oh. "})
	b.Push("s2", agent.Update{Type: "message_chunk", Delta: "other"})
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: "Hel"})
	b.Push("s2", agent.Update{Type: "message_chunk", Delta: " one"})
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: "lo"})
	b.Push("s1", agent.Update{Type: "thinking", Delta: "hmm"})
	b.Push("s1", agent.Update{Type: "tool_call"})
	b.End("s2")
	want := []string{"s1 message_chunk Oh. ", "s2 message_chunk other", "s1 message_chunk Hello", "s1 thinking hmm", "s1 tool_call ", "s2 message_chunk  one"}
	if !slices.Equal(got(), want) {
		t.Errorf("emitted %q, want %q", got(), want)
	}
}

// An adapter re-sends a finished block whole, and the webview drops it only when it arrives alone.
func TestAReSentBlockLeavesAlone(t *testing.T) {
	b, got := recordBatcher(time.Hour)
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: "Hel"})
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: "lo"})
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: "Hello"})
	// The run restarts at any other update, so a re-send also covers text from before it.
	b.Push("s1", agent.Update{Type: "tool_call_update"})
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: " world"})
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: "Hello world"})
	b.Flush("s1")
	want := []string{"s1 message_chunk Hel", "s1 message_chunk lo", "s1 message_chunk Hello", "s1 tool_call_update ", "s1 message_chunk  world", "s1 message_chunk Hello world"}
	if !slices.Equal(got(), want) {
		t.Errorf("emitted %q, want %q", got(), want)
	}
}

// An update that adds no part leaves the text as the webview's last part, so its re-send can come first.
func TestAReSendRightAfterAnotherUpdateLeavesAlone(t *testing.T) {
	for _, other := range []string{"tool_call_update", "usage", "model_change"} {
		b, got := recordBatcher(time.Hour)
		b.Push("s1", agent.Update{Type: "message_chunk", Delta: "Hel"})
		b.Push("s1", agent.Update{Type: "message_chunk", Delta: "lo"})
		b.Push("s1", agent.Update{Type: other})
		b.Push("s1", agent.Update{Type: "message_chunk", Delta: "Hello"})
		b.Push("s1", agent.Update{Type: "message_chunk", Delta: " next"})
		b.Flush("s1")
		want := []string{"s1 message_chunk Hel", "s1 message_chunk lo", "s1 " + other + " ", "s1 message_chunk Hello", "s1 message_chunk  next"}
		if !slices.Equal(got(), want) {
			t.Errorf("after %s: emitted %q, want %q", other, got(), want)
		}
	}
}

// End forgets the run (a session reloaded mid-turn), while the webview still shows the text a re-send repeats.
func TestAReSendRightAfterEndLeavesAlone(t *testing.T) {
	b, got := recordBatcher(time.Hour)
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: "Do"})
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: "ne."})
	b.End("s1")
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: "Done."})
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: " Next"})
	b.Flush("s1")
	want := []string{"s1 message_chunk Do", "s1 message_chunk ne.", "s1 message_chunk Done.", "s1 message_chunk  Next"}
	if !slices.Equal(got(), want) {
		t.Errorf("emitted %q, want %q", got(), want)
	}
}

// A stopped agent's sessions get their waiting text out, and none of them stays in memory.
func TestEndAllEndsEverySession(t *testing.T) {
	b, got := recordBatcher(time.Hour)
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: "a"})
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: "b"})
	b.Push("s2", agent.Update{Type: "message_chunk", Delta: "c"})
	b.EndAll()
	want := []string{"s1 message_chunk a", "s2 message_chunk c", "s1 message_chunk b"}
	if !slices.Equal(got(), want) {
		t.Errorf("emitted %q, want %q", got(), want)
	}
	if len(b.sessions) != 0 {
		t.Errorf("%d sessions kept after EndAll", len(b.sessions))
	}
}

// Text nothing follows still leaves once the window ends.
func TestWaitingTextLeavesAfterTheWindow(t *testing.T) {
	b, got := recordBatcher(10 * time.Millisecond)
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: "a"})
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: "b"})
	b.Push("s1", agent.Update{Type: "message_chunk", Delta: "c"})
	deadline := time.Now().Add(2 * time.Second)
	for len(got()) < 2 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if want := []string{"s1 message_chunk a", "s1 message_chunk bc"}; !slices.Equal(got(), want) {
		t.Errorf("emitted %q, want %q", got(), want)
	}
}
