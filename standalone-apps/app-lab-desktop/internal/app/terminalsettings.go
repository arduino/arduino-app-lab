package app

// Terminal preferences (which terminal emulator is used to open the board shell),
// persisted in the app-data root so they survive a per-agent runtime uninstall.

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"app-lab-desktop/internal/airuntime"
	"app-lab-desktop/internal/terminal"
)

const terminalSettingsFile = "terminal-settings.json"

type terminalSettings struct {
	// Terminal is the terminal emulator selected by the user, an empty value
	// means that the terminal is detected automatically.
	Terminal string `json:"terminal,omitempty"`
}

func terminalSettingsPath() (string, error) {
	dir, err := airuntime.AppDataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, terminalSettingsFile), nil
}

// readTerminalPreference returns the persisted terminal selection (empty if unset
// or unreadable).
func readTerminalPreference() string {
	path, err := terminalSettingsPath()
	if err != nil {
		return ""
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	var s terminalSettings
	if json.Unmarshal(data, &s) != nil {
		return ""
	}
	return strings.TrimSpace(s.Terminal)
}

// writeTerminalPreference persists the terminal selection atomically (temp file + rename).
func writeTerminalPreference(value string) error {
	path, err := terminalSettingsPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(terminalSettings{Terminal: strings.TrimSpace(value)}, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// setTerminalPreference validates and persists the terminal selected by the user.
func setTerminalPreference(value string) error {
	value = strings.TrimSpace(value)
	if value != "" {
		if err := terminal.ValidateCommand(value); err != nil {
			return err
		}
	}
	return writeTerminalPreference(value)
}
