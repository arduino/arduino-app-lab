package agent

import "strings"

// nativeMutatingTools: Claude engine tools kept fully disallowed via the adapter session _meta (the
// --disallowedTools CLI flag is ignored by claude-agent-acp): Bash (no agent shell — App Lab owns board
// I/O) and NotebookEdit (no notebooks in apps). Edit/Write/MultiEdit are intentionally NOT here — they're
// allowed but permission-gated, editing the app mirror (internal/appmirror) so changes sync to the board.
var nativeMutatingTools = []string{"Bash", "NotebookEdit"}

// neverAutoApprovable: tools that must always be human-confirmed — dropped from the allowedTools list, and denied any "always" option on their permission prompt. board_exec (arbitrary board shell) is the case that matters: a persistent grant is keyed on the tool name alone, and App Lab can neither list nor revoke it. Match it through isNeverAutoApprovable, never by bare lookup.
var neverAutoApprovable = map[string]bool{"board_exec": true}

// Matched against the whole title: the separator is the engine's choice, and a false grants the shell.
func isNeverAutoApprovable(tool string) bool {
	for name := range neverAutoApprovable {
		if denotesTool(tool, name) {
			return true
		}
	}
	return false
}

// The separator check stops a longer name ending in ours ("xboard_exec") from matching.
func denotesTool(title, name string) bool {
	if title == name {
		return true
	}
	if !strings.HasSuffix(title, name) {
		return false
	}
	switch title[len(title)-len(name)-1] {
	case '_', '-', ':', '.', '/':
		return true
	}
	return false
}
