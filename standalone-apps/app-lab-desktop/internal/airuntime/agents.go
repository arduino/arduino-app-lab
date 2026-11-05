// The agent registry: one entry per supported agent, and the source every per-agent lookup is checked against.

package airuntime

import (
	"fmt"
	"sort"
)

// AgentID identifies a runtime install (e.g. "claude").
type AgentID string

const (
	AgentClaude   AgentID = "claude"
	AgentOpenCode AgentID = "opencode"
)

// DefaultAgent is what a fresh install opens with, and the fallback wherever nothing has named one yet.
const DefaultAgent = AgentClaude

// Launch is how one agent's ACP server is started, relative to its runtime directory.
type Launch struct {
	Entry   []string // path inside the runtime dir
	ViaNode bool     // run Entry with the pinned Node rather than directly
	Args    []string // arguments that make it speak ACP
}

type agentSpec struct {
	enabled bool
	launch  Launch
	// The package whose version is the agent's own; Node's is the same for every agent.
	primaryPackage string
}

// supportedAgents is the allowlist of installable agents; set enabled false to withdraw one.
var supportedAgents = map[AgentID]agentSpec{
	AgentClaude: {
		enabled:        true,
		primaryPackage: "@anthropic-ai/claude-code",
		// The ACP adapter is JavaScript, so the pinned Node runs it.
		launch: Launch{
			Entry:   []string{"node_modules", "@agentclientprotocol", "claude-agent-acp", "dist", "index.js"},
			ViaNode: true,
		},
	},
	AgentOpenCode: {
		enabled:        true,
		primaryPackage: "opencode-ai",
		// A native binary named opencode.exe everywhere; the address is on argv, unreachable from config.
		launch: Launch{
			Entry: []string{"node_modules", "opencode-ai", "bin", "opencode.exe"},
			Args:  []string{"acp", "--hostname", "127.0.0.1", "--port", "0"},
		},
	},
}

func isSupported(agent AgentID) bool { return supportedAgents[agent].enabled }

// Lets anything that must handle every agent be checked against the registry, not a list of its own.
func SupportedAgents() []AgentID {
	out := make([]AgentID, 0, len(supportedAgents))
	for id, spec := range supportedAgents {
		if spec.enabled {
			out = append(out, id)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}

// LaunchFor returns how to start an agent's ACP server.
func LaunchFor(agent AgentID) (Launch, error) {
	spec, ok := supportedAgents[agent]
	if !ok || !spec.enabled {
		return Launch{}, fmt.Errorf("airuntime: no launch spec for agent %q", agent)
	}
	return spec.launch, nil
}

// ParseAgent validates a client-supplied agent id, so the host never trusts a raw FE string.
func ParseAgent(s string) (AgentID, error) {
	id := AgentID(s)
	if !isSupported(id) {
		return "", fmt.Errorf("airuntime: unknown or unsupported agent %q", s)
	}
	return id, nil
}
