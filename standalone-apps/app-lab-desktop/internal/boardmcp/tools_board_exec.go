package boardmcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// boardExecInput is the board_exec escape hatch's arguments: the command, an optional cwd, and a required reason.
type boardExecInput struct {
	Command string `json:"command" jsonschema:"the shell command to run on the board (POSIX sh)"`
	Cwd     string `json:"cwd,omitempty" jsonschema:"optional working directory on the board"`
	Reason  string `json:"reason" jsonschema:"why this command is needed and why no dedicated arduino-board tool fits (shown to the user for approval)"`
}

// registerBoardExec adds board_exec (mutating, last-resort escape hatch — §2.8). Kept off the read-only allowlist so it
// always prompts; the UI also strips its "always allow" option so it can never be auto-approved (§6-J).
func registerBoardExec(srv *mcp.Server, access BoardAccess) {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "board_exec",
		Description: "Run a shell command on the connected board — LAST RESORT. Prefer the dedicated arduino-board tools (apps_*, bricks_*, app_bricks_*, models_*, wifi_status, board_status); use board_exec only when no dedicated tool fits — e.g. installing a dependency (pip/apt) or a one-off diagnostic. To view, read or edit an App's files use apps_checkout + the Read/Edit/Write tools — never cat or inspect app files via board_exec. Runs on the BOARD (not your machine) as the board user (sudo available). Mutating — always asks the user for permission; give a clear `reason`.",
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in boardExecInput) (*mcp.CallToolResult, any, error) {
		command := strings.TrimSpace(in.Command)
		if command == "" {
			return nil, nil, fmt.Errorf("command is required")
		}
		if strings.TrimSpace(in.Reason) == "" {
			return nil, nil, fmt.Errorf("reason is required (explain why board_exec instead of a dedicated tool)")
		}
		out, err := access.Exec(ctx, command, in.Cwd)
		if err != nil {
			return nil, nil, err
		}
		if strings.TrimSpace(out) == "" {
			out = "(command produced no output)"
		}
		return textResult(out), nil, nil
	})
}
