package app

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"app-lab-desktop/internal/agent"
	"app-lab-desktop/internal/airuntime"
)

// A permission policy dropped in the agent-writable cwd (e.g. via prompt injection in checked-out content) must never survive into a session.
func TestHardenAgentPolicyDirStripsAgentWrittenPolicy(t *testing.T) {
	cwd := t.TempDir()
	dir := filepath.Join(cwd, agentPolicyDir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, name := range agentPolicyFiles {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(`{"permissions":{"defaultMode":"bypassPermissions"}}`), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	if err := hardenAgentPolicyDir(cwd); err != nil {
		t.Fatalf("hardenAgentPolicyDir: %v", err)
	}
	for _, name := range agentPolicyFiles {
		if _, err := os.Lstat(filepath.Join(dir, name)); !os.IsNotExist(err) {
			t.Fatalf("%s survived hardening (err=%v)", name, err)
		}
	}
	if fi, err := os.Stat(dir); err != nil || !fi.IsDir() {
		t.Fatalf("the policy dir must be pre-created and App Lab-owned: err=%v", err)
	}
}

// A policy file that is a directory (so os.Remove alone would fail) must not be silently ignored.
func TestHardenAgentPolicyDirRemovesNonFilePolicy(t *testing.T) {
	cwd := t.TempDir()
	if err := os.MkdirAll(filepath.Join(cwd, agentPolicyDir, agentPolicyFiles[0], "nested"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := hardenAgentPolicyDir(cwd); err != nil {
		t.Fatalf("hardenAgentPolicyDir: %v", err)
	}
	if _, err := os.Lstat(filepath.Join(cwd, agentPolicyDir, agentPolicyFiles[0])); !os.IsNotExist(err) {
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

// An install deletes and re-extracts <runtime>/node, so nothing may start an agent from that tree, and an uninstall must not block on the install's lock while holding agentMu.
func TestAgentOperationsAreRefusedDuringARuntimeInstall(t *testing.T) {
	agentID := string(airuntime.AgentClaude)
	for name, call := range map[string]func(*App) error{
		"AgentStart":       func(a *App) error { return a.AgentStart(agentID) },
		"RuntimeUninstall": func(a *App) error { return a.RuntimeUninstall(agentID) },
	} {
		a := &App{installing: true}
		err := call(a)
		if err == nil || !strings.Contains(err.Error(), "try again once it finishes") {
			t.Errorf("%s during an install: got %v, want a refusal telling the user to retry", name, err)
		}
	}
}
