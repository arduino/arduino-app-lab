package app

import (
	"app-lab-desktop/internal/board"
	"app-lab-desktop/internal/context"
	"app-lab-desktop/internal/emoji"
	"app-lab-desktop/internal/errors"
	"app-lab-desktop/internal/fs"
	"app-lab-desktop/internal/learn"
	"app-lab-desktop/internal/update"
	"fmt"

	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

type App struct {
	ctxHolder      *context.Holder
	version        string
	updater        *update.Updater
	learnSvc       *learn.Learn
	detectedBoards []*board.Board
	selectedBoard  *board.Board
}

func New(version string, learnSvc *learn.Learn) *App {
	return &App{
		ctxHolder:     context.NewHolder(),
		version:       version,
		learnSvc:      learnSvc,
		selectedBoard: board.Noop(),
	}
}

func (a *App) GetTitle() string {
	return "Arduino App Lab - " + a.GetCurrentVersion()
}

func (a *App) GetAboutMessage() string {
	return fmt.Sprintf(
		`Version: %s

		Copyright © 2025 Arduino SA
		www.arduino.cc
		`,
		a.version,
	)
}

func (a *App) GetAssetMiddleware() assetserver.Middleware {
	return assetserver.ChainMiddleware(
		fs.FileContentAssetMiddleware(a.ctxHolder, a.selectedBoard),
		learn.AssetMiddleware(a.ctxHolder, a.learnSvc),
		emoji.AssetMiddleware(a.ctxHolder),
	)
}

func (a *App) GetErrorFormatter() options.ErrorFormatter {
	return errors.ChainErrorMiddleware([]errors.ErrorMiddleware{
		errors.TunnelSSHAuthFailedMiddleware(),
	})
}
