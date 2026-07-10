package app

// API methods exposed to the frontend, grouped by functionality.
// This file should only contain the method signatures and no or very little logic

import (
	"fmt"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"app-lab-desktop/internal/appui"
	"app-lab-desktop/internal/arduinoapps"
	"app-lab-desktop/internal/auth"
	"app-lab-desktop/internal/board"
	"app-lab-desktop/internal/carrier"
	"app-lab-desktop/internal/featureflags"
	"app-lab-desktop/internal/flasher"
	"app-lab-desktop/internal/fs"
	"app-lab-desktop/internal/fs/opener"
	"app-lab-desktop/internal/learn"
	"app-lab-desktop/internal/network"
	"app-lab-desktop/internal/network/ethernet"
	"app-lab-desktop/internal/network/wifi"
	"app-lab-desktop/internal/terminal"
	"app-lab-desktop/internal/update"
)

// Board check management
func (a *App) IsBoard() bool {
	return board.IsSBC()
}

func (a *App) NeedsImageUpdate() bool {
	return a.selectedBoard.IsR0Build()
}

func (a *App) RebootBoard(password string) error {
	return a.selectedBoard.RebootBoard(a.selectedBoard.Conn, password)
}

// Orchestrator URL management
func (a *App) GetOrchestratorURL() (string, error) {
	return a.selectedBoard.GetOrchestratorURL()
}

// WiFi management
func (a *App) ConnectToWiFi(ssid, password string) error {
	return wifi.Connect(a.ctx(), a.selectedBoard.Conn, ssid, password)
}

func (a *App) DisconnectWiFi() error {
	return wifi.Disconnect(a.ctx(), a.selectedBoard.Conn)
}

func (a *App) ListSSIDs() ([]string, error) {
	return wifi.ListSSIDs(a.ctx(), a.selectedBoard.Conn)
}

func (a *App) GetWiFiStatus() (wifi.WifiStatus, error) {
	return wifi.GetWiFiStatus(a.ctx(), a.selectedBoard.Conn)
}

func (a *App) GetEthStatus() (ethernet.EthStatus, error) {
	return ethernet.GetEthStatus(a.ctx(), a.selectedBoard.Conn)
}

func (a *App) GetInternetStatus() (bool, error) {
	return network.GetInternetStatus(a.ctx(), a.selectedBoard.Conn)
}

func (a *App) GetConnectionName() (*string, error) {
	return network.GetConnectionName(a.ctx(), a.selectedBoard.Conn)
}

func (a *App) GetIPAddress() (*string, error) {
	return network.GetIPAddress(a.ctx(), a.selectedBoard.Conn)
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

func (a *App) GetFileTree(path string) (*fs.FSNode, error) {
	return fs.GetFileTree(path, a.selectedBoard.Conn)
}

func (a *App) GetFileContent(p string) (string, error) {
	return fs.GetFileContent(p, a.selectedBoard.Conn)
}

func (a *App) WriteFileContent(path string, content string) error {
	return fs.WriteFileContent(a.selectedBoard.Conn, path, content)
}

func (a *App) RenameFile(oldPath string, newPath string) error {
	return fs.RenameFile(a.selectedBoard.Conn, oldPath, newPath)
}

func (a *App) RenameFolder(oldPath string, newPath string) error {
	return fs.RenameFolder(a.selectedBoard.Conn, oldPath, newPath)
}

func (a *App) RemoveFile(path string) error {
	return fs.RemoveFile(a.selectedBoard.Conn, path)
}

func (a *App) CreateFolder(path string) error {
	return fs.CreateFolder(a.selectedBoard.Conn, path)
}

func (a *App) IsDirectory(path string) (bool, error) {
	return fs.IsDirectory(a.selectedBoard.Conn, path)
}

func (a *App) IsLocalDirectory(path string) (bool, error) {
	return fs.IsLocalDirectory(path)
}

func (a *App) SelectFilesDialog(remoteDir string) ([]string, error) {
	return fs.SelectFilesDialog(a.ctx(), a.selectedBoard.Conn, remoteDir)
}

func (a *App) ImportFileToAppFromPath(remoteDir string, filePaths string, newFileName string) (string, error) {
	return fs.ImportFileToAppFromPath(a.ctx(), a.selectedBoard.Conn, remoteDir, filePaths, newFileName)
}

func (a *App) SelectFolderDialog(remoteDir string) (string, error) {
	return fs.SelectFolderDialog(a.ctx(), a.selectedBoard.Conn, remoteDir)
}

func (a *App) ImportFolderToAppFromPath(remoteDir string, folderPath string, newFileName string) (string, error) {
	return fs.ImportFolderToAppFromPath(a.ctx(), a.selectedBoard.Conn, remoteDir, folderPath, newFileName)
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
func (a *App) OpenBoardTerminal() error {
	return terminal.OpenTerminal(a.ctx(), a.selectedBoard)
}

// Flasher endpoints
func (a *App) GetOSImageVersion() string {
	return a.selectedBoard.GetOSImageVersion()
}

func (a *App) IsUserPartitionPreservationSupported(currentImageVersion string, targetImageVersion string) bool {
	return flasher.IsUserPartitionPreservationSupported(currentImageVersion, targetImageVersion)
}

func (a *App) ListAvailableOSImages() ([]flasher.OSImageRelease, error) {
	return flasher.ListAvailableOSImages(a.ctx())
}

func (a *App) GetAvailableFreeSpace() (uint64, error) {
	return flasher.GetAvailableFreeSpace(a.ctx())
}

func (a *App) Flash(imageVersion flasher.OSImageRelease, preserveUserPartition bool) error {
	return flasher.Flash(a.selectedBoard.Info.Serial, imageVersion, preserveUserPartition, func(event flasher.FlashEvent) {
		runtime.EventsEmit(a.ctx(), "flash-progress", event)
	})
}

func (a *App) CancelFlash() {
	flasher.CancelFlash()
}

func (a *App) InferOrchestratorURL() (string, error) {
	orchestratorURL := ""
	if a.IsBoard() {
		orchestratorURL = "http://localhost:8800"
	} else {
		tunlOrchestratorURL, err := a.GetOrchestratorURL()
		if err != nil {
			return "", err
		}
		orchestratorURL = tunlOrchestratorURL
	}

	return orchestratorURL, nil
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

	return arduinoapps.SelectAppDialog(a.ctx(), orchestratorURL)
}

func (a *App) ImportAppFromPath(filePath string) (string, error) {
	orchestratorURL, err := a.InferOrchestratorURL()
	if err != nil {
		return "", fmt.Errorf("failed to get orchestrator URL for import app from path: %w", err)
	}

	return arduinoapps.ImportAppFromPath(a.ctx(), orchestratorURL, filePath)
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
func (a *App) CarrierList() ([]carrier.Carrier, error) {
	return carrier.List(a.ctx(), a.selectedBoard.Conn)
}

func (a *App) CarrierShow(carrierName string) (carrier.ShowResult, error) {
	return carrier.Show(a.ctx(), a.selectedBoard.Conn, carrierName)
}

func (a *App) CarrierDisable(password string, carrierName string) (carrier.ShowCarrierResult, error) {
	return carrier.Disable(a.selectedBoard.Conn, password, carrierName)
}

func (a *App) CarrierEnable(password string, carrierName string, configuration []carrier.EnableDeviceConfig) (carrier.ShowCarrierResult, error) {
	return carrier.Enable(a.selectedBoard.Conn, password, carrierName, configuration)
}
