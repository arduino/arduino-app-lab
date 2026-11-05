package update

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	goruntime "runtime"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/arduino/go-updater/releaser"
	goUpdater "github.com/arduino/go-updater/updater"
)

// The fakes always return an error: on success CheckAndApplyUpdate opens a Wails dialog,
// and the Wails runtime calls log.Fatalf when the context carries no frontend.
var errFake = errors.New("fake go-updater result")

func newTestUpdater(executablePath string, check func() error) *Updater {
	return &Updater{
		version: "0.10.0",
		checkForUpdates: func(string, releaser.Version, *releaser.Client, goUpdater.UpgradeConfirmCB) error {
			return check()
		},
		executable: func() (string, error) { return executablePath, nil },
	}
}

func TestCheckAndApplyUpdateRejectsConcurrentCalls(t *testing.T) {
	var calls atomic.Int32
	entered := make(chan struct{})
	release := make(chan struct{})

	u := newTestUpdater(filepath.Join(t.TempDir(), "App.app", "Contents", "MacOS", "app"), func() error {
		if calls.Add(1) == 1 {
			close(entered)
			<-release
		}
		return errFake
	})

	first := make(chan error, 1)
	go func() { first <- u.CheckAndApplyUpdate(context.Background(), false) }()
	<-entered

	if err := u.CheckAndApplyUpdate(context.Background(), false); !errors.Is(err, ErrUpdateInProgress) {
		t.Fatalf("second call: got %v, want ErrUpdateInProgress", err)
	}
	if got := calls.Load(); got != 1 {
		t.Fatalf("go-updater called %d times while the first call ran, want 1", got)
	}

	close(release)
	if err := <-first; !errors.Is(err, errFake) {
		t.Fatalf("first call: got %v, want the fake's error", err)
	}

	if err := u.CheckAndApplyUpdate(context.Background(), false); !errors.Is(err, errFake) {
		t.Fatalf("call after the first finished: got %v, want the fake's error", err)
	}
	if got := calls.Load(); got != 2 {
		t.Fatalf("go-updater called %d times in total, want 2", got)
	}
}

func TestCheckAndApplyUpdateExplainsGoUpdaterLeftoverRefusal(t *testing.T) {
	apps := t.TempDir()
	executablePath := filepath.Join(apps, "Arduino App Lab.app", "Contents", "MacOS", "app-lab")
	oldAppPath := filepath.Join(apps, "Arduino App Lab.app.old.app")

	var calls atomic.Int32
	refuse := true
	u := newTestUpdater(executablePath, func() error {
		calls.Add(1)
		if refuse {
			// The error go-updater v0.3.0 returns in updater/apply_darwin.go.
			return fmt.Errorf("temp app already exists: %s, cannot update", oldAppPath)
		}
		return errFake
	})

	err := u.CheckAndApplyUpdate(context.Background(), false)
	if !errors.Is(err, ErrLeftoverOldApp) {
		t.Fatalf("got %v, want ErrLeftoverOldApp", err)
	}
	// The backup may be the only intact copy of App Lab, so the message must not ask the user to delete it.
	want := "a previous App Lab update left a backup copy at " + oldAppPath + ", so the update cannot run"
	if err.Error() != want {
		t.Fatalf("got message %q, want %q", err, want)
	}
	if got := calls.Load(); got != 1 {
		t.Fatalf("go-updater called %d times, want 1", got)
	}

	refuse = false
	if err := u.CheckAndApplyUpdate(context.Background(), false); !errors.Is(err, errFake) {
		t.Fatalf("after go-updater stops refusing: got %v, want the fake's error", err)
	}
}

func TestCheckAndApplyUpdateLeavesTheLeftoverDecisionToGoUpdater(t *testing.T) {
	apps := t.TempDir()
	executablePath := filepath.Join(apps, "Arduino App Lab.app", "Contents", "MacOS", "app-lab")
	if err := os.MkdirAll(filepath.Join(apps, "Arduino App Lab.app.old.app"), 0o755); err != nil {
		t.Fatal(err)
	}

	// A go-updater that recovers from the leftover instead of refusing.
	var calls atomic.Int32
	u := newTestUpdater(executablePath, func() error {
		calls.Add(1)
		return errFake
	})

	if err := u.CheckAndApplyUpdate(context.Background(), false); !errors.Is(err, errFake) {
		t.Fatalf("got %v, want the fake's error", err)
	}
	if got := calls.Load(); got != 1 {
		t.Fatalf("go-updater called %d times, want 1", got)
	}
}

// Fails when a go-updater bump changes or removes its leftover refusal. explainLeftoverOldApp then
// no longer applies: update its prefix, or remove it with the refusal.
func TestGoUpdaterLeftoverRefusalIsExplained(t *testing.T) {
	if goruntime.GOOS != "darwin" {
		t.Skip("go-updater refuses a leftover <name>.old.app only on darwin")
	}
	apps := t.TempDir()
	executablePath := filepath.Join(apps, "Arduino App Lab.app", "Contents", "MacOS", "app-lab")
	oldAppPath := filepath.Join(apps, "Arduino App Lab.app.old.app")
	if err := os.MkdirAll(oldAppPath, 0o755); err != nil {
		t.Fatal(err)
	}
	// Nothing listens on port 1, so a go-updater that does not refuse fails at the manifest fetch.
	unreachable, err := url.Parse("http://127.0.0.1:1")
	if err != nil {
		t.Fatal(err)
	}
	client := releaser.NewClient(unreachable, "AppLab/Stable")

	err = goUpdater.CheckForUpdates(executablePath, "0.10.0", client, nil)
	if err == nil {
		t.Fatal("go-updater returned no error with a leftover present")
	}
	explained := explainLeftoverOldApp(err)
	if explained == nil {
		t.Fatalf("go-updater's error %q is not recognised as a leftover refusal", err)
	}
	if !strings.Contains(explained.Error(), oldAppPath) {
		t.Fatalf("got %q, want the path %s in it", explained, oldAppPath)
	}
}
