package agent

import "testing"

// The disallow list must reach the adapter via session _meta (claudeCode.options.disallowedTools) — the shape the adapter actually reads.
func TestClaudeSessionMetaDisallowsMutatingTools(t *testing.T) {
	cc, ok := claudeSessionMeta(nil, "")["claudeCode"].(map[string]any)
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
