package arduinoapps

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"app-lab-desktop/internal/hostread"
)

// Importing an app reads a host path and uploads it, so it needs the same intent
// check as a direct host read. The denial happens before anything is opened,
// which is why these cases need no orchestrator.
func TestImportAppFromPathDeniesAPathNeverSelected(t *testing.T) {
	dir := t.TempDir()
	secret := filepath.Join(dir, "id_rsa")
	if err := os.WriteFile(secret, []byte("PRIVATE KEY"), 0o600); err != nil {
		t.Fatalf("failed to write %s: %v", secret, err)
	}

	appID, err := ImportAppFromPath(context.Background(), "http://localhost:0", secret, hostread.NewAllowSet())
	if err == nil {
		t.Fatal("expected a path that was never selected to be refused")
	}
	if appID != "" {
		t.Errorf("expected no app id on denial, got %q", appID)
	}
	if strings.Contains(err.Error(), "PRIVATE KEY") {
		t.Error("the denial must not leak the file content")
	}

	if _, statErr := os.Stat(secret); statErr != nil {
		t.Errorf("a refused import must leave the file alone: %v", statErr)
	}
}

func TestImportAppFromPathDeniesEverythingWithoutIntent(t *testing.T) {
	var noIntent *hostread.AllowSet

	if _, err := ImportAppFromPath(context.Background(), "http://localhost:0", "/tmp/app.zip", noIntent); err == nil {
		t.Error("expected a nil allow set to deny the import")
	}
}
