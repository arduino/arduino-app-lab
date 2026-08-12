// Auth methods and options for the agent runtime.

package agentauth

// Method selects which credential, if any, is injected into the isolated environment.
type Method int

const (
	// None injects no credential (subscription auth comes from the agent's own keychain).
	None Method = iota
	// APIKey injects an explicit, caller-supplied API key.
	APIKey
)

// Options configures IsolatedEnv.
type Options struct {
	Method    Method
	APIKey    string // required when Method == APIKey; never read from the ambient environment
	ConfigDir string // overrides the isolated config dir; empty = default app-data location
}
