//go:build linux || freebsd || openbsd || netbsd
// +build linux freebsd openbsd netbsd

package opener

import (
	"os/exec"
)

func openWithDialog(path string) error {
	if err := exec.Command("gio", "open", path).Start(); err == nil {
		return nil
	}
	return exec.Command("xdg-open", path).Start()
}
