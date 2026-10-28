package app

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"app-lab-desktop/internal/airuntime"

	"github.com/stretchr/testify/require"
)

// existingTerminal is an executable that is available on every platform.
func existingTerminal() string {
	if runtime.GOOS == "windows" {
		return "cmd"
	}
	return "sh"
}

func TestTerminalPreference(t *testing.T) {
	// The app data root is overridden with an environment variable: the
	// OS-specific variables are honoured on some platforms only.
	t.Setenv(airuntime.DataHomeEnv, t.TempDir())

	require.Empty(t, readTerminalPreference(), "the preference is empty when it has not been set")

	require.NoError(t, writeTerminalPreference("alacritty"))
	require.Equal(t, "alacritty", readTerminalPreference())

	require.NoError(t, writeTerminalPreference(""))
	require.Empty(t, readTerminalPreference())
}

func TestTerminalPreferenceFile(t *testing.T) {
	appDataDir := t.TempDir()
	t.Setenv(airuntime.DataHomeEnv, appDataDir)

	require.NoError(t, writeTerminalPreference("ghostty"))

	path := filepath.Join(appDataDir, "arduino-app-lab", "terminal-settings.json")
	content, err := os.ReadFile(path)
	require.NoError(t, err)
	require.Contains(t, string(content), "ghostty")
}

func TestSetTerminalPreference(t *testing.T) {
	t.Setenv(airuntime.DataHomeEnv, t.TempDir())

	// A terminal that does not exist is rejected.
	require.Error(t, setTerminalPreference("this-terminal-does-not-exist"))
	require.Empty(t, readTerminalPreference())

	// An empty value restores the automatic detection.
	require.NoError(t, setTerminalPreference(""))
	require.Empty(t, readTerminalPreference())

	require.NoError(t, setTerminalPreference(existingTerminal()))
	require.Equal(t, existingTerminal(), readTerminalPreference())

	// A command with arguments is accepted.
	require.NoError(t, setTerminalPreference(existingTerminal()+" --title foo"))
	require.Equal(t, existingTerminal()+" --title foo", readTerminalPreference())

	// A command with a line break is rejected.
	require.Error(t, setTerminalPreference(existingTerminal()+"\n--title foo"))
}
