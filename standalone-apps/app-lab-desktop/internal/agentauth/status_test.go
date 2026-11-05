package agentauth

import (
	"app-lab-desktop/internal/airuntime"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// The marker is what App Lab reads as "logged in", so it must go — while everything else in the config survives,
// since the file also holds unrelated CLI state.
func TestStripOAuthMarkerLeavesTheRestOfTheConfig(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, claudeConfigFile)
	if err := os.WriteFile(path, []byte(`{"oauthAccount":{"emailAddress":"a@b.c"},"firstStartTime":"2026-01-01","theme":"dark"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := stripOAuthMarker(path); err != nil {
		t.Fatalf("strip: %v", err)
	}
	var cfg map[string]json.RawMessage
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		t.Fatalf("config is no longer valid JSON: %v", err)
	}
	if _, still := cfg["oauthAccount"]; still {
		t.Error("the logged-in marker survived the sign-out")
	}
	for _, keep := range []string{"firstStartTime", "theme"} {
		if _, ok := cfg[keep]; !ok {
			t.Errorf("sign-out dropped unrelated config key %q", keep)
		}
	}
	// A config with no marker (already signed out) and a missing file are both no-ops, not errors.
	if err := stripOAuthMarker(path); err != nil {
		t.Errorf("second strip: %v", err)
	}
	if err := stripOAuthMarker(filepath.Join(dir, "absent.json")); err != nil {
		t.Errorf("missing config: %v", err)
	}
}

// S7: stripping the marker alone left a usable refresh token behind, so the profile must carry what it takes to
// clear the agent's own credential store — the CLI logout (for the OS keychain) and the on-disk credential file.
func TestClaudeProfileCanClearItsCredential(t *testing.T) {
	if len(claudeProfile.logoutArgs) == 0 {
		t.Error("no logout args: only the CLI can clear its keychain entry, so sign-out would leave the token live")
	}
	if len(claudeProfile.credentialFiles) == 0 {
		t.Error("no credential files: on platforms without a usable keychain the token stays on disk")
	}
}

// The profile is what isolates one agent's credentials, so a missing one must fail here, not at launch.
func TestEveryRegisteredAgentHasAnAuthProfile(t *testing.T) {
	for _, id := range airuntime.SupportedAgents() {
		p, err := profileFor(id)
		if err != nil {
			t.Errorf("%s: %v", id, err)
			continue
		}
		if p.configDirEnv == "" {
			t.Errorf("%s: no config-dir variable, so it would read and write the user's own directory", id)
		}
		if p.cliBin == "" {
			t.Errorf("%s: no CLI binary", id)
		}
	}
}

// OpenCode has no browser login: borrowing Claude's flags or its account file would both invent one.
func TestAnAgentWithoutABrowserLoginIsNotAnsweredFromAnother(t *testing.T) {
	if openCodeProfile.subscription != nil {
		t.Error("OpenCode advertises a browser sign-in it does not have")
	}
	if _, err := SubscriptionLoginArgs(airuntime.AgentOpenCode); err == nil {
		t.Error("returned sign-in arguments for an agent with no browser sign-in")
	}
	acc, err := ReadSubscriptionAccount(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if acc.LoggedIn {
		t.Error("reported signed in through a flow this agent does not have")
	}
}

// The other half: the agent that does own that file is still read from it.
func TestClaudeAccountComesFromItsOwnConfig(t *testing.T) {
	dir := t.TempDir()
	body := []byte(`{"oauthAccount":{"emailAddress":"a@b.c"},"firstStartTime":"2026-01-01"}`)
	if err := os.WriteFile(filepath.Join(dir, claudeConfigFile), body, 0o600); err != nil {
		t.Fatal(err)
	}
	acc, err := readClaudeAccount(dir)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if !acc.LoggedIn || acc.Email != "a@b.c" {
		t.Errorf("got %+v, want a signed-in account for a@b.c", acc)
	}
	args, err := SubscriptionLoginArgs(airuntime.AgentClaude)
	if err != nil || len(args) == 0 {
		t.Errorf("no sign-in arguments for the agent whose flow this is: %v", err)
	}
}
