package lsp

import (
	"app-lab-desktop/internal/board"
	"fmt"
	"io"
	"log/slog"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"sync"

	"github.com/adrg/xdg"
	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

var workspaceMu sync.Mutex

const boardAppsRootDir = "/home/arduino/ArduinoApps"
const workspaceBaseDirName = "arduino_applab_workspace"
const arduinoDirName = "arduino15"

// On Windows the persistent workspace root and the arduino-cli directory under
// it get deliberately terse names, because everything arduino-cli installs
// nests below them: the cross toolchain's C++ headers end up at
// <base>/<arduino>/data/packages/zephyr/tools/arm-zephyr-eabi/<ver>/arm-zephyr-eabi/
// include/c++/<ver>/arm-zephyr-eabi/<multilib>/bits/<header>.
//
// GCC does not open that resolved path. It opens the form it builds from
// -iprefix, with the ".." segments left in
// ("...\bin\../lib/gcc/arm-zephyr-eabi/12.2.0/../../../../arm-zephyr-eabi/..."),
// which is ~50 characters longer and is what Windows measures against the
// 260-char MAX_PATH — and MinGW-built GCC does not use the \\?\ escape that
// would lift the limit. With the long names the worst header in the cortex-m33
// multilib reached 265 characters, so `arduino-cli compile` failed with
// "bits/cpu_defines.h: No such file or directory", the compilation database came
// out incomplete, and clangd resolved nothing. Verified by A/B: the identical
// compile through a short junction succeeds.
//
// These two segments drop from 39 characters to 15, which clears the limit by 18
// and tolerates a 26-character profile folder — Windows caps account names at 20
// (sAMAccountName), so that covers every local account with room for a domain
// suffix. The old layout tolerated two characters, i.e. it was broken for
// essentially every Windows user, not just long names.
//
// Kept to Windows so macOS and Linux installs, which have no such limit and work
// today, are not migrated for nothing.
const (
	windowsWorkspaceBaseDirName = "AppLab"
	windowsArduinoDirName       = "a15"
)

func persistentBaseDirName() string {
	if runtime.GOOS == "windows" {
		return windowsWorkspaceBaseDirName
	}
	return workspaceBaseDirName
}

func arduinoDirBaseName() string {
	if runtime.GOOS == "windows" {
		return windowsArduinoDirName
	}
	return arduinoDirName
}

// FileScheme prefixes the URIs the editor and language servers exchange.
// Exported so callers test for it with the same string FileURIToLocalPath strips.
const FileScheme = "file://"

var LspFileExtensions = []string{
	".ino", ".yaml", ".c", ".cpp", ".h", ".hpp",
	".py", ".pyi", ".js", ".ts", ".mjs", ".cjs", ".jsx", ".tsx", ".html", ".css", ".scss",
}

// tempWorkspaceBase resolves the workspace root once. On Windows os.TempDir()
// reads %TMP%, which Windows hands back in 8.3 short form whenever the user
// name is not 8.3-clean — a dot is enough, so "f.spissu" yields
// "C:\Users\FEFB0~1.SPI\AppData\Local\Temp".
//
// That spelling is only ours. Language servers canonicalise to the long form
// (clangd reports build.source.path that way), so every URI a server
// *originates* comes back long while our rootUri was short. Neither comparator
// folds 8.3 — isWithinDir only case-folds, as does the frontend's
// normalizeFileUri — so those URIs test as outside the workspace: go-to-
// definition into a not-yet-open sketch header fails, and cross-file renames
// are skipped without an error.
//
// Expanding here rather than teaching the comparators to fold 8.3 keeps the fix
// in one place and costs nothing per comparison: hand the server the spelling
// it will canonicalise to and both sides agree. Every other workspace path is
// derived from this one, so they all inherit the long form.
var tempWorkspaceBase = sync.OnceValue(func() string {
	base := filepath.Join(os.TempDir(), workspaceBaseDirName)
	if runtime.GOOS != "windows" {
		return base
	}

	// EvalSymlinks resolves each component with FindFirstFile and keeps the name
	// Windows reports, which expands 8.3 as a side effect. It needs the path to
	// exist, so create it first; every caller here creates its own subdirectory
	// anyway.
	if err := os.MkdirAll(base, 0755); err != nil {
		slog.Warn("could not create workspace base, using unexpanded path", "path", base, "err", err)
		return base
	}
	expanded, err := filepath.EvalSymlinks(base)
	if err != nil {
		slog.Warn("could not expand workspace base to its long form", "path", base, "err", err)
		return base
	}
	if expanded != base {
		slog.Info("expanded 8.3 short path for workspace base", "short", base, "long", expanded)
	}
	return expanded
})

func getTempWorkspaceBase() string {
	return tempWorkspaceBase()
}

// persistentWorkspaceBase resolves the persistent root once, migrating an
// install created under the old longer names on first use.
var persistentWorkspaceBase = sync.OnceValue(func() string {
	base := filepath.Join(xdg.DataHome, persistentBaseDirName())
	if runtime.GOOS == "windows" {
		migrateWorkspaceBase(filepath.Join(xdg.DataHome, workspaceBaseDirName), base)
	}
	return base
})

func getPersistentWorkspaceBase() string {
	return persistentWorkspaceBase()
}

// migrateWorkspaceBase renames a pre-existing workspace into the shortened
// layout, so the installed cores and toolchains are reused rather than
// re-downloaded. Both renames stay inside xdg.DataHome, so they are same-volume.
//
// Best-effort throughout: on any failure we leave the old tree untouched and
// carry on with the new, empty path. That costs a re-download but cannot lose
// data or leave a half-migrated tree in use.
//
// Takes both paths rather than deriving them so a test can exercise it on any
// host, as the Windows-only branch is otherwise unreachable in CI.
func migrateWorkspaceBase(oldBase, newBase string) {
	if oldBase == newBase {
		return
	}
	if _, err := os.Stat(newBase); err == nil {
		return // already migrated
	}
	if _, err := os.Stat(oldBase); err != nil {
		return // fresh install, nothing to move
	}

	if err := os.Rename(oldBase, newBase); err != nil {
		slog.Warn("could not migrate workspace to the shortened path", "from", oldBase, "to", newBase, "err", err)
		return
	}
	slog.Info("migrated workspace to the shortened path", "from", oldBase, "to", newBase)

	oldArduinoDir := filepath.Join(newBase, arduinoDirName)
	newArduinoDir := filepath.Join(newBase, windowsArduinoDirName)
	if _, err := os.Stat(oldArduinoDir); err != nil {
		return
	}
	if err := os.Rename(oldArduinoDir, newArduinoDir); err != nil {
		slog.Warn("could not migrate arduino-cli directory", "from", oldArduinoDir, "to", newArduinoDir, "err", err)
		return
	}

	// arduino-cli.yaml records directories.data/downloads/user as absolute paths,
	// which the move just invalidated. Remove it so createArduinoCliConfig writes
	// a fresh one against the new location; the cores already under data/ are
	// picked up from there as they are.
	cfg := filepath.Join(newArduinoDir, "arduino-cli.yaml")
	if err := os.Remove(cfg); err != nil && !os.IsNotExist(err) {
		slog.Warn("could not drop stale arduino-cli config after migration", "path", cfg, "err", err)
	}
}

func getSubDir(base, subDir string) string {
	dir := filepath.Join(base, subDir)
	_ = os.MkdirAll(dir, 0755)
	return dir
}

func GetLspTempWorkspaceAppDir() string {
	return getSubDir(getTempWorkspaceBase(), "app")
}

func getLspTempWorkspaceLogsDir() string {
	return getSubDir(getTempWorkspaceBase(), "logs")
}

func getLspWorkspaceResourcesDir() string {
	return getSubDir(getPersistentWorkspaceBase(), "resources")
}

func getLspWorkspacePythonConfigDir() string {
	return getSubDir(getPersistentWorkspaceBase(), "python-config")
}

func GetLspWorkspacePythonStubsDirPath() string {
	return getSubDir(getPersistentWorkspaceBase(), "python-stubs")
}

// GetLspWorkspacePythonVenvBase is the directory holding the stub virtual
// environment basedpyright resolves its search paths from (see
// ensurePythonVenvStub).
func GetLspWorkspacePythonVenvBase() string {
	return getSubDir(getPersistentWorkspaceBase(), "python-venv")
}

func isLspFile(filePath string) bool {
	fileExt := path.Ext(filePath)
	return slices.Contains(LspFileExtensions, fileExt)
}

func ShouldSyncRemoteFileToLspWorkspace(filePath string) bool {
	return isLspFile(filePath) && !board.IsSBC()
}

func getWorkspaceFilePathFromRemoteFilePath(filePath string) (string, error) {
	slog.Info("getWorkspaceFilePathFromRemoteFilePath", "filePath", filePath)

	// strip the "<boardAppsRootDir>/<appName>/" prefix
	rel := strings.TrimPrefix(filePath, boardAppsRootDir)
	rel = strings.TrimPrefix(rel, "/")
	_, subPath, _ := strings.Cut(rel, "/")

	appDir := GetLspTempWorkspaceAppDir()
	fullPath := filepath.Join(appDir, subPath)

	// prevent path traversal ("..") from escaping the workspace app dir
	if !isWithinDir(fullPath, appDir) {
		return "", fmt.Errorf("invalid workspace path %q escapes %q", filePath, appDir)
	}

	return fullPath, nil
}

// isWithinDir reports whether target resolves to a location inside dir.
func isWithinDir(target, dir string) bool {
	cleanDir := filepath.Clean(dir)
	cleanTarget := filepath.Clean(target)
	// Windows filesystems are case-insensitive, so compare case-folded to avoid
	// wrongly rejecting a valid path that differs only in drive/segment casing.
	if runtime.GOOS == "windows" {
		cleanDir = strings.ToLower(cleanDir)
		cleanTarget = strings.ToLower(cleanTarget)
	}
	return cleanTarget == cleanDir ||
		strings.HasPrefix(cleanTarget, cleanDir+string(os.PathSeparator))
}

// IsAllowedLspFilePath confines LSP file reads to the known workspace roots
// (app workspace, bundled resources / library data / python stubs, and the
// SBC board apps dir) to prevent arbitrary file reads via the exposed API.
func IsAllowedLspFilePath(filePath string) bool {
	roots := []string{
		getTempWorkspaceBase(),
		getPersistentWorkspaceBase(),
	}
	// The board apps dir is only ours when we are the board. Off-board that is
	// just a path that could exist on the user's machine, and remote app files
	// are synced into the temp workspace anyway
	// (see ShouldSyncRemoteFileToLspWorkspace).
	if board.IsSBC() {
		roots = append(roots, boardAppsRootDir)
	}
	for _, root := range roots {
		if isWithinDir(filePath, root) {
			return true
		}
	}
	return false
}

func SyncRemoteFileToLspWorkspace(filePath string, reader io.Reader) {

	// avoid app example
	if !strings.HasPrefix(filePath, boardAppsRootDir) {
		return
	}

	workspaceMu.Lock()
	defer workspaceMu.Unlock()

	fullPath, err := getWorkspaceFilePathFromRemoteFilePath(filePath)
	if err != nil {
		slog.Error("failed to resolve lsp workspace path", "path", filePath, "err", err)
		return
	}
	if err := writeWorkspaceFile(fullPath, reader); err != nil {
		slog.Error("failed to update lsp workspace", "path", filePath, "err", err)
	}
}

// FileURIToLocalPath converts a "file://" URI into a native OS path, decoding
// percent-escapes and handling the two Windows shapes: a drive-letter URI
// ("file:///C:/x" -> "C:\x") and a UNC share ("file://server/x" -> "\\server\x").
// Inverse of the frontend's toFileUri; shared so every caller converts alike.
func FileURIToLocalPath(fileURI string) (string, error) {
	return fileURIToLocalPath(fileURI, runtime.GOOS == "windows")
}

// fileURIToLocalPath takes the platform explicitly so both branches are
// reachable from a test on any host — the Windows-only paths through here have
// no other way to be exercised in CI.
func fileURIToLocalPath(fileURI string, windows bool) (string, error) {
	if !strings.HasPrefix(fileURI, FileScheme) {
		return "", fmt.Errorf("unsupported URI scheme: %q", fileURI)
	}

	// Strip and unescape by hand rather than via url.Parse: "%", "#" and "?"
	// are legal, unescaped, in file names, and url.Parse rejects the first and
	// silently truncates the path at the other two. An unescape that fails
	// leaves the raw text alone, which is the correct reading of such a name.
	rest := strings.TrimPrefix(fileURI, FileScheme)
	if decoded, err := url.PathUnescape(rest); err == nil {
		rest = decoded
	}

	// A non-empty authority ("file://server/share") is a Windows UNC share;
	// "localhost" is RFC 8089's spelling of "no host". Anything else has no
	// meaning as a local path.
	var host string
	if !strings.HasPrefix(rest, "/") {
		host, rest, _ = strings.Cut(rest, "/")
		rest = "/" + rest
		if strings.EqualFold(host, "localhost") {
			host = ""
		}
	}

	if !windows {
		if host != "" {
			return "", fmt.Errorf("cannot resolve remote host %q as a local path", host)
		}
		return rest, nil
	}

	if host != "" {
		return `\\` + host + strings.ReplaceAll(rest, "/", `\`), nil
	}
	// Drive-letter URIs look like "/C:/Users/..." — drop the leading slash so
	// it becomes a valid absolute path, then switch to backslashes.
	if len(rest) > 2 && rest[0] == '/' && rest[2] == ':' {
		rest = rest[1:]
	}
	return strings.ReplaceAll(rest, "/", `\`), nil
}

// IsURIWithinDir reports whether a "file://" URI resolves to dir or a location
// inside it. Compare URIs against local paths through here rather than with a
// string prefix test: the URI arrives percent-encoded and slash-separated,
// which never matches a native Windows path spelled with backslashes.
func IsURIWithinDir(fileURI, dir string) bool {
	localPath, err := FileURIToLocalPath(fileURI)
	if err != nil {
		return false
	}
	return isWithinDir(localPath, dir)
}

func GetLspWorkspaceFile(fileURI string) (string, error) {
	filePath, err := FileURIToLocalPath(fileURI)
	if err != nil {
		slog.Error("parse uri failed", "uri", fileURI, "err", err)
		return "", err
	}

	// confine reads to known workspace roots to prevent arbitrary file reads
	if !IsAllowedLspFilePath(filePath) {
		slog.Error("read file denied: path outside allowed workspace roots", "path", filePath)
		return "", fmt.Errorf("access denied: path outside allowed workspace roots")
	}

	content, err := os.ReadFile(filePath)
	if err != nil {
		slog.Error("read file failed", "path", filePath, "err", err)
		return "", err
	}

	return string(content), nil
}

func RemoveWorkspaceFile(filePath string) {

	// avoid app example / host files not under the board apps root
	if !strings.HasPrefix(filePath, boardAppsRootDir) {
		return
	}

	workspaceMu.Lock()
	defer workspaceMu.Unlock()

	workspaceFileName, err := getWorkspaceFilePathFromRemoteFilePath(filePath)
	if err != nil {
		slog.Error("failed to resolve lsp workspace path", "path", filePath, "err", err)
		return
	}

	if err := os.Remove(workspaceFileName); err != nil && !os.IsNotExist(err) {
		slog.Error("failed to remove from lsp workspace", "path", workspaceFileName, "err", err)
	}
}

func RenameWorkspaceFile(prevPath, newPath string) {

	slog.Info("Renaming workspace file", "prevPath", prevPath, "newPath", newPath)

	workspaceMu.Lock()
	defer workspaceMu.Unlock()

	prevName, err := getWorkspaceFilePathFromRemoteFilePath(prevPath)
	if err != nil {
		slog.Error("failed to resolve lsp workspace path", "path", prevPath, "err", err)
		return
	}
	newName, err := getWorkspaceFilePathFromRemoteFilePath(newPath)
	if err != nil {
		slog.Error("failed to resolve lsp workspace path", "path", newPath, "err", err)
		return
	}

	if err := os.Rename(prevName, newName); err != nil {
		slog.Error("failed to rename in lsp workspace", "from", prevName, "to", newName, "err", err)
	}
}

func InitLspWorkspace(conn remote.RemoteConn, appPath string) error {

	workspaceMu.Lock()
	defer workspaceMu.Unlock()

	slog.Info("InitLspWorkspace", "appPath", appPath)

	dstPath := GetLspTempWorkspaceAppDir()

	if err := os.RemoveAll(dstPath); err != nil {
		slog.Error("remove workspace failed", "path", dstPath, "err", err)
		return err
	}

	if err := os.MkdirAll(dstPath, 0o755); err != nil {
		slog.Error("mkdir workspace failed", "path", dstPath, "err", err)
		return err
	}

	var copyRecursive func(src, dst string) (bool, error)

	copyRecursive = func(src, dst string) (bool, error) {

		entries, err := conn.List(src)
		if err != nil {
			slog.Error("failed to read dir", "src", src, "err", err)
			return false, err
		}

		var copiedAny bool

		for _, entry := range entries {
			srcEntry := path.Join(src, entry.Name)
			dstEntry := filepath.Join(dst, entry.Name)

			if entry.IsDir {
				// Skip hidden directories
				if strings.HasPrefix(entry.Name, ".") {
					continue
				}
				ok, err := copyRecursive(srcEntry, dstEntry)
				if err != nil {
					// Same reasoning as the per-file skip below: one unreadable or
					// unmirrorable subtree should not cost LSP for the whole app.
					slog.Warn("skipping subtree in LSP workspace mirror", "dir", srcEntry, "err", err)
					continue
				}
				if ok {
					copiedAny = true
				}
				continue
			}

			if !isLspFile(srcEntry) {
				continue
			}

			// Use an inline function to safely defer reader.Close() and manage errors
			copyErr := func() error {
				reader, err := conn.ReadFile(srcEntry)
				if err != nil {
					slog.Error("failed to read file", "file", srcEntry, "err", err)
					return err
				}
				defer reader.Close()

				if err := writeWorkspaceFile(dstEntry, reader); err != nil {
					slog.Error("failed to write file", "file", dstEntry, "err", err)
					return err
				}

				return nil
			}()

			// A single unmirrorable file must not take the whole workspace down.
			// Names are validated on create/rename, but a board can already hold
			// files this host cannot write — a name that is legal on the board's
			// Debian filesystem but not on Windows (e.g. "log:2026.txt"), or one
			// created outside App Lab entirely. Skipping loses LSP for that file
			// only; aborting lost it for every file in the app.
			if copyErr != nil {
				slog.Warn("skipping file in LSP workspace mirror", "file", srcEntry, "err", copyErr)
				continue
			}

			copiedAny = true
		}

		return copiedAny, nil
	}

	ok, err := copyRecursive(appPath, dstPath)
	if err != nil {
		slog.Error("copy app workspace failed", "err", err)
		return err
	}

	if !ok {
		slog.Info("no valid LSP files found, removing workspace", "dst", dstPath)
		_ = os.RemoveAll(dstPath)
		return nil
	}

	slog.Info("copy app workspace completed", "dst", dstPath)
	return nil
}

func writeWorkspaceFile(path string, r io.Reader) error {
	slog.Info("writeWorkspaceFile", "path", path)

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = io.Copy(f, r)
	return err
}
