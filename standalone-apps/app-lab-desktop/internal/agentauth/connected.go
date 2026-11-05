// The record that the user chose an agent that asks for no credential.

package agentauth

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"app-lab-desktop/internal/airuntime"
)

// connectedFile marks an agent connected without credentials: installed on disk is not connected.
const connectedFile = "connected.json"

// MarkConnected records that the user connected this agent, and when.
func MarkConnected(agent airuntime.AgentID) error {
	path, err := connectedPath(agent)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.Marshal(struct {
		ConnectedAt time.Time `json:"connectedAt"`
	}{time.Now().UTC()})
	if err != nil {
		return err
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("agentauth: record the connection: %w", err)
	}
	return nil
}

// ConnectedAt is when the user connected a credential-free agent; zero when they never did.
func ConnectedAt(agent airuntime.AgentID) time.Time {
	path, err := connectedPath(agent)
	if err != nil {
		return time.Time{}
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return time.Time{}
	}
	var rec struct {
		ConnectedAt time.Time `json:"connectedAt"`
	}
	if err := json.Unmarshal(data, &rec); err != nil {
		return time.Time{}
	}
	return rec.ConnectedAt
}

// ClearConnected forgets the connection at sign-out; a missing record is not an error.
func ClearConnected(agent airuntime.AgentID) error {
	path, err := connectedPath(agent)
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("agentauth: clear the connection: %w", err)
	}
	return nil
}

func connectedPath(agent airuntime.AgentID) (string, error) {
	// Every other door here refuses an id it does not know; this one joined it into a path unchecked.
	if _, err := profileFor(agent); err != nil {
		return "", err
	}
	dir, err := airuntime.AgentConfigDir(agent)
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, connectedFile), nil
}
