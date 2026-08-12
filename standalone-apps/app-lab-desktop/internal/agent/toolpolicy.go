package agent

import "strings"

// nativeMutatingTools: Claude engine tools kept fully disallowed via the adapter session _meta (the
// --disallowedTools CLI flag is ignored by claude-agent-acp): Bash (no agent shell — App Lab owns board
// I/O) and NotebookEdit (no notebooks in apps). Edit/Write/MultiEdit are intentionally NOT here — they're
// allowed but permission-gated, editing the app mirror (internal/appmirror) so changes sync to the board.
var nativeMutatingTools = []string{"Bash", "NotebookEdit"}

// neverAutoApprovable: tools that must always be human-confirmed — dropped from the allowedTools list, and denied any "always" option on their permission prompt. board_exec (arbitrary board shell) is the case that matters: a persistent grant is keyed on the tool name alone, and App Lab can neither list nor revoke it. Match it through isNeverAutoApprovable, never by bare lookup.
var neverAutoApprovable = map[string]bool{"board_exec": true}

// isNeverAutoApprovable matches a tool by bare name ("board_exec") or by MCP-qualified call title ("mcp__arduino-board__board_exec").
func isNeverAutoApprovable(tool string) bool {
	if i := strings.LastIndex(tool, "__"); i >= 0 {
		tool = tool[i+len("__"):]
	}
	return neverAutoApprovable[tool]
}
