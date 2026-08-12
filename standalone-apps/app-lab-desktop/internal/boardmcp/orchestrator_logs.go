package boardmcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// App-logs is a Server-Sent Events stream (buffered tail, then live). These bound a read into a snapshot instead of following forever.
const (
	sseIdleTimeout = 700 * time.Millisecond // once lines flow, stop after this much silence (the tail arrives in a burst)
	logsMaxWait    = 8 * time.Second        // hard end-to-end cap; also the max wait for the first buffered line, so a slow board isn't a false "no logs"
)

// orchestratorLogsTail opens an app-logs SSE stream and returns the buffered tail (message events), stopping once the stream goes idle, ends, or the deadline hits — it never follows live output.
func orchestratorLogsTail(ctx context.Context, access BoardAccess, path string) (string, error) {
	base, err := access.OrchestratorBaseURL(ctx)
	if err != nil {
		return "", fmt.Errorf("no board connected: %w", err)
	}
	if base == "" {
		return "", fmt.Errorf("no board connected")
	}

	ctx, cancel := context.WithTimeout(ctx, logsMaxWait)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+path, nil)
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

	var lines []string
	var streamErr string
	gotData := false
loop:
	for {
		wait := logsMaxWait // before any data, wait the whole budget (ctx bounds it) rather than giving up early on a slow board
		if gotData {
			wait = sseIdleTimeout
		}
		select {
		case <-ctx.Done():
			break loop
		case ev, ok := <-events:
			if !ok {
				break loop
			}
			switch ev.name {
			case "done", "close":
				break loop
			case "message":
				var m struct {
					Message string `json:"message"`
				}
				if json.Unmarshal([]byte(ev.data), &m) == nil && m.Message != "" {
					lines = append(lines, m.Message)
					gotData = true
				}
			case "error":
				var e struct {
					Message string `json:"message"`
				}
				if json.Unmarshal([]byte(ev.data), &e) == nil {
					streamErr = e.Message
				}
			}
		case <-time.After(wait):
			break loop
		}
	}

	if len(lines) == 0 && streamErr != "" {
		return "", fmt.Errorf("orchestrator log stream error: %s", streamErr)
	}
	return strings.Join(lines, "\n"), nil
}

// sseEvent is one parsed Server-Sent Event (name defaults to "message" per the SSE spec).
type sseEvent struct {
	name string
	data string
}

// readSSE parses a text/event-stream into events, closing the channel at EOF or when ctx is cancelled.
func readSSE(ctx context.Context, r io.Reader, out chan<- sseEvent) {
	defer close(out)
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	var name, data string
	for sc.Scan() {
		line := sc.Text()
		switch {
		case line == "":
			if name == "" && data == "" {
				continue
			}
			ev := sseEvent{name: name, data: data}
			if ev.name == "" {
				ev.name = "message"
			}
			select {
			case out <- ev:
			case <-ctx.Done():
				return
			}
			name, data = "", ""
		case strings.HasPrefix(line, "event:"):
			name = strings.TrimSpace(line[len("event:"):])
		case strings.HasPrefix(line, "data:"):
			d := strings.TrimPrefix(line[len("data:"):], " ")
			if data == "" {
				data = d
			} else {
				data += "\n" + d
			}
		}
	}
}
