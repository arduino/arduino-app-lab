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

func freeBytes(path string) (uint64, error) {
	p, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return 0, err
	}
	var free, total, totalFree uint64
	if err := windows.GetDiskFreeSpaceEx(p, &free, &total, &totalFree); err != nil {
		return 0, err
	}
	return free, nil
}
