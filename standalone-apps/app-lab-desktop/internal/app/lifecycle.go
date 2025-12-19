package app

import (
	"app-lab-desktop/internal/board"
	"app-lab-desktop/internal/update"
	"context"
	"fmt"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) Startup(ctx context.Context) {
	a.ctxHolder.Set(ctx)

	if err := board.InstallToolingIfMissing(ctx); err != nil {
		runtime.LogErrorf(ctx, "failed to initialize board: %v", err)
		// TODO: Display error to user?
	}

	// TODO: this should be either a build or runtime flag
	if board.IsSBC() {
		b, err := board.GetSbcBoard(ctx)
		if err != nil {
			runtime.LogErrorf(ctx, "failed to get SBC board: %v", err)
			return
		}
		a.selectedBoard = b
	} else {
		u, err := update.NewUpdater(a.version, os.Getenv("UPDATE_URL"))
		if err != nil {
			runtime.LogErrorf(ctx, "failed to initialize updater: %v", err)
		} else {
			a.updater = u
		}
	}
}

func (a *App) Shutdown(ctx context.Context) {
	a.selectedBoard.CloseTunnels(ctx)
}

func (a *App) ctx() context.Context {
	return a.ctxHolder.Get()
}

func (a *App) detectBoards() ([]*board.Board, error) {
	boards, err := board.GetBoards(a.ctx())
	if err != nil {
		return nil, fmt.Errorf("failed to detect boards: %w", err)
	}
	a.detectedBoards = boards
	return boards, nil
}

func (a *App) selectBoard(id string, password string) error {
	for _, b := range a.detectedBoards {
		if b.Id == id {
			if err := b.EstablishConnection(a.ctx(), password); err != nil {
				return fmt.Errorf("failed to select board: %w", err)
			}
			// Important: this is safe because selectedBoard is initialized to a Noop board and changed once,
			// if one day we need to change it multiple times we need to gracefully close the previous board live fields
			// (e.g. Conn, tunnels)
			*a.selectedBoard = *b
			return nil
		}
	}
	return fmt.Errorf("failed to select board: board with id %s not found", id)
}
