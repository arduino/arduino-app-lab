package agent

import (
	"context"
	"strings"
	"sync"
	"time"
)

// Without its arguments a request is still asked, only with no command shown and no app to scope "Always allow" to.
var argumentsWait = time.Second

// OpenCode asks for an MCP tool with an empty input, and the SDK runs that request while the update with the arguments may still be queued.
type callInputs struct {
	mu      sync.Mutex
	inputs  map[string]any
	arrived map[string]chan struct{} // closed once the call's arguments are in inputs
}

func callKey(sid SessionID, callID string) string { return string(sid) + "\x00" + callID }

// A pending call's input is still empty on OpenCode, so only a running call, or one already carrying arguments, counts.
func (c *callInputs) announce(sid SessionID, callID string, input any, status string) {
	if callID == "" {
		return
	}
	key := callKey(sid, callID)
	c.mu.Lock()
	defer c.mu.Unlock()
	switch {
	case status == "completed" || status == "failed":
		delete(c.inputs, key)
		delete(c.arrived, key)
		return
	case status != "in_progress" && !hasArguments(input):
		return
	}
	ch := c.channelLocked(key)
	c.inputs[key] = input
	select {
	case <-ch:
	default:
		close(ch)
	}
}

// wait returns the call's announced arguments, waiting up to argumentsWait for them to arrive.
func (c *callInputs) wait(ctx context.Context, sid SessionID, callID string) (any, bool) {
	key := callKey(sid, callID)
	c.mu.Lock()
	ch := c.channelLocked(key)
	c.mu.Unlock()

	timer := time.NewTimer(argumentsWait)
	defer timer.Stop()
	select {
	case <-ch:
	case <-timer.C:
		return nil, false
	case <-ctx.Done():
		return nil, false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	input, ok := c.inputs[key]
	return input, ok
}

// channelLocked returns the call's arrival channel, creating it; c.mu must be held.
func (c *callInputs) channelLocked(key string) chan struct{} {
	if c.arrived == nil {
		c.inputs, c.arrived = map[string]any{}, map[string]chan struct{}{}
	}
	ch, ok := c.arrived[key]
	if !ok {
		ch = make(chan struct{})
		c.arrived[key] = ch
	}
	return ch
}

// forget drops a closed session's calls, including those whose update never said they finished.
func (c *callInputs) forget(sid SessionID) {
	prefix := callKey(sid, "")
	c.mu.Lock()
	defer c.mu.Unlock()
	for key := range c.arrived {
		if strings.HasPrefix(key, prefix) {
			delete(c.inputs, key)
			delete(c.arrived, key)
		}
	}
}

func hasArguments(input any) bool {
	m, ok := input.(map[string]any)
	return ok && len(m) > 0
}

// A copy where the request's own keys win: App Lab writes into the request's input, and the announced map is the chat's too.
func withArguments(own, announced any) any {
	from, ok := announced.(map[string]any)
	if !ok {
		return own
	}
	merged := make(map[string]any, len(from))
	for k, v := range from {
		merged[k] = v
	}
	if mine, ok := own.(map[string]any); ok {
		for k, v := range mine {
			merged[k] = v
		}
	}
	return merged
}
