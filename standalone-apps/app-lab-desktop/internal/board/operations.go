package board

import (
	"context"
	"errors"
	"fmt"
	"io"
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

	boards, err := board.FromFQBN(ctx, arduinoQFqbn)
	if err != nil {
		return nil, fmt.Errorf("failing to get board from FQBN: %w", err)
	}
	if len(boards) == 0 {
		return nil, fmt.Errorf("no boards found for FQBN %s", arduinoQFqbn)
	}

	var result []*Board
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

	// If data dir has package_index.json, then we assume that discoveries are installed
	if dataDir.Join("package_index.json").Exist() {
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
