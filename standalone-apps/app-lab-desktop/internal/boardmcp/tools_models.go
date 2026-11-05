package boardmcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"app-lab-desktop/internal/appid"
)

// modelStatusInstalled is the /v1/models status of a model actually present on the board; anything else is on offer.
const modelStatusInstalled = "installed"

// modelSourceEdgeImpulse is the metadata source of a model that came from Edge Impulse rather than a public catalog.
const modelSourceEdgeImpulse = "edgeimpulse"

// modelsListInput optionally narrows the list to models compatible with one brick.
type modelsListInput struct {
	Brick string `json:"brick,omitempty" jsonschema:"optional: filter to models compatible with this brick id (from bricks_list)"`
}

// modelItem is the slimmed record of an AI model the board knows about. Installed says whether it is actually on
// the board: /v1/models also lists models that are merely offered for download, and only an installed one can run.
type modelItem struct {
	ID          string   `json:"id"`
	Name        string   `json:"name,omitempty"`
	Description string   `json:"description,omitempty"`
	Installed   bool     `json:"installed"`
	Builtin     bool     `json:"builtin,omitempty"`
	SizeBytes   int64    `json:"sizeBytes,omitempty"`
	BrickIDs    []string `json:"brickIds,omitempty"`
	// Who the model comes from: edgeimpulse, qualcomm-ai-hub, huggingface, ... — the same value the UI labels it with.
	Source    string `json:"source,omitempty"`
	Publisher string `json:"publisher,omitempty"`
	Runtime   string `json:"runtime,omitempty"`
	// Whether models_install can fetch it: a listed model with no download URL is one only the user can bring in.
	Installable bool `json:"installable"`
	// Set for a model that came from an Edge Impulse project, so it can be named as the user's own custom model.
	EdgeImpulse *edgeImpulseRef `json:"edgeImpulse,omitempty"`
}

// edgeImpulseRef is the Edge Impulse provenance the board records in a model's metadata.
type edgeImpulseRef struct {
	ProjectID   string `json:"projectId,omitempty"`
	ImpulseID   string `json:"impulseId,omitempty"`
	ImpulseName string `json:"impulseName,omitempty"`
}

// registerModelsList adds models_list (read-only) and returns its name for the auto-approve allowlist.
func registerModelsList(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "models_list",
		Description: "List the AI models the connected board knows about: id, name, description, which bricks use them, and where each comes from (`source` — edgeimpulse, qualcomm-ai-hub, huggingface, ...; plus publisher and runtime). The list includes models that are not on the board yet: `installed: false` means an app using it cannot run until it is put there, and `installable: true` means models_install can fetch it by id. Everything listed here is fetchable by id when `installable: true`, Edge Impulse models included — models_import_custom is only for one of the user's Edge Impulse impulses that this list does not contain at all. Read-only; optionally pass `brick` to show only the models compatible with that brick (from bricks_list).",
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
			ID          *string            `json:"id"`
			Name        *string            `json:"name"`
			Description *string            `json:"description"`
			Status      *string            `json:"status"`
			IsBuiltin   *bool              `json:"is_builtin"`
			Size        *int64             `json:"size"`
			Metadata    *map[string]string `json:"metadata"`
			BrickIds    *[]string          `json:"brick_ids"`
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
				Installed:   strv(m.Status) == modelStatusInstalled,
				Builtin:     m.IsBuiltin != nil && *m.IsBuiltin,
			}
			if m.Size != nil {
				item.SizeBytes = *m.Size
			}
			if m.BrickIds != nil {
				item.BrickIDs = *m.BrickIds
			}
			// No source — no metadata at all included — means Edge Impulse, the same default the UI applies, so agent and UI never disagree.
			item.Source = modelSourceEdgeImpulse
			if m.Metadata != nil {
				md := *m.Metadata
				if ref := (edgeImpulseRef{ProjectID: md["ei-project-id"], ImpulseID: md["ei-impulse-id"], ImpulseName: md["ei-impulse-name"]}); ref != (edgeImpulseRef{}) {
					item.EdgeImpulse = &ref
				}
				if src := md["source"]; src != "" {
					item.Source = src
				}
				item.Publisher, item.Runtime = md["publisher"], md["runtime"]
				// Anything the board lists is fetchable by id, Edge Impulse included: only a model it does not list yet needs the user's key.
				item.Installable = !item.Installed && md["source-model-url"] != ""
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

// modelInstallInput identifies the model to put on the board.
type modelInstallInput struct {
	ID string `json:"id" jsonschema:"the model id to install, from models_list (one with installable: true)"`
}

// registerModelsInstall adds models_install (mutating: downloads a model onto the board; permission-gated).
func registerModelsInstall(srv *mcp.Server, access BoardAccess, installs *ModelInstaller) {
	mcp.AddTool(srv, &mcp.Tool{
		Name: "models_install",
		Description: "Download an AI model onto the connected board so a Brick can use it. Pass the id of a model models_list reports as `installable: true`; an app whose brick selects a model that is not installed cannot run until this succeeds. " +
			"Mutating — asks the user for permission. A small model finishes inside this call; a large one (an LLM runs to hundreds of MB) keeps downloading in the background and this returns as soon as it is safely under way, with the progress so far — then call models_wait_installed to follow it. " +
			"NEVER call models_install again for a model that is still downloading: the board would throw the partial file away and start over. (After a download that actually failed, restarting with this tool is the right move.) It can only fetch what models_list already contains: a model of the user's own that the board has never seen comes in through models_import_custom instead.",
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in modelInstallInput) (*mcp.CallToolResult, any, error) {
		id := strings.TrimSpace(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("model id is required")
		}
		// Asking for a model the board already holds would make it re-fetch the whole file for nothing.
		if installed, err := modelIsInstalled(ctx, access, id); err == nil && installed {
			return textResult(fmt.Sprintf("Model %q is already installed on the board.", id)), nil, nil
		}
		run, joined := installs.start(access, id)
		select {
		case <-run.done:
			res, err := installOutcome(ctx, access, id, run)
			return res, nil, err
		case <-time.After(modelInstallHandoffWait):
		case <-ctx.Done(): // the agent stopped waiting; the download carries on regardless
		}
		verb := "Downloading"
		if joined {
			verb = "Already downloading"
		}
		return textResult(fmt.Sprintf("%s %q onto the board%s. It continues in the background: follow it with models_wait_installed, and do NOT call models_install again for it — a second request makes the board discard the partial download and restart from zero.", verb, id, progressSuffix(run))), nil, nil
	})
}

// modelWaitInput identifies the model whose download to wait on.
type modelWaitInput struct {
	ID         string `json:"id" jsonschema:"the model id being installed, from models_install"`
	TimeoutSec int    `json:"timeout_sec,omitempty" jsonschema:"how long to wait, in seconds (default 300, max 480); if it returns still downloading, just call again"`
}

const (
	// Long on purpose: one call should cover a whole slow download, so the agent does not burn a turn every 45s to re-ask.
	modelWaitDefault = 5 * time.Minute
	modelWaitMax     = 8 * time.Minute
	modelWaitPoll    = 2 * time.Second
)

// registerModelsWaitInstalled adds models_wait_installed (read-only) and returns its name for the auto-approve allowlist.
func registerModelsWaitInstalled(srv *mcp.Server, access BoardAccess, installs *ModelInstaller) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "models_wait_installed",
		Description: "After models_install handed a large download off to the background, wait for it to land. Checks the board server-side and returns as soon as the model is installed (or the download failed), or when the wait budget elapses, reporting how far it has got. Read-only — this is how you follow a download: re-calling models_install would restart it from zero. Pass the model id; optionally timeout_sec (default 300, max 480). One call normally covers the whole download. If it returns still downloading, just call it again.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in modelWaitInput) (*mcp.CallToolResult, any, error) {
		id := strings.TrimSpace(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("model id is required")
		}
		timeout := modelWaitDefault
		if in.TimeoutSec > 0 {
			timeout = time.Duration(in.TimeoutSec) * time.Second
		}
		if timeout > modelWaitMax {
			timeout = modelWaitMax
		}
		deadline := time.Now().Add(timeout)
		for {
			installed, err := modelIsInstalled(ctx, access, id)
			if err != nil {
				return nil, nil, err
			}
			if installed {
				return textResult(fmt.Sprintf("Installed model %q on the board. A brick already configured with it picks it up on the app's next start.", id)), nil, nil
			}
			run := installs.lookup(id)
			if run == nil {
				return textResult(fmt.Sprintf("No download is running for %q and the board does not have it — call models_install to start one.", id)), nil, nil
			}
			if run.ended() {
				res, outErr := installOutcome(ctx, access, id, run)
				return res, nil, outErr
			}
			if !time.Now().Before(deadline) {
				return textResult(fmt.Sprintf("Still downloading %q%s. Call models_wait_installed again to keep waiting.", id, progressSuffix(run))), nil, nil
			}
			select {
			case <-ctx.Done():
				return nil, nil, ctx.Err()
			case <-time.After(modelWaitPoll):
			}
		}
	})
	return "models_wait_installed"
}

// modelIsInstalled re-reads one model and reports whether the board now holds it.
func modelIsInstalled(ctx context.Context, access BoardAccess, id string) (bool, error) {
	body, err := orchestratorGet(ctx, access, "/v1/models/"+url.PathEscape(id))
	if err != nil {
		return false, err
	}
	var detail struct {
		Status *string `json:"status"`
	}
	if err := json.Unmarshal([]byte(body), &detail); err != nil {
		return false, fmt.Errorf("parse model: %w", err)
	}
	return strv(detail.Status) == modelStatusInstalled, nil
}

// modelImportInput points the UI at the brick whose model the user wants to bring in.
type modelImportInput struct {
	AppID   string `json:"appId" jsonschema:"the app id from apps_list"`
	BrickID string `json:"brickId" jsonschema:"the brick that needs the model, from app_bricks_list"`
}

// registerModelsImportCustom adds models_import_custom (mutating): it opens App Lab's own Edge Impulse picker rather than importing itself, because the project key belongs to the user alone (see RequestImportCustomModel).
func registerModelsImportCustom(srv *mcp.Server, access BoardAccess) {
	mcp.AddTool(srv, &mcp.Tool{
		Name: "models_import_custom",
		Description: "Ask the user to bring one of their own Edge Impulse models onto the board, for a brick that needs a model no board model fits. This opens App Lab's model picker on that brick, where the user chooses the project and impulse — importing needs their Edge Impulse project key, which you never receive and must never ask them to paste into the chat. " +
			"Use models_install instead whenever models_list already offers a suitable model: this tool is only for a model the board does not list yet. " +
			"It returns as soon as the picker is open; the user still has to choose and the download takes minutes, so check models_list afterwards rather than calling this again.",
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in modelImportInput) (*mcp.CallToolResult, any, error) {
		appID, brickID := appid.Canonical(in.AppID), strings.TrimSpace(in.BrickID)
		if appID == "" || brickID == "" {
			return nil, nil, fmt.Errorf("appId and brickId are required")
		}
		// A board we cannot read is not a board we may import onto, so the error case fails the same way.
		if board, err := access.SelectedBoard(ctx); err != nil || !board.Connected {
			return nil, nil, fmt.Errorf("no board connected")
		}
		access.RequestImportCustomModel(appID, brickID)
		return textResult(fmt.Sprintf("Opened App Lab's model picker for brick %q in app %q. The user picks the Edge Impulse project and impulse there and the download runs in App Lab; check models_list for the result. If nothing appears, they may have cancelled — ask before trying again.", brickID, appID)), nil, nil
	})
}
