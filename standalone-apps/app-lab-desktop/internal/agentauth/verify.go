// Checking an API key before we accept it, so "Verify" means what it says.

package agentauth

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"app-lab-desktop/internal/airuntime"
)

// verifyTimeout keeps the user's wait short: this runs behind the Verify button's spinner.
const verifyTimeout = 8 * time.Second

// ErrAPIKeyRejected means the provider answered that the key isn't valid — as opposed to not being able to ask at all.
var ErrAPIKeyRejected = errors.New("the API key was rejected by the provider")

// VerifyAPIKey asks the provider whether the key works, with a cheap authenticated GET rather than a full agent turn
// (which would mean spawning node, an ACP handshake and a session just to find out). It deliberately does NOT use
// internal/httpclient: that client's host allowlist is for App Lab's own backend, and this talks to the agent's
// provider — the same host the agent process itself calls once it is running.
func VerifyAPIKey(ctx context.Context, agent airuntime.AgentID, key string) error {
	p, err := profileFor(agent)
	if err != nil {
		return err
	}
	if p.apiKeyVerifyURL == "" {
		return nil // no way to check for this agent: accepting is better than blocking sign-in outright
	}
	ctx, cancel := context.WithTimeout(ctx, verifyTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.apiKeyVerifyURL, nil)
	if err != nil {
		return err
	}
	for k, v := range p.apiKeyVerifyHeaders(key) {
		req.Header.Set(k, v)
	}
	resp, err := (&http.Client{Timeout: verifyTimeout}).Do(req)
	if err != nil {
		// Couldn't ask: say so plainly instead of blaming the key, which may well be fine.
		return fmt.Errorf("could not reach %s to verify the API key (check your connection): %w", p.apiKeyVerifyURL, err)
	}
	defer resp.Body.Close()

	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return ErrAPIKeyRejected
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		return nil
	default:
		// A 5xx or a rate limit says nothing about the key, so don't reject it on that basis.
		return fmt.Errorf("could not verify the API key: the provider answered %s", resp.Status)
	}
}
