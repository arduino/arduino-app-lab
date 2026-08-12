package boardmcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// modelsListInput optionally narrows the list to models compatible with one brick.
type modelsListInput struct {
	Brick string `json:"brick,omitempty" jsonschema:"optional: filter to models compatible with this brick id (from bricks_list)"`
}

// modelItem is the slimmed record of an AI model on the board: what it is, which bricks use it, and whether it ships built-in.
type modelItem struct {
	ID          string   `json:"id"`
	Name        string   `json:"name,omitempty"`
	Description string   `json:"description,omitempty"`
	Builtin     bool     `json:"builtin,omitempty"`
	BrickIDs    []string `json:"brickIds,omitempty"`
}

// registerModelsList adds models_list (read-only) and returns its name for the auto-approve allowlist.
func registerModelsList(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "models_list",
		Description: "List the AI models available on the connected board (id, name, description, which bricks use them, and whether they're built-in). Read-only; optionally pass `brick` to show only the models compatible with that brick (from bricks_list).",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in modelsListInput) (*mcp.CallToolResult, any, error) {
		path := "/v1/models"
		if b := strings.TrimSpace(in.Brick); b != "" {
			path += "?bricks=" + url.QueryEscape(b)
		}
		body, err := orchestratorGet(ctx, access, path)
		if err != nil {
			return nil, nil, err
		}
		shaped, err := shapeModelsList(body)
		if err != nil {
			return nil, nil, err
		}
		return textResult(shaped), nil, nil
	})
	return "models_list"
}

// shapeModelsList projects /v1/models into a compact catalog (drops disk_usage/runner/metadata internals).
func shapeModelsList(raw string) (string, error) {
	var resp struct {
		Models *[]struct {
			ID          *string   `json:"id"`
			Name        *string   `json:"name"`
			Description *string   `json:"description"`
			IsBuiltin   *bool     `json:"is_builtin"`
			BrickIds    *[]string `json:"brick_ids"`
		} `json:"models"`
	}
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		return "", fmt.Errorf("parse models: %w", err)
	}

	out := struct {
		Models []modelItem `json:"models"`
	}{Models: []modelItem{}}
	if resp.Models != nil {
		for _, m := range *resp.Models {
			item := modelItem{
				ID:          strv(m.ID),
				Name:        strv(m.Name),
				Description: strv(m.Description),
				Builtin:     m.IsBuiltin != nil && *m.IsBuiltin,
			}
			if m.BrickIds != nil {
				item.BrickIDs = *m.BrickIds
			}
			out.Models = append(out.Models, item)
		}
	}

	j, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return "", err
	}
	return string(j), nil
}

// modelDeleteInput identifies the model to delete.
type modelDeleteInput struct {
	ID string `json:"id" jsonschema:"the model id to delete, from models_list"`
}

// registerModelsDelete adds models_delete (mutating: removes an installed model; permission-gated).
func registerModelsDelete(srv *mcp.Server, access BoardAccess) {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "models_delete",
		Description: "Delete an installed AI model from the connected board, freeing its disk space. Mutating — asks the user for permission. Pass the model id (models_list); built-in models can't be removed.",
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in modelDeleteInput) (*mcp.CallToolResult, any, error) {
		id := strings.TrimSpace(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("model id is required")
		}
		if _, err := orchestratorRequest(ctx, access, http.MethodDelete, "/v1/models/"+url.PathEscape(id), nil); err != nil {
			return nil, nil, err
		}
		return textResult(fmt.Sprintf("Deleted model %q.", id)), nil, nil
	})
}
