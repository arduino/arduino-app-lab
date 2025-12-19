//go:build windows
// +build windows

package opener

import (
	"os/exec"
)

func openWithDialog(path string) error {
	return exec.Command("rundll32.exe", "shell32.dll,OpenAs_RunDLL", path).Start()
}
