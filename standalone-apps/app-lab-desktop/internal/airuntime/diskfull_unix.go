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
