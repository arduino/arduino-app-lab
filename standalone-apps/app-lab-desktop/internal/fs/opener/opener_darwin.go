//go:build darwin
// +build darwin

package opener

import (
	"os/exec"
)

func openWithDialog(path string) error {
	return exec.Command("open", path).Start()
}
