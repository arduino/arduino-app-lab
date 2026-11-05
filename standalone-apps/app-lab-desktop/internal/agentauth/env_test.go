package agentauth

import (
	"strings"
	"testing"

	agentproc "app-lab-desktop/internal/agent"
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
	m := envMap(buildIsolatedEnv(base, testProfile, "/rt/node/bin", "/rt/config", "", "", nil))

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

	api := envMap(buildIsolatedEnv(base, testProfile, "/rt/node/bin", "/rt/config", testProfile.apiKeyEnv, "explicit-key", nil))
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

// An inherited value must lose to ours, or the isolation is off whenever the parent has HOME set.
func TestBuildIsolatedEnvContainmentBeatsTheInheritedValue(t *testing.T) {
	base := []string{"PATH=/usr/bin", "HOME=/Users/someone", "XDG_CONFIG_HOME=/Users/someone/.config"}
	contained := []string{"HOME=/rt/config/home", "XDG_CONFIG_HOME=/rt/config/xdg/config"}

	env := envMap(buildIsolatedEnv(base, testProfile, "/rt/node/bin", "/rt/config", "", "", contained))
	if got, want := env["HOME"], "/rt/config/home"; got != want {
		t.Errorf("HOME = %q, want %q", got, want)
	}
	if got, want := env["XDG_CONFIG_HOME"], "/rt/config/xdg/config"; got != want {
		t.Errorf("XDG_CONFIG_HOME = %q, want %q", got, want)
	}
	if n := countKey(buildIsolatedEnv(base, testProfile, "/rt/node/bin", "/rt/config", "", "", contained), "HOME"); n != 1 {
		t.Errorf("HOME appears %d times; a duplicate leaves the winner up to the exec implementation", n)
	}
}

func countKey(env []string, key string) int {
	n := 0
	for _, kv := range env {
		if k, _, ok := strings.Cut(kv, "="); ok && k == key {
			n++
		}
	}
	return n
}

// Every configured provider contributes its own variable, under the name the catalogue gave it.
func TestEveryConfiguredProviderIsInjectedOnce(t *testing.T) {
	isolatedAppData(t)
	mockKeychain(t)
	// A multi-variable provider: the first name is the one the key is injected as.
	writeCatalogue(t, airuntime.AgentOpenCode, `{
	  "openai":{"name":"OpenAI","env":["OPENAI_API_KEY"]},
	  "multi":{"name":"Multi Var","env":["FIRST_TOKEN","SECOND_KEY"]},
	  "unused":{"name":"Unused","env":["UNUSED_API_KEY"]}
	}`)
	keys := map[string]string{"openai": "sk-test-openai-key", "multi": "sk-test-multi-key"}
	for id, key := range keys {
		if err := StoreProviderKey(airuntime.AgentOpenCode, id, key); err != nil {
			t.Fatalf("store %s: %v", id, err)
		}
	}

	env, err := IsolatedEnv(airuntime.AgentOpenCode, Options{Method: None})
	if err != nil {
		t.Fatalf("IsolatedEnv: %v", err)
	}
	m := envMap(env)
	if m["OPENAI_API_KEY"] != keys["openai"] {
		t.Errorf("OPENAI_API_KEY = %q, want the stored key", m["OPENAI_API_KEY"])
	}
	if m["FIRST_TOKEN"] != keys["multi"] {
		t.Errorf("FIRST_TOKEN = %q, want the multi-variable provider's key under its first name", m["FIRST_TOKEN"])
	}
	// The aliases are not set: the engine reads the canonical one, and a second copy is a second secret.
	if _, ok := m["SECOND_KEY"]; ok {
		t.Error("an alias variable was set as well; only the canonical one is injected")
	}
	// A provider with no key contributes nothing, empty value included.
	if _, ok := m["UNUSED_API_KEY"]; ok {
		t.Errorf("UNUSED_API_KEY = %q was set for a provider with no key", m["UNUSED_API_KEY"])
	}
	for _, k := range []string{"OPENAI_API_KEY", "FIRST_TOKEN"} {
		if n := countKey(env, k); n != 1 {
			t.Errorf("%s appears %d times; a duplicate leaves the winner to the exec implementation", k, n)
		}
	}
}

// A key belongs to the agent it was given to: the other engine must never be spawned holding it.
func TestOneAgentsProviderKeysNeverReachTheOther(t *testing.T) {
	isolatedAppData(t)
	mockKeychain(t)
	writeCatalogue(t, airuntime.AgentOpenCode, `{"openai":{"name":"OpenAI","env":["OPENAI_API_KEY"]}}`)
	const key = "sk-test-opencodes-own-key"
	if err := StoreProviderKey(airuntime.AgentOpenCode, "openai", key); err != nil {
		t.Fatalf("store: %v", err)
	}

	env, err := IsolatedEnv(airuntime.AgentClaude, Options{Method: None})
	if err != nil {
		t.Fatalf("IsolatedEnv: %v", err)
	}
	for _, kv := range env {
		if strings.Contains(kv, key) {
			t.Fatalf("the other agent's key reached claude's environment as %q", kv)
		}
	}
	if _, ok := envMap(env)["OPENAI_API_KEY"]; ok {
		t.Error("claude was spawned with a provider variable that belongs to the other agent")
	}
}

// The engine walks HOME for skills, prompts and config, so an inherited one undoes the containment.
func TestTheContainedEngineNeverSeesTheUsersOwnDirectories(t *testing.T) {
	isolatedAppData(t)
	mockKeychain(t)
	t.Setenv("HOME", "/Users/someone")
	t.Setenv("XDG_CONFIG_HOME", "/Users/someone/.config")
	t.Setenv("XDG_DATA_HOME", "/Users/someone/.local/share")
	for _, k := range []string{"GITHUB_TOKEN", "AWS_SECRET_ACCESS_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"} {
		t.Setenv(k, "ambient-leak")
	}

	env, err := IsolatedEnv(airuntime.AgentOpenCode, Options{Method: None})
	if err != nil {
		t.Fatalf("IsolatedEnv: %v", err)
	}
	m := envMap(env)
	configRoot, err := airuntime.AgentConfigDir(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	// OPENCODE_TEST_HOME is the engine's home on every platform: on Windows its homedir() ignores HOME.
	for _, k := range []string{"HOME", "OPENCODE_TEST_HOME", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME"} {
		if v := m[k]; v == "" || !strings.HasPrefix(v, configRoot) {
			t.Errorf("%s = %q, want a path under the agent's own config root %q", k, v, configRoot)
		}
		if n := countKey(env, k); n != 1 {
			t.Errorf("%s appears %d times, so which one the engine reads is undefined", k, n)
		}
	}
	for _, k := range []string{"GITHUB_TOKEN", "AWS_SECRET_ACCESS_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"} {
		if v, ok := m[k]; ok {
			t.Errorf("%s=%q reached the engine; the allow-list must drop it", k, v)
		}
	}
	// The measured recipe: each of these closes a mechanism the engine would otherwise run.
	for _, k := range []string{
		"OPENCODE_DISABLE_PROJECT_CONFIG", "OPENCODE_PURE",
		"OPENCODE_DISABLE_EXTERNAL_SKILLS", "OPENCODE_DISABLE_CLAUDE_CODE_SKILLS",
	} {
		if m[k] == "" {
			t.Errorf("%s is unset, so that mechanism is left on", k)
		}
	}
	// The built-in plugins are the engine's own provider logins: without them GitHub Copilot can neither sign in nor answer.
	if v, ok := m["OPENCODE_DISABLE_DEFAULT_PLUGINS"]; ok {
		t.Errorf("OPENCODE_DISABLE_DEFAULT_PLUGINS=%q turns the built-in logins off", v)
	}
	// The HTTP routes that run a shell are behind these, so they must be a real secret each launch.
	user, password := m["OPENCODE_SERVER_USERNAME"], m["OPENCODE_SERVER_PASSWORD"]
	if len(user) < 16 || len(password) < 48 {
		t.Errorf("server credential = %q/%q, want the minted pair", user, password)
	}
	second, err := IsolatedEnv(airuntime.AgentOpenCode, Options{Method: None})
	if err != nil {
		t.Fatal(err)
	}
	if envMap(second)["OPENCODE_SERVER_PASSWORD"] == password {
		t.Error("the server password is the same on the next launch; it is minted per launch")
	}
}

// The policy travels in this variable, so a host value of the same name must not compete with ours.
// The allowlist is the union of every engine's config variable, so each one leaked into the others.
func TestNoEngineInheritsAnotherEnginesConfigVariable(t *testing.T) {
	isolatedAppData(t)
	mockKeychain(t)
	for _, running := range airuntime.SupportedAgents() {
		for _, other := range airuntime.SupportedAgents() {
			if other == running {
				continue
			}
			op, err := profileFor(other)
			if err != nil {
				t.Fatalf("%s: %v", other, err)
			}
			t.Setenv(op.configDirEnv, "/tmp/the-users-own-"+string(other))
			env, err := IsolatedEnv(running, Options{Method: None})
			if err != nil {
				t.Fatalf("%s: IsolatedEnv: %v", running, err)
			}
			got := envMap(env)[op.configDirEnv]
			if got == "/tmp/the-users-own-"+string(other) {
				t.Errorf("%s inherited %s's %s=%q from the host", running, other, op.configDirEnv, got)
			}
		}
	}
}

func TestTheEnginesConfigVariableCannotComeFromTheHost(t *testing.T) {
	isolatedAppData(t)
	mockKeychain(t)
	for _, id := range airuntime.SupportedAgents() {
		d, err := agentproc.DialectFor(id)
		if err != nil {
			t.Errorf("%s: %v", id, err)
			continue
		}
		if d.LaunchConfigEnv == "" {
			continue // its policy travels in the session envelope instead
		}
		t.Setenv(d.LaunchConfigEnv, `{"permission":{"bash":{"*":"allow"}}}`)
		env, err := IsolatedEnv(id, Options{Method: None})
		if err != nil {
			t.Fatalf("%s: IsolatedEnv: %v", id, err)
		}
		if v, ok := envMap(env)[d.LaunchConfigEnv]; ok {
			t.Errorf("%s: %s=%q survived from the host environment", id, d.LaunchConfigEnv, v)
		}
	}
}
