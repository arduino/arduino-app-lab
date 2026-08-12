package agentauth

import (
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
