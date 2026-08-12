//go:build windows

// Classifies out-of-space errors raised by install writes.

package airuntime

import (
	"errors"
	"syscall"

	"golang.org/x/sys/windows"
)

// isDiskFull reports whether err was caused by the volume being full.
func isDiskFull(err error) bool {
	return errors.Is(err, syscall.ENOSPC) ||
		errors.Is(err, windows.ERROR_DISK_FULL) ||
		errors.Is(err, windows.ERROR_HANDLE_DISK_FULL)
}
