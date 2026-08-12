// The isolated child environment for the agent's processes: bundled node on PATH, a forced
// config dir, ambient credentials scrubbed, and the API key injected when one is supplied.

package agentauth

import (
	"errors"
	"os"
	"strings"

	agentproc "app-lab-desktop/internal/agent"
	"app-lab-desktop/internal/airuntime"
)

// IsolatedEnv returns the child environment for spawning the agent (login or adapter).
func IsolatedEnv(agent airuntime.AgentID, opts Options) ([]string, error) {
	if opts.Method == APIKey && opts.APIKey == "" {
		return nil, errors.New("agentauth: APIKey method requires a non-empty API key")
	}
	p, err := profileFor(agent)
	if err != nil {
		return nil, err
	}
	nodeBinDir, err := airuntime.NodeBinDir(agent)
	if err != nil {
		return nil, err
	}
	configDir := opts.ConfigDir
	if configDir == "" {
		if configDir, err = airuntime.AgentConfigDir(agent); err != nil {
			return nil, err
		}
	}
	injectKey, injectVal := injection(p, opts)
	// Base on the agent allow-list, never os.Environ(): ambient secrets
	// (GITHUB_TOKEN, AWS_*, …) must not reach the agent or anything it spawns.
	return buildIsolatedEnv(agentproc.ChildEnv(), p, nodeBinDir, configDir, injectKey, injectVal), nil
}

// injection picks the credential env var for an explicit-credential method (None injects nothing).
func injection(p authProfile, opts Options) (key, val string) {
	switch opts.Method {
	case APIKey:
		return p.apiKeyEnv, opts.APIKey
	default:
		return "", ""
	}
}

// buildIsolatedEnv is the pure core of IsolatedEnv (testable without touching os.Environ).
func buildIsolatedEnv(base []string, p authProfile, nodeBinDir, configDir, injectKey, injectVal string) []string {
	drop := make(map[string]bool, len(p.scrubKeys)+1)
	drop[strings.ToUpper(p.configDirEnv)] = true // force ours; never inherit the dev's
	for _, k := range p.scrubKeys {
		drop[strings.ToUpper(k)] = true
	}

	oldPath := ""
	out := make([]string, 0, len(base)+3)
	for _, kv := range base {
		k, v, ok := strings.Cut(kv, "=")
		switch {
		case ok && strings.EqualFold(k, "PATH"):
			oldPath = v
		case ok && drop[strings.ToUpper(k)]:
			// scrubbed credential var or the forced config dir
		default:
			out = append(out, kv)
		}
	}

	newPath := nodeBinDir
	if oldPath != "" {
		newPath += string(os.PathListSeparator) + oldPath
	}
	out = append(out, "PATH="+newPath, p.configDirEnv+"="+configDir)
	if injectKey != "" && injectVal != "" {
		out = append(out, injectKey+"="+injectVal)
	}
	return out
}
