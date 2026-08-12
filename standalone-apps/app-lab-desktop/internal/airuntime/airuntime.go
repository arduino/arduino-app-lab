// Manager: orchestrates install / status / uninstall of the per-agent runtime.

package airuntime

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// ErrInsufficientDiskSpace is returned when an install step runs out of disk space.
var ErrInsufficientDiskSpace = errors.New("airuntime: insufficient disk space")

// Status mirrors the TS RuntimeStatus contract.
type Status struct {
	Installed      bool   `json:"installed"`
	Version        string `json:"version,omitempty"`
	DiskUsageBytes int64  `json:"diskUsageBytes,omitempty"`
}

// Manager installs, inspects and removes the on-demand runtime for one agent.
type Manager struct {
	runtimeDir string

	mu sync.Mutex // serialises Install/Uninstall within this process

	cancelMu sync.Mutex
	cancel   context.CancelFunc
}

// New builds a Manager for the given agent.
func New(agent AgentID) (*Manager, error) {
	if !isSupported(agent) {
		return nil, fmt.Errorf("airuntime: unsupported agent id %q", agent)
	}
	root, err := appDataRoot()
	if err != nil {
		return nil, err
	}
	return &Manager{runtimeDir: runtimeDirForRoot(root, agent)}, nil
}

// Status reports whether the runtime is installed, plus its Node version and disk size.
func (m *Manager) Status(_ context.Context) (Status, error) {
	man, err := readManifest(manifestPathOf(m.runtimeDir))
	if err != nil {
		return Status{}, err
	}
	if man == nil {
		return Status{Installed: false}, nil
	}
	return Status{Installed: true, Version: man.NodeVersion, DiskUsageBytes: dirSize(m.runtimeDir)}, nil
}

// UpdateCheck mirrors the TS RuntimeUpdateCheck contract.
type UpdateCheck struct {
	UpdateAvailable bool   `json:"updateAvailable"`
	LatestVersion   string `json:"latestVersion,omitempty"`
}

// CheckUpdate reports whether the installed runtime differs from the versions this app build pins (Node version or dependency lockfile). No network: "latest" is what this build ships, so an update surfaces after the app itself updates. Re-running Install applies it.
func (m *Manager) CheckUpdate(_ context.Context) (UpdateCheck, error) {
	man, err := readManifest(manifestPathOf(m.runtimeDir))
	if err != nil {
		return UpdateCheck{}, err
	}
	if man == nil {
		return UpdateCheck{LatestVersion: defaultNodeVersion}, nil
	}
	lockSum, err := lockfileSHA256()
	if err != nil {
		return UpdateCheck{}, err
	}
	outdated := man.NodeVersion != defaultNodeVersion || man.LockfileSHA256 != lockSum
	return UpdateCheck{UpdateAvailable: outdated, LatestVersion: defaultNodeVersion}, nil
}

// Install runs preflight, lock, Node download/verify/extract, `npm ci`, then writes the manifest.
func (m *Manager) Install(parentCtx context.Context, onProgress ProgressFunc) (err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	emit := func(p Progress) {
		if onProgress != nil {
			onProgress(p)
		}
	}
	defer func() {
		if err != nil {
			emitError(emit, err)
		}
	}()

	ctx, cancel := context.WithCancel(parentCtx)
	m.setCancel(cancel)
	defer m.setCancel(nil)
	defer cancel()

	if err := os.MkdirAll(m.runtimeDir, 0o755); err != nil {
		return fmt.Errorf("create runtime dir: %w", err)
	}

	// Cross-process lock so a second App Lab window can't race this install.
	lock, err := acquireInstallLock(m.runtimeDir)
	if err != nil {
		return err
	}
	defer lock.release()

	if err := installNodeRuntime(ctx, m.nodeInstall(), emit); err != nil {
		return asDiskFull(err)
	}

	if err := materializeDeps(m.runtimeDir); err != nil {
		return asDiskFull(err)
	}

	// `npm ci` is a subprocess, so a disk-full shows up in its output rather
	// than as a typed error — watch the stream for ENOSPC.
	npmDiskFull := false
	emit(Progress{Phase: PhaseNpm, Message: "Installing agent packages", Pct: pctOf(pctNpm)})
	if err := runNpmCI(ctx, m.runtimeDir, func(line string) {
		if strings.Contains(line, "ENOSPC") {
			npmDiskFull = true
		}
		emit(Progress{Phase: PhaseNpm, Message: line, Pct: pctOf(pctNpm)})
	}); err != nil {
		if npmDiskFull {
			return fmt.Errorf("%w: %v", ErrInsufficientDiskSpace, err)
		}
		return err
	}

	if err := m.writeManifest(); err != nil {
		return err
	}
	emit(Progress{Phase: PhaseDone, Pct: pctOf(pctDone)})
	return nil
}

// Uninstall removes the runtime directory (idempotent).
func (m *Manager) Uninstall(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := os.RemoveAll(m.runtimeDir); err != nil {
		return fmt.Errorf("remove runtime dir: %w", err)
	}
	return nil
}

// Cancel aborts an in-flight Install (safe when idle).
func (m *Manager) Cancel() {
	m.cancelMu.Lock()
	defer m.cancelMu.Unlock()
	if m.cancel != nil {
		m.cancel()
	}
}

// setCancel stores (or clears) the cancel func for the running install.
func (m *Manager) setCancel(c context.CancelFunc) {
	m.cancelMu.Lock()
	defer m.cancelMu.Unlock()
	m.cancel = c
}

// nodeInstall builds the Node download parameters from package defaults.
func (m *Manager) nodeInstall() nodeInstall {
	return nodeInstall{
		runtimeDir: m.runtimeDir,
		version:    defaultNodeVersion,
		baseURL:    defaultNodeBaseURL,
		httpClient: defaultHTTPClient(),
		maxRetries: defaultMaxRetries,
	}
}

// writeManifest records the installed Node version, lockfile sha and packages.
func (m *Manager) writeManifest() error {
	pkgs, err := pinnedPackages()
	if err != nil {
		return err
	}
	lockSum, err := lockfileSHA256()
	if err != nil {
		return err
	}
	return writeManifest(manifestPathOf(m.runtimeDir), &Manifest{
		NodeVersion:    defaultNodeVersion,
		LockfileSHA256: lockSum,
		Packages:       pkgs,
	})
}

// asDiskFull maps an out-of-space failure to ErrInsufficientDiskSpace; other errors pass through.
func asDiskFull(err error) error {
	if err != nil && isDiskFull(err) {
		return fmt.Errorf("%w: %v", ErrInsufficientDiskSpace, err)
	}
	return err
}

// emitError reports a terminal error phase (cancellation gets a neutral message).
func emitError(emit ProgressFunc, err error) {
	msg := err.Error()
	if errors.Is(err, context.Canceled) {
		msg = "installation cancelled"
	}
	emit(Progress{Phase: PhaseError, Message: msg})
}

// dirSize sums the sizes of all regular files under root (best effort).
func dirSize(root string) int64 {
	var total int64
	_ = filepath.WalkDir(root, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.Type().IsRegular() {
			if info, err := d.Info(); err == nil {
				total += info.Size()
			}
		}
		return nil
	})
	return total
}
