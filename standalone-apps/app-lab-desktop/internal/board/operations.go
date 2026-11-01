package board

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"os"
	"path"
	"strings"
	"sync"

	"github.com/arduino/arduino-app-cli/pkg/board"
	"github.com/arduino/arduino-cli/commands"
	rpc "github.com/arduino/arduino-cli/rpc/cc/arduino/cli/commands/v1"
	"github.com/arduino/go-paths-helper"
	"github.com/codeclysm/extract/v4"
	"github.com/sirupsen/logrus"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	semver "go.bug.st/relaxed-semver"
)

var toolsInstalled = false
var toolsInstallLock sync.Mutex

func GetBoards(ctx context.Context) ([]*Board, error) {
	toolsInstallLock.Lock()
	initalized := toolsInstalled
	toolsInstallLock.Unlock()
	if !initalized {
		return nil, errors.New("detection tools not installed")
	}

	boards, err := board.FromFQBN(ctx, supportedBoards)
	// No supported board attached is a normal state, not an error.
	// Non-nil, so it serializes as [] and not null.
	if isNoPortsError(err) || (err == nil && len(boards) == 0) {
		return []*Board{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failing to get board from FQBN: %w", err)
	}

	result := make([]*Board, 0, len(boards))
	for _, b := range boards {
		board, err := New(&b)
		if err != nil {
			runtime.LogErrorf(ctx, "failed to create board instance: %v", err)
			continue
		}
		result = append(result, board)
	}
	return result, nil
}

// isNoPortsError reports whether err is FromFQBN finding no port at all. arduino-app-cli
// returns this case as a plain string, so the text is the only signal.
func isNoPortsError(err error) bool {
	return err != nil && strings.Contains(err.Error(), "no hardware ID found")
}

func GetSbcBoard(ctx context.Context) (*Board, error) {
	if !IsSBC() {
		return nil, fmt.Errorf("not running on SBC")
	}

	boards, err := GetBoards(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get boards: %w", err)
	}
	if len(boards) == 0 {
		return nil, fmt.Errorf("no boards found")
	}

	b := boards[0]
	if err := b.EstablishConnection(ctx, ""); err != nil {
		return nil, fmt.Errorf("failed to establish local connection: %w", err)
	}
	return b, nil
}

// InstallToolingIfMissing checks if the required discovery tools are installed, and if not,
// it installs them using the embedded resources.
func InstallToolingIfMissing(ctx context.Context) error {
	toolsInstallLock.Lock()
	defer toolsInstallLock.Unlock()
	if toolsInstalled {
		return nil
	}

	logrus.SetLevel(logrus.ErrorLevel) // Reduce the log level of arduino-cli
	srv := commands.NewArduinoCoreServer()

	// Retrieve the CLI configuration
	cfg, err := srv.ConfigurationGet(ctx, &rpc.ConfigurationGetRequest{})
	if err != nil {
		return err
	}
	dataDir := paths.New(cfg.GetConfiguration().GetDirectories().GetData())

	// Prepare embedded resources
	embedPackageRootDir := ""
	if root, err := packagesFS.ReadDir("."); err != nil {
		return err
	} else if len(root) == 0 {
		return fmt.Errorf("no resources found in embedded filesystem")
	} else {
		embedPackageRootDir = root[0].Name()
	}
	embedPackageDir, err := packagesFS.ReadDir(embedPackageRootDir)
	if err != nil {
		return err
	}
	if len(embedPackageDir) == 0 {
		return fmt.Errorf("no resources found in embedded filesystem")
	}

	// Check if adb is available
	abdToolPath := dataDir.Join("packages", "arduino", "tools", "adb", "32.0.0")
	if !abdToolPath.Exist() {
		if err := abdToolPath.MkdirAll(); err != nil {
			return err
		}

		// Find adb archive in embedded resources
		var adbArchiveName string
		for _, entry := range embedPackageDir {
			if strings.HasPrefix(entry.Name(), "adb") {
				adbArchiveName = entry.Name()
			}
		}

		// Unpack adb tool
		// Use path.Join to ensure forward slash is used on all OSes (embedded FS requires forward slash,
		// while Windows uses backslash).
		f, err := packagesFS.Open(path.Join(embedPackageRootDir, adbArchiveName))
		if err != nil {
			return err
		}
		defer f.Close()
		stripRoot := func(p string) string {
			for i, c := range p {
				if c == '/' || c == os.PathSeparator {
					return p[i+1:]
				}
			}
			return p
		}
		if err := extract.Archive(ctx, f, abdToolPath.String(), stripRoot); err != nil {
			return err
		}
		f.Close()
	}

	if discoveriesUpToDate(dataDir, embedPackageDir) {
		toolsInstalled = true
		return nil
	}

	// Otherwise we will let the arduino-cli install it
	if err := dataDir.MkdirAll(); err != nil {
		return err
	}

	// Unpack package_index from resources
	f, err := packageIndex.Open("resources_index/package_index.tar.bz2")
	if err != nil {
		return err
	}
	defer f.Close()
	if err := extract.Archive(ctx, f, dataDir.String(), nil); err != nil {
		return err
	}
	f.Close()

	// Drop discoveries archives in downloads dir
	downloadsDir := paths.New(cfg.GetConfiguration().GetDirectories().GetDownloads()).Join("packages")
	if err := downloadsDir.MkdirAll(); err != nil {
		return err
	}

	// Copy each embedded package into downloads dir
	for _, entry := range embedPackageDir {
		// Use path.Join to ensure forward slash is used on all OSes (embedded FS requires forward slash,
		// while Windows uses backslash).
		src, err := packagesFS.Open(path.Join(embedPackageRootDir, entry.Name()))
		if err != nil {
			return err
		}
		defer src.Close()
		dst, err := downloadsDir.Join(entry.Name()).Create()
		if err != nil {
			return err
		}
		defer dst.Close()
		if _, err := io.Copy(dst, src); err != nil {
			return err
		}
		src.Close()
		dst.Close()
		slog.Debug("Copied discovery package to downloads dir", slog.String("file", entry.Name()))
	}
	defer func() {
		if _, err := srv.CleanDownloadCacheDirectory(ctx, &rpc.CleanDownloadCacheDirectoryRequest{}); err != nil {
			slog.Error("Error cleaning cache directory", slog.Any("error", err))
		}
	}()

	// Initialize the CLI so it can auto-install the discovery packages
	var inst *rpc.Instance
	if resp, err := srv.Create(ctx, &rpc.CreateRequest{}); err != nil {
		return err
	} else {
		inst = resp.GetInstance()
	}
	defer func() {
		_, _ = srv.Destroy(ctx, &rpc.DestroyRequest{Instance: inst})
	}()

	if err := srv.Init(
		&rpc.InitRequest{Instance: inst},
		commands.InitStreamResponseToCallbackFunction(ctx, func(r *rpc.InitResponse) error {
			slog.Debug("Arduino init instance", slog.String("instance", r.String()))
			return nil
		}),
	); err != nil {
		return err
	}

	toolsInstalled = true
	return nil
}

var builtinDiscoveries = []string{"serial-discovery", "mdns-discovery"}

// bundledToolVersion parses the version out of archive names like "mdns-discovery_v1.1.0_Windows_64bit.zip".
func bundledToolVersion(entries []fs.DirEntry, tool string) *semver.Version {
	for _, entry := range entries {
		rest, ok := strings.CutPrefix(entry.Name(), tool+"_")
		if !ok {
			continue
		}
		version, _, _ := strings.Cut(rest, "_")
		if v, err := semver.Parse(strings.TrimPrefix(version, "v")); err == nil {
			return v
		}
	}
	return nil
}

func discoveriesUpToDate(dataDir *paths.Path, entries []fs.DirEntry) bool {
	for _, tool := range builtinDiscoveries {
		bundled := bundledToolVersion(entries, tool)
		if bundled == nil {
			slog.Warn("No bundled archive found for discovery", slog.String("tool", tool))
			continue
		}
		if !toolInstalledAtLeast(dataDir.Join("packages", "builtin", "tools", tool), bundled) {
			slog.Info("Bundled discovery not installed", slog.String("tool", tool), slog.String("version", bundled.String()))
			return false
		}
	}
	return true
}

func toolInstalledAtLeast(toolDir *paths.Path, min *semver.Version) bool {
	releases, err := toolDir.ReadDir()
	if err != nil {
		return false
	}
	releases.FilterDirs()
	for _, release := range releases {
		if v, err := semver.Parse(release.Base()); err == nil && v.GreaterThanOrEqual(min) {
			return true
		}
	}
	return false
}
