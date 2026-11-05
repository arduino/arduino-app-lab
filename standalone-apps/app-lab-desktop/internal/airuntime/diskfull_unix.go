//go:build !windows

// Classifies out-of-space (ENOSPC) errors raised by install writes.

package airuntime

import (
	"errors"
	"syscall"
)

// isDiskFull reports whether err was caused by the filesystem being full.
func isDiskFull(err error) bool {
	return errors.Is(err, syscall.ENOSPC)
}

func freeBytes(path string) (uint64, error) {
	var st syscall.Statfs_t
	if err := syscall.Statfs(path, &st); err != nil {
		return 0, err
	}
	return uint64(st.Bavail) * uint64(st.Bsize), nil
}
