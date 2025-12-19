package update

import (
	"app-lab-desktop/internal/board"
	"context"
	"fmt"
	"net/url"
	"os"

	"github.com/arduino/go-updater/releaser"
	goUpdater "github.com/arduino/go-updater/updater"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	semver "go.bug.st/relaxed-semver"
)

type Updater struct {
	releaser *releaser.Client
	version  string
}

func NewUpdater(version, updateURL string) (*Updater, error) {
	if updateURL == "" {
		updateURL = "https://downloads.arduino.cc/"
	}
	parsedURL, err := url.Parse(updateURL)
	if err != nil {
		fmt.Println("Invalid UPDATE_URL:", err)
		return nil, fmt.Errorf("invalid UPDATE_URL: %w", err)
	}

	headers := map[string]string{}

	if os.Getenv("BASIC_AUTH_TOKEN") != "" {
		headers["Authorization"] = "Basic " + os.Getenv("BASIC_AUTH_TOKEN")
	}

	s3Path := "AppLab/Stable"

	if os.Getenv("UPDATE_S3_PATH") != "" {
		s3Path = os.Getenv("UPDATE_S3_PATH")
	}

	client := releaser.NewClient(
		parsedURL,
		s3Path,
		releaser.WithHeaders(headers),
	)

	return &Updater{
		releaser: client,
		version:  version,
	}, nil
}

func (u *Updater) NewVersion(ctx context.Context) (string, error) {
	isBoard := board.IsSBC()
	if isBoard {
		return "", nil
	}

	if u.releaser == nil {
		return "", fmt.Errorf("updater client is not initialized")
	}

	env := runtime.Environment(ctx)

	plat := releaser.NewPlatform(env.Platform, env.Arch)

	nextVersionManifest, err := u.releaser.GetLatestVersion(plat)
	if err != nil {
		return "", err // no new version available
	}
	nextSemVer, err := semver.Parse(nextVersionManifest.Version.String())
	if err != nil {
		fmt.Println("error parsing next version:", err)
		return "", nil // no new version available, malformed version
	}

	// here the next version exists and is valid
	currentSemVersion, err := semver.Parse(u.version)
	if err != nil {
		currentSemVersion = semver.MustParse("0")
	}

	if nextSemVer.GreaterThan(currentSemVersion) {
		return nextSemVer.String(), nil
	}

	return "", nil
}

func (u *Updater) CheckAndApplyUpdate(ctx context.Context, showConfirmDialog bool) error {
	// Private function for showing a confirmation dialog before upgrading
	confirmDialog := func(current releaser.Version, target releaser.Version) bool {
		result, err := runtime.MessageDialog(ctx, runtime.MessageDialogOptions{
			Type:          runtime.QuestionDialog,
			Title:         "Update available",
			Message:       "Do you want to upgrade from " + current.String() + " to " + target.String() + "?",
			Buttons:       []string{"Yes", "No", "Cancel"},
			DefaultButton: "Yes",
		})

		if err != nil {
			fmt.Println("Error showing dialog:", err)
			return false
		}

		if result == "Yes" {
			fmt.Println("User confirmed the action.")
			return true
		}

		return false
	}

	// Private function for showing a rejection dialog when the user does not want to update
	rejectionDialog := func() error {
		_, err := runtime.MessageDialog(ctx, runtime.MessageDialogOptions{
			Type:  runtime.InfoDialog,
			Title: "App not updated",
		})
		if err != nil {
			return fmt.Errorf("error showing info dialog: %w", err)
		}
		return nil
	}

	executablePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("could not get executable path: %w", err)
	}

	var updateConfirmCallback func(current releaser.Version, target releaser.Version) bool
	if showConfirmDialog {
		updateConfirmCallback = confirmDialog
	}

	err = goUpdater.CheckForUpdates(executablePath, releaser.Version(u.version), u.releaser, updateConfirmCallback)
	if err != nil {
		return fmt.Errorf("error checking for updates: %w", err)
	}

	err = rejectionDialog()
	if err != nil {
		return fmt.Errorf("error showing rejection dialog: %w", err)
	}
	return nil
}
