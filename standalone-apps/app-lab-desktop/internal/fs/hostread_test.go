package fs

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"app-lab-desktop/internal/hostread"
	"app-lab-desktop/internal/lsp"
)

func writeHostFile(t *testing.T, dir string, name string, content string) string {
	t.Helper()

	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("failed to write %s: %v", path, err)
	}
	return path
}

func TestGetLocalFileContentServesAnOpenedFile(t *testing.T) {
	path := writeHostFile(t, t.TempDir(), "notes.md", "# notes")

	hostReads := hostread.NewAllowSet()
	hostReads.Allow(path)

	content, err := getLocalFileContent(lsp.FileScheme+path, hostReads)
	if err != nil {
		t.Fatalf("getLocalFileContent() failed for an allowed path: %v", err)
	}
	if content != "# notes" {
		t.Errorf("getLocalFileContent() = %q, want %q", content, "# notes")
	}
}

func TestGetLocalFileContentDeniesAFileNeverOpened(t *testing.T) {
	dir := t.TempDir()
	opened := writeHostFile(t, dir, "notes.md", "# notes")
	secret := writeHostFile(t, dir, "id_rsa", "PRIVATE KEY")

	hostReads := hostread.NewAllowSet()
	hostReads.Allow(opened)

	content, err := getLocalFileContent(lsp.FileScheme+secret, hostReads)
	if err == nil {
		t.Fatal("expected a file that was never opened to be denied")
	}
	if content != "" {
		t.Errorf("expected no content on denial, got %q", content)
	}
	if strings.Contains(err.Error(), "PRIVATE KEY") {
		t.Error("the denial must not leak the file content")
	}
}

func TestGetLocalFileContentDeniesEverythingWithoutIntent(t *testing.T) {
	path := writeHostFile(t, t.TempDir(), "notes.md", "# notes")

	if _, err := getLocalFileContent(lsp.FileScheme+path, hostread.NewAllowSet()); err == nil {
		t.Error("expected an empty allow set to deny the read")
	}
}

// An import copies a host path onto the board, where it becomes readable by the
// ordinary board APIs - so it needs the same intent check as a direct read.
func TestCheckHostImport(t *testing.T) {
	dir := t.TempDir()
	picked := writeHostFile(t, dir, "sketch.py", "print()")
	secret := writeHostFile(t, dir, "id_rsa", "PRIVATE KEY")

	hostReads := hostread.NewAllowSet()
	hostReads.Allow(picked)

	if err := checkHostImport(picked, hostReads); err != nil {
		t.Errorf("expected a selected path to be importable, got %v", err)
	}
	if err := checkHostImport(secret, hostReads); err == nil {
		t.Error("expected a path that was never selected to be refused")
	}
	if err := checkHostImport(dir, hostReads); err == nil {
		t.Error("expected the containing folder to be refused when only a file was selected")
	}
}

// Files the LSP can already serve through GetLspWorkspaceFile stay readable, so
// gating host reads does not break navigation into headers and stubs.
func TestGetLocalFileContentAllowsLspWorkspaceRoots(t *testing.T) {
	workspace := lsp.GetLspTempWorkspaceAppDir()
	path := writeHostFile(t, workspace, "header_under_test.h", "#pragma once")
	t.Cleanup(func() { _ = os.Remove(path) })

	if !lsp.IsAllowedLspFilePath(path) {
		t.Fatalf("expected %s to be inside the LSP workspace roots", path)
	}

	content, err := getLocalFileContent(lsp.FileScheme+path, hostread.NewAllowSet())
	if err != nil {
		t.Fatalf("getLocalFileContent() failed for an LSP workspace file: %v", err)
	}
	if content != "#pragma once" {
		t.Errorf("getLocalFileContent() = %q, want %q", content, "#pragma once")
	}
}
