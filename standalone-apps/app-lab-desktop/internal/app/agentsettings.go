package app

// Cross-agent preferences (which agent is the default for new sessions), persisted in the app-data root so they survive a per-agent runtime uninstall.

import (
	"encoding/json"
	"os"
	"path/filepath"

	"app-lab-desktop/internal/airuntime"
)

const aiSettingsFile = "ai-settings.json"

type aiSettings struct {
	DefaultAgent string `json:"defaultAgent,omitempty"`
}

func aiSettingsPath() (string, error) {
	dir, err := airuntime.AppDataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, aiSettingsFile), nil
}

// readDefaultAgent returns the persisted default agent id (empty if unset or unreadable).
func readDefaultAgent() string {
	path, err := aiSettingsPath()
	if err != nil {
		return ""
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	var s aiSettings
	if json.Unmarshal(data, &s) != nil {
		return ""
	}
	return s.DefaultAgent
}

// writeDefaultAgent persists the default agent id atomically (temp file + rename).
func writeDefaultAgent(id string) error {
	path, err := aiSettingsPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(aiSettings{DefaultAgent: id}, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
