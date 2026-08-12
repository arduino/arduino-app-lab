package agentauth

import (
	"strings"
	"testing"

	"app-lab-desktop/internal/airuntime"
)

// A synthetic profile keeps this test of the generic builder agent-agnostic.
var testProfile = authProfile{
	configDirEnv: "AGENT_CONFIG_DIR",
	apiKeyEnv:    "AGENT_API_KEY",
	scrubKeys:    []string{"AGENT_API_KEY", "AGENT_OAUTH_TOKEN", "AGENT_SECRET"},
}

// The isolated env is the security boundary: ambient credentials must never reach the
// child, and the config dir must be forced to ours.
func TestBuildIsolatedEnv(t *testing.T) {
	base := []string{
		"PATH=/usr/bin:/bin",
		"HOME=/home/dev",
		"HTTPS_PROXY=http://proxy:8080",
		"AGENT_API_KEY=ambient-leak",
		"AGENT_OAUTH_TOKEN=ambient-leak",
		"AGENT_SECRET=ambient-leak",
		"AGENT_CONFIG_DIR=/home/dev/.agent",
	}
	m := envMap(buildIsolatedEnv(base, testProfile, "/rt/node/bin", "/rt/config", "", ""))

	for _, k := range testProfile.scrubKeys {
		if _, ok := m[k]; ok {
			t.Errorf("ambient credential %s leaked into the isolated env", k)
		}
	}
	if got := m[testProfile.configDirEnv]; got != "/rt/config" {
		t.Errorf("%s = %q, want /rt/config (the dev's must not be inherited)", testProfile.configDirEnv, got)
	}
	if got := m["PATH"]; !strings.HasPrefix(got, "/rt/node/bin") {
		t.Errorf("PATH = %q, want it to start with the bundled node bin", got)
	}
	if m["HOME"] != "/home/dev" || m["HTTPS_PROXY"] != "http://proxy:8080" {
		t.Errorf("innocuous ambient vars should pass through: HOME=%q HTTPS_PROXY=%q", m["HOME"], m["HTTPS_PROXY"])
	}
}

// API-key mode scrubs the ambient value and injects the caller's — never the reverse.
func TestBuildIsolatedEnvInjection(t *testing.T) {
	base := []string{"PATH=/usr/bin", "AGENT_API_KEY=ambient-leak"}

	api := envMap(buildIsolatedEnv(base, testProfile, "/rt/node/bin", "/rt/config", testProfile.apiKeyEnv, "explicit-key"))
	if got := api[testProfile.apiKeyEnv]; got != "explicit-key" {
		t.Errorf("%s = %q, want explicit-key (ambient scrubbed, explicit injected)", testProfile.apiKeyEnv, got)
	}
}

func envMap(env []string) map[string]string {
	m := make(map[string]string, len(env))
	for _, kv := range env {
		if k, v, ok := strings.Cut(kv, "="); ok {
			m[k] = v
		}
	}
	return m
}

// IsolatedEnv must start from the agent allow-list, so an ambient secret in
// the user's shell cannot reach the agent or anything it spawns.
func TestIsolatedEnvAppliesTheAllowList(t *testing.T) {
	for _, k := range []string{"GITHUB_TOKEN", "AWS_SECRET_ACCESS_KEY", "NPM_TOKEN", "OPENAI_API_KEY"} {
		t.Setenv(k, "ambient-leak")
	}
	t.Setenv("HOME", "/home/dev")
	t.Setenv("HTTPS_PROXY", "http://proxy:8080")

	env, err := IsolatedEnv(airuntime.AgentClaude, Options{Method: None})
	if err != nil {
		t.Fatalf("IsolatedEnv: %v", err)
	}
	m := envMap(env)
	for _, k := range []string{"GITHUB_TOKEN", "AWS_SECRET_ACCESS_KEY", "NPM_TOKEN", "OPENAI_API_KEY"} {
		if v, ok := m[k]; ok {
			t.Errorf("%s=%q reached the agent; the allow-list must drop it", k, v)
		}
	}
	// And what the agent needs must survive the intersection.
	if m["HOME"] != "/home/dev" || m["HTTPS_PROXY"] != "http://proxy:8080" {
		t.Errorf("the agent's own needs must pass: HOME=%q HTTPS_PROXY=%q", m["HOME"], m["HTTPS_PROXY"])
	}
	if m["CLAUDE_CONFIG_DIR"] == "" {
		t.Error("the forced config dir must be set")
	}
}
