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
)

// appEntry is the slimmed-down app record returned to the agent (drops orchestrator internals).
type appEntry struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Icon        string `json:"icon,omitempty"`
	Status      string `json:"status"`
	Description string `json:"description,omitempty"`
}

// registerAppsList adds apps_list (read-only) and returns its name for the auto-approve allowlist.
func registerAppsList(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "apps_list",
		Description: "List the Arduino Apps on the connected board, split into the user's installed apps and the built-in examples (id, name, status, description). Read-only.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, _ noArgs) (*mcp.CallToolResult, any, error) {
		body, err := orchestratorGet(ctx, access, "/v1/apps")
		if err != nil {
			return nil, nil, err
		}
		shaped, err := shapeAppsList(body)
		if err != nil {
			return nil, nil, err
		}
		return textResult(shaped), nil, nil
	})
	return "apps_list"
}

// shapeAppsList projects the orchestrator's /v1/apps response into a compact user-apps/examples split.
func shapeAppsList(raw string) (string, error) {
	var resp struct {
		Apps *[]struct {
			Description *string `json:"description"`
			Example     *bool   `json:"example"`
			Icon        *string `json:"icon"`
			ID          *string `json:"id"`
			Name        *string `json:"name"`
			Status      *string `json:"status"`
		} `json:"apps"`
		BrokenApps *[]struct {
			ID *string `json:"id"`
		} `json:"broken_apps"`
	}
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		return "", fmt.Errorf("parse apps response: %w", err)
	}

	out := struct {
		Apps     []appEntry `json:"apps"`
		Examples []appEntry `json:"examples"`
		Broken   []string   `json:"broken_apps,omitempty"`
	}{Apps: []appEntry{}, Examples: []appEntry{}}

	if resp.Apps != nil {
		for _, a := range *resp.Apps {
			e := appEntry{ID: strv(a.ID), Name: strv(a.Name), Icon: strv(a.Icon), Status: strv(a.Status), Description: strv(a.Description)}
			if a.Example != nil && *a.Example {
				out.Examples = append(out.Examples, e)
			} else {
				out.Apps = append(out.Apps, e)
			}
		}
	}
	if resp.BrokenApps != nil {
		for _, b := range *resp.BrokenApps {
			out.Broken = append(out.Broken, strv(b.ID))
		}
	}

	j, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return "", err
	}
	return string(j), nil
}

type appGetInput struct {
	ID string `json:"id" jsonschema:"the app id from apps_list, e.g. user:my-app or examples:blink"`
}

// brickEntry is the slimmed-down brick record (an app's declared brick, or a catalog brick from bricks_list).
type brickEntry struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Category     string `json:"category,omitempty"`
	Description  string `json:"description,omitempty"`
	RequireModel bool   `json:"requireModel,omitempty"`
}

// appDetail is the slimmed-down single-app record (adds path + bricks over appEntry).
type appDetail struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Icon        string       `json:"icon,omitempty"`
	Status      string       `json:"status"`
	Description string       `json:"description,omitempty"`
	Example     bool         `json:"example,omitempty"`
	Path        string       `json:"path,omitempty"`
	Bricks      []brickEntry `json:"bricks"`
}

// registerAppsGet adds apps_get (read-only) and returns its name for the auto-approve allowlist.
func registerAppsGet(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "apps_get",
		Description: "Get one Arduino App's details on the connected board (status, description, path, and its bricks). Read-only; pass the app id from apps_list.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appGetInput) (*mcp.CallToolResult, any, error) {
		id := strings.TrimSpace(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		body, err := orchestratorGet(ctx, access, "/v1/apps/"+url.PathEscape(id))
		if err != nil {
			return nil, nil, err
		}
		shaped, err := shapeAppDetail(body)
		if err != nil {
			return nil, nil, err
		}
		return textResult(shaped), nil, nil
	})
	return "apps_get"
}

// shapeAppDetail projects the orchestrator's /v1/apps/{id} response into a compact app record.
func shapeAppDetail(raw string) (string, error) {
	var resp struct {
		Bricks *[]struct {
			Category     *string `json:"category"`
			ID           string  `json:"id"`
			Name         string  `json:"name"`
			RequireModel *bool   `json:"require_model"`
		} `json:"bricks"`
		Description *string `json:"description"`
		Example     *bool   `json:"example"`
		Icon        *string `json:"icon"`
		ID          string  `json:"id"`
		Name        string  `json:"name"`
		Path        *string `json:"path"`
		Status      string  `json:"status"`
	}
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		return "", fmt.Errorf("parse app detail: %w", err)
	}

	out := appDetail{
		ID:          resp.ID,
		Name:        resp.Name,
		Icon:        strv(resp.Icon),
		Status:      resp.Status,
		Description: strv(resp.Description),
		Example:     resp.Example != nil && *resp.Example,
		Path:        strv(resp.Path),
		Bricks:      []brickEntry{},
	}
	if resp.Bricks != nil {
		for _, b := range *resp.Bricks {
			out.Bricks = append(out.Bricks, brickEntry{
				ID:           b.ID,
				Name:         b.Name,
				Category:     strv(b.Category),
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

// registerAppsCheckout adds apps_checkout (read-only: only mirrors the board locally; edits are gated Edit/Write) and returns its name for the allowlist.
func registerAppsCheckout(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "apps_checkout",
		Description: "Check out an Arduino App's files from the connected board into a local working copy — use this to VIEW, read, or edit an app's files: check out, then use the Read, Edit and Write tools on the returned directory (do NOT read app files by cat-ing them via board_exec). Edits sync back to the board automatically at the end of the turn. Read-only itself; pass the app id from apps_list.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appGetInput) (*mcp.CallToolResult, any, error) {
		id := strings.TrimSpace(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		path, err := access.CheckoutApp(ctx, id)
		if err != nil {
			return nil, nil, err
		}
		return textResult(path), nil, nil
	})
	return "apps_checkout"
}

type appLogsInput struct {
	ID   string `json:"id" jsonschema:"the app id from apps_list, e.g. user:my-app or examples:blink"`
	Tail int    `json:"tail,omitempty" jsonschema:"how many recent log lines to fetch (default 200, max 1000)"`
}

// registerAppsLogs adds apps_logs (read-only) and returns its name for the auto-approve allowlist.
func registerAppsLogs(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "apps_logs",
		Description: "Get a snapshot of an Arduino App's recent Python logs (stdout/Logger) on the connected board — the last lines, not a live stream. Read-only; pass the app id from apps_list.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appLogsInput) (*mcp.CallToolResult, any, error) {
		id := strings.TrimSpace(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		tail := in.Tail
		if tail <= 0 {
			tail = 200
		}
		if tail > 1000 {
			tail = 1000
		}
		logs, err := orchestratorLogsTail(ctx, access, fmt.Sprintf("/v1/apps/%s/logs?tail=%d", url.PathEscape(id), tail))
		if err != nil {
			return nil, nil, err
		}
		if logs == "" {
			logs = "(no logs)"
		}
		return textResult(logs), nil, nil
	})
	return "apps_logs"
}

type appActionInput struct {
	ID string `json:"id" jsonschema:"the app id from apps_list, e.g. user:my-app"`
}

type appEditInput struct {
	ID          string  `json:"id" jsonschema:"the app id from apps_list, e.g. user:my-app"`
	Name        *string `json:"name,omitempty" jsonschema:"new name for the app (optional; omit to leave unchanged)"`
	Description *string `json:"description,omitempty" jsonschema:"new description (optional; omit to leave unchanged)"`
	Icon        *string `json:"icon,omitempty" jsonschema:"new icon, a single emoji (optional; omit to leave unchanged)"`
}

type appCloneInput struct {
	ID   string  `json:"id" jsonschema:"the id of the app to clone, from apps_list"`
	Name *string `json:"name,omitempty" jsonschema:"name for the copy (optional; the board derives one if omitted)"`
	Icon *string `json:"icon,omitempty" jsonschema:"icon for the copy, a single emoji (optional)"`
}

// registerAppsStart adds apps_start (mutating). Not read-only, so it stays off the auto-approve allowlist and the agent must get user permission first.
func registerAppsStart(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "apps_start",
		Description: "Start an Arduino App on the connected board. Only one app runs at a time, so this stops whatever is currently running. Pass the app id from apps_list. Mutating: requires user approval. Starting can be slow — on a freshly-flashed board it can take several minutes (image pulls, dependency installs, sketch build). If it doesn't finish quickly the tool returns while the start keeps running in the background; call apps_wait_running to wait for it to come up (don't hand-poll apps_get), and do NOT call apps_start again.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: false},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appActionInput) (*mcp.CallToolResult, any, error) {
		id := strings.TrimSpace(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		// Push checked-out edits so the started app runs the latest code; refuse to start stale code if this app's sync failed.
		failed, conflicts := access.FlushMirrorEdits()
		if failed[id] != nil {
			return nil, nil, fmt.Errorf("the pending edits for this app could not be synced to the board (%v) — start aborted so the board doesn't run stale code. The local edits are preserved and will be re-pushed automatically; check the board connection and call apps_start again", failed[id])
		}
		if conflicts[id] != nil {
			return nil, nil, fmt.Errorf("your edits to this app conflict with the board (%v) — start aborted so the board doesn't run stale code. Retrying will not help: call apps_checkout to pick up the board's version, re-apply what you need, then start it", conflicts[id])
		}
		res := runAppAction(ctx, access, fmt.Sprintf("/v1/apps/%s/start", url.PathEscape(id)))
		// The agent started this app; ask the UI to auto-open its web UI + forward ports once running (like a manual run).
		access.RequestOpenAppUI(id)
		if !res.finished {
			// Slow start (e.g. a freshly-flashed board pulling images, installing deps, building the sketch);
			// it keeps running in the background. The agent must poll, not assume success or failure.
			return textResult("Starting the app — this can take several minutes on a freshly-flashed board (pulling images, installing dependencies, building the sketch). It is still booting in the background; call apps_wait_running to wait for it, and only report it started once that shows it running. Do NOT call apps_start again."), nil, nil
		}
		// Finished within the wait. Trust the actual status: a spurious SSE error with the app running still counts as started.
		if st, err := appStatus(ctx, access, id); err == nil && strings.EqualFold(st, "running") {
			return textResult("Started — the app is now running."), nil, nil
		}
		if res.err != nil {
			return nil, nil, res.err
		}
		out := res.out
		if out == "" {
			out = "Started."
		}
		return textResult(out), nil, nil
	})
	return "apps_start"
}

// registerAppsStop adds apps_stop (mutating). Not read-only — permission-gated like apps_start.
func registerAppsStop(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "apps_stop",
		Description: "Stop a running Arduino App on the connected board. Pass the app id from apps_list. Mutating: requires user approval. If it doesn't finish quickly the tool returns while the stop keeps running in the background; poll apps_get to confirm and do NOT call apps_stop again.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: false},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appActionInput) (*mcp.CallToolResult, any, error) {
		id := strings.TrimSpace(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		res := runAppAction(ctx, access, fmt.Sprintf("/v1/apps/%s/stop", url.PathEscape(id)))
		if !res.finished {
			return textResult("Stopping the app — it is still running in the background; poll apps_get to confirm it stopped. Do NOT call apps_stop again."), nil, nil
		}
		// Trust the actual status over a spurious stream error: if the app is no longer running, the stop worked.
		if st, err := appStatus(ctx, access, id); err == nil && !strings.EqualFold(st, "running") {
			return textResult("Stopped."), nil, nil
		}
		if res.err != nil {
			return nil, nil, res.err
		}
		out := res.out
		if out == "" {
			out = "Stopped."
		}
		return textResult(out), nil, nil
	})
	return "apps_stop"
}

const (
	waitDefaultTimeout = 60 * time.Second  // one call covers a typical boot; the agent re-calls for longer ones
	waitMaxTimeout     = 120 * time.Second // cap so the tool call can't block for minutes and time out
	waitPollInterval   = 2 * time.Second
)

type appWaitInput struct {
	ID         string `json:"id" jsonschema:"the app id from apps_list, e.g. user:my-app"`
	TimeoutSec int    `json:"timeout_sec,omitempty" jsonschema:"how long to wait, in seconds (default 60, max 120); if it returns still starting, just call again"`
}

// registerAppsWaitRunning adds apps_wait_running (read-only): a server-side wait so the agent doesn't hand-poll apps_get while an app boots.
func registerAppsWaitRunning(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "apps_wait_running",
		Description: "After apps_start, wait for the app to finish booting and report its status. Checks the board server-side and returns as soon as the app is running (or clearly failed), or when the wait budget elapses. Read-only — use this instead of repeatedly calling apps_get yourself. Pass the app id; optionally timeout_sec (default 60, max 120). If it returns still starting, just call it again.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appWaitInput) (*mcp.CallToolResult, any, error) {
		id := strings.TrimSpace(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		timeout := waitDefaultTimeout
		if in.TimeoutSec > 0 {
			timeout = time.Duration(in.TimeoutSec) * time.Second
		}
		if timeout > waitMaxTimeout {
			timeout = waitMaxTimeout
		}
		status, running, err := waitForAppRunning(ctx, access, id, timeout)
		if err != nil {
			return nil, nil, err
		}
		switch {
		case running:
			return textResult("The app is running."), nil, nil
		case isFailedStatus(status):
			return textResult(fmt.Sprintf("The app failed to start (status %q). Check apps_logs for the cause.", status)), nil, nil
		default:
			return textResult(fmt.Sprintf("Still starting (status %q) after %s — it's booting in the background. Call apps_wait_running again to keep waiting.", status, timeout)), nil, nil
		}
	})
	return "apps_wait_running"
}

// waitForAppRunning polls the app's status server-side until it is running, clearly failed, or the timeout elapses; returns the last status seen.
func waitForAppRunning(ctx context.Context, access BoardAccess, id string, timeout time.Duration) (status string, running bool, err error) {
	deadline := time.Now().Add(timeout)
	for {
		status, err = appStatus(ctx, access, id)
		if err != nil {
			return "", false, err
		}
		if strings.EqualFold(status, "running") {
			return status, true, nil
		}
		if isFailedStatus(status) || !time.Now().Before(deadline) {
			return status, false, nil
		}
		select {
		case <-ctx.Done():
			return "", false, ctx.Err()
		case <-time.After(waitPollInterval):
		}
	}
}

// isFailedStatus flags a clearly-failed status so the wait exits early, without hardcoding the orchestrator's full status enum.
func isFailedStatus(status string) bool {
	s := strings.ToLower(status)
	return strings.Contains(s, "error") || strings.Contains(s, "fail")
}

// registerAppsDelete adds apps_delete (mutating). Off the read-only allowlist so the agent must get user permission first.
func registerAppsDelete(srv *mcp.Server, access BoardAccess) {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "apps_delete",
		Description: "Permanently delete an Arduino App from the connected board: it is stopped if running, then its files and containers are removed. This CANNOT be undone. Mutating — asks the user for permission. Pass the app id from apps_list. Example apps cannot be deleted.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: false},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appActionInput) (*mcp.CallToolResult, any, error) {
		id := strings.TrimSpace(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		if _, err := orchestratorRequest(ctx, access, http.MethodDelete, "/v1/apps/"+url.PathEscape(id), nil); err != nil {
			return nil, nil, err
		}
		return textResult(fmt.Sprintf("Deleted app %q.", id)), nil, nil
	})
}

// registerAppsEdit adds apps_edit (mutating). Off the read-only allowlist so the agent must get user permission first.
func registerAppsEdit(srv *mcp.Server, access BoardAccess) {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "apps_edit",
		Description: "Edit an Arduino App's details on the connected board: its name, description and/or icon. Pass the app id from apps_list plus at least one field to change; omitted fields are left as-is. Mutating — asks the user for permission. Example apps can't be edited, and a name already in use is rejected. Renaming needs the app stopped: if it is running or starting, first ask the user whether they want it stopped for the rename, then (only with their agreement) call apps_stop before renaming.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: false},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appEditInput) (*mcp.CallToolResult, any, error) {
		id := strings.TrimSpace(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		if in.Name == nil && in.Description == nil && in.Icon == nil {
			return nil, nil, fmt.Errorf("provide at least one of name, description, or icon to change")
		}
		// Renaming a live app leaves the old one running under the new record, so gate a name change on the app being stopped (description/icon are harmless); report it rather than error so the agent asks the user, and let an unreadable status fall through.
		if in.Name != nil {
			if st, serr := appStatus(ctx, access, id); serr == nil && (strings.EqualFold(st, "running") || strings.EqualFold(st, "starting")) {
				return textResult(fmt.Sprintf("Not renamed: this app is %s, and it must be stopped before it can be renamed. Ask the user whether they want it stopped for the rename; only if they agree, call apps_stop, confirm with apps_get that it stopped, then call apps_edit again to rename it (start it again afterwards if that makes sense).", st)), nil, nil
			}
		}
		// Only the fields set are sent (omitempty); the orchestrator leaves the rest unchanged.
		body, err := json.Marshal(struct {
			Name        *string `json:"name,omitempty"`
			Description *string `json:"description,omitempty"`
			Icon        *string `json:"icon,omitempty"`
		}{Name: in.Name, Description: in.Description, Icon: in.Icon})
		if err != nil {
			return nil, nil, err
		}
		if _, err := orchestratorRequest(ctx, access, http.MethodPatch, "/v1/apps/"+url.PathEscape(id), body); err != nil {
			return nil, nil, err
		}
		return textResult(fmt.Sprintf("Updated app %q.", id)), nil, nil
	})
}

// registerAppsClone adds apps_clone (mutating). Off the read-only allowlist so the agent must get user permission first.
func registerAppsClone(srv *mcp.Server, access BoardAccess) {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "apps_clone",
		Description: "Duplicate an existing Arduino App on the connected board into a new app (copies its files, sketch and bricks). Pass the source app id from apps_list; optionally a name and icon for the copy (the board derives a name if omitted). Returns the new app's id. Mutating — asks the user for permission. A name already in use is rejected.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: false},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appCloneInput) (*mcp.CallToolResult, any, error) {
		id := strings.TrimSpace(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		// Flush the source app's checked-out edits so the clone copies the latest code; refuse to clone stale files if its sync failed.
		failed, conflicts := access.FlushMirrorEdits()
		if failed[id] != nil {
			return nil, nil, fmt.Errorf("the pending edits for this app could not be synced to the board (%v) — clone aborted so it doesn't copy stale files. Check the board connection and try again", failed[id])
		}
		if conflicts[id] != nil {
			return nil, nil, fmt.Errorf("your edits to this app conflict with the board (%v) — clone aborted so it doesn't copy stale files. Retrying will not help: call apps_checkout to pick up the board's version first", conflicts[id])
		}
		body, err := json.Marshal(struct {
			Name *string `json:"name,omitempty"`
			Icon *string `json:"icon,omitempty"`
		}{Name: in.Name, Icon: in.Icon})
		if err != nil {
			return nil, nil, err
		}
		raw, err := orchestratorPost(ctx, access, "/v1/apps/"+url.PathEscape(id)+"/clone", body)
		if err != nil {
			return nil, nil, err
		}
		shaped, err := shapeCreateResult(raw)
		if err != nil {
			return nil, nil, err
		}
		return textResult(shaped), nil, nil
	})
}

// appStatus fetches an app's current status string (e.g. "running") from the orchestrator, to confirm a start/stop actually took effect even when the SSE stream reported a spurious error.
func appStatus(ctx context.Context, access BoardAccess, id string) (string, error) {
	body, err := orchestratorGet(ctx, access, "/v1/apps/"+url.PathEscape(id))
	if err != nil {
		return "", err
	}
	var resp struct {
		Status string `json:"status"`
	}
	if err := json.Unmarshal([]byte(body), &resp); err != nil {
		return "", err
	}
	return resp.Status, nil
}

type appCreateInput struct {
	Name        string `json:"name" jsonschema:"the app name, e.g. My Blink App"`
	Description string `json:"description,omitempty" jsonschema:"a short description of what the app does"`
	Icon        string `json:"icon,omitempty" jsonschema:"an emoji icon for the app, e.g. 💡"`
}

// registerAppsCreate adds apps_create (mutating). Not read-only — permission-gated like the other write tools.
func registerAppsCreate(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "apps_create",
		Description: "Create a new Arduino App on the connected board — scaffolds its folder, app.yaml and python/main.py. Returns the new app id; write the app's code and declare its bricks by editing those files afterward. Mutating: requires user approval.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: false},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appCreateInput) (*mcp.CallToolResult, any, error) {
		name := strings.TrimSpace(in.Name)
		if name == "" {
			return nil, nil, fmt.Errorf("app name is required")
		}
		reqBody, err := json.Marshal(struct {
			Name        string `json:"name"`
			Description string `json:"description,omitempty"`
			Icon        string `json:"icon,omitempty"`
		}{Name: name, Description: strings.TrimSpace(in.Description), Icon: strings.TrimSpace(in.Icon)})
		if err != nil {
			return nil, nil, err
		}
		body, err := orchestratorPost(ctx, access, "/v1/apps", reqBody)
		if err != nil {
			return nil, nil, err
		}
		shaped, err := shapeCreateResult(body)
		if err != nil {
			return nil, nil, err
		}
		return textResult(shaped), nil, nil
	})
	return "apps_create"
}

// shapeCreateResult projects the orchestrator's create response into the new app id.
func shapeCreateResult(raw string) (string, error) {
	var resp struct {
		ID *string `json:"id"`
	}
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		return "", fmt.Errorf("parse create response: %w", err)
	}
	out := struct {
		ID string `json:"id"`
	}{ID: strv(resp.ID)}
	j, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return "", err
	}
	return string(j), nil
}

func strv(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
