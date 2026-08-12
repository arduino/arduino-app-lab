package arduinoapps

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// maxAppDetailBody caps the app-detail response so a hostile/huge body can't be read unbounded (mirrors boardmcp's 1 MiB cap).
const maxAppDetailBody = 1 << 20

// AppPath returns an app's filesystem path on the board, from the orchestrator's app detail (GET /v1/apps/{id}).
func AppPath(ctx context.Context, orchestratorURL, appID string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	endpoint := fmt.Sprintf("%s/v1/apps/%s", orchestratorURL, url.PathEscape(appID))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("app detail request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxAppDetailBody))
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("app detail returned %d: %s", resp.StatusCode, string(body))
	}
	var detail struct {
		Path string `json:"path"`
	}
	if err := json.Unmarshal(body, &detail); err != nil {
		return "", fmt.Errorf("parse app detail: %w", err)
	}
	if detail.Path == "" {
		return "", fmt.Errorf("app %q has no path on the board", appID)
	}
	return detail.Path, nil
}

// AppName returns an app's display name from the orchestrator's app detail (GET /v1/apps/{id}). Best-effort,
// used to label the permission dialog with a readable name; a short timeout keeps a slow board from delaying it.
func AppName(ctx context.Context, orchestratorURL, appID string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	endpoint := fmt.Sprintf("%s/v1/apps/%s", orchestratorURL, url.PathEscape(appID))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("app detail request failed: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxAppDetailBody))
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("app detail returned %d: %s", resp.StatusCode, string(body))
	}
	var detail struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(body, &detail); err != nil {
		return "", fmt.Errorf("parse app detail: %w", err)
	}
	return detail.Name, nil
}

// List returns the ids of every app on the board (user apps and examples), from GET /v1/apps.
func List(ctx context.Context, orchestratorURL string) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	endpoint := fmt.Sprintf("%s/v1/apps", orchestratorURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("apps list request failed: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxAppDetailBody))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("apps list returned %d: %s", resp.StatusCode, string(body))
	}
	var parsed struct {
		Apps []struct {
			ID string `json:"id"`
		} `json:"apps"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("parse apps list: %w", err)
	}
	ids := make([]string, 0, len(parsed.Apps))
	for _, a := range parsed.Apps {
		if a.ID != "" {
			ids = append(ids, a.ID)
		}
	}
	return ids, nil
}
