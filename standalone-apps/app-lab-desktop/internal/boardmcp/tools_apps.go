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
	"app-lab-desktop/internal/appmirror"
	"app-lab-desktop/internal/arduinoapps"
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
		Description: "List the Arduino Apps on the connected board, split into the user's own apps, the installed App releases and the built-in examples (id, name, status, description). Releases and examples cannot be changed. Read-only.",
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

// shapeAppsList projects the orchestrator's /v1/apps response into a compact user-apps/releases/examples split.
func shapeAppsList(raw string) (string, error) {
	var resp struct {
		Apps *[]struct {
			Description *string `json:"description"`
			Example     *bool   `json:"example"`
			Icon        *string `json:"icon"`
			ID          *string `json:"id"`
			Name        *string `json:"name"`
			Release     *bool   `json:"release"`
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
		Releases []appEntry `json:"releases"`
		Examples []appEntry `json:"examples"`
		Broken   []string   `json:"broken_apps,omitempty"`
	}{Apps: []appEntry{}, Releases: []appEntry{}, Examples: []appEntry{}}

	if resp.Apps != nil {
		for _, a := range *resp.Apps {
			e := appEntry{ID: strv(a.ID), Name: strv(a.Name), Icon: strv(a.Icon), Status: strv(a.Status), Description: strv(a.Description)}
			switch {
			case a.Example != nil && *a.Example:
				out.Examples = append(out.Examples, e)
			case a.Release != nil && *a.Release:
				out.Releases = append(out.Releases, e)
			default:
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
	Release     bool         `json:"release,omitempty"`
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
		id := appid.Canonical(in.ID)
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
		// apps_get is how the agent verifies its work, so it carries the sync warnings.
		return textResult(SyncIssueWarning(access.PendingSyncIssues()) + shaped), nil, nil
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
		Release     *bool   `json:"release"`
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
		Release:     resp.Release != nil && *resp.Release,
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

// readOnlyCheckoutNotice forbids the workaround, gives the reason and names the way forward — the house shape for agent-facing refusals.
const readOnlyCheckoutNotice = "This app is a built-in example or an installed App release: its files on the board are READ-ONLY. " +
	"Read and study them freely, but any edit you make in this directory will NOT reach the board. " +
	"To change how it works, call apps_clone to copy it into a new app, check that copy out, and edit there. " +
	"Do not look for a way around this: if the user asked you to modify this app itself, tell them examples and " +
	"releases cannot be modified and offer them the editable copy instead."

// requireUserApp refuses a write to an app the mirror also treats as read-only: it asks ResolveApp, so the two cannot
// disagree. An app whose detail cannot be read is refused too: a wrong "writable" changes files the user cannot restore.
func requireUserApp(ctx context.Context, access BoardAccess, appID string) error {
	base, err := access.OrchestratorBaseURL(ctx)
	if err != nil {
		return err
	}
	target, err := arduinoapps.ResolveApp(ctx, base, appID)
	if err != nil {
		return err
	}
	if !target.ReadOnly {
		return nil
	}
	return fmt.Errorf("not changed: this app is read-only on the board (a built-in example, an installed App release, " +
		"or an app outside the user's apps folder) — only the user's own apps can be changed. " +
		"Do not look for a way around this: tell the user, and offer to apps_clone it into a new app and make the change there")
}

// registerAppsCheckout adds apps_checkout (read-only: only mirrors the board locally; edits are gated Edit/Write) and returns its name for the allowlist.
func registerAppsCheckout(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "apps_checkout",
		Description: "Check out an Arduino App's files from the connected board into a local working copy — use this to VIEW, read, or edit an app's files: check out, then use the Read, Edit and Write tools on the returned directory (do NOT read app files by cat-ing them via board_exec). To rename, move or delete files or folders, use app_files_rename and app_files_delete, not Write. Edits sync back to the board automatically — at the end of the turn and right before apps_start, apps_clone, or board_exec — but a running app never picks them up by itself: restart it to apply changes. Built-in examples (Inspirations, brick examples, core-and-foundational) and installed App releases check out READ-ONLY: read them freely, but edits to them never reach the board — apps_clone one first to get a copy you can change. Read-only itself; pass the app id from apps_list.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appGetInput) (*mcp.CallToolResult, any, error) {
		id := appid.Canonical(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		co, err := access.CheckoutApp(ctx, id)
		if err != nil {
			return nil, nil, err
		}
		// The checkout is the agent's recovery step, so it must surface any earlier edits that never landed.
		return textResult(checkoutText(co, access.PendingSyncIssues())), nil, nil
	})
	return "apps_checkout"
}

// staleCheckoutWarning tells the agent a re-checkout kept the old copy because the board could not be read; %v is the reason.
const staleCheckoutWarning = "warning: this checkout could not be refreshed from the board (%v). Some of its files may be out of date: changes made on the board since the app was last checked out may be missing here. " +
	"Call apps_checkout again before you rely on these files; if it fails again, tell the user the board could not be read. Do not read the app's files through board_exec instead."

// checkoutText is the apps_checkout result: warnings first, then the path and what the agent must know about the copy.
func checkoutText(co Checkout, syncIssues []string) string {
	text := SyncIssueWarning(syncIssues)
	if co.Stale != nil {
		text += fmt.Sprintf(staleCheckoutWarning, co.Stale) + "\n\n"
	}
	text += co.Path
	if co.ReadOnly {
		text += "\n\n" + readOnlyCheckoutNotice
	}
	for _, rel := range co.Parked {
		text += fmt.Sprintf("\nnote: your uncommitted edits to %s conflicted with changes made on the board since checkout; the board's version is now in place and your edits were saved to %s — review it NOW and re-apply what you still need with Edit on the real file. The parked copy is internal plumbing and is cleaned up automatically at the end of the turn: never mention it to the user, never ask the user to delete it, and do not push it to the board via board_exec.",
			rel, rel+appmirror.ParkedSuffix)
	}
	return text
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
		id := appid.Canonical(in.ID)
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
		return textResult(SyncIssueWarning(access.PendingSyncIssues()) + logs), nil, nil
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
		Description: "Start an Arduino App on the connected board. Only one app runs at a time, and the board refuses this while another app runs: stop that one first with apps_stop. Pass the app id from apps_list. Mutating: requires user approval. Starting can be slow — on a freshly-flashed board it can take several minutes (image pulls, dependency installs, sketch build). If it doesn't finish quickly the tool returns while the start keeps running in the background; call apps_wait_running to wait for it to come up (don't hand-poll apps_get), and do NOT call apps_start again.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: false},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appActionInput) (*mcp.CallToolResult, any, error) {
		id := appid.Canonical(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		// Push checked-out edits so the started app runs the latest code; refuse to start stale code if this app's sync failed.
		failed, conflicts, withheld, notes := access.FlushMirrorEdits(id)
		if failed[id] != nil {
			return nil, nil, fmt.Errorf("the pending edits for this app could not be synced to the board (%v) — start aborted so the board doesn't run stale code. The local edits are preserved and will be re-pushed automatically; check the board connection and call apps_start again", failed[id])
		}
		if conflicts[id] != nil {
			return nil, nil, fmt.Errorf("your edits to this app conflict with the board (%v) — start aborted so the board doesn't run stale code. Retrying will not help: call apps_checkout to pick up the board's version (it saves your edits as %s files), re-apply what you need, then start it", conflicts[id], appmirror.ParkedSuffix)
		}
		// A built-in app cannot take the agent's edits, so the board runs the shipped code: say so rather than let a start read as success.
		note := ""
		if withheld[id] != nil {
			note = fmt.Sprintf("Note: %v. The board is running the app's shipped files, not your local edits — to run your changes, apps_clone this app and start the copy.\n\n", withheld[id])
		}
		// Warnings don't abort the start (this app's checkout may be fine), but the agent must learn about stray or unlanded edits; rendered post-flush so they reflect the current state.
		warn := SyncIssueWarning(notes) + SyncIssueWarning(access.PendingSyncIssues()) + GhostEditWarning(access.PendingGhostEdits())
		res := runAppAction(ctx, access, fmt.Sprintf("/v1/apps/%s/start", url.PathEscape(id)))
		// The agent started this app; ask the UI to auto-open its web UI + forward ports once running (like a manual run).
		access.RequestOpenAppUI(id)
		if !res.finished {
			// Slow start (e.g. a freshly-flashed board pulling images, installing deps, building the sketch);
			// it keeps running in the background. The agent must poll, not assume success or failure.
			return textResult(warn + note + "Starting the app — this can take several minutes on a freshly-flashed board (pulling images, installing dependencies, building the sketch). It is still booting in the background; call apps_wait_running to wait for it, and only report it started once that shows it running. Do NOT call apps_start again."), nil, nil
		}
		check, cancel := context.WithTimeout(ctx, startCheckCap)
		st, boot, serr := startCheck(check, access, id)
		cancel()
		text, err := startOutcome(res, st, boot, serr, warn+note)
		if err != nil {
			return nil, nil, err
		}
		return textResult(text), nil, nil
	})
	return "apps_start"
}

// startCheck reads how a start whose stream ended came out: the board ends it once the app's containers run, and an app whose code fails at once reads "running" for a moment before it fails.
func startCheck(ctx context.Context, access BoardAccess, id string) (string, appBoot, error) {
	status, err := appStatus(ctx, access, id)
	switch {
	case err != nil:
		return "", bootPending, err
	case isFailedStatus(status):
		return status, bootDown, nil
	case !strings.EqualFold(status, "running") && !strings.EqualFold(status, "starting"):
		return status, bootPending, nil
	}
	return waitForAppRunning(ctx, access, id, startCheckWait)
}

// startOutcome words a start that ended within the hand-off by the app's status (startCheck), after the warnings (said once, so kept on an error too).
func startOutcome(res appActionResult, status string, boot appBoot, statusErr error, warn string) (string, error) {
	switch {
	case statusErr == nil && boot == bootUp:
		return warn + "Started — the app is now running.", nil // a spurious stream error included
	case res.err != nil:
		return "", fmt.Errorf("%s%w", warn, res.err)
	case statusErr != nil:
		return warn + fmt.Sprintf("The start ended, but the app's status could not be read (%v). Call apps_wait_running, and only report the app started once that shows it running.", statusErr), nil
	case boot == bootDown:
		return "", fmt.Errorf("%sthe app is not running: it failed or stopped right after it started (status %q). Read apps_logs for the cause; do not report it as started", warn, status)
	case strings.EqualFold(status, "running"):
		return warn + "The app came up only a moment ago. Call apps_wait_running to check that it keeps running, and only report it started once that shows it running.", nil
	default:
		return "", fmt.Errorf("%sthe start ended but the app is not running (status %q). Call apps_wait_running to see whether it still comes up, and apps_logs for the cause if it does not; do not report it as started", warn, status)
	}
}

// registerAppsStop adds apps_stop (mutating). Not read-only — permission-gated like apps_start.
func registerAppsStop(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "apps_stop",
		Description: "Stop a running Arduino App on the connected board. Pass the app id from apps_list. Mutating: requires user approval. If it doesn't finish quickly the tool returns while the stop keeps running in the background; poll apps_get to confirm and do NOT call apps_stop again.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: false},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appActionInput) (*mcp.CallToolResult, any, error) {
		id := appid.Canonical(in.ID)
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
	startCheckWait     = 10 * time.Second  // how long apps_start checks the app once its stream ended, the settle included
)

var (
	startCheckCap    = 20 * time.Second // with the 20 s hand-off, keeps apps_start under the engine's 60 s limit on a slow board
	waitPollInterval = 2 * time.Second
	// runningSettle is how long an app must keep reading "running" before a tool reports it running: one whose code fails at once reads "running" for a second or two first.
	runningSettle      = 5 * time.Second
	settlePollInterval = time.Second
)

// appBoot is how a wait for an app to come up ended.
type appBoot int

const (
	bootPending appBoot = iota // the wait ran out first: the app was starting, not started, or up for less than runningSettle
	bootUp                     // it read "running" for runningSettle
	bootDown                   // it failed, or it stopped after it came up
)

type appWaitInput struct {
	ID         string `json:"id" jsonschema:"the app id from apps_list, e.g. user:my-app"`
	TimeoutSec int    `json:"timeout_sec,omitempty" jsonschema:"how long to wait, in seconds (default 60, max 120); if it returns still starting, just call again"`
}

// registerAppsWaitRunning adds apps_wait_running (read-only): a server-side wait so the agent doesn't hand-poll apps_get while an app boots.
func registerAppsWaitRunning(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "apps_wait_running",
		Description: "After apps_start, wait for the app to finish booting and report its status. Checks the board server-side and returns once the app has kept running for a few seconds (an app that fails right after it starts is reported as failed), or when the wait budget elapses. Read-only — use this instead of repeatedly calling apps_get yourself. Pass the app id; optionally timeout_sec (default 60, max 120). If it returns still starting, just call it again.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appWaitInput) (*mcp.CallToolResult, any, error) {
		id := appid.Canonical(in.ID)
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
		// Shorter than two settles, a wait could end on every call with the app up but not yet confirmed.
		if floor := 2 * runningSettle; timeout < floor {
			timeout = floor
		}
		status, boot, err := waitForAppRunning(ctx, access, id, timeout)
		if err != nil {
			return nil, nil, err
		}
		switch {
		case boot == bootUp:
			return textResult("The app is running."), nil, nil
		case isFailedStatus(status):
			return textResult(fmt.Sprintf("The app failed to start (status %q). Check apps_logs for the cause.", status)), nil, nil
		case boot == bootDown:
			return textResult(fmt.Sprintf("The app is not running: it stopped right after it came up (status %q). Check apps_logs for the cause.", status)), nil, nil
		case strings.EqualFold(status, "running"):
			return textResult("The app came up only a moment ago. Call apps_wait_running again to check that it keeps running before you report it started."), nil, nil
		default:
			return textResult(fmt.Sprintf("Still starting (status %q) after %s — it's booting in the background. Call apps_wait_running again to keep waiting.", status, timeout)), nil, nil
		}
	})
	return "apps_wait_running"
}

// waitForAppRunning polls the app's status until it read "running" for runningSettle, the app is down, or the timeout ends; reads and polls end within the timeout.
func waitForAppRunning(ctx context.Context, access BoardAccess, id string, timeout time.Duration) (status string, boot appBoot, err error) {
	deadline := time.Now().Add(timeout)
	reads, cancel := context.WithDeadline(ctx, deadline)
	defer cancel()
	var upSince time.Time
	for {
		read, readErr := appStatus(reads, access, id)
		switch {
		case readErr == nil:
			status = read
		case ctx.Err() != nil || reads.Err() == nil:
			return "", bootPending, readErr
		case status == "":
			return "", bootPending, fmt.Errorf("the board did not answer within %s", timeout)
		default:
			return status, bootPending, nil // the timeout cut the read: the one before it stands
		}
		poll := waitPollInterval
		switch {
		case strings.EqualFold(status, "running"):
			if upSince.IsZero() {
				upSince = time.Now()
			}
			if time.Since(upSince) >= runningSettle {
				return status, bootUp, nil
			}
			poll = settlePollInterval
		// Once up, only a restart ("starting") is not the app going down.
		case isFailedStatus(status) || (!upSince.IsZero() && !strings.EqualFold(status, "starting")):
			return status, bootDown, nil
		default:
			upSince = time.Time{}
		}
		if !time.Now().Add(poll).Before(deadline) {
			return status, bootPending, nil
		}
		select {
		case <-ctx.Done():
			return "", bootPending, ctx.Err()
		case <-time.After(poll):
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
		id := appid.Canonical(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		if _, err := orchestratorRequest(ctx, access, http.MethodDelete, "/v1/apps/"+url.PathEscape(id), nil); err != nil {
			return nil, nil, err
		}
		access.ForgetWorkspaceApp(id) // its id is reusable by a later app of the same name
		return textResult(fmt.Sprintf("Deleted app %q.", id)), nil, nil
	})
}

// registerAppsEdit adds apps_edit (mutating). Off the read-only allowlist so the agent must get user permission first.
func registerAppsEdit(srv *mcp.Server, access BoardAccess) {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "apps_edit",
		Description: "Edit an Arduino App's details on the connected board: its name, description and/or icon. Pass the app id from apps_list plus at least one field to change; omitted fields are left as-is. Mutating — asks the user for permission. Example apps and App releases can't be edited, and a name already in use is rejected. Renaming needs the app stopped: if it is running or starting, first ask the user whether they want it stopped for the rename, then (only with their agreement) call apps_stop before renaming.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: false},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appEditInput) (*mcp.CallToolResult, any, error) {
		id := appid.Canonical(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		if in.Name == nil && in.Description == nil && in.Icon == nil {
			return nil, nil, fmt.Errorf("provide at least one of name, description, or icon to change")
		}
		if err := requireUserApp(ctx, access, id); err != nil {
			return nil, nil, err
		}
		// Renaming a live app leaves the old one running under the new record, so gate a name change on the app being stopped (description/icon are harmless); report it rather than error so the agent asks the user, and let an unreadable status fall through.
		if in.Name != nil {
			if st, serr := appStatus(ctx, access, id); serr == nil && (strings.EqualFold(st, "running") || strings.EqualFold(st, "starting")) {
				return textResult(fmt.Sprintf("Not renamed: this app is %s, and it must be stopped before it can be renamed. Ask the user whether they want it stopped for the rename; only if they agree, call apps_stop, confirm with apps_get that it stopped, then call apps_edit again to rename it (start it again afterwards if that makes sense).", st)), nil, nil
			}
		}
		// The rename moves the checkout too, so edits still waiting in it go to the board first, as before a file rename.
		warn := ""
		if in.Name != nil {
			w, err := flushBeforeFileChange(access, id)
			if err != nil {
				return nil, nil, err
			}
			warn = w
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
		// Not cut by a Stop of the turn (the request still times out): the board may have moved the folder, and the rebind below must follow.
		raw, err := orchestratorRequest(context.WithoutCancel(ctx), access, http.MethodPatch, "/v1/apps/"+url.PathEscape(id), body)
		if err != nil {
			return nil, nil, err
		}
		// A name change mints a new id and the old one stops resolving: carry the workspace over and hand the agent the id to use, or its next call 404s.
		if newID := editedAppID(raw); newID != "" && newID != id {
			note := access.RebindWorkspaceApp(id, newID, strings.TrimSpace(deref(in.Name)))
			access.RefreshManagedFiles(newID)
			text := fmt.Sprintf("Updated app %q; renaming gave it the new id %q — use that from now on, the old one no longer resolves.", id, newID)
			if note != "" {
				text = fmt.Sprintf("Updated app %q. %s", id, note) // the note names the new id and checkout folder
			}
			return textResult(warn + text), nil, nil
		}
		access.RefreshManagedFiles(id)
		return textResult(warn + fmt.Sprintf("Updated app %q.", id)), nil, nil
	})
}

// editedAppID reads the id back from an app update; empty when the response says nothing about it.
func editedAppID(raw string) string {
	var app struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(raw), &app); err != nil {
		return ""
	}
	return strings.TrimSpace(app.ID)
}

// deref reads an optional string field, empty when unset.
func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// registerAppsClone adds apps_clone (mutating). Off the read-only allowlist so the agent must get user permission first.
func registerAppsClone(srv *mcp.Server, access BoardAccess) {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "apps_clone",
		Description: "Duplicate an existing Arduino App on the connected board into a new app (copies its files, sketch and bricks). Pass the source app id from apps_list; optionally a name and icon for the copy (the board derives a name if omitted). Returns the new app's id. Mutating — asks the user for permission. A name already in use is rejected.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: false},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appCloneInput) (*mcp.CallToolResult, any, error) {
		id := appid.Canonical(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		// Flush the source app's checked-out edits so the clone copies the latest code; refuse to clone stale files if its sync failed.
		failed, conflicts, withheld, notes := access.FlushMirrorEdits(id)
		if failed[id] != nil {
			return nil, nil, fmt.Errorf("the pending edits for this app could not be synced to the board (%v) — clone aborted so it doesn't copy stale files. Check the board connection and try again", failed[id])
		}
		if conflicts[id] != nil {
			return nil, nil, fmt.Errorf("your edits to this app conflict with the board (%v) — clone aborted so it doesn't copy stale files. Retrying will not help: call apps_checkout to pick up the board's version first (it saves your edits as %s files to re-apply)", conflicts[id], appmirror.ParkedSuffix)
		}
		// Warnings don't abort the clone (this app's checkout may be fine), but the agent must learn about stray or unlanded edits; rendered post-flush so they reflect the current state.
		warn := SyncIssueWarning(notes) + SyncIssueWarning(access.PendingSyncIssues()) + GhostEditWarning(access.PendingGhostEdits())
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
		if withheld[id] != nil {
			// The clone came from the board, so edits the source could not take are absent from the copy.
			return textResult(warn + fmt.Sprintf("Note: %v. The copy was made from the board's shipped files, so your edits to the read-only app are not in it — re-apply them in the new app.\n\n%s", withheld[id], shaped)), nil, nil
		}
		return textResult(warn + shaped), nil, nil
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
		Description: "Create a new Arduino App on the connected board — scaffolds its folder, app.yaml, python/main.py and a sketch/ (sketch.ino and sketch.yaml). Returns the new app id; afterward write the app's code in its checkout (apps_checkout) and add its bricks with app_bricks_add. The new app is a sibling of every other app on the board, never inside the one a scoped session is working on, and that session keeps its own app. Mutating: requires user approval.",
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
