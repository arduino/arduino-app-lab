package boardmcp

import (
	"context"
	"encoding/json"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// registerBoardStatus adds board_status (read-only) and returns its name for the auto-approve allowlist.
func registerBoardStatus(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "board_status",
		Description: "Report which Arduino board App Lab is connected to (model/name and serial), so you can identify it before board-specific choices. Reports connected=false when no board is selected. Read-only.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, _ noArgs) (*mcp.CallToolResult, any, error) {
		status, err := access.SelectedBoard(ctx)
		if err != nil {
			return nil, nil, err
		}
		j, err := json.MarshalIndent(status, "", "  ")
		if err != nil {
			return nil, nil, err
		}
		return textResult(string(j)), nil, nil
	})
	return "board_status"
}

// registerBoardsList adds boards_list (read-only): the boards App Lab currently detects, flagging the selected one.
func registerBoardsList(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "boards_list",
		Description: "List the Arduino boards App Lab currently detects (over USB/serial, network and ADB); each is flagged whether it's the one currently selected. Read-only, takes no arguments. Note: every other tool acts on the SELECTED board — switching the selected board is done in App Lab's UI, not from here.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, _ noArgs) (*mcp.CallToolResult, any, error) {
		boards, err := access.ListBoards(ctx)
		if err != nil {
			return nil, nil, err
		}
		j, err := json.MarshalIndent(struct {
			Boards []BoardSummary `json:"boards"`
		}{Boards: boards}, "", "  ")
		if err != nil {
			return nil, nil, err
		}
		return textResult(string(j)), nil, nil
	})
	return "boards_list"
}
