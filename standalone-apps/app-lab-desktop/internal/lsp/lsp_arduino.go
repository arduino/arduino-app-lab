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

// pinnedCore describes a specific arduino-cli core release that must be
// installed from a non-default (staging) package index for a given board.
type pinnedCore struct {
	version       string
	additionalURL string
}

// lspPinnedCores maps a board FQBN to a pinned core release for the Arduino
// language server. ventunoq is only published in the arduino:zephyr staging
// index (not the public board manager), so its core must be installed from
// there at a pinned version; otherwise the language server cannot build a
// compilation database and hangs at 0%.
// TODO: remove once ventunoq ships in the public arduino:zephyr core.
var lspPinnedCores = map[string]pinnedCore{
	board.FQBNVentunoQ: {
		version:       "0.56.3-0.head.monza-1.0.1.62+fcf3e1ab",
		additionalURL: "https://downloads.arduino.cc/packages/package_zephyr_staging_index.json",
	},
}

// pinnedCoreURLs is the set of package indexes that only exist to serve a
// pinned core. They are registered while a pinned board is selected and
// de-registered otherwise: pinned releases are semver pre-releases that
// outrank the public ones, so leaving a staging index registered makes it the
// "latest" version for every board sharing the same core.
var pinnedCoreURLs = func() []string {
	seen := map[string]bool{}
	urls := []string{}
	for _, p := range lspPinnedCores {
		if p.additionalURL != "" && !seen[p.additionalURL] {
			seen[p.additionalURL] = true
			urls = append(urls, p.additionalURL)
		}
	}
	return urls
}()

// lookupPinnedCore resolves the pin for an FQBN, ignoring any trailing menu
// options (`vendor:arch:board:opt=value`) so a configured board still matches.
func lookupPinnedCore(fqbn string) (pinnedCore, bool) {
	if p, ok := lspPinnedCores[fqbn]; ok {
		return p, true
	}
	if parts := strings.Split(fqbn, ":"); len(parts) > 3 {
		p, ok := lspPinnedCores[strings.Join(parts[:3], ":")]
		return p, ok
	}
	return pinnedCore{}, false
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
		if err := updateArduinoCliCoreIndex(arduinoCliPath, arduinoCliConfigPath); err != nil {
			return fmt.Errorf("failed to update arduino-cli core index: %w", err)
		}
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

func updateArduinoCliCoreIndex(arduinoCliPath, arduinoCliConfigPath string) error {
	slog.Info("updating arduino-cli core index")
	updateIndexCmd, err := paths.NewProcess(nil, arduinoCliPath, "core", "update-index", "--config-file", arduinoCliConfigPath)
	if err != nil {
		return err
	}
	if out, err := updateIndexCmd.RunAndCaptureCombinedOutput(context.Background()); err != nil {
		slog.Error("failed to update arduino-cli core index", "error", err, "output", string(out))
		return err
	}
	slog.Info("arduino-cli core index updated")
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
	fqbn := ""

	// get coreID from FQBN
	if b := h.boardProvider(); b != nil && b.Info.FQBN != "" {
		fqbn = b.Info.FQBN
		slog.Info("detecting core from board FQBN", "fqbn", fqbn)
		parts := strings.Split(fqbn, ":")
		if len(parts) >= 2 {
			coreID = parts[0] + ":" + parts[1]
		}
	}

	// Some boards are only published in a non-default (staging) package index
	// and must be installed at a pinned version. Register that index only while
	// such a board is selected, and drop it again for every other board —
	// otherwise the staging pre-release keeps outranking the public releases
	// and "latest" resolves back to the pinned version.
	pinned, isPinned := lookupPinnedCore(fqbn)
	wantURL := ""
	if isPinned {
		wantURL = pinned.additionalURL
	}
	urlsChanged, err := syncArduinoCliAdditionalURLs(arduinoCliPath, arduinoCliConfigPath, wantURL)
	if err != nil {
		return fmt.Errorf("failed to sync board manager urls: %w", err)
	}
	if urlsChanged {
		if err := updateArduinoCliCoreIndex(arduinoCliPath, arduinoCliConfigPath); err != nil {
			return fmt.Errorf("failed to update core index after board manager url change: %w", err)
		}
	}

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

	// Pinned boards target their exact staging version; everything else tracks
	// the latest published version as before.
	targetVersion := latestVersion
	if isPinned {
		targetVersion = pinned.version
	}

	shouldInstall := !isInstalled
	if isInstalled && targetVersion != "" && version != targetVersion {
		slog.Info("core version change required", "core", coreID, "current", version, "target", targetVersion)
		shouldInstall = true
	}

	// install
	if shouldInstall {
		logVersion := targetVersion
		if logVersion == "" {
			logVersion = "latest"
		}
		slog.Info("install core", "core", coreID, "version", logVersion)

		// Always install an explicit version when we know one. `core upgrade`
		// can only move forward, so it cannot walk the pinned pre-release back
		// down to the public release when switching from ventunoq to unoq.
		spec := coreID
		if targetVersion != "" {
			spec = coreID + "@" + targetVersion
		}
		args := []string{"core", "install", spec, "--config-file", arduinoCliConfigPath}

		installCmd, err := paths.NewProcess(nil, append([]string{arduinoCliPath}, args...)...)
		if err != nil {
			return err
		}
		if out, err := installCmd.RunAndCaptureCombinedOutput(context.Background()); err != nil {
			slog.Error("core install failed", "core", coreID, "version", logVersion, "error", err, "output", string(out))
			return err
		}
		slog.Info("core install successfully", "core", coreID, "version", logVersion)
	} else {
		slog.Info("core is up to date", "core", coreID, "version", version)
	}
	return nil
}

// syncArduinoCliAdditionalURLs makes board_manager.additional_urls contain
// keepURL (when non-empty) and none of the other pinned-core staging indexes,
// reporting whether anything changed so the caller can refresh the core index.
//
// Registration has to be reversible: a staging index stays in the config file
// forever otherwise, and its pre-release versions then win the "latest"
// resolution for every board sharing that core.
func syncArduinoCliAdditionalURLs(arduinoCliPath, arduinoCliConfigPath, keepURL string) (bool, error) {
	dumpCmd, err := paths.NewProcess(nil, arduinoCliPath, "config", "dump", "--json", "--config-file", arduinoCliConfigPath)
	if err != nil {
		return false, fmt.Errorf("failed to create arduino-cli config dump process: %w", err)
	}
	out, _, err := dumpCmd.RunAndCaptureOutput(context.Background())
	if err != nil {
		return false, fmt.Errorf("failed to dump arduino-cli config: %w", err)
	}

	var dump struct {
		Config struct {
			BoardManager struct {
				AdditionalURLs []string `json:"additional_urls"`
			} `json:"board_manager"`
		} `json:"config"`
	}
	if err := json.Unmarshal(out, &dump); err != nil {
		return false, fmt.Errorf("failed to parse arduino-cli config: %w", err)
	}
	current := dump.Config.BoardManager.AdditionalURLs

	changed := false

	// Drop every staging index we own that isn't wanted for this board. URLs
	// added by the user (or by other features) are left untouched.
	for _, url := range pinnedCoreURLs {
		if url == keepURL || !slices.Contains(current, url) {
			continue
		}
		rmCmd, err := paths.NewProcess(nil, arduinoCliPath, "config", "remove", "board_manager.additional_urls", url, "--config-file", arduinoCliConfigPath)
		if err != nil {
			return changed, fmt.Errorf("failed to create board manager url removal process: %w", err)
		}
		if out, err := rmCmd.RunAndCaptureCombinedOutput(context.Background()); err != nil {
			return changed, fmt.Errorf("failed to remove board manager url %q: %w (%s)", url, err, string(out))
		}
		slog.Info("removed board manager url", "url", url)
		changed = true
	}

	if keepURL != "" && !slices.Contains(current, keepURL) {
		addCmd, err := paths.NewProcess(nil, arduinoCliPath, "config", "add", "board_manager.additional_urls", keepURL, "--config-file", arduinoCliConfigPath)
		if err != nil {
			return changed, fmt.Errorf("failed to create board manager url process: %w", err)
		}
		if out, err := addCmd.RunAndCaptureCombinedOutput(context.Background()); err != nil {
			return changed, fmt.Errorf("failed to add board manager url %q: %w (%s)", keepURL, err, string(out))
		}
		slog.Info("added board manager url", "url", keepURL)
		changed = true
	}

	return changed, nil
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
