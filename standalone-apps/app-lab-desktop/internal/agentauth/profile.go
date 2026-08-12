// Per-agent auth descriptor — the multi-agent seam. Only Claude is implemented today;
// a second agent (e.g. Gemini's Google login) becomes a new profile, not a rewrite.

package agentauth

import (
	"fmt"

	"app-lab-desktop/internal/airuntime"
)

// authProfile captures the credential-isolation specifics of one agent.
type authProfile struct {
	configDirEnv string   // env var that points the agent at its config/credentials dir
	apiKeyEnv    string   // env var for explicit API-key auth
	scrubKeys    []string // ambient credential vars dropped before spawning
	cliBin       string   // node_modules/.bin name to run
	logoutArgs   []string // CLI args that make the agent clear its OWN persisted credential (keychain included)
	// credentialFiles are credential stores the agent keeps inside its config dir, removed on sign-out for the
	// platforms that use a file rather than an OS keychain.
	credentialFiles []string
	// apiKeyVerifyURL is a cheap authenticated GET that tells a valid API key from a bogus one; empty = unverifiable.
	apiKeyVerifyURL string
	// apiKeyVerifyHeaders authenticates that request the way the provider expects.
	apiKeyVerifyHeaders func(key string) map[string]string
}

// profileFor returns the auth profile for a supported agent.
func profileFor(agent airuntime.AgentID) (authProfile, error) {
	switch agent {
	case airuntime.AgentClaude:
		return claudeProfile, nil
	default:
		return authProfile{}, fmt.Errorf("agentauth: no auth profile for agent %q", agent)
	}
}

// claudeProfile: subscription OAuth runs through the claude CLI's own login flow; the CLI
// runs from its node_modules/.bin shim (claude-code 2.1.178 ships a single native binary).
var claudeProfile = authProfile{
	configDirEnv: "CLAUDE_CONFIG_DIR",
	apiKeyEnv:    "ANTHROPIC_API_KEY",
	scrubKeys: []string{
		"ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN",
		"CLAUDE_API_KEY", "ANTHROPIC_BASE_URL",
	},
	cliBin:     "claude",
	logoutArgs: []string{"auth", "logout"},
	// Where the CLI keeps the OAuth credential when there is no usable OS keychain (typically Linux).
	credentialFiles: []string{".credentials.json"},
	// Listing models is the cheapest authenticated call: it needs a valid key and returns almost nothing.
	apiKeyVerifyURL: "https://api.anthropic.com/v1/models?limit=1",
	apiKeyVerifyHeaders: func(key string) map[string]string {
		return map[string]string{"x-api-key": key, "anthropic-version": "2023-06-01"}
	},
}
