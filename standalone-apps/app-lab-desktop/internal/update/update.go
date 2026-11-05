package update

import (
	"app-lab-desktop/internal/board"
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"
	"sync/atomic"

	"github.com/arduino/go-updater/releaser"
	goUpdater "github.com/arduino/go-updater/updater"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	semver "go.bug.st/relaxed-semver"
)

// ErrUpdateInProgress is returned when CheckAndApplyUpdate is called while another call runs.
// The frontend matches its text (APP_UPDATE_IN_PROGRESS in updaterContextProvider.logic.ts).
var ErrUpdateInProgress = errors.New("an App Lab update is already in progress")

// ErrLeftoverOldApp is returned when go-updater refuses to run because a previous update left
// <name>.old.app next to the app.
var ErrLeftoverOldApp = errors.New("a previous App Lab update left a backup copy")

// goUpdaterLeftoverPrefix starts the error go-updater v0.3.0 returns for a leftover <name>.old.app
// (updater/apply_darwin.go).
const goUpdaterLeftoverPrefix = "temp app already exists: "

type Updater struct {
	releaser *releaser.Client
	version  string
	running  atomic.Bool

	// Seams for tests: the real CheckForUpdates downloads a release and, on success, exits the process.
	checkForUpdates func(targetPath string, current releaser.Version, client *releaser.Client, cb goUpdater.UpgradeConfirmCB) error
	executable      func() (string, error)
}

func NewUpdater(version, userAgent, updateURL string) (*Updater, error) {

	if updateURL == "" {
		updateURL = "https://downloads.arduino.cc"
	}
	parsedURL, err := url.Parse(updateURL)
	if err != nil {
		fmt.Println("Invalid ARDUINO_APP_LAB_UPDATE_URL:", err)
		return nil, fmt.Errorf("invalid ARDUINO_APP_LAB_UPDATE_URL: %w", err)
	}

	headers := map[string]string{}
	headers["User-Agent"] = userAgent

	s3Path := "AppLab/Stable"

	if os.Getenv("ARDUINO_APP_LAB_UPDATE_S3_PATH") != "" {
		s3Path = os.Getenv("ARDUINO_APP_LAB_UPDATE_S3_PATH")
	}

	client := releaser.NewClient(
		parsedURL,
		s3Path,
		releaser.WithHeaders(headers),
	)

	return &Updater{
		releaser:        client,
		version:         version,
		checkForUpdates: goUpdater.CheckForUpdates,
		executable:      os.Executable,
	}, nil
}

func (u *Updater) NewVersion(ctx context.Context) (string, error) {
	runtime.LogInfof(ctx, "Checking new version with user agent '%v'", u.releaser.Headers["User-Agent"])
	if u.releaser == nil {
		return "", fmt.Errorf("updater client is not initialized")
	}

	env := runtime.Environment(ctx)

	plat := releaser.NewPlatform(env.Platform, env.Arch)
	runtime.LogInfof(ctx, "Checking updates for platform '%s'", plat.String())

	nextVersionManifest, err := u.releaser.GetLatestVersion(plat)
	if err != nil {
		return "", err // no new version available
	}

	// here we check if a new version is actually available
	// but for SBC we dont proceed with the actual update
	isBoard := board.IsSBC()
	if isBoard {
		return "", nil
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

// explainLeftoverOldApp rewords go-updater's refusal on a leftover <name>.old.app, and returns nil for
// any other error. go-updater alone decides whether a leftover blocks the update: a check of its own
// here would keep refusing after a go-updater release that recovers from the leftover. If go-updater
// words the error differently, the user sees go-updater's text.
func explainLeftoverOldApp(err error) error {
	oldAppPath, found := strings.CutPrefix(err.Error(), goUpdaterLeftoverPrefix)
	if !found {
		return nil
	}
	oldAppPath = strings.TrimSuffix(oldAppPath, ", cannot update")
	return fmt.Errorf("%w at %s, so the update cannot run", ErrLeftoverOldApp, oldAppPath)
}

func (u *Updater) CheckAndApplyUpdate(ctx context.Context, showConfirmDialog bool) error {
	if !u.running.CompareAndSwap(false, true) {
		return ErrUpdateInProgress
	}
	defer u.running.Store(false)

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

	executablePath, err := u.executable()
	if err != nil {
		return fmt.Errorf("could not get executable path: %w", err)
	}

	var updateConfirmCallback func(current releaser.Version, target releaser.Version) bool
	if showConfirmDialog {
		updateConfirmCallback = confirmDialog
	}

	err = u.checkForUpdates(executablePath, releaser.Version(u.version), u.releaser, updateConfirmCallback)
	if err != nil {
		if leftover := explainLeftoverOldApp(err); leftover != nil {
			return leftover
		}
		return fmt.Errorf("error checking for updates: %w", err)
	}

	err = rejectionDialog()
	if err != nil {
		return fmt.Errorf("error showing rejection dialog: %w", err)
	}
	return nil
}
