package agent

import "testing"

// The disallow list must reach the adapter via session _meta (claudeCode.options.disallowedTools) — the shape the adapter actually reads.
func TestClaudeSessionMetaDisallowsMutatingTools(t *testing.T) {
	cc, ok := claudeSessionMeta(nil, "", SessionWorkspace{})["claudeCode"].(map[string]any)
	if !ok {
		t.Fatal("meta missing claudeCode")
	}
	opts, ok := cc["options"].(map[string]any)
	if !ok {
		t.Fatal("meta missing claudeCode.options")
	}
	disallowed, ok := opts["disallowedTools"].([]string)
	if !ok {
		t.Fatalf("disallowedTools not a []string: %T", opts["disallowedTools"])
	}
	has := func(tool string) bool {
		for _, d := range disallowed {
			if d == tool {
				return true
			}
		}
		return false
	}
	// Fully blocked: no agent shell (Bash), no notebooks (NotebookEdit).
	for _, tool := range []string{"Bash", "NotebookEdit"} {
		if !has(tool) {
			t.Errorf("policy must disallow %q, got %v", tool, disallowed)
		}
	}
	// Editing tools stay permission-gated (they edit the app mirror), so they must NOT be disallowed.
	for _, tool := range []string{"Edit", "Write", "MultiEdit"} {
		if has(tool) {
			t.Errorf("policy must not disallow %q (it's permission-gated), got %v", tool, disallowed)
		}
	}
}

// The separator belongs to the engine; a false here is an "always" grant on the board's shell.
func TestNeverAutoApprovableMatchesAnyEngineNaming(t *testing.T) {
	mustMatch := []string{
		"board_exec",                     // bare, as our MCP server declares it
		"mcp__arduino-board__board_exec", // Claude's adapter
		"arduino-board_board_exec",       // OpenCode: a single underscore
		"arduino-board:board_exec",       // a colon-joining engine
	}
	for _, tool := range mustMatch {
		if !isNeverAutoApprovable(tool) {
			t.Errorf("isNeverAutoApprovable(%q) = false, want true", tool)
		}
	}

	mustNotMatch := []string{
		"apps_list",
		"mcp__arduino-board__apps_list",
		"arduino-board_apps_list",
		"xboard_exec",        // ends with our name but is a different tool
		"board_exec_dry_run", // starts with it, is not it
		"",
	}
	for _, tool := range mustNotMatch {
		if isNeverAutoApprovable(tool) {
			t.Errorf("isNeverAutoApprovable(%q) = true, want false", tool)
		}
	}
}
