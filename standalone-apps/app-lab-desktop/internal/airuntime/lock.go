// Cross-process advisory install lock that prevents concurrent `npm ci`.

package airuntime

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

// ErrInstallInProgress is returned when another process holds the install lock.
var ErrInstallInProgress = errors.New("airuntime: another install is already in progress")

// errLockHeld is the internal sentinel for non-blocking lock contention.
var errLockHeld = errors.New("lock held")

// installLock is a held advisory file lock.
type installLock struct {
	f *os.File
}

// release drops the lock and closes the file (the lock file is left in place).
func (l *installLock) release() {
	if l == nil || l.f == nil {
		return
	}
	_ = unlockFile(l.f)
	_ = l.f.Close()
}

// acquireInstallLock takes a non-blocking exclusive lock on <runtimeDir>/.install.lock.
func acquireInstallLock(runtimeDir string) (*installLock, error) {
	if err := os.MkdirAll(runtimeDir, 0o755); err != nil {
		return nil, fmt.Errorf("create runtime dir: %w", err)
	}
	p := filepath.Join(runtimeDir, ".install.lock")
	f, err := os.OpenFile(p, os.O_CREATE|os.O_RDWR, 0o644)
	if err != nil {
		return nil, fmt.Errorf("open lock file: %w", err)
	}
	if err := lockFile(f); err != nil {
		_ = f.Close()
		if errors.Is(err, errLockHeld) {
			return nil, ErrInstallInProgress
		}
		return nil, fmt.Errorf("acquire lock: %w", err)
	}
	return &installLock{f: f}, nil
}
