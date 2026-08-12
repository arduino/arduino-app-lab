// Persisting the explicit API-key credential in the OS keychain so it survives restarts, the way
// the subscription OAuth token does (see status.go). The key is never written to disk in plaintext.

package agentauth

import (
	"errors"
	"fmt"

	"github.com/zalando/go-keyring"

	"app-lab-desktop/internal/airuntime"
)

// keyringService namespaces the agent API keys in the OS keychain — one entry per agent id.
const keyringService = "AppLab-agent-apikey"

// StoreAPIKey persists the agent's API key in the OS keychain.
func StoreAPIKey(agent airuntime.AgentID, key string) error {
	if err := keyring.Set(keyringService, string(agent), key); err != nil {
		return fmt.Errorf("agentauth: store API key: %w", err)
	}
	return nil
}

// ReadAPIKey returns the agent's persisted API key, or "" if none is stored.
func ReadAPIKey(agent airuntime.AgentID) (string, error) {
	key, err := keyring.Get(keyringService, string(agent))
	if err != nil {
		if errors.Is(err, keyring.ErrNotFound) {
			return "", nil
		}
		return "", fmt.Errorf("agentauth: read API key: %w", err)
	}
	return key, nil
}

// DeleteAPIKey removes the agent's persisted API key; a missing entry is not an error.
func DeleteAPIKey(agent airuntime.AgentID) error {
	if err := keyring.Delete(keyringService, string(agent)); err != nil {
		if errors.Is(err, keyring.ErrNotFound) {
			return nil
		}
		return fmt.Errorf("agentauth: delete API key: %w", err)
	}
	return nil
}
