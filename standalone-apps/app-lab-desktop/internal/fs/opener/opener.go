package opener

// The public entry point is:
//   err := opener.Open(filePath)
//
// Supported platforms: Windows, macOS, and Linux/X11/Wayland.
//
// All operations are performed asynchronously; when an application is found it
// is spawned and this function returns immediately.
import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

// Open tries to launch path in Arduino IDE 2.x when possible, otherwise it
// opens the OS‑native "Open With..." dialog.  For *.py files the dialog is always shown.
func Open(path string) error {
	if path == "" {
		return errors.New("opener: empty path")
	}

	absPath, err := filepath.Abs(path)
	if err != nil {
		return fmt.Errorf("opener: %w", err)
	}

	info, err := os.Stat(absPath)
	if err != nil {
		return fmt.Errorf("opener: %w", err)
	}
	if info.IsDir() {
		return fmt.Errorf("opener: %s is a directory, not a file", absPath)
	}

	return openWithDialog(absPath)
}
