// Supported agent identities for the runtime manager.

package airuntime

import "fmt"

// AgentID identifies a runtime install (e.g. "claude").
type AgentID string

const AgentClaude AgentID = "claude"

// supportedAgents is the allowlist of installable agents; set an entry false to disable it.
var supportedAgents = map[AgentID]bool{
	AgentClaude: true,
}

// isSupported reports whether agent is a known, enabled runtime target.
func isSupported(agent AgentID) bool { return supportedAgents[agent] }

// ParseAgent validates a client-supplied agent id, so the host never trusts a raw FE string.
func ParseAgent(s string) (AgentID, error) {
	id := AgentID(s)
	if !isSupported(id) {
		return "", fmt.Errorf("airuntime: unknown or unsupported agent %q", s)
	}
	return id, nil
}
