package boardmcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// appBricksListInput identifies the app whose configured bricks to list.
type appBricksListInput struct {
	AppID string `json:"appId" jsonschema:"the app id from apps_list"`
}

// appBrickVariable is one of a brick's config variables: its name and whether it's set — never the value.
// Brick Configuration is where users keep secrets, and this read-only tool is auto-approved (unprompted).
type appBrickVariable struct {
	Name  string `json:"name"`
	IsSet bool   `json:"isSet"`
}

// appBrickInstance is the slimmed record of a brick wired into an app: what it is plus its current configuration.
type appBrickInstance struct {
	ID           string             `json:"id"`
	Name         string             `json:"name,omitempty"`
	Category     string             `json:"category,omitempty"`
	Status       string             `json:"status,omitempty"`
	RequireModel bool               `json:"requireModel,omitempty"`
	Model        string             `json:"model,omitempty"`
	Variables    []appBrickVariable `json:"variables,omitempty"`
}

// appBricksListDescription must say values are withheld, or the model reads their absence as a fault and reaches for board_exec.
const appBricksListDescription = "List the Bricks configured in a specific app: id, name, category, selected AI model, and which config variables are set — the bricks wired into that app's app.yaml. Config variable VALUES are never returned: they hold the user's secrets (API keys, tokens), so you get each variable's name and whether it has a value. If you need one, ask the user. Read-only; pass the app id from apps_list."

// registerAppBricksList adds app_bricks_list (read-only) and returns its name for the auto-approve allowlist.
func registerAppBricksList(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "app_bricks_list",
		Description: appBricksListDescription,
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appBricksListInput) (*mcp.CallToolResult, any, error) {
		appID := strings.TrimSpace(in.AppID)
		if appID == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		body, err := orchestratorGet(ctx, access, "/v1/apps/"+url.PathEscape(appID)+"/bricks")
		if err != nil {
			return nil, nil, err
		}
		shaped, err := shapeAppBricks(body)
		if err != nil {
			return nil, nil, err
		}
		return textResult(shaped), nil, nil
	})
	return "app_bricks_list"
}

// shapeAppBricks projects /v1/apps/{id}/bricks into a compact list of instances with their config (drops readme/author internals).
func shapeAppBricks(raw string) (string, error) {
	var resp struct {
		Bricks *[]struct {
			ID              *string `json:"id"`
			Name            *string `json:"name"`
			Category        *string `json:"category"`
			Status          *string `json:"status"`
			Model           *string `json:"model"`
			RequireModel    *bool   `json:"require_model"`
			ConfigVariables *[]struct {
				Name  *string `json:"name"`
				Value *string `json:"value"`
			} `json:"config_variables"`
		} `json:"bricks"`
	}
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		return "", fmt.Errorf("parse app bricks: %w", err)
	}

	out := struct {
		Bricks []appBrickInstance `json:"bricks"`
	}{Bricks: []appBrickInstance{}}
	if resp.Bricks != nil {
		for _, b := range *resp.Bricks {
			inst := appBrickInstance{
				ID:           strv(b.ID),
				Name:         strv(b.Name),
				Category:     strv(b.Category),
				Status:       strv(b.Status),
				Model:        strv(b.Model),
				RequireModel: b.RequireModel != nil && *b.RequireModel,
			}
			if b.ConfigVariables != nil {
				for _, v := range *b.ConfigVariables {
					if name := strv(v.Name); name != "" {
						inst.Variables = append(inst.Variables, appBrickVariable{
							Name:  name,
							IsSet: v.Value != nil && *v.Value != "",
						})
					}
				}
				sort.Slice(inst.Variables, func(i, j int) bool { return inst.Variables[i].Name < inst.Variables[j].Name })
			}
			out.Bricks = append(out.Bricks, inst)
		}
	}

	j, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return "", err
	}
	return string(j), nil
}

// appBrickWriteInput adds or updates a brick in an app: the target brick plus an optional model and config variables.
type appBrickWriteInput struct {
	AppID     string            `json:"appId" jsonschema:"the app id from apps_list"`
	BrickID   string            `json:"brickId" jsonschema:"the catalog brick id from bricks_list, e.g. arduino:video_object_detection"`
	Model     string            `json:"model,omitempty" jsonschema:"optional: the AI model id for the brick (from bricks_get compatibleModels), when it requires one"`
	Variables map[string]string `json:"variables,omitempty" jsonschema:"optional: brick config variables as name->value; see bricks_get configVariables"`
}

// brickWriteBody is the orchestrator's PUT/PATCH body for a brick instance (model + config variables, both optional).
type brickWriteBody struct {
	Model     *string            `json:"model,omitempty"`
	Variables *map[string]string `json:"variables,omitempty"`
}

// body builds the orchestrator request body, sending only the fields the caller set.
func (in appBrickWriteInput) body() ([]byte, error) {
	b := brickWriteBody{}
	if m := strings.TrimSpace(in.Model); m != "" {
		b.Model = &m
	}
	if len(in.Variables) > 0 {
		v := in.Variables
		b.Variables = &v
	}
	return json.Marshal(b)
}

// registerAppBricksAdd adds app_bricks_add (mutating: wires a catalog brick into an app; kept off the read-only allowlist so it's permission-gated).
func registerAppBricksAdd(srv *mcp.Server, access BoardAccess) {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "app_bricks_add",
		Description: "Add a catalog Brick to an app: wires it into the app's app.yaml, with an optional AI model and config variables. Mutating — asks the user for permission. Pass the app id (apps_list) and the catalog brick id (bricks_list); read bricks_get first for the brick's required config.",
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appBrickWriteInput) (*mcp.CallToolResult, any, error) {
		appID, brickID := strings.TrimSpace(in.AppID), strings.TrimSpace(in.BrickID)
		if appID == "" || brickID == "" {
			return nil, nil, fmt.Errorf("app id and brick id are required")
		}
		body, err := in.body()
		if err != nil {
			return nil, nil, err
		}
		path := "/v1/apps/" + url.PathEscape(appID) + "/bricks/" + url.PathEscape(brickID)
		if _, err := orchestratorRequest(ctx, access, http.MethodPut, path, body); err != nil {
			return nil, nil, err
		}
		return textResult(fmt.Sprintf("Added brick %q to app %q. Remember to import it in the app's code (from arduino.app_bricks…).", brickID, appID)), nil, nil
	})
}

// registerAppBricksUpdate adds app_bricks_update (mutating: change a configured brick's model/variables; permission-gated).
func registerAppBricksUpdate(srv *mcp.Server, access BoardAccess) {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "app_bricks_update",
		Description: "Update a Brick already configured in an app: change its selected AI model and/or its config variables. Mutating — asks the user for permission. Pass the app id, the brick id (app_bricks_list), and the fields to change.",
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appBrickWriteInput) (*mcp.CallToolResult, any, error) {
		appID, brickID := strings.TrimSpace(in.AppID), strings.TrimSpace(in.BrickID)
		if appID == "" || brickID == "" {
			return nil, nil, fmt.Errorf("app id and brick id are required")
		}
		body, err := in.body()
		if err != nil {
			return nil, nil, err
		}
		path := "/v1/apps/" + url.PathEscape(appID) + "/bricks/" + url.PathEscape(brickID)
		if _, err := orchestratorRequest(ctx, access, http.MethodPatch, path, body); err != nil {
			return nil, nil, err
		}
		return textResult(fmt.Sprintf("Updated brick %q in app %q.", brickID, appID)), nil, nil
	})
}

// appBrickRemoveInput identifies the brick to remove from an app.
type appBrickRemoveInput struct {
	AppID   string `json:"appId" jsonschema:"the app id from apps_list"`
	BrickID string `json:"brickId" jsonschema:"the brick id to remove, from app_bricks_list"`
}

// registerAppBricksRemove adds app_bricks_remove (mutating: unwires a brick from an app; permission-gated).
func registerAppBricksRemove(srv *mcp.Server, access BoardAccess) {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "app_bricks_remove",
		Description: "Remove a Brick from an app: unwires it from the app's app.yaml. Mutating — asks the user for permission. Pass the app id and the brick id (app_bricks_list). Also remove its import from the app's code.",
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appBrickRemoveInput) (*mcp.CallToolResult, any, error) {
		appID, brickID := strings.TrimSpace(in.AppID), strings.TrimSpace(in.BrickID)
		if appID == "" || brickID == "" {
			return nil, nil, fmt.Errorf("app id and brick id are required")
		}
		path := "/v1/apps/" + url.PathEscape(appID) + "/bricks/" + url.PathEscape(brickID)
		if _, err := orchestratorRequest(ctx, access, http.MethodDelete, path, nil); err != nil {
			return nil, nil, err
		}
		return textResult(fmt.Sprintf("Removed brick %q from app %q.", brickID, appID)), nil, nil
	})
}
