package app

// API methods exposed to the frontend, grouped by functionality.
// This file should only contain the method signatures and no or very little logic

import (
	"errors"
	"fmt"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"app-lab-desktop/internal/agent"
	"app-lab-desktop/internal/appui"
	"app-lab-desktop/internal/arduinoapps"
	"app-lab-desktop/internal/auth"
	"app-lab-desktop/internal/board"
	"app-lab-desktop/internal/carrier"
	"app-lab-desktop/internal/featureflags"
	"app-lab-desktop/internal/flasher"
	"app-lab-desktop/internal/fs"
	"app-lab-desktop/internal/fs/opener"
	"app-lab-desktop/internal/fs/watcher"
	"app-lab-desktop/internal/httpclient"
	"app-lab-desktop/internal/hw"
	"app-lab-desktop/internal/learn"
	"app-lab-desktop/internal/lsp"
	"app-lab-desktop/internal/network"
	"app-lab-desktop/internal/network/wifi"
	"app-lab-desktop/internal/terminal"
	"app-lab-desktop/internal/update"
)

func (a *App) MakeHTTPRequest(method, url, token string, headers map[string]string, body string) (*httpclient.Response, error) {
	return httpclient.DoRequest(a.ctx(), method, url, token, headers, body)
}

// Board check management
func (a *App) IsBoard() bool {
	return board.IsSBC()
}

func (a *App) NeedsImageUpdate() bool {
	return a.selectedBoard.IsR0Build()
}

func (a *App) RebootBoard(password string) error {
	sb := a.boardSnapshot() // one snapshot: the board and the connection it is rebooted over must be the same one
	return sb.RebootBoard(sb.Conn, password)
}

// Orchestrator URL management
func (a *App) GetOrchestratorURL() (string, error) {
	return a.selectedBoard.GetOrchestratorURL()
}

// Cloud Connector URL management
func (a *App) GetCloudConnectorURL() (string, error) {
	return a.selectedBoard.GetCloudConnectorURL()
}

// WiFi management
func (a *App) ConnectToWiFi(ssid, password string) error {
	err := wifi.Connect(a.ctx(), a.boardConn(), ssid, password)
	if errors.Is(err, wifi.ErrIncorrectPassword) {
		// Return the bare error code: it is the API contract with the frontend
		return wifi.ErrIncorrectPassword
	}
	return err
}

func (a *App) DisconnectWiFi() error {
	return wifi.Disconnect(a.ctx(), a.boardConn())
}

func (a *App) ListSSIDs() ([]string, error) {
	return wifi.ListSSIDs(a.ctx(), a.boardConn())
}

func (a *App) GetNetworkStatus() (network.NetworkStatus, error) {
	return network.GetNetworkStatus(a.ctx(), a.boardConn())
}

func (a *App) GetConnectionName() (*string, error) {
	return network.GetConnectionName(a.ctx(), a.boardConn())
}

func (a *App) GetIPAddress() (*string, error) {
	return network.GetIPAddress(a.ctx(), a.boardConn())
}

// Feature flags management
func (a *App) GetFeatureFlags() []string {
	return featureflags.GetFeatureFlags()
}

// Update management
func (a *App) GetCurrentVersion() string {
	return a.version
}

func (a *App) NewVersion() (string, error) {
	if a.updater == nil {
		return "", fmt.Errorf("updater is not initialized")
	}
	return a.updater.NewVersion(a.ctx())
}

func (a *App) CheckAndApplyUpdate(showConfirmDialog bool) error {
	if a.updater == nil {
		return fmt.Errorf("updater is not initialized")
	}
	return a.updater.CheckAndApplyUpdate(a.ctx(), showConfirmDialog)
}

func (a *App) CheckBoardUpdate(onlyArduino bool, origin string) (string, error) {
	return update.CheckBoardUpdateV1Request(onlyArduino, origin)
}

func (a *App) ApplyBoardUpdate(onlyArduino bool, origin string) (*bool, error) {
	return update.ApplyBoardUpdateV1Request(onlyArduino, origin)
}

func (a *App) GetBoardUpdateLogs(origin string) error {
	return update.GetBoardUpdateLogsStreamV1Request(a.ctx(), origin)
}

// Board list management
func (a *App) GetBoardList() ([]*board.Board, error) {
	return a.detectBoards()
}

func (a *App) SelectBoard(serial string, password string) error {
	return a.selectBoard(serial, password)
}

// Board name management
func (a *App) GetBoardName() (string, error) {
	return a.selectedBoard.GetName(a.ctx())
}

func (a *App) SetBoardName(name string) error {
	return a.selectedBoard.SetName(a.ctx(), name)
}

func (a *App) GetKeyboardLayout() (string, error) {
	return a.selectedBoard.GetKeyboardLayout(a.ctx())
}

func (a *App) ListKeyboardLayouts() ([]board.KeyboardLayout, error) {
	return a.selectedBoard.ListKeyboardLayouts()
}

func (a *App) SetKeyboardLayout(layout string) error {
	return a.selectedBoard.SetKeyboardLayout(a.ctx(), layout)
}

func (a *App) GetKernelVersion() (string, error) {
	return a.selectedBoard.GetKernelVersion(a.ctx())
}

func (a *App) GetLinuxDistribution() (string, error) {
	return a.selectedBoard.GetLinuxDistribution()
}

// Board network mode management
func (a *App) GetNetworkModeStatus() (bool, error) {
	return a.selectedBoard.GetNetworkModeStatus(a.ctx())
}

func (a *App) EnableNetworkMode(password string) error {
	return a.selectedBoard.EnableNetworkMode(a.ctx(), password)
}

func (a *App) DisableNetworkMode(password string) error {
	return a.selectedBoard.DisableNetworkMode(a.ctx(), password)
}

// Board user password management
func (a *App) IsUserPasswordSet() (bool, error) {
	return a.selectedBoard.IsUserPasswordSet(a.ctx())
}

func (a *App) SetUserPassword(password string) error {
	return a.selectedBoard.SetUserPassword(a.ctx(), password)
}

// File system management
func (a *App) OpenFile(path string) error {
	return opener.Open(path)
}

func (a *App) ListDirectory(path string) ([]fs.FSNode, error) {
	return fs.ListDirectory(path, a.boardConn())
}

// StatPath resolves to null when nothing exists at path.
func (a *App) StatPath(path string) (*fs.FSNode, error) {
	return fs.StatPath(a.boardConn(), path)
}

func (a *App) GetFileContent(path string) (string, error) {
	return fs.GetFileContent(path, a.boardConn(), a.hostReads)
}

// File mutations optionally suppress the watcher: when suppressWatch is true
// (UI-originated edits, which already update the frontend optimistically) the
// resulting fs events are ignored to avoid a self-refresh. Suppression is held
// for the op's full duration (see suppressHold). Callers that WANT a refresh —
// e.g. the integrated agent writing files — pass false.
func (a *App) WriteFileContent(path string, content string, suppressWatch bool) error {
	if suppressWatch {
		a.suppressHold(path)
		defer a.suppressRelease(path)
	}
	return fs.WriteFileContent(a.boardConn(), path, content)
}

func (a *App) RenameFile(oldPath string, newPath string, suppressWatch bool) error {
	if suppressWatch {
		a.suppressHold(oldPath, newPath)
		defer a.suppressRelease(oldPath, newPath)
	}
	return fs.RenameFile(a.boardConn(), oldPath, newPath)
}

func (a *App) RenameFolder(oldPath string, newPath string, suppressWatch bool) error {
	if suppressWatch {
		a.suppressHold(oldPath, newPath)
		defer a.suppressRelease(oldPath, newPath)
	}
	return fs.RenameFolder(a.boardConn(), oldPath, newPath)
}

func (a *App) RemoveFile(path string, suppressWatch bool) error {
	if suppressWatch {
		a.suppressHold(path)
		defer a.suppressRelease(path)
	}
	return fs.RemoveFile(a.boardConn(), path)
}

func (a *App) CreateFolder(path string, suppressWatch bool) error {
	if suppressWatch {
		a.suppressHold(path)
		defer a.suppressRelease(path)
	}
	return fs.CreateFolder(a.boardConn(), path)
}

// Filesystem watching. These start/stop backend watches whose changes are
// reported to the frontend via the "refresh" event.

func (a *App) WatchApp(path string) error {
	return a.watcher.WatchApp(a.watchTarget(), path)
}

func (a *App) UnwatchApp(path string) {
	a.watcher.UnwatchApp(path)
}

func (a *App) WatchAppsDir(path string) error {
	return a.watcher.WatchAppsDir(a.watchTarget(), path)
}

func (a *App) UnwatchAppsDir(path string) {
	a.watcher.UnwatchAppsDir(path)
}

func (a *App) UnwatchAll() {
	a.watcher.UnwatchAll()
}

// watchTarget snapshots the current connection and whether its filesystem is
// local, for the watcher to choose the fsnotify vs inotifywait backend.
func (a *App) watchTarget() watcher.Target {
	sb := a.boardSnapshot()
	return watcher.Target{
		Conn:    sb.Conn,
		IsLocal: sb.IsLocalFS(),
	}
}

// suppressHold / suppressRelease bracket a self-originated fs mutation so the
// watcher ignores the events it produces for the op's full duration (however
// long the transfer takes), plus a short grace window after release. Every hold
// must be released — use defer.
func (a *App) suppressHold(paths ...string) {
	if a.watcher != nil {
		a.watcher.SuppressHold(paths...)
	}
}

func (a *App) suppressRelease(paths ...string) {
	if a.watcher != nil {
		a.watcher.SuppressRelease(paths...)
	}
}

func (a *App) IsLocalDirectory(path string) (bool, error) {
	return fs.IsLocalDirectory(path)
}

func (a *App) SelectFilesDialog(remoteDir string) ([]string, error) {
	return fs.SelectFilesDialog(a.ctx(), a.boardConn(), remoteDir, a.hostReads)
}

func (a *App) ImportFileToAppFromPath(remoteDir string, filePaths string, newFileName string, suppressWatch bool) (string, error) {
	if suppressWatch {
		target := fs.ImportTargetPath(remoteDir, filePaths, newFileName)
		a.suppressHold(target)
		defer a.suppressRelease(target)
	}
	return fs.ImportFileToAppFromPath(a.ctx(), a.boardConn(), remoteDir, filePaths, newFileName, a.hostReads)
}

func (a *App) SelectFolderDialog(remoteDir string) (string, error) {
	return fs.SelectFolderDialog(a.ctx(), a.boardConn(), remoteDir, a.hostReads)
}

func (a *App) ImportFolderToAppFromPath(remoteDir string, folderPath string, newFileName string, suppressWatch bool) (string, error) {
	if suppressWatch {
		target := fs.ImportTargetPath(remoteDir, folderPath, newFileName)
		a.suppressHold(target)
		defer a.suppressRelease(target)
	}
	return fs.ImportFolderToAppFromPath(a.ctx(), a.boardConn(), remoteDir, folderPath, newFileName, a.hostReads)
}

// Apps UI management
func (a *App) OpenUIWhenReady(port int, timeout int) error {
	return appui.OpenUIWhenReady(a.ctx(), a.selectedBoard, port, timeout)
}

func (a *App) ForwardNonUIPort(port int) error {
	return appui.ForwardNonUIPort(a.ctx(), a.selectedBoard, port)
}

// Learn
func (a *App) GetLearnResourceList() ([]learn.LearnResourceEntry, error) {
	return a.learnSvc.GetResourceList(a.ctx())
}

func (a *App) GetLearnResource(id learn.LearnResourceID) (*learn.FullLearnResource, error) {
	return a.learnSvc.GetResource(a.ctx(), id)
}

func (a *App) GetTags() ([]learn.Tag, error) {
	return a.learnSvc.GetTags(a.ctx())
}

// Open Terminal
func (a *App) OpenBoardTerminal() (terminal.LaunchResult, error) {
	return terminal.OpenTerminal(a.ctx(), a.selectedBoard, terminal.Options{
		PreferredTerminal: readTerminalPreference(),
	})
}

// ListTerminals returns the terminal emulators available on the system, in the
// order they are tried when no terminal has been selected.
func (a *App) ListTerminals() terminal.TerminalCatalog {
	return terminal.ListAvailable()
}

// GetTerminalPreference returns the terminal selected by the user, an empty
// value means that the terminal is detected automatically.
func (a *App) GetTerminalPreference() string {
	return readTerminalPreference()
}

// SetTerminalPreference persists the terminal selected by the user, an empty
// value restores the automatic detection.
func (a *App) SetTerminalPreference(value string) error {
	return setTerminalPreference(value)
}

// Flasher endpoints
func (a *App) GetOSImageVersion() string {
	return a.selectedBoard.GetOSImageVersion()
}

func (a *App) IsUserPartitionPreservationSupported(currentImageVersion string, targetImageVersion string) bool {
	return flasher.IsUserPartitionPreservationSupported(currentImageVersion, targetImageVersion)
}

func (a *App) ListAvailableOSImages() ([]flasher.OSImageRelease, error) {
	return flasher.ListAvailableOSImages(a.ctx(), a.selectedBoard.Info.FQBN)
}

func (a *App) GetAvailableFreeSpace() (uint64, error) {
	return flasher.GetAvailableFreeSpace(a.ctx())
}

func (a *App) Flash(imageVersion flasher.OSImageRelease, preserveUserPartition bool) error {
	// flasher.Flash calls the callback on this goroutine, so reading the flag after it returns needs no sync.
	writing := false
	err := flasher.Flash(a.selectedBoard.Info, imageVersion, preserveUserPartition, func(event flasher.FlashEvent) {
		if event.Step == flasher.FlashStepFlashing {
			writing = true
		}
		runtime.EventsEmit(a.ctx(), "flash-progress", event)
	})
	// A flashed board reboots and may have lost the apps the agent checked out, so the agent is stopped instead of
	// kept on stale state. A failure counts too once the write had started: the board the checkouts describe is
	// wiped either way, and a later turn would push pre-flash files at it. A failure before that (no daemon, a
	// download that never landed) leaves the board alone, so the agent keeps working.
	if (err == nil || writing) && a.dropAgent() {
		a.emit("acp:restart", agent.RestartInfo{GaveUp: true, Reason: boardFlashedReason})
	}
	return err
}

func (a *App) CancelFlash() {
	flasher.CancelFlash()
}

func (a *App) InferOrchestratorURL() (string, error) {
	return a.boardSnapshot().InferOrchestratorURL()
}

// App import/export
func (a *App) ExportApp(appID string, appName string, includeData bool) (string, error) {
	orchestratorURL, err := a.InferOrchestratorURL()
	if err != nil {
		return "", fmt.Errorf("failed to get orchestrator URL for export app: %w", err)
	}

	return arduinoapps.ExportApp(a.ctx(), orchestratorURL, appID, appName, includeData)
}

func (a *App) SelectAppDialog() (string, error) {
	orchestratorURL, err := a.InferOrchestratorURL()
	if err != nil {
		return "", fmt.Errorf("failed to get orchestrator URL for import app: %w", err)
	}

	return arduinoapps.SelectAppDialog(a.ctx(), orchestratorURL, a.hostReads)
}

func (a *App) ImportAppFromPath(filePath string) (string, error) {
	orchestratorURL, err := a.InferOrchestratorURL()
	if err != nil {
		return "", fmt.Errorf("failed to get orchestrator URL for import app from path: %w", err)
	}

	return arduinoapps.ImportAppFromPath(a.ctx(), orchestratorURL, filePath, a.hostReads)
}

func (a *App) ChooseReleaseSavePath(defaultFileName string) (string, error) {
	return a.releaseFiles.ChooseSavePath(a.ctx(), defaultFileName)
}

func (a *App) WriteReleaseFile(filePath string, contentBase64 string) error {
	return a.releaseFiles.Write(filePath, contentBase64)
}

func (a *App) ReadReleaseManifest(filePath string) (arduinoapps.ReleaseManifest, error) {
	return arduinoapps.ReadReleaseManifest(filePath, a.hostReads)
}

func (a *App) ReadReleaseArchive(filePath string) (string, error) {
	return arduinoapps.ReadReleaseArchive(filePath, a.hostReads)
}

// Edge Impulse integration
func (a *App) GetRefreshToken(user string) (string, error) {
	return auth.GetRefreshToken(user)
}

func (a *App) SetRefreshToken(user string, token string) error {
	return auth.SetRefreshToken(user, token)
}

func (a *App) DeleteRefreshToken(user string) error {
	return auth.DeleteRefreshToken(user)
}

// Carrier
func (a *App) CarrierList() (carrier.CarrierResponse, error) {
	return carrier.List(a.ctx(), a.boardConn())
}

func (a *App) CarrierShow() (carrier.ShowResult, error) {
	return carrier.Show(a.ctx(), a.boardConn())
}

func (a *App) CarrierDisable(password string, carrierName string) error {
	return carrier.Disable(a.ctx(), a.boardConn(), password, carrierName)
}

func (a *App) CarrierEnable(password string, carrierName string, configuration []carrier.EnableDeviceConfig) error {
	return carrier.Enable(a.ctx(), a.boardConn(), password, carrierName, configuration)
}

// Hardware
func (a *App) HwSupported() bool {
	return hw.Supported(a.ctx(), a.boardConn())
}

func (a *App) HwAvailable() bool {
	return hw.Available(a.ctx(), a.boardConn())
}

func (a *App) HwList() (hw.ListResult, error) {
	return hw.List(a.ctx(), a.boardConn())
}

func (a *App) HwShow() (hw.ShowResult, error) {
	return hw.Show(a.ctx(), a.boardConn())
}

func (a *App) HwDisable(password string, name string) error {
	return hw.Disable(a.ctx(), a.boardConn(), password, name)
}

func (a *App) HwEnable(password string, name string, configuration []hw.EnableDeviceConfig) error {
	return hw.Enable(a.ctx(), a.boardConn(), password, name, configuration)
}

// LSP

func (a *App) IsLspEnabled() bool {
	return a.lspHandler.IsLspEnabled()
}

func (a *App) InitLspWorkspace(appPath string) error {
	return lsp.InitLspWorkspace(a.boardConn(), appPath)
}

func (a *App) GetLspTempWorkspaceAppDir() string {
	return lsp.GetLspTempWorkspaceAppDir()
}

func (a *App) GetLspWorkspaceFile(filePath string) (string, error) {
	return lsp.GetLspWorkspaceFile(filePath)
}

func (a *App) ListLspSketchFiles(dir string) ([]string, error) {
	return lsp.ListLspSketchFiles(dir)
}

func (a *App) ListLspFiles(workspaceDir string, relDir string) ([]string, error) {
	return lsp.ListLspFiles(workspaceDir, relDir)
}

func (a *App) StartLSP(lspId lsp.LspId, workspaceDir string) error {
	return a.lspHandler.Start(lspId, workspaceDir)
}

func (a *App) StopAllLSP() {
	a.lspHandler.StopAll()
}

func (a *App) SendLSPMessage(lspId lsp.LspId, message interface{}) error {
	return a.lspHandler.Send(lspId, message)
}
