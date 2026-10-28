package terminal

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// createWrapperScript creates the script that runs the given command inside the
// terminal and keeps it open. The script removes itself once it terminates.
func createWrapperScript(command []string) (string, error) {
	dir, err := os.MkdirTemp("", "app-lab-terminal-")
	if err != nil {
		slog.Error("failed to create temporary directory", "err", err)
		return "", fmt.Errorf("could not create the temporary directory: %w", err)
	}
	cleanupStaleScripts(dir)

	content, err := scriptContent(command)
	if err != nil {
		slog.Error("failed to create the wrapper script", "err", err)
		os.RemoveAll(dir)
		return "", err
	}

	scriptPath := filepath.Join(dir, scriptName)
	if err := os.WriteFile(scriptPath, []byte(content), 0700); err != nil {
		slog.Error("failed to write file", "err", err, "path", scriptPath)
		os.RemoveAll(dir)
		return "", fmt.Errorf("could not create the wrapper script: %w", err)
	}
	return scriptPath, nil
}

// cleanupStaleScripts removes the scripts left behind by a previous run that
// were never executed.
func cleanupStaleScripts(currentDir string) {
	entries, err := os.ReadDir(os.TempDir())
	if err != nil {
		return
	}
	for _, entry := range entries {
		if !entry.IsDir() || !strings.HasPrefix(entry.Name(), "app-lab-terminal-") {
			continue
		}
		path := filepath.Join(os.TempDir(), entry.Name())
		if path == currentDir {
			continue
		}
		info, err := entry.Info()
		if err != nil || time.Since(info.ModTime()) < time.Hour {
			continue
		}
		os.RemoveAll(path)
	}
}
