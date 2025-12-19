package main

import (
	"app-lab-desktop/internal/app"
	"app-lab-desktop/internal/learn"
	"embed"
	"fmt"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

var (
	//go:embed all:frontend/dist
	assets  embed.FS
	version = "0.0.0-dev"
)

func main() {
	learnSvc := learn.New()
	app := app.New(version, learnSvc)

	err := wails.Run(&options.App{
		Title:  app.GetTitle(),
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets:     assets,
			Middleware: app.GetAssetMiddleware(),
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.Startup,
		OnShutdown:       app.Shutdown,
		Bind:             []any{app},
		ErrorFormatter:   app.GetErrorFormatter(),
		Debug: options.Debug{
			OpenInspectorOnStartup: true,
		},
		Linux: &linux.Options{
			WebviewGpuPolicy: linux.WebviewGpuPolicyAlways,
		},
		WindowStartState: options.Maximised,
		Mac: &mac.Options{
			About: &mac.AboutInfo{
				Title:   "Arduino App Lab",
				Message: app.GetAboutMessage(),
			},
			Appearance: mac.NSAppearanceNameDarkAqua,
		},
	})

	if err != nil {
		panic(fmt.Errorf("failed to run application: %w", err))
	}
}

func printHelp(cmd string) {
	fmt.Printf("Usage: %s [command]\n", cmd)
	fmt.Println("Commands:")
	fmt.Println("  version   Show the application version")
	fmt.Println("  help      Show this help message")
}
