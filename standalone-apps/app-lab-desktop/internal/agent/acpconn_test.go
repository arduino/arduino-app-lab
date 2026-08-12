package agent

import (
	"testing"

	acp "github.com/coder/acp-go-sdk"
)

func alwaysAndOnceOptions() []acp.PermissionOption {
	return []acp.PermissionOption{
		{OptionId: "allow_once", Name: "Allow", Kind: acp.PermissionOptionKind("allow_once")},
		{OptionId: "allow_always", Name: "Allow always", Kind: acp.PermissionOptionKind("allow_always")},
		{OptionId: "reject_once", Name: "Reject", Kind: acp.PermissionOptionKind("reject_once")},
	}
}

// "Always allow" is the user's call to make (Claude Code offers it), so it must reach the dialog untouched — App Lab only takes it away from board_exec.
func TestToPermissionRequestKeepsPersistentGrants(t *testing.T) {
	for _, title := range []string{"Write", "mcp__arduino-board__apps_start", "switch_mode"} {
		req := toPermissionRequest(acp.RequestPermissionRequest{
			SessionId: "s1",
			ToolCall:  acp.ToolCallUpdate{ToolCallId: "t1", Title: &title},
			Options:   alwaysAndOnceOptions(),
		})
		if len(req.Options) != 3 {
			t.Errorf("%s: every option must be offered, got %+v", title, req.Options)
		}
	}
}

// board_exec runs an arbitrary board shell, and a persistent grant on it is keyed on the tool name alone with nothing in App Lab to revoke it — so that one prompt stays per-call.
func TestToPermissionRequestDropsPersistentGrantsForBoardExec(t *testing.T) {
	for _, title := range []string{"board_exec", "mcp__arduino-board__board_exec"} {
		req := toPermissionRequest(acp.RequestPermissionRequest{
			SessionId: "s1",
			ToolCall:  acp.ToolCallUpdate{ToolCallId: "t1", Title: &title},
			Options: append(alwaysAndOnceOptions(),
				acp.PermissionOption{OptionId: "yolo-always-allow", Name: "Sure", Kind: acp.PermissionOptionKind("allow_once")}, // persistence hidden in the id
			),
		})
		if len(req.Options) != 2 {
			t.Fatalf("%s: only the per-call options may survive, got %+v", title, req.Options)
		}
		for _, o := range req.Options {
			if isPersistentGrantOption(o.ID, o.Kind) {
				t.Errorf("%s: option %+v grants beyond this call and must not be offered", title, o)
			}
		}
	}
}

func TestIsPersistentGrantOption(t *testing.T) {
	cases := map[string]struct {
		id, kind string
		want     bool
	}{
		"allow once":        {"allow_once", "allow_once", false},
		"reject once":       {"reject_once", "reject_once", false},
		"allow always":      {"allow_always", "allow_always", true},
		"reject always":     {"reject_always", "reject_always", true},
		"always in the id":  {"ALLOW_ALWAYS", "", true},
		"kind only":         {"opt-7", "allow_always", true},
		"unrelated option":  {"cancel", "", false},
		"mixed-case suffix": {"x", "Allow_Always", true},
	}
	for name, c := range cases {
		if got := isPersistentGrantOption(c.id, c.kind); got != c.want {
			t.Errorf("%s: isPersistentGrantOption(%q, %q) = %v, want %v", name, c.id, c.kind, got, c.want)
		}
	}
}
