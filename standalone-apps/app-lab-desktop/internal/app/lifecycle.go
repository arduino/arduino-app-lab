package app

import (
	"context"
	_ "embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	stdruntime "runtime"
	"strings"

	"app-lab-desktop/internal/airuntime"
	"app-lab-desktop/internal/auth"
	"app-lab-desktop/internal/board"
	"app-lab-desktop/internal/flasher"
	"app-lab-desktop/internal/fs/watcher"
	"app-lab-desktop/internal/notices"
	"app-lab-desktop/internal/update"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// HostFileDropEvent carries the paths of a native file drop to the frontend,
// already recorded as readable for this session. The frontend listens here
// instead of on `wails:file-drop` - see the OnFileDrop registration below.
const HostFileDropEvent = "host-file-drop"

func (a *App) Startup(ctx context.Context) {
	if err := a.registerOSFileHandler(); err != nil {
		runtime.LogErrorf(ctx, "failed to register protocol: %v", err)
	}

	a.ctxHolder.Set(ctx)

	// Dragging a file onto the window is the user handing it to us, so record it
	// as readable. The event is emitted in Go, so the paths arrive as real
	// strings.
	//
	// Go is the only subscriber to `wails:file-drop`, and hands the paths on
	// under its own name. That is not cosmetic: `EventsOff` in the webview
	// reaches the shared Go event bus, which drops *every* listener registered
	// for that name - including this one, which Startup installs once and would
	// never reinstate. Re-emitting also fixes the order, since the allow-set is
	// written before the webview is told anything.
	runtime.OnFileDrop(ctx, func(x int, y int, paths []string) {
		a.hostReads.Allow(paths...)
		runtime.EventsEmit(ctx, HostFileDropEvent, x, y, paths)
	})

	a.watcher = watcher.NewWatchManager(ctx)

	// Windows-only delivery of the Go/npm attribution, a no-op elsewhere — the
	// split is explained in internal/notices. Non-fatal: a full disk should not
	// stop the app starting.
	if dataDir, err := airuntime.AppDataDir(); err != nil {
		runtime.LogErrorf(ctx, "failed to resolve the app data dir for notices: %v", err)
	} else if err := notices.WriteDependencyNotices(filepath.Join(dataDir, "licenses")); err != nil {
		runtime.LogErrorf(ctx, "failed to write dependency notices: %v", err)
	}

	if err := board.InstallToolingIfMissing(ctx); err != nil {
		runtime.LogErrorf(ctx, "failed to initialize board: %v", err)
		// TODO: Display error to user?
	}

	// TODO: this should be either a build or runtime flag
	var userAgent string = fmt.Sprintf("App Lab %s; Desktop", a.version)
	if board.IsSBC() {
		b, err := board.GetSbcBoard(ctx)
		if err != nil {
			runtime.LogErrorf(ctx, "failed to get SBC board: %v", err)
			return
		}
		a.selectedBoard = b
		userAgent = fmt.Sprintf("App Lab %s; %s; %s", a.version, b.Info.BoardName, b.GetOSImageVersion())
	}

	u, err := update.NewUpdater(a.version, userAgent, os.Getenv("ARDUINO_APP_LAB_UPDATE_URL"))
	if err != nil {
		runtime.LogErrorf(ctx, "failed to initialize updater: %v", err)
	}
	a.updater = u

	// checking for updates is best-effort in SBC mode, we just log errors
	// in Desktop mode, `NewVersion` is driven by the UI (see api.go) so we don't call it here
	if board.IsSBC() {
		_, versionErr := u.NewVersion(ctx)
		if versionErr == nil {
			runtime.LogInfof(ctx, "Successfully checked for updates (SBC)")
		} else {
			runtime.LogInfof(ctx, "Failed to check for updates (SBC), skipping...")
		}
	}

	a.AuthFlow = auth.NewFlow()

	a.lspHandler.Initialize()

}

func (a *App) Shutdown(ctx context.Context) {
	if a.watcher != nil {
		a.watcher.Close()
	}
	_ = a.AgentStop()
	// Wails never cancels the app context, so a sign-in awaiting its code would outlive the window.
	a.agentMu.Lock()
	login := a.pendingLogin
	a.agentMu.Unlock()
	if login != nil {
		login.cancel()
	}
	// Same reason: an install runs under the app context too, so quitting mid-`npm ci` would orphan npm and its
	// download with nothing left to report to. Cancel returns immediately and is safe when idle.
	a.runtimeMu.Lock()
	rt := a.runtimeMgr
	a.runtimeMu.Unlock()
	if rt != nil {
		rt.Cancel()
	}
	daemon, err := flasher.FlashDaemonService()
	if err == nil {
		daemon.DaemonShutDown()
	}
	a.selectedBoard.CloseTunnels(ctx)
	a.lspHandler.StopAll()
}

func (a *App) ctx() context.Context {
	return a.ctxHolder.Get()
}

func (a *App) detectBoards() ([]*board.Board, error) {
	boards, err := board.GetBoards(a.ctx())
	if err != nil {
		return nil, fmt.Errorf("failed to detect boards: %w", err)
	}
	// Discovery (e.g. mDNS) can return a stale custom name until the board
	// re-announces itself: for the selected board, prefer the name we know
	// (kept up to date on rename).
	for i, b := range boards {
		// Match by serial (USB) or address (network)
		isSelected := (b.Info.Serial != "" && b.Info.Serial == a.selectedBoard.Info.Serial)
		if isSelected {
			boards[i].Info.CustomName = a.selectedBoard.Info.CustomName
		}
	}
	a.detectedBoards = boards
	return boards, nil
}

func (a *App) selectBoard(serial string, password string) error {
	for _, b := range a.detectedBoards {
		if b.Info.Serial == serial {
			if err := b.EstablishConnection(a.ctx(), password); err != nil {
				return fmt.Errorf("failed to select board: %w", err)
			}
			// The agent is bound to one board — its prompt describes it and its mirrors hold that board's files — so
			// hand the board over before swapping it (flush, stop, drop checkouts). See detachAgentForBoardChange.
			a.detachAgentForBoardChange()
			// The connection is changing; drop any watches pointing at the old one.
			if a.watcher != nil {
				a.watcher.UnwatchAll()
			}
			// The old "changed once" premise is gone (the board is swapped repeatedly now); still open: the previous board's Conn/tunnels aren't closed, and this assignment stays unsynchronised for the non-agent readers (W1).
			*a.selectedBoard = *b

			a.lspHandler.OnBoardSelected()

			return nil
		}
	}
	return fmt.Errorf("failed to select board: board with serial %s not found", serial)
}

//go:embed ArduinoAppLab.desktop
var appLabDesktopFile string

//go:embed arduino-app-lab.png
var appLabDesktopIcon []byte

func (a *App) registerOSFileHandler() error {
	// Only linux supported for now, as this relies on xdg-mime and .desktop files
	if stdruntime.GOOS != "linux" {
		return nil
	}

	// Check if the package has been installed via a .deb or .rpm, in that case we
	// assume the installer has taken care of registering the protocol handler.
	if _, err := os.Stat("/usr/share/applications/ArduinoAppLab.desktop"); err == nil {
		return nil
	}

	mimeType := "x-scheme-handler/arduino-app-lab"

	// Drop a .desktop file in the user's home directory to register the protocol handler.
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	execPath, err := os.Executable()
	if err != nil {
		return err
	}
	execFileName := filepath.Base(execPath)
	desktopFileName := execFileName + ".desktop"
	desktopDir := filepath.Join(home, ".local", "share", "applications")
	desktopPath := filepath.Join(desktopDir, desktopFileName)
	iconDir := filepath.Join(home, ".local", "share", "icons")
	iconPath := filepath.Join(iconDir, "arduino-app-lab.png")
	desktopFileContent := strings.ReplaceAll(appLabDesktopFile, "$BINARY_PATH", execPath)
	desktopFileContent = strings.ReplaceAll(desktopFileContent, "$WM_CLASS", execFileName)
	desktopFileContent = strings.ReplaceAll(desktopFileContent, "$ICON", iconPath)
	desktopFileContent = strings.ReplaceAll(desktopFileContent, "$VERSION", a.version)

	// Check if the .desktop file already exists and has the correct content, if not create/update it.
	fileNeedsUpdate := true
	if _, err := os.Stat(desktopPath); err == nil {
		existingContent, err := os.ReadFile(desktopPath)
		if err == nil && string(existingContent) == desktopFileContent {
			fileNeedsUpdate = false
		}
	}

	if fileNeedsUpdate {
		// Write/update the .desktop file
		if err := os.MkdirAll(desktopDir, 0755); err != nil {
			return err
		}
		if err := os.WriteFile(desktopPath, []byte(desktopFileContent), 0644); err != nil {
			return err
		}
		// Write the icon file
		if err := os.MkdirAll(iconDir, 0755); err != nil {
			return err
		}
		if err := os.WriteFile(iconPath, appLabDesktopIcon, 0644); err != nil {
			return err
		}

		// Update the desktop database to register the new .desktop file, if the tool is available.
		if cmdPath, err := exec.LookPath("update-desktop-database"); err == nil {
			_ = exec.Command(cmdPath, desktopDir).Run()
		} else {
			fmt.Println("Warning: update-desktop-database not found, skipping cache refresh.")
		}
	}

	// Register the protocol handler for the current user using xdg-mime.
	return exec.Command("xdg-mime", "default", desktopFileName, mimeType).Run()
}
