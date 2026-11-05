package boardmcp

import (
	"context"
	"encoding/json"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// registerCarrierStatus adds carrier_status (read-only) and returns its name for the auto-approve allowlist.
func registerCarrierStatus(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name: "carrier_status",
		Description: "Report how the connected board's carrier (e.g. the Media Carrier, with its CSI camera and DSI display slots) is configured, " +
			"and which video/display nodes the kernel exposes. Read-only. " +
			"Call it for ANY question about a camera, a display or a carrier on this board, including one phrased as \"camera 0\" or \"camera 1\": those are this carrier's CSI slot names (camera0, camera1), NOT the Camera(source=N) index a brick takes in Python, and the slot options live only here. " +
			"A carrier being listed does NOT mean it is attached: the catalogue is built into the board's arduino-linux-config, so the slots appear on any board of this model. " +
			"When a carrier reports attached=unknown, answer \"cannot be determined from the board\" to any question about it being present or connected — never \"no\", not even as a headline you then qualify. " +
			"Anything named in \"unread\" could not be read at all, and so could an absent \"enabled\", \"option\" or \"devices\": say the board did not answer, and never report it as absent hardware or as disabled. An entry like \"carriers/media-carrier\" means that one carrier's configuration is the part that was not read. " +
			"When attached is absent the carrier is enabled, and the video/display nodes are then the evidence to judge by — unless they are named in \"unread\", in which case nothing here can settle it. " +
			"A CSI camera or DSI display is only visible as a node once its slot is enabled and the board rebooted, so a missing node says nothing about the hardware — report it as 'not configured', never as 'not present'. " +
			"The Venus encoder/decoder video nodes always exist and are not cameras. A DRM connector's status (e.g. DP-1 connected/disconnected) IS real detection and can be trusted as it stands. " +
			"Enabling a slot needs root and a reboot: it is not available here, so tell the user which option to set (e.g. camera0=type1-2lanes) instead of trying.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, _ noArgs) (*mcp.CallToolResult, any, error) {
		status, err := access.CarrierStatus(ctx)
		if err != nil {
			return nil, nil, err
		}
		if !status.Connected {
			return textResult("No board connected."), nil, nil
		}
		j, err := json.MarshalIndent(status, "", "  ")
		if err != nil {
			return nil, nil, err
		}
		return textResult(string(j)), nil, nil
	})
	return "carrier_status"
}
