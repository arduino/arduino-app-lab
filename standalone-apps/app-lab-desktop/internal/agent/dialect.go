package agent

import (
	"encoding/json"
	"fmt"

	"app-lab-desktop/internal/airuntime"
)

// What differs between engines once ACP is subtracted; a nil field means that channel is absent.
type Dialect struct {
	// Nil on an engine that ignores _meta: its policy travels in LaunchConfig instead.
	SessionMeta func(allowedTools []string, boardName string, ws SessionWorkspace) map[string]any
	// Auto-approval matches this string exactly, so another engine's naming approves nothing.
	QualifyTool func(server, tool string) string
	// The configuration the engine reads at startup, as the value of one environment variable.
	LaunchConfig    func(in LaunchInput) (string, error)
	LaunchConfigEnv string
	// The session's scope paragraph, in the FIRST prompt only: repeating it costs ~146 tokens every turn.
	PromptFocus func(ws SessionWorkspace) string
	// For an engine whose instructions setting takes a file path, not text; rel is under the config dir.
	LaunchInstructions func(in LaunchInput) (rel string, data []byte)
	// Its permission request for an MCP tool carries none of the call's arguments; the call's own update does.
	AsksWithoutArguments bool
	// It lists a session from session/new on, before the caller has the id back.
	ListsNewSessions bool
	// Its servers come from the launch config: one sent again in session/new or session/load replaces the client every session shares.
	MCPInLaunchConfig bool
	// Its cancel stops only a run already started: one that lands while the prompt is still being set up is dropped.
	DropsEarlyCancel bool
}

// Standalone: a dialect reaching its own QualifyTool field would be an initialisation cycle.
func claudeToolName(server, tool string) string   { return fmt.Sprintf("mcp__%s__%s", server, tool) }
func openCodeToolName(server, tool string) string { return server + "_" + tool }

// The adapter reads session options from _meta; the matching CLI flags are ignored.
var claudeDialect = Dialect{
	SessionMeta: claudeSessionMeta,
	QualifyTool: claudeToolName,
}

// OpenCode discards _meta without an error, so everything it would have carried moves to the config.
var openCodeDialect = Dialect{
	SessionMeta:          nil,
	QualifyTool:          openCodeToolName,
	LaunchConfig:         openCodeLaunchConfig,
	LaunchConfigEnv:      "OPENCODE_CONFIG_CONTENT",
	PromptFocus:          workspaceFocus,
	LaunchInstructions:   openCodeInstructions,
	AsksWithoutArguments: true,
	ListsNewSessions:     true,
	MCPInLaunchConfig:    true,
	DropsEarlyCancel:     true,
}

// AGENTS.md is the first file the engine reads, so writing it also shadows the user's ~/.claude/CLAUDE.md.
func openCodeInstructions(in LaunchInput) (string, []byte) {
	return "AGENTS.md", []byte(chatOutputStyle + "\n\n" + boardKnowledgeFor(in.BoardName) + "\n")
}

var dialects = map[airuntime.AgentID]Dialect{
	airuntime.AgentClaude:   claudeDialect,
	airuntime.AgentOpenCode: openCodeDialect,
}

// An error, not a default: another engine's naming would disable auto-approval without saying so.
func DialectFor(id airuntime.AgentID) (Dialect, error) {
	d, ok := dialects[id]
	if !ok {
		return Dialect{}, fmt.Errorf("agent: no dialect for %q", id)
	}
	return d, nil
}

// Fixed for the life of the process, which is why the per-session focus is not here.
type LaunchInput struct {
	BoardName  string
	MCPServers []MCPServer
}

// Merged last, so it beats any file — except the listening address, global-scope only and pinned on argv.
func openCodeLaunchConfig(in LaunchInput) (string, error) {
	perm := map[string]any{
		// Denied, not prompted: App Lab owns board I/O. The HTTP API's shell routes need the credential.
		"bash":               "deny", // only a bare deny drops the tool: kept, a command its parser cannot read runs unchecked
		"task":               "deny",
		"webfetch":           "deny",
		"websearch":          "deny",
		"external_directory": map[string]any{"*": "deny"},
	}
	for _, s := range in.MCPServers {
		// Ask by default, then allow the read-only tools by name: the envelope's allowedTools, restated.
		perm[openCodeToolName(boardMCPServerName, "*")] = "ask"
		for _, t := range s.ReadOnlyTools {
			if isNeverAutoApprovable(t) {
				continue // never silently approved, whatever the list says
			}
			perm[openCodeToolName(boardMCPServerName, t)] = "allow"
		}
	}

	cfg := map[string]any{
		"permission": perm,
		// On build only: the global rules are merged after each agent's own, so a global edit rule would let plan mode edit.
		"agent": map[string]any{"build": map[string]any{"permission": map[string]any{"edit": "ask"}}},
		// Stops the user's own ~/.claude/CLAUDE.md being read when our AGENTS.md is absent.
		"disableClaudeCodePrompt": true,
		"server":                  map[string]any{"hostname": "127.0.0.1", "mdns": false},
		// Both start host processes no permission rule reaches; off by default, pinned against an update or a user config.
		"formatter": false,
		"lsp":       false,
	}
	if mcp := openCodeMCP(in.MCPServers); len(mcp) > 0 {
		cfg["mcp"] = mcp
	}
	out, err := json.Marshal(cfg)
	if err != nil {
		return "", fmt.Errorf("agent: build OpenCode launch config: %w", err)
	}
	return string(out), nil
}

func openCodeMCP(servers []MCPServer) map[string]any {
	out := make(map[string]any, len(servers))
	for _, s := range servers {
		server := map[string]any{
			"type":    "remote",
			"url":     s.URL,
			"enabled": true,
			"headers": map[string]string{"Authorization": "Bearer " + s.Token},
		}
		if s.CallTimeout > 0 {
			server["timeout"] = s.CallTimeout.Milliseconds()
		}
		out[boardMCPServerName] = server
	}
	return out
}
