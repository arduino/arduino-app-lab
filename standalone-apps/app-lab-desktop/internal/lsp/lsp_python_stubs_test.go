package lsp

import (
	"archive/zip"
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// wheelBytes builds an app-bricks wheel holding the named entries, so the extraction
// can be exercised without reaching the real release.
func wheelBytes(t *testing.T, names ...string) []byte {
	t.Helper()

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, name := range names {
		header := &zip.FileHeader{Name: name, Method: zip.Deflate}
		header.SetMode(0o644)
		w, err := zw.CreateHeader(header)
		if err != nil {
			t.Fatalf("create zip entry %s: %v", name, err)
		}
		if _, err := w.Write([]byte("x = 1\n")); err != nil {
			t.Fatalf("write zip entry %s: %v", name, err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("close zip: %v", err)
	}
	return buf.Bytes()
}

// serveWheel points the downloader at a local server for the duration of the test.
func serveWheel(t *testing.T, handler http.HandlerFunc) {
	t.Helper()

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	previous := wheelURLFor
	wheelURLFor = func(version string) string { return server.URL + "/" + version + ".whl" }
	t.Cleanup(func() { wheelURLFor = previous })
}

func TestPublishStubsForVersionExtractsAndMarksComplete(t *testing.T) {
	wheel := wheelBytes(t,
		"arduino/app_bricks/__init__.py",
		"arduino/app_bricks/py.typed",
		// Wheel metadata is not a stub and must not be extracted.
		"arduino_app_bricks-1.0.0.dist-info/METADATA",
	)
	serveWheel(t, func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write(wheel) })

	root := t.TempDir()
	versionDir := filepath.Join(root, "1.0.0")
	if err := publishStubsForVersion(context.Background(), root, versionDir, "1.0.0"); err != nil {
		t.Fatalf("publishStubsForVersion() = %v, want nil", err)
	}

	if !stubsAreReady(versionDir) {
		t.Fatal("version dir is not marked ready")
	}
	if _, err := os.Stat(filepath.Join(versionDir, "arduino", "app_bricks", "__init__.py")); err != nil {
		t.Fatalf("stub file missing: %v", err)
	}
	if _, err := os.Stat(filepath.Join(versionDir, "arduino_app_bricks-1.0.0.dist-info")); err == nil {
		t.Fatal("wheel metadata was extracted, want it filtered out")
	}

	// The staging directory has to be gone, or newestReadyStubsDir has to keep
	// skipping candidates forever.
	entries, err := os.ReadDir(root)
	if err != nil {
		t.Fatalf("read %s: %v", root, err)
	}
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), stubsStagingPrefix) {
			t.Fatalf("%s survived a successful publish", entry.Name())
		}
	}
}

// The reported bug: the old code deleted the stubs directory before fetching the
// wheel, so a network failure left basedpyright with an empty extraPaths and no way
// back until the next server start.
func TestFailedDownloadLeavesEarlierStubsUsable(t *testing.T) {
	serveWheel(t, func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNotFound) })

	root := t.TempDir()
	earlier := writeReadyStubs(t, root, "1.0.0")

	versionDir := filepath.Join(root, "2.0.0")
	if err := publishStubsForVersion(context.Background(), root, versionDir, "2.0.0"); err == nil {
		t.Fatal("publishStubsForVersion() = nil, want an error when the download fails")
	}

	// The new version must not look provisioned...
	if stubsAreReady(versionDir) {
		t.Fatal("2.0.0 is marked ready after a failed download")
	}
	// ...and the version that was working must still be there and still chosen.
	if _, err := os.Stat(filepath.Join(earlier, "arduino", "app_bricks", "__init__.py")); err != nil {
		t.Fatalf("earlier stubs were destroyed by a failed publish: %v", err)
	}
	if got := newestReadyStubsDir(root); got != earlier {
		t.Fatalf("newestReadyStubsDir() = %q, want the earlier stubs %q", got, earlier)
	}
}

// A crash mid-extraction leaves a directory with the right name and no marker.
// Publishing again has to replace it rather than merge into it.
func TestPublishReplacesAnIncompleteDirForTheSameVersion(t *testing.T) {
	wheel := wheelBytes(t, "arduino/app_bricks/__init__.py")
	serveWheel(t, func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write(wheel) })

	root := t.TempDir()
	versionDir := filepath.Join(root, "1.0.0")
	stale := filepath.Join(versionDir, "arduino", "leftover.py")
	if err := os.MkdirAll(filepath.Dir(stale), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(stale, []byte("stale\n"), 0o644); err != nil {
		t.Fatalf("write %s: %v", stale, err)
	}

	if err := publishStubsForVersion(context.Background(), root, versionDir, "1.0.0"); err != nil {
		t.Fatalf("publishStubsForVersion() = %v, want nil", err)
	}
	if !stubsAreReady(versionDir) {
		t.Fatal("version dir is not marked ready")
	}
	if _, err := os.Stat(stale); err == nil {
		t.Fatal("the incomplete directory's contents survived, want them replaced")
	}
}
