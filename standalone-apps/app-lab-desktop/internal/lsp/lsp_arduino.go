package lsp

import (
	"app-lab-desktop/internal/board"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"time"

	"github.com/arduino/go-paths-helper"
)

const boardArduino15Dir = "/home/arduino/.arduino15"
const boardArduinoCliPath = "/usr/bin/arduino-cli"

// staleIndexURLs are package indexes earlier versions registered to reach a
// core that the public board manager did not carry yet. They are removed from
// every install: they publish semver pre-releases that outrank the public
// releases, so one left registered decides the "latest" version for every
// board sharing that core.
//
// ventunoq needed the zephyr staging index until arduino:zephyr 1.0.0, which
// carries it in the public index.
var staleIndexURLs = []string{
	"https://downloads.arduino.cc/packages/package_zephyr_staging_index.json",
}

func (h *LSPHandler) initArduinoCliConfig() error {
	if err := h.ensureResources(); err != nil {
		return err
	}

	h.initArduinoCliConfigMu.Lock()
	defer h.initArduinoCliConfigMu.Unlock()

	arduino15Path := getArduino15Path()
	arduinoCliConfigPath := getArduinoCliConfigPath()
	arduinoCliPath := getArduinoCliPath()

	created, err := createArduinoCliConfig(arduinoCliPath, arduino15Path, arduinoCliConfigPath)
	if err != nil {
		return fmt.Errorf("failed to create arduino-cli config: %w", err)
	}

	// Run unconditionally, not just for a fresh config: the config is persistent,
	// so every existing install already has one and would keep reporting in the
	// host language otherwise.
	ensureArduinoCliLocale(arduinoCliPath, arduinoCliConfigPath)

	if created {
		if err := updateArduinoCliIndex(context.Background(), "core", arduinoCliPath, arduinoCliConfigPath); err != nil {
			return fmt.Errorf("failed to update arduino-cli core index: %w", err)
		}
		h.coreIndexRefreshed = true
	}

	return nil
}

func createArduinoCliConfig(arduinoCliPath, arduino15Path, arduinoCliConfigPath string) (bool, error) {
	if _, err := os.Stat(arduinoCliConfigPath); err == nil {
		slog.Info("arduino-cli config already exists, skipping initialization", "path", arduinoCliConfigPath)
		return false, nil
	}

	if err := os.MkdirAll(arduino15Path, 0755); err != nil {
		return false, err
	}

	cmd, err := paths.NewProcess(nil, arduinoCliPath, "config", "init", "--dest-dir", arduino15Path)
	if err != nil {
		return false, err
	}
	if out, err := cmd.RunAndCaptureCombinedOutput(context.Background()); err != nil {
		slog.Error("failed to initialize arduino-cli config", "dest", arduino15Path, "error", err, "output", string(out))
		return false, err
	}
	slog.Info("arduino-cli config initialized", "dest", arduino15Path)

	// set directories
	configCommands := [][]string{
		{"config", "set", "directories.data", filepath.Join(arduino15Path, "data"), "--config-file", arduinoCliConfigPath},
		{"config", "set", "directories.downloads", filepath.Join(arduino15Path, "staging"), "--config-file", arduinoCliConfigPath},
		{"config", "set", "directories.user", filepath.Join(arduino15Path, "user"), "--config-file", arduinoCliConfigPath},
	}

	for _, args := range configCommands {
		cmd, err := paths.NewProcess(nil, append([]string{arduinoCliPath}, args...)...)
		if err != nil {
			return false, err
		}
		if out, err := cmd.RunAndCaptureCombinedOutput(context.Background()); err != nil {
			slog.Error("failed to set arduino-cli config", "args", args, "error", err, "output", string(out))
			return false, err
		}
	}

	return true, nil
}

// arduinoCliLocale pins the language of arduino-cli's own messages. The child
// otherwise inherits the host locale, so on an Italian machine a failed compile
// reports "L' argomento passato non è valido: ..." — untriageable from a user's
// log and unmatchable by any string check we write. This is the arduino-cli
// counterpart of the `locale: 'en'` already sent in the LSP initialize request
// (lsp-client-transport.ts).
//
// It also covers the arduino-cli that the language server spawns itself, since
// ALS is passed the same -cli-config file.
const arduinoCliLocale = "en"

// ensureArduinoCliLocale pins the config file's locale. Idempotent, and
// deliberately non-fatal: readable diagnostics are not worth failing LSP
// startup over.
func ensureArduinoCliLocale(arduinoCliPath, arduinoCliConfigPath string) {
	cmd, err := paths.NewProcess(nil, arduinoCliPath, "config", "set", "locale", arduinoCliLocale, "--config-file", arduinoCliConfigPath)
	if err != nil {
		slog.Warn("failed to create arduino-cli locale process", "error", err)
		return
	}
	if out, err := cmd.RunAndCaptureCombinedOutput(context.Background()); err != nil {
		slog.Warn("failed to pin arduino-cli locale", "locale", arduinoCliLocale, "error", err, "output", string(out))
	}
}

// updateArduinoCliIndex runs `<kind> update-index`, where kind is "core" or
// "lib".
func updateArduinoCliIndex(ctx context.Context, kind, arduinoCliPath, arduinoCliConfigPath string) error {
	slog.Info("updating arduino-cli index", "kind", kind)
	updateIndexCmd, err := paths.NewProcess(nil, arduinoCliPath, kind, "update-index", "--config-file", arduinoCliConfigPath)
	if err != nil {
		return err
	}
	if out, err := updateIndexCmd.RunAndCaptureCombinedOutput(ctx); err != nil {
		slog.Error("failed to update arduino-cli index", "kind", kind, "error", err, "output", string(out))
		return err
	}
	slog.Info("arduino-cli index updated", "kind", kind)
	return nil
}

// verifyClangdExecutable checks that the bundled clangd can actually run, before
// handing it to the language server.
//
// resourcesExist only stats each required asset and compares a .version file, so a
// clangd that is present but cannot load reports as verified — that is the gap this
// closes. Any reason it will not execute counts: a partial extraction, a binary an
// antivirus has neutered, a wrong-architecture build, a missing shared library.
//
// The incident that motivated it: clangd 22.1.8-2-rc1 for Windows linked the MSVC
// runtime dynamically, so on a machine whose Visual C++ redistributable predated
// 2019 (no VCRUNTIME140_1.dll) the loader failed with 0xC0000135 and clangd exited
// ~25ms after spawn. resourcesExist logged "LSP asset verified" and "version match"
// throughout, the language server logged only "Lost connection with clangd!", and
// the editor sat at 0% with nothing to explain it. Fixed upstream in rc2 by linking
// the CRT statically, so that particular cause should not recur — the check stays
// because the class of failure it catches is not specific to it.
//
// Unlike the ctags check, a non-zero exit is NOT acceptable here. A loader failure
// is reported *as* an exit status — the process starts, then dies — so tolerating
// ExitError would miss precisely the case this exists for. Requiring a clean
// `--version` is the check.
//
// Bounded by toolVerifyTimeout, because a binary that will not run does not always
// die: one stalled on a filesystem that stops answering hangs instead, and an
// unbounded wait here is one the frontend cannot escape — startLSP carries no
// deadline of its own, so the editor sits at 0% indefinitely, which is the same
// symptom as the incident above and no easier to diagnose. Applies on the board as
// well as the desktop, since an SBC runs this same bundled clangd.
// RunAndCaptureCombinedOutput kills the child when the context expires, so the
// deadline ends the process rather than just abandoning the wait.
func verifyClangdExecutable() error {
	return verifyClangdExecutableAt(getClangdPath(), toolVerifyTimeout)
}

// verifyClangdExecutableAt takes the binary and the deadline rather than deriving
// them, so a test can reach the hang branch without waiting toolVerifyTimeout and
// the others without a bundled clangd.
func verifyClangdExecutableAt(path string, timeout time.Duration) error {
	proc, err := paths.NewProcess(nil, path, "--version")
	if err != nil {
		slog.Error("could not build the clangd version process", "path", path, "error", err)
		return fmt.Errorf("advanced language support could not start clangd (%v)", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	out, err := proc.RunAndCaptureCombinedOutput(ctx)
	// Reported separately from the failure below because the kill was ours: the
	// process error is "signal: killed", which explains nothing to whoever reads
	// the log next. Both conditions are required — a deadline that expires in the
	// moment after a clean answer must not turn that answer into a failure.
	if err != nil && errors.Is(ctx.Err(), context.DeadlineExceeded) {
		slog.Error("bundled clangd did not answer --version in time", "path", path, "timeout", timeout, "output", strings.TrimSpace(string(out)))
		return fmt.Errorf("advanced language support timed out starting clangd at %s", path)
	}
	if err != nil {
		slog.Error("bundled clangd cannot be run", "path", path, "error", err, "output", strings.TrimSpace(string(out)))
		return fmt.Errorf("advanced language support could not start clangd (%v)", err)
	}
	if !strings.Contains(strings.ToLower(string(out)), "clangd") {
		slog.Error("bundled clangd answered --version unexpectedly", "path", path, "output", strings.TrimSpace(string(out)))
		return fmt.Errorf("advanced language support could not verify clangd at %s", path)
	}
	return nil
}

// ctagsGlob matches every ctags arduino-cli has installed under its data dir.
// The version segment is a wildcard so a bumped builtin tool still matches.
func ctagsGlob(dataDir string) string {
	return filepath.Join(dataDir, "packages", "builtin", "tools", "ctags", "*", "ctags")
}

// ensureCtagsExecutable guarantees arduino-cli has a ctags it can actually run on
// this host, replacing the one it installed with our native build when it cannot.
//
// arduino-cli shells out to ctags to generate function prototypes whenever it
// preprocesses a .ino — including under --only-compilation-database, and with no
// flag or config to opt out. Its builtin package index publishes ctags
// 5.8-arduino11 for x86_64-apple-darwin only; there is no arm64-apple-darwin
// build, and ctags is the single non-native executable in the entire toolchain
// (the zephyr cross compiler, every other builtin tool, and all our bundled
// binaries are arm64). So on Apple Silicon it runs through Rosetta 2 — which
// macOS does not preinstall.
//
// Without Rosetta the exec fails with EBADARCH ("bad CPU type in executable"),
// arduino-cli exits 1, and the language server quits because it cannot start
// clangd. We then restart it five times and give up, none of which reached the
// UI: the editor rendered the whole thing as a spinner frozen at 0% forever.
//
// Repairing rather than reporting is deliberate — needing a Rosetta install to
// edit a sketch is not something to put in front of a user. We ship an arm64
// ctags built from arduino/ctags (see scripts/lsps/arduino/build_ctags.sh) and
// drop it in. Runs on every Start, so a later `core install` that restores the
// x86_64 binary is repaired again rather than silently breaking the LSP.
func ensureCtagsExecutable() error {
	// Only Apple Silicon macOS lacks a native ctags. Everywhere else the builtin
	// index has a matching build, so there is nothing to do.
	if runtime.GOOS != "darwin" || runtime.GOARCH != "arm64" {
		return nil
	}

	dataDir := filepath.Join(getArduino15Path(), "data")
	if err := checkCtagsExecutable(dataDir); err == nil {
		return nil
	}

	src := getResourcePath(filepath.Join("arduino", "ctags", "ctags"))
	if err := installNativeCtags(dataDir, src); err != nil {
		return err
	}
	return checkCtagsExecutable(dataDir)
}

// checkCtagsExecutable reports whether every ctags on disk can be executed.
//
// Only a failure to *execute* counts: a non-zero exit means the binary ran, which
// is the whole question, so an ExitError passes. Takes dataDir rather than
// deriving it so a test can exercise both outcomes without an arduino-cli install.
func checkCtagsExecutable(dataDir string) error {
	matches, err := filepath.Glob(ctagsGlob(dataDir))
	if err != nil || len(matches) == 0 {
		// Not downloaded yet, or a layout we do not recognise. Nothing to verify
		// and nothing to repair — let the compile speak for itself.
		slog.Info("skipping ctags check, no ctags binary found", "pattern", ctagsGlob(dataDir))
		return nil
	}

	for _, ctagsPath := range matches {
		proc, procErr := paths.NewProcess(nil, ctagsPath, "--version")
		if procErr != nil {
			return fmt.Errorf("could not build the ctags version process for %s: %w", ctagsPath, procErr)
		}
		runErr := proc.Run()
		if runErr == nil {
			continue
		}
		var exitErr *exec.ExitError
		if errors.As(runErr, &exitErr) {
			continue
		}
		return fmt.Errorf("ctags at %s is not executable: %w", ctagsPath, runErr)
	}
	return nil
}

// installNativeCtags overwrites every ctags arduino-cli installed with the arm64
// build at src.
//
// Writes via a temp file and rename: the destination may be the binary a compile
// is currently executing, and replacing it in place would either fail with
// ETXTBSY or corrupt that run.
//
// Takes src rather than resolving it so a test does not have to write into the
// caller's real resources directory (getResourcePath is fixed at init and cannot
// be redirected).
func installNativeCtags(dataDir, src string) error {
	payload, err := os.ReadFile(src)
	if err != nil {
		return fmt.Errorf("no bundled native ctags to install from %s: %w", src, err)
	}

	matches, err := filepath.Glob(ctagsGlob(dataDir))
	if err != nil {
		return fmt.Errorf("failed to look for installed ctags: %w", err)
	}
	if len(matches) == 0 {
		return fmt.Errorf("no installed ctags found to replace under %s", dataDir)
	}

	for _, dst := range matches {
		tmp := dst + ".arm64.tmp"
		if err := os.WriteFile(tmp, payload, 0o755); err != nil {
			return fmt.Errorf("failed to stage native ctags at %s: %w", tmp, err)
		}
		if err := os.Rename(tmp, dst); err != nil {
			_ = os.Remove(tmp)
			return fmt.Errorf("failed to replace ctags at %s: %w", dst, err)
		}
		slog.Info("replaced arduino-cli ctags with the bundled arm64 build", "path", dst)
	}
	return nil
}

func (h *LSPHandler) InstallArduinoCliCore() error {
	if err := h.initArduinoCliConfig(); err != nil {
		return err
	}

	h.initArduinoCliConfigMu.Lock()
	defer h.initArduinoCliConfigMu.Unlock()

	arduinoCliConfigPath := getArduinoCliConfigPath()
	arduinoCliPath := getArduinoCliPath()

	coreID := "arduino:zephyr"

	// get coreID from FQBN
	if b := h.boardProvider(); b != nil && b.Info.FQBN != "" {
		slog.Info("detecting core from board FQBN", "fqbn", b.Info.FQBN)
		parts := strings.Split(b.Info.FQBN, ":")
		if len(parts) >= 2 {
			coreID = parts[0] + ":" + parts[1]
		}
	}

	// The removal warns rather than returns: it only has work to do on an
	// install an earlier version touched, and arduino-cli ignores an index once
	// its URL is gone, so no index update has to follow it.
	if err := removeStaleArduinoCliAdditionalURLs(arduinoCliPath, arduinoCliConfigPath); err != nil {
		slog.Warn("failed to clean up board manager urls", "error", err)
	}
	h.refreshArduinoCliCoreIndex(arduinoCliPath, arduinoCliConfigPath)

	// check installed cores. `--all` so a not-yet-installed platform still
	// reports its latest available version, which we need to install an
	// explicit version rather than an implicit "newest across all indexes".
	cmd, err := paths.NewProcess(nil, arduinoCliPath, "core", "list", "--all", "--json", "--config-file", arduinoCliConfigPath)
	if err != nil {
		return err
	}
	out, _, err := cmd.RunAndCaptureOutput(context.Background())
	if err != nil {
		slog.Warn("failed to list cores", "error", err)
	}

	var result struct {
		Platforms []struct {
			ID               string `json:"id"`
			InstalledVersion string `json:"installed_version"`
			LatestVersion    string `json:"latest_version"`
		} `json:"platforms"`
	}
	if err := json.Unmarshal(out, &result); err != nil {
		slog.Warn("failed to parse core list, proceeding with installation check", "error", err)
	}

	isInstalled := false
	version := ""
	latestVersion := ""
	for _, p := range result.Platforms {
		if p.ID == coreID {
			if p.InstalledVersion != "" {
				isInstalled = true
				version = p.InstalledVersion
			}
			latestVersion = p.LatestVersion
			break
		}
	}

	shouldInstall := !isInstalled
	if isInstalled && latestVersion != "" && version != latestVersion {
		slog.Info("core version change required", "core", coreID, "current", version, "target", latestVersion)
		shouldInstall = true
	}

	// install
	if shouldInstall {
		logVersion := latestVersion
		if logVersion == "" {
			logVersion = "latest"
		}
		slog.Info("install core", "core", coreID, "version", logVersion)

		// Always install an explicit version when we know one. `core upgrade`
		// can only move forward, so it cannot replace a pre-release left by an
		// earlier version with the public release that supersedes it.
		spec := coreID
		if latestVersion != "" {
			spec = coreID + "@" + latestVersion
		}
		h.refreshArduinoCliLibraryIndex(arduinoCliPath, arduinoCliConfigPath)
		return installOrKeepArduinoCliCore(arduinoCliPath, arduinoCliConfigPath, spec, version)
	}
	slog.Info("core is up to date", "core", coreID, "version", version)
	return nil
}

// coreIndexRefreshTimeout bounds the core index refresh. A firewall that
// drops packets instead of rejecting them makes `core update-index` run for
// over two minutes, and nothing starts the language server until it returns.
// A var so tests can shorten it.
var coreIndexRefreshTimeout = 30 * time.Second

// refreshArduinoCliCoreIndex runs `core update-index` on a language server
// start, until one fetch succeeds or runs out of time. Caller holds
// initArduinoCliConfigMu.
//
// The config file is persistent, so without the refresh the index stays at
// whatever it was when the config was created and `core list` keeps reporting
// that as the latest version. The fetch is time-boxed and best effort: a host
// that cannot reach the index keeps the cached one and the installed core.
func (h *LSPHandler) refreshArduinoCliCoreIndex(arduinoCliPath, arduinoCliConfigPath string) {
	// A fetch that ran out of time means the host drops packets, and the
	// library fetch would wait its full timeout before the install starts.
	if refreshArduinoCliIndex(&h.coreIndexRefreshed, "core", coreIndexRefreshTimeout, arduinoCliPath, arduinoCliConfigPath) {
		h.libraryIndexRefreshed = true
	}
}

// libraryIndexRefreshTimeout bounds the library index fetch before a core
// install. The index is about 40 times larger than the core index, and five
// minutes downloads its 4.6 MB at about 125 kbit/s. Other language server
// starts wait on initArduinoCliConfigMu meanwhile. A var so tests can shorten
// it.
var libraryIndexRefreshTimeout = 5 * time.Minute

// refreshArduinoCliLibraryIndex runs `lib update-index` before a core install,
// until one fetch succeeds or runs out of time. Caller holds
// initArduinoCliConfigMu.
//
// A platform lists the library versions it depends on, and `core install`
// fails with "Library ... not found" when the cached library index is older
// than one of them. No other arduino-cli call App Lab makes reads this index,
// so a launch that installs nothing does not fetch it. A failed fetch is not
// fatal: the cached index can already list the versions the core needs.
//
// refreshArduinoCliCoreIndex also sets libraryIndexRefreshed, so this fetch is
// skipped, when the core index fetch ran out of time.
func (h *LSPHandler) refreshArduinoCliLibraryIndex(arduinoCliPath, arduinoCliConfigPath string) {
	refreshArduinoCliIndex(&h.libraryIndexRefreshed, "lib", libraryIndexRefreshTimeout, arduinoCliPath, arduinoCliConfigPath)
}

// refreshArduinoCliIndex runs `<kind> update-index` unless refreshed is set,
// and sets it once a fetch succeeds or runs out of time. It reports whether the
// fetch ran out of time. Caller holds initArduinoCliConfigMu.
//
// A fetch that fails before the timeout is retried on the next call: a first
// install has no core in the core index, and no library versions to fall back
// to, until one fetch succeeds. The host can be offline at the first start
// because Wi-Fi has not connected yet. A fetch that ran out of time is not
// retried, because every retry would hold initArduinoCliConfigMu for the full
// timeout.
func refreshArduinoCliIndex(refreshed *bool, kind string, timeout time.Duration, arduinoCliPath, arduinoCliConfigPath string) bool {
	if *refreshed {
		return false
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	err := updateArduinoCliIndex(ctx, kind, arduinoCliPath, arduinoCliConfigPath)
	timedOut := err != nil && errors.Is(ctx.Err(), context.DeadlineExceeded)
	if err == nil || timedOut {
		*refreshed = true
	}
	if err != nil {
		slog.Warn("continuing with the cached arduino-cli index", "kind", kind, "error", err)
	}
	return timedOut
}

// installOrKeepArduinoCliCore installs spec. When a version is already
// installed, a failed install keeps it and returns nil: the language server
// works with the older core, and an upgrade fails for reasons the user cannot
// fix from App Lab, such as an offline host or a stale library index.
func installOrKeepArduinoCliCore(arduinoCliPath, arduinoCliConfigPath, spec, installedVersion string) error {
	if err := installArduinoCliCore(arduinoCliPath, arduinoCliConfigPath, spec); err != nil {
		if installedVersion == "" {
			return err
		}
		slog.Warn("core upgrade failed, continuing with the installed version", "spec", spec, "installed", installedVersion, "error", err)
		return nil
	}
	slog.Info("core install successfully", "spec", spec)
	return nil
}

// installArduinoCliCore runs `core install` for spec.
//
// The returned error carries arduino-cli's last output line, which is where it
// prints the reason. The editor shows err.Error() as the language support
// failure, and the exit status alone ("exit status 1") does not say what to fix.
func installArduinoCliCore(arduinoCliPath, arduinoCliConfigPath, spec string) error {
	installCmd, err := paths.NewProcess(nil, arduinoCliPath, "core", "install", spec, "--config-file", arduinoCliConfigPath)
	if err != nil {
		return err
	}
	out, err := installCmd.RunAndCaptureCombinedOutput(context.Background())
	if err == nil {
		return nil
	}
	slog.Error("core install failed", "spec", spec, "error", err, "output", string(out))
	if reason := lastOutputLine(out); reason != "" {
		return &coreInstallError{msg: fmt.Sprintf("installing %s: %s", spec, reason), err: err}
	}
	return fmt.Errorf("installing %s: %w", spec, err)
}

// coreInstallError keeps the exit status out of the message the editor shows,
// while errors.As still finds it.
type coreInstallError struct {
	msg string
	err error
}

func (e *coreInstallError) Error() string { return e.msg }

func (e *coreInstallError) Unwrap() error { return e.err }

// lastOutputLine returns the last non-empty line of a command's output. Progress
// bars redraw with \r, so those count as line breaks too.
func lastOutputLine(out []byte) string {
	lines := strings.FieldsFunc(string(out), func(r rune) bool { return r == '\n' || r == '\r' })
	for i := len(lines) - 1; i >= 0; i-- {
		if line := strings.TrimSpace(lines[i]); line != "" {
			return line
		}
	}
	return ""
}

// removeStaleArduinoCliAdditionalURLs drops every staleIndexURLs entry from
// board_manager.additional_urls.
//
// The config file is persistent, so an index an earlier version registered
// stays there until it is removed.
func removeStaleArduinoCliAdditionalURLs(arduinoCliPath, arduinoCliConfigPath string) error {
	dumpCmd, err := paths.NewProcess(nil, arduinoCliPath, "config", "dump", "--json", "--config-file", arduinoCliConfigPath)
	if err != nil {
		return fmt.Errorf("failed to create arduino-cli config dump process: %w", err)
	}
	out, _, err := dumpCmd.RunAndCaptureOutput(context.Background())
	if err != nil {
		return fmt.Errorf("failed to dump arduino-cli config: %w", err)
	}

	var dump struct {
		Config struct {
			BoardManager struct {
				AdditionalURLs []string `json:"additional_urls"`
			} `json:"board_manager"`
		} `json:"config"`
	}
	if err := json.Unmarshal(out, &dump); err != nil {
		return fmt.Errorf("failed to parse arduino-cli config: %w", err)
	}
	current := dump.Config.BoardManager.AdditionalURLs

	// URLs added by the user (or by other features) are left untouched.
	for _, url := range staleIndexURLs {
		if !slices.Contains(current, url) {
			continue
		}
		rmCmd, err := paths.NewProcess(nil, arduinoCliPath, "config", "remove", "board_manager.additional_urls", url, "--config-file", arduinoCliConfigPath)
		if err != nil {
			return fmt.Errorf("failed to create board manager url removal process: %w", err)
		}
		if out, err := rmCmd.RunAndCaptureCombinedOutput(context.Background()); err != nil {
			return fmt.Errorf("failed to remove board manager url %q: %w (%s)", url, err, string(out))
		}
		slog.Info("removed board manager url", "url", url)
	}

	return nil
}

func getArduino15Path() string {
	if board.IsSBC() {
		return boardArduino15Dir
	}
	return getSubDir(getPersistentWorkspaceBase(), arduinoDirBaseName())
}

func getArduinoCliPath() string {
	if board.IsSBC() {
		return boardArduinoCliPath
	}
	return getResourcePath(filepath.Join("arduino", "arduino-cli", "arduino-cli"))
}

func getArduinoCliConfigPath() string {
	return filepath.Join(getArduino15Path(), "arduino-cli.yaml")
}

func getClangdPath() string {
	return getResourcePath(filepath.Join("arduino", "clangd", "clangd"))
}
