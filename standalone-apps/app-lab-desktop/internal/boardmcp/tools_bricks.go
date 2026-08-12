package boardmcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// registerBricksList adds bricks_list (read-only) and returns its name for the auto-approve allowlist.
func registerBricksList(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "bricks_list",
		Description: "List the Bricks available on the connected board (id, name, category, description, whether it needs an AI model) — the building blocks declared in an app's app.yaml. Read-only.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, _ noArgs) (*mcp.CallToolResult, any, error) {
		body, err := orchestratorGet(ctx, access, "/v1/bricks")
		if err != nil {
			return nil, nil, err
		}
		shaped, err := shapeBricksList(body)
		if err != nil {
			return nil, nil, err
		}
		return textResult(shaped), nil, nil
	})
	return "bricks_list"
}

// shapeBricksList projects the orchestrator's /v1/bricks response into a compact catalog (drops author/status internals).
func shapeBricksList(raw string) (string, error) {
	var resp struct {
		Bricks *[]struct {
			Category     *string `json:"category"`
			Description  *string `json:"description"`
			ID           *string `json:"id"`
			Name         *string `json:"name"`
			RequireModel *bool   `json:"require_model"`
		} `json:"bricks"`
	}
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		return "", fmt.Errorf("parse bricks response: %w", err)
	}

	out := struct {
		Bricks []brickEntry `json:"bricks"`
	}{Bricks: []brickEntry{}}
	if resp.Bricks != nil {
		for _, b := range *resp.Bricks {
			out.Bricks = append(out.Bricks, brickEntry{
				ID:           strv(b.ID),
				Name:         strv(b.Name),
				Category:     strv(b.Category),
				Description:  strv(b.Description),
				RequireModel: b.RequireModel != nil && *b.RequireModel,
			})
		}
	}

	j, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return "", err
	}
	return string(j), nil
}

type brickGetInput struct {
	ID string `json:"id" jsonschema:"the brick id from bricks_list, e.g. arduino:video_object_detection"`
}

// brickConfigVar is one configurable variable a brick exposes (set in Brick Configuration).
type brickConfigVar struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Required    bool   `json:"required,omitempty"`
}

// brickDetail is the slimmed-down single-brick record: the README (API) plus what's needed to configure and use it.
type brickDetail struct {
	ID               string           `json:"id"`
	Name             string           `json:"name"`
	Category         string           `json:"category,omitempty"`
	Description      string           `json:"description,omitempty"`
	RequireModel     bool             `json:"requireModel,omitempty"`
	Readme           string           `json:"readme,omitempty"`
	ConfigVariables  []brickConfigVar `json:"configVariables,omitempty"`
	CompatibleModels []string         `json:"compatibleModels,omitempty"`
}

// registerBricksGet adds bricks_get (read-only) and returns its name for the auto-approve allowlist.
func registerBricksGet(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "bricks_get",
		Description: "Get one Brick's full details on the connected board: its README (Python class, methods, examples), config variables, and compatible AI models — read this before using a brick in code. Read-only; pass the brick id from bricks_list.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in brickGetInput) (*mcp.CallToolResult, any, error) {
		id := strings.TrimSpace(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("brick id is required")
		}
		body, err := orchestratorGet(ctx, access, "/v1/bricks/"+url.PathEscape(id))
		if err != nil {
			return nil, nil, err
		}
		shaped, err := shapeBrickDetail(body)
		if err != nil {
			return nil, nil, err
		}
		return textResult(shaped), nil, nil
	})
	return "bricks_get"
}

// shapeBrickDetail projects the orchestrator's /v1/bricks/{id} response into a compact record (keeps the README, drops author/status/used_by internals).
func shapeBrickDetail(raw string) (string, error) {
	var resp struct {
		Category         *string `json:"category"`
		CompatibleModels *[]struct {
			ID   *string `json:"id"`
			Name *string `json:"name"`
		} `json:"compatible_models"`
		ConfigVariables *[]struct {
			Name        *string `json:"name"`
			Description *string `json:"description"`
			Required    *bool   `json:"required"`
		} `json:"config_variables"`
		Description  *string `json:"description"`
		ID           *string `json:"id"`
		Name         *string `json:"name"`
		Readme       *string `json:"readme"`
		RequireModel *bool   `json:"require_model"`
	}
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		return "", fmt.Errorf("parse brick detail: %w", err)
	}

	out := brickDetail{
		ID:           strv(resp.ID),
		Name:         strv(resp.Name),
		Category:     strv(resp.Category),
		Description:  strv(resp.Description),
		RequireModel: resp.RequireModel != nil && *resp.RequireModel,
		Readme:       strv(resp.Readme),
	}
	if resp.ConfigVariables != nil {
		for _, v := range *resp.ConfigVariables {
			out.ConfigVariables = append(out.ConfigVariables, brickConfigVar{
				Name:        strv(v.Name),
				Description: strv(v.Description),
				Required:    v.Required != nil && *v.Required,
			})
		}
	}
	if resp.CompatibleModels != nil {
		for _, m := range *resp.CompatibleModels {
			name := strv(m.Name)
			if name == "" {
				name = strv(m.ID)
			}
			if name != "" {
				out.CompatibleModels = append(out.CompatibleModels, name)
			}
		}
	}

	j, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return "", err
	}
	return string(j), nil
}
