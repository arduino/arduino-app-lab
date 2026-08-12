package boardmcp

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// noArgs is the input type for tools that take no parameters.
type noArgs struct{}

// maxOrchestratorBody caps a tool result at 1 MiB so it can't blow up the model context.
const maxOrchestratorBody = 1 << 20

// orchestratorGet does a GET {orchestratorBaseURL}{path} and returns the response body, with a clear error when no board is connected.
func orchestratorGet(ctx context.Context, access BoardAccess, path string) (string, error) {
	base, err := access.OrchestratorBaseURL(ctx)
	if err != nil {
		return "", fmt.Errorf("no board connected: %w", err)
	}
	if base == "" {
		return "", fmt.Errorf("no board connected")
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+path, nil)
	if err != nil {
		return "", err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("orchestrator request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxOrchestratorBody))
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("orchestrator returned %s: %s", resp.Status, string(body))
	}
	return string(body), nil
}

// orchestratorPost does a POST {orchestratorBaseURL}{path} with a JSON body and returns the response body, with a clear error when no board is connected.
func orchestratorPost(ctx context.Context, access BoardAccess, path string, body []byte) (string, error) {
	base, err := access.OrchestratorBaseURL(ctx)
	if err != nil {
		return "", fmt.Errorf("no board connected: %w", err)
	}
	if base == "" {
		return "", fmt.Errorf("no board connected")
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+path, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("orchestrator request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, maxOrchestratorBody))
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("orchestrator returned %s: %s", resp.Status, string(respBody))
	}
	return string(respBody), nil
}

// orchestratorRequest does a {method} {orchestratorBaseURL}{path} with an optional JSON body (nil for none) and
// returns the response body. Used for the mutating verbs (PUT/PATCH/DELETE); GET/POST have their own helpers.
func orchestratorRequest(ctx context.Context, access BoardAccess, method, path string, body []byte) (string, error) {
	base, err := access.OrchestratorBaseURL(ctx)
	if err != nil {
		return "", fmt.Errorf("no board connected: %w", err)
	}
	if base == "" {
		return "", fmt.Errorf("no board connected")
	}

	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, base+path, reader)
	if err != nil {
		return "", err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("orchestrator request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, maxOrchestratorBody))
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("orchestrator returned %s: %s", resp.Status, string(respBody))
	}
	return string(respBody), nil
}

// textResult wraps plain text as an MCP tool result.
func textResult(text string) *mcp.CallToolResult {
	return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: text}}}
}
