package boardmcp

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// resourcesMaxWait caps the system-resources snapshot read. The stream emits the first cpu/memory/disk
// batch immediately (then re-scrapes on tickers), so we grab that batch and stop; this is just the ceiling.
const resourcesMaxWait = 6 * time.Second

// registerSystemResources adds system_resources (read-only): a one-shot CPU/memory/disk snapshot of the board.
func registerSystemResources(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "system_resources",
		Description: "Report the connected board's current resource usage: CPU (percent in use), memory (used/total bytes) and disk(s) (mount path, used/total bytes). Read-only — a one-shot snapshot. Takes no arguments.",
	}, func(ctx context.Context, _ *mcp.CallToolRequest, _ noArgs) (*mcp.CallToolResult, any, error) {
		snap, err := orchestratorResourcesSnapshot(ctx, access)
		if err != nil {
			return nil, nil, err
		}
		return textResult(snap), nil, nil
	})
	return "system_resources"
}

// registerSystemName adds system_name (read-only): the board's configured device name (e.g. 'estrella').
func registerSystemName(srv *mcp.Server, access BoardAccess) string {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "system_name",
		Description: "Report the connected board's configured device name (e.g. 'estrella') — the user-set name, distinct from the hardware model (that's board_status). Read-only. Takes no arguments.",
	}, func(ctx context.Context, _ *mcp.CallToolRequest, _ noArgs) (*mcp.CallToolResult, any, error) {
		name, err := access.SystemName(ctx)
		if err != nil {
			return nil, nil, err
		}
		out, err := json.MarshalIndent(struct {
			Name string `json:"name"`
		}{Name: name}, "", "  ")
		if err != nil {
			return nil, nil, err
		}
		return textResult(string(out)), nil, nil
	})
	return "system_name"
}

// system-resources snapshot shapes — mirror arduino-app-cli's SSE event data (cpu/mem/disk).
type resourceCPU struct {
	UsedPercent float64 `json:"used_percent"`
}
type resourceMemory struct {
	Used  uint64 `json:"used"`
	Total uint64 `json:"total"`
}
type resourceDisk struct {
	Path  string `json:"path"`
	Used  uint64 `json:"used"`
	Total uint64 `json:"total"`
}
type resourcesSnapshot struct {
	CPU    *resourceCPU    `json:"cpu,omitempty"`
	Memory *resourceMemory `json:"memory,omitempty"`
	Disks  []resourceDisk  `json:"disks,omitempty"`
}

// orchestratorResourcesSnapshot reads the system-resources SSE stream (a continuous monitor) just long
// enough to capture the initial cpu/memory/disk batch, then stops and returns it as a one-shot snapshot.
func orchestratorResourcesSnapshot(ctx context.Context, access BoardAccess) (string, error) {
	base, err := access.OrchestratorBaseURL(ctx)
	if err != nil {
		return "", fmt.Errorf("no board connected: %w", err)
	}
	if base == "" {
		return "", fmt.Errorf("no board connected")
	}

	ctx, cancel := context.WithTimeout(ctx, resourcesMaxWait)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"/v1/system/resources", nil)
	if err != nil {
		return "", err
	}
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

	var snap resourcesSnapshot
	var streamErr string
	// The initial batch is cpu + memory + at least one disk; stop as soon as we have it (or time out).
loop:
	for snap.CPU == nil || snap.Memory == nil || len(snap.Disks) == 0 {
		select {
		case <-ctx.Done():
			break loop
		case ev, ok := <-events:
			if !ok {
				break loop
			}
			switch ev.name {
			case "cpu":
				var c resourceCPU
				if json.Unmarshal([]byte(ev.data), &c) == nil {
					snap.CPU = &c
				}
			case "mem":
				var m resourceMemory
				if json.Unmarshal([]byte(ev.data), &m) == nil {
					snap.Memory = &m
				}
			case "disk":
				var d resourceDisk
				if json.Unmarshal([]byte(ev.data), &d) == nil {
					snap.Disks = append(snap.Disks, d)
				}
			case "error":
				var e struct {
					Message string `json:"message"`
				}
				if json.Unmarshal([]byte(ev.data), &e) == nil {
					streamErr = e.Message
				}
			}
		}
	}

	if snap.CPU == nil && snap.Memory == nil && len(snap.Disks) == 0 {
		if streamErr != "" {
			return "", fmt.Errorf("orchestrator resources stream error: %s", streamErr)
		}
		return "", fmt.Errorf("no resource data received from the board")
	}
	out, err := json.MarshalIndent(snap, "", "  ")
	if err != nil {
		return "", err
	}
	return string(out), nil
}
