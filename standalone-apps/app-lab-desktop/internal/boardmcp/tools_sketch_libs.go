package boardmcp

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type sketchLibInput struct {
	ID      string `json:"id" jsonschema:"the app id from apps_list, e.g. user:my-app"`
	Library string `json:"library" jsonschema:"the library as 'Name' or 'Name@Version' (omit the version for the latest), e.g. Servo or Servo@1.2.0"`
}

// registerSketchLibrariesList adds sketch_libraries_list (read-only): the app sketch's Arduino libraries + their dependencies.
func registerSketchLibrariesList(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "sketch_libraries_list",
		Description: "List the Arduino libraries used by an app's sketch on the connected board: the explicitly-added `libraries` and the `dependencies` they pull in. Read-only. Pass the app id from apps_list.",
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appActionInput) (*mcp.CallToolResult, any, error) {
		id := strings.TrimSpace(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		body, err := orchestratorGet(ctx, access, "/v1/apps/"+url.PathEscape(id)+"/sketch/libraries")
		if err != nil {
			return nil, nil, err
		}
		return textResult(body), nil, nil
	})
	return "sketch_libraries_list"
}

// registerSketchLibrariesAdd adds sketch_libraries_add (mutating). Off the read-only allowlist so the agent must get user permission first.
func registerSketchLibrariesAdd(srv *mcp.Server, access BoardAccess) {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "sketch_libraries_add",
		Description: "Add an Arduino library (with its dependencies) to an app's sketch on the connected board. Pass the app id from apps_list and the library as 'Name' or 'Name@Version' (omit the version for the latest). Mutating — asks the user for permission. Example apps can't be altered. Returns the libraries that were added.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: false},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in sketchLibInput) (*mcp.CallToolResult, any, error) {
		id, lib := strings.TrimSpace(in.ID), strings.TrimSpace(in.Library)
		if id == "" || lib == "" {
			return nil, nil, fmt.Errorf("app id and library are required")
		}
		// add_deps=true: an Arduino library's dependencies are needed for the sketch to compile.
		path := "/v1/apps/" + url.PathEscape(id) + "/sketch/libraries/" + url.PathEscape(lib) + "?add_deps=true"
		body, err := orchestratorRequest(ctx, access, http.MethodPut, path, nil)
		if err != nil {
			return nil, nil, err
		}
		return textResult(body), nil, nil
	})
}

// registerSketchLibrariesRemove adds sketch_libraries_remove (mutating). Off the read-only allowlist so the agent must get user permission first.
func registerSketchLibrariesRemove(srv *mcp.Server, access BoardAccess) {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "sketch_libraries_remove",
		Description: "Remove an Arduino library from an app's sketch on the connected board; its dependencies are left in place (they may be shared with other libraries). Pass the app id from apps_list and the library as 'Name' or 'Name@Version'. Mutating — asks the user for permission. Example apps can't be altered. Returns the libraries that were removed.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: false},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in sketchLibInput) (*mcp.CallToolResult, any, error) {
		id, lib := strings.TrimSpace(in.ID), strings.TrimSpace(in.Library)
		if id == "" || lib == "" {
			return nil, nil, fmt.Errorf("app id and library are required")
		}
		path := "/v1/apps/" + url.PathEscape(id) + "/sketch/libraries/" + url.PathEscape(lib)
		body, err := orchestratorRequest(ctx, access, http.MethodDelete, path, nil)
		if err != nil {
			return nil, nil, err
		}
		return textResult(body), nil, nil
	})
}
