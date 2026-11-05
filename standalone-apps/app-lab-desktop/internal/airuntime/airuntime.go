// Manager: orchestrates install / status / uninstall of the per-agent runtime.

package airuntime

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// ErrInsufficientDiskSpace is what an install that runs out of disk space matches with errors.Is; the error itself is a *DiskSpaceError.
var ErrInsufficientDiskSpace = errors.New("insufficient disk space")

// DiskSpaceError is a disk too full for the runtime; the frontend words it from the two sizes, the message is its fallback.
type DiskSpaceError struct {
	Code        string  `json:"code"`
	Message     string  `json:"message"`
	NeededBytes uint64  `json:"neededBytes"`
	FreeBytes   *uint64 `json:"freeBytes,omitempty"` // absent when the disk could not be measured
}

func (e *DiskSpaceError) Error() string        { return e.Message }
func (e *DiskSpaceError) ErrorCode() string    { return e.Code }
func (e *DiskSpaceError) Is(target error) bool { return target == ErrInsufficientDiskSpace }

// diskSpaceError measures dir again for the frontend's wording.
func diskSpaceError(dir, detail string) error {
	e := &DiskSpaceError{Code: "airuntime_insufficient_disk_space", Message: "insufficient disk space: " + detail, NeededBytes: installFootprintBytes}
	if free, err := freeBytes(dir); err == nil {
		e.FreeBytes = &free
	}
	return e
}

// Status mirrors the TS RuntimeStatus contract.
type Status struct {
	Installed bool `json:"installed"`
	// The agent's own package version; Version is Node's, which every agent shares.
	AgentVersion   string `json:"agentVersion,omitempty"`
	Version        string `json:"version,omitempty"`
	DiskUsageBytes int64  `json:"diskUsageBytes,omitempty"`
}

// Manager installs, inspects and removes the on-demand runtime for one agent.
type Manager struct {
	agent      AgentID // which agent's dependency set and runtime dir this manages
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
	return &Manager{agent: agent, runtimeDir: runtimeDirForRoot(root, agent)}, nil
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
	// The manifest can outlive the tree `npm ci` emptied; one stat on the tree itself cannot lie that way.
	if !hasInstalledPackages(m.runtimeDir) {
		return Status{Installed: false}, nil
	}
	return Status{
		Installed:      true,
		AgentVersion:   man.Packages[supportedAgents[m.agent].primaryPackage],
		Version:        man.NodeVersion,
		DiskUsageBytes: dirSize(m.runtimeDir),
	}, nil
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
	lockSum, err := lockfileSHA256(m.agent)
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

	// Stamped here, so no phase can forget it: every emitter below goes through this one func.
	emit := func(p Progress) {
		if onProgress != nil {
			p.Agent = m.agent
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

	// Preflight (ai-agent.md §1): everything below only classifies ENOSPC after a half-install exists.
	if err := checkFreeSpace(m.runtimeDir); err != nil {
		return err
	}

	// Cross-process lock so a second App Lab window can't race this install.
	lock, err := acquireInstallLock(m.runtimeDir)
	if err != nil {
		return err
	}
	defer lock.release()

	if err := installNodeRuntime(ctx, m.nodeInstall(), emit); err != nil {
		return asDiskFull(m.runtimeDir, err)
	}

	if err := materializeDeps(m.runtimeDir, m.agent); err != nil {
		return asDiskFull(m.runtimeDir, err)
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
			return diskSpaceError(m.runtimeDir, err.Error())
		}
		return err
	}

	if err := m.writeManifest(); err != nil {
		return err
	}
	emit(Progress{Phase: PhaseDone, Pct: pctOf(pctDone)})
	return nil
}

// Agent is which agent this manager installs and reports on.
func (m *Manager) Agent() AgentID { return m.agent }

// Nothing else tells a complete install from one whose packages a failed `npm ci` removed.
func hasInstalledPackages(runtimeDir string) bool {
	entries, err := os.ReadDir(filepath.Join(runtimeDir, "node_modules"))
	return err == nil && len(entries) > 0
}

// ~1.0 GB measured plus headroom for npm's cache; too generous would refuse a machine that would fit.
const installFootprintBytes = 3 << 29 // 1.5 GiB

// A filesystem that cannot answer does not block: this fails early, asDiskFull still catches real ENOSPC.
func checkFreeSpace(dir string) error {
	free, err := freeBytes(dir)
	if err != nil {
		slog.Warn("could not read free disk space; installing without the preflight", "dir", dir, "err", err)
		return nil
	}
	if free < installFootprintBytes {
		return diskSpaceError(dir, fmt.Sprintf("the agent runtime needs about %.1f GB free, and this disk has %d MB",
			float64(installFootprintBytes)/(1<<30), free>>20))
	}
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
	pkgs, err := pinnedPackages(m.agent)
	if err != nil {
		return err
	}
	lockSum, err := lockfileSHA256(m.agent)
	if err != nil {
		return err
	}
	return writeManifest(manifestPathOf(m.runtimeDir), &Manifest{
		NodeVersion:    defaultNodeVersion,
		LockfileSHA256: lockSum,
		Packages:       pkgs,
	})
}

// asDiskFull maps an out-of-space failure to a DiskSpaceError; other errors pass through.
func asDiskFull(dir string, err error) error {
	if err != nil && isDiskFull(err) {
		return diskSpaceError(dir, err.Error())
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

// dirSize sums the sizes of all regular files under root (best effort); a hard-linked file counts once, as on disk.
func dirSize(root string) int64 {
	var total int64
	linked := map[fileID]bool{}
	_ = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || !d.Type().IsRegular() {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil
		}
		if id, ok := hardLinkID(path, info); ok {
			if linked[id] {
				return nil
			}
			linked[id] = true
		}
		total += info.Size()
		return nil
	})
	return total
}

// fileID is a file's identity on disk, shared by all of its hard links.
type fileID struct{ dev, ino uint64 }
