// Per-agent auth descriptor: the seam where another engine is a new profile, not a rewrite.

package agentauth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"path/filepath"

	"app-lab-desktop/internal/airuntime"
)

// authProfile captures the credential-isolation specifics of one agent.
type authProfile struct {
	configDirEnv string   // env var that points the agent at its config root
	configSubdir string   // the directory the engine appends inside that root; empty means the root is it
	apiKeyEnv    string   // env var for explicit API-key auth
	scrubKeys    []string // ambient credential vars dropped before spawning
	cliBin       string   // node_modules/.bin name to run
	logoutArgs   []string // CLI args that make the agent clear its OWN persisted credential (keychain included)
	// The browser sign-in this agent offers, or nil when it has none and an API key is the only credential.
	subscription *subscriptionLogin
	// Credential stores kept as files, removed on sign-out, on platforms with no usable OS keychain.
	credentialFiles []string
	// apiKeyVerifyURL is a cheap authenticated GET that tells a valid API key from a bogus one; empty = unverifiable.
	apiKeyVerifyURL string
	// apiKeyVerifyHeaders authenticates that request the way the provider expects.
	apiKeyVerifyHeaders func(key string) map[string]string
	// Environment confining the engine to its own directory; runs per launch, so it can mint a secret.
	containment func(configDir string) ([]string, error)
	// Where the engine caches its own provider catalogue, for an agent with one key per provider.
	providerCatalogRel string
	// The agent has a default that runs with no credential at all; keys only widen the model list.
	usableWithoutCredential bool
	// What makes the engine fetch it, so Connect has the list before the first launch writes it.
	catalogWarmupArgs []string
	// The part of the catalogue the settings panel offers, in its order; empty offers all of it.
	offeredProviders []OfferedProvider
	// The engine's own credential file, for the providers it signs in to itself, under the config root.
	engineAuthFileRel string
	// The CLI command that deletes a stored session, followed by its id, for an engine whose ACP cannot delete one.
	sessionDeleteArgs []string
}

// How one agent does browser OAuth; every part of it is that engine's own.
type subscriptionLogin struct {
	loginArgs []string
	// read reports the persisted login. Reading another engine's file would answer for the wrong agent.
	read func(configDir string) (SubscriptionAccount, error)
	// clear removes App Lab's "logged in" marker; the live credential is the CLI's own logout to undo.
	clear func(configDir string) error
}

func profileFor(agent airuntime.AgentID) (authProfile, error) {
	switch agent {
	case airuntime.AgentClaude:
		return claudeProfile, nil
	case airuntime.AgentOpenCode:
		return openCodeProfile, nil
	default:
		return authProfile{}, fmt.Errorf("agentauth: no auth profile for agent %q", agent)
	}
}

// Subscription OAuth runs through the claude CLI's own login flow, from its node_modules/.bin shim.
var claudeProfile = authProfile{
	configDirEnv: "CLAUDE_CONFIG_DIR",
	apiKeyEnv:    "ANTHROPIC_API_KEY",
	scrubKeys: []string{
		"ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN",
		"CLAUDE_API_KEY", "ANTHROPIC_BASE_URL",
	},
	cliBin:     "claude",
	logoutArgs: []string{"auth", "logout"},
	subscription: &subscriptionLogin{
		loginArgs: []string{"auth", "login", "--claudeai"},
		read:      readClaudeAccount,
		clear:     clearClaudeAccount,
	},
	// Where the CLI keeps the OAuth credential when there is no usable OS keychain (typically Linux).
	credentialFiles: []string{".credentials.json"},
	// Listing models is the cheapest authenticated call: it needs a valid key and returns almost nothing.
	apiKeyVerifyURL: "https://api.anthropic.com/v1/models?limit=1",
	apiKeyVerifyHeaders: func(key string) map[string]string {
		return map[string]string{"x-api-key": key, "anthropic-version": "2023-06-01"}
	},
}

// No login of its own (session/authenticate always succeeds), so the credential is a provider API key.
var openCodeProfile = authProfile{
	// XDG_CONFIG_HOME, not OPENCODE_CONFIG_DIR: the latter adds a directory instead of replacing them.
	configDirEnv: "XDG_CONFIG_HOME",
	configSubdir: "opencode",
	// Empty on purpose: bring-your-own-provider, so the variable depends on the provider the user picks.
	apiKeyEnv: "",
	scrubKeys: []string{
		"OPENCODE_CONFIG", "OPENCODE_CONFIG_CONTENT", "OPENCODE_CONFIG_DIR", "OPENCODE_TEST_HOME",
		"OPENCODE_SERVER_USERNAME", "OPENCODE_SERVER_PASSWORD", "OPENCODE_PERMISSION",
		"OPENCODE_PLUGIN_META_FILE", "OPENCODE_CLIENT",
	},
	cliBin: "opencode",
	// XDG_CACHE_HOME is <config root>/cache, and the engine writes the catalogue there on its first run.
	providerCatalogRel: filepath.Join("cache", "opencode", "models.json"),
	// Without --refresh the command only lists models and never writes the catalogue.
	catalogWarmupArgs: []string{"models", "--refresh"},
	offeredProviders:  openCodeOffered,
	// The engine's own logins, GitHub Copilot's among them, and the keys a missing keychain left in a file must not outlive a sign-out.
	credentialFiles: []string{filepath.Join("data", "opencode", "auth.json"), providerKeyFile, providerKeyFile + ".tmp"},
	// XDG_DATA_HOME is <config root>/data; `opencode providers list` prints this path.
	engineAuthFileRel: filepath.Join("data", "opencode", "auth.json"),
	// Its ACP offers close but no delete, so a session it stored stays in its list for good.
	sessionDeleteArgs: []string{"session", "delete"},
	// Measured: with an empty config and no key, its free models answer a turn.
	usableWithoutCredential: true,
	// No subscription: session/authenticate succeeds without doing anything, so a sign-in would be a lie.
	containment: openCodeContainment,
}

// The measured recipe: each line closes something the engine would otherwise read, run or expose.
func openCodeContainment(configDir string) ([]string, error) {
	user, err := randomToken(8)
	if err != nil {
		return nil, err
	}
	password, err := randomToken(24)
	if err != nil {
		return nil, err
	}
	under := func(name string) string { return filepath.Join(configDir, name) }
	return []string{
		// Closes the walk up from the cwd, which is the mirror the agent can write: opencode.json, .opencode.
		"OPENCODE_DISABLE_PROJECT_CONFIG=1",
		// What that flag misses: a ~/.opencode scan, and HOME's ~/.claude and ~/.agents skills and CLAUDE.md.
		"XDG_DATA_HOME=" + under("data"),
		"XDG_CACHE_HOME=" + under("cache"),
		"XDG_STATE_HOME=" + under("state"),
		"HOME=" + under("home"),
		// Read before homedir(), which follows USERPROFILE on Windows and so would miss the HOME above.
		"OPENCODE_TEST_HOME=" + under("home"),
		// Not an XDG path: without it the engine's own install leaves ~96 MB in the user's ~/.npm.
		"npm_config_cache=" + under("npm-cache"),
		// External plugins run and skills are injected, so those go off; built-in plugins stay on, as they are the engine's own logins.
		"OPENCODE_PURE=1",
		"OPENCODE_DISABLE_EXTERNAL_SKILLS=1",
		"OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=1",
		// Two HTTP routes run a shell no permission rule reaches; this keeps other local processes off them.
		"OPENCODE_SERVER_USERNAME=" + user,
		"OPENCODE_SERVER_PASSWORD=" + password,
	}, nil
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("agentauth: generate server credential: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// UsableWithoutCredential reports whether the agent can run before the user has given it anything.
func UsableWithoutCredential(agent airuntime.AgentID) bool {
	p, err := profileFor(agent)
	return err == nil && p.usableWithoutCredential
}

// An agent without a browser sign-in is an error here, not an empty run of another engine's flags.
func SubscriptionLoginArgs(agent airuntime.AgentID) ([]string, error) {
	p, err := profileFor(agent)
	if err != nil {
		return nil, err
	}
	if p.subscription == nil {
		return nil, fmt.Errorf("agentauth: %s has no browser sign-in; it authenticates with an API key", agent)
	}
	return p.subscription.loginArgs, nil
}

// Where the engine reads its configuration: the agent's config root plus the subdirectory it appends.
func EngineConfigDir(agent airuntime.AgentID) (string, error) {
	p, err := profileFor(agent)
	if err != nil {
		return "", err
	}
	root, err := airuntime.AgentConfigDir(agent)
	if err != nil {
		return "", err
	}
	if p.configSubdir == "" {
		return root, nil
	}
	return filepath.Join(root, p.configSubdir), nil
}
