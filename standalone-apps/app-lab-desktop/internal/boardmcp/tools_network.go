package boardmcp

import (
	"context"
	"encoding/json"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// registerWifiStatus adds wifi_status (read-only) and returns its name for the auto-approve allowlist.
func registerWifiStatus(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "wifi_status",
		Description: "Report the connected board's network status: Wi-Fi state (connected/connecting/disconnected), the active connection name, and whether the board can reach the internet (bricks and AI models need it online). Read-only.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, _ noArgs) (*mcp.CallToolResult, any, error) {
		status, err := access.NetworkStatus(ctx)
		if err != nil {
			return nil, nil, err
		}
		j, err := json.MarshalIndent(status, "", "  ")
		if err != nil {
			return nil, nil, err
		}
		return textResult(string(j)), nil, nil
	})
	return "wifi_status"
}
