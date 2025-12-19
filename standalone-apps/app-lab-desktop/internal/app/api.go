package app

// API methods exposed to the frontend, grouped by functionality.
// This file should only contain the method signatures and no or very little logic

import (
	"app-lab-desktop/internal/appui"
	"app-lab-desktop/internal/board"
	"app-lab-desktop/internal/featureflags"
	"app-lab-desktop/internal/fs"
	"app-lab-desktop/internal/fs/opener"
	"app-lab-desktop/internal/learn"
	"app-lab-desktop/internal/network"
	"app-lab-desktop/internal/network/ethernet"
	"app-lab-desktop/internal/network/wifi"
	"app-lab-desktop/internal/terminal"
	"app-lab-desktop/internal/update"

	"fmt"
)

// Board check management
func (a *App) IsBoard() bool {
	return board.IsSBC()
}

func (a *App) NeedsImageUpdate() bool {
	return a.selectedBoard.IsR0Build()
}

// Orchestrator URL management
func (a *App) GetOrchestratorURL() (string, error) {
	return a.selectedBoard.GetOrchestratorURL()
}

// WiFi management
func (a *App) ConnectToWiFi(ssid, password string) error {
	return wifi.Connect(a.ctx(), a.selectedBoard.Conn, ssid, password)
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

func (a *App) SelectBoard(id string, password string) error {
	return a.selectBoard(id, password)
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

func (a *App) RemoveFile(path string) error {
	return fs.RemoveFile(a.selectedBoard.Conn, path)
}

func (a *App) CreateFolder(path string) error {
	return fs.CreateFolder(a.selectedBoard.Conn, path)
}

// Apps UI management
func (a *App) OpenUIWhenReady(port int) error {
	return appui.OpenUIWhenReady(a.ctx(), a.selectedBoard, port)
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
