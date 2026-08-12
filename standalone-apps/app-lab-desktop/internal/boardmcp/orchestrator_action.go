package boardmcp

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	// appActionHandoffWait is how long a start/stop tool call blocks for a fast result before handing the
	// operation off to the background and telling the agent to poll apps_get. Kept short for responsiveness;
	// correctness does not depend on it — the op runs to completion in the background regardless.
	appActionHandoffWait = 20 * time.Second
	// appActionBackgroundCap bounds the detached operation. The orchestrator ties the op to our HTTP
	// connection — StartApp runs `docker compose up` (plus the sketch build and provisioning) under the
	// request context and KILLS it if we disconnect — so we must hold the connection open for the whole op.
	// Generous enough for a freshly-flashed board (image pulls, dependency installs, sketch build).
	appActionBackgroundCap = 15 * time.Minute
)

// appActionResult reports how a detached start/stop ended.
type appActionResult struct {
	out      string
	err      error
	finished bool // true if the op completed within appActionHandoffWait; false if it is still running in the background
}

// runAppAction runs an orchestrator SSE action (app start/stop) DETACHED from the MCP request. The
// orchestrator binds the operation to our HTTP connection and kills it if the client disconnects (docker
// compose, sketch build and provisioning all run under the request context), so a slow op must not be tied
// to the short-lived tool call. We hold the connection open on a background context and only wait
// appActionHandoffWait for a fast result; a slower op keeps running in the background while the agent polls
// apps_get. This is robust even if the MCP tool call itself times out — the op is never aborted by it.
func runAppAction(ctx context.Context, access BoardAccess, path string) appActionResult {
	bg, cancel := context.WithTimeout(context.Background(), appActionBackgroundCap)
	ch := make(chan appActionResult, 1)
	go func() {
		out, err := orchestratorAction(bg, access, path)
		ch <- appActionResult{out: out, err: err}
		cancel() // op done (or capped) — release the background context
	}()

	select {
	case r := <-ch:
		r.finished = true
		return r
	case <-time.After(appActionHandoffWait):
		// Still running — leave the goroutine holding the connection so the board finishes the op.
		return appActionResult{finished: false}
	case <-ctx.Done():
		// The agent stopped waiting on the tool call; the op keeps running in the background.
		return appActionResult{finished: false}
	}
}

// orchestratorAction POSTs to an SSE action endpoint (app start/stop) and drains its progress stream to the
// terminal event (done/close/EOF), returning the collected progress; an error event fails the call. The
// caller owns the context lifetime (see runAppAction) and this imposes no timeout of its own — cutting the
// connection short cancels the operation on the board, so only runAppAction's background context bounds it.
func orchestratorAction(ctx context.Context, access BoardAccess, path string) (string, error) {
	base, err := access.OrchestratorBaseURL(ctx)
	if err != nil {
		return "", fmt.Errorf("no board connected: %w", err)
	}
	if base == "" {
		return "", fmt.Errorf("no board connected")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+path, strings.NewReader("{}"))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("orchestrator request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return "", fmt.Errorf("orchestrator returned %s: %s", resp.Status, string(body))
	}

	events := make(chan sseEvent)
	go readSSE(ctx, io.LimitReader(resp.Body, maxOrchestratorBody), events)

	var progress []string
	for {
		select {
		case <-ctx.Done():
			// Background cap reached (runAppAction). Return what we collected; the op is being cut off.
			return strings.Join(progress, "\n"), ctx.Err()
		case ev, ok := <-events:
			if !ok {
				return strings.Join(progress, "\n"), nil // stream closed cleanly
			}
			switch ev.name {
			case "done", "close":
				return strings.Join(progress, "\n"), nil
			case "message":
				var m struct {
					Message string `json:"message"`
				}
				if json.Unmarshal([]byte(ev.data), &m) == nil && m.Message != "" {
					progress = append(progress, m.Message)
				}
			case "error":
				var e struct {
					Message string `json:"message"`
				}
				_ = json.Unmarshal([]byte(ev.data), &e)
				msg := e.Message
				if msg == "" {
					msg = "operation failed"
				}
				if len(progress) > 0 {
					return "", fmt.Errorf("%s\nprogress:\n%s", msg, strings.Join(progress, "\n"))
				}
				return "", fmt.Errorf("%s", msg)
			}
		}
	}
}
