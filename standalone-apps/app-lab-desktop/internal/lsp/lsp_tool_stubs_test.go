package lsp

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	paths "github.com/arduino/go-paths-helper"
)

// writeStub renders one shadow to disk the way ensureCltStubDir does, and returns
// its path. The directory carries a space because the real one lives under
// ~/Library/Application Support.
func writeStub(t *testing.T, stub toolStub, logPath string) string {
	t.Helper()

	dir := filepath.Join(t.TempDir(), "clt shim")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", dir, err)
	}
	path := filepath.Join(dir, stub.name)
	if err := os.WriteFile(path, []byte(stubScript(stub, logPath)), 0o755); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
	return path
}

// logPathWithSpace mirrors the real log location, which sits under a directory with
// a space in it — unquoted, every redirection in the script would break.
func logPathWithSpace(t *testing.T) string {
	t.Helper()

	dir := filepath.Join(t.TempDir(), "Application Support", "logs")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", dir, err)
	}
	return filepath.Join(dir, toolStubLogName)
}

func TestEnsureCltStubDirShadowsEveryToolExecutably(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("the shadows are macOS-only")
	}

	dir := ensureCltStubDir(t.TempDir(), logPathWithSpace(t))
	if dir == "" {
		t.Fatal(`ensureCltStubDir() = "", want a directory on darwin`)
	}

	for _, stub := range cltStubs() {
		path := filepath.Join(dir, stub.name)
		info, err := os.Stat(path)
		if err != nil {
			t.Fatalf("stat %s: %v", path, err)
		}
		// A shadow that is not executable is skipped by the PATH lookup, which hands
		// the probe straight back to /usr/bin — the failure this whole file exists to
		// prevent, and one that looks like success from the Go side.
		if info.Mode().Perm()&0o111 == 0 {
			t.Fatalf("%s is not executable, mode = %v", stub.name, info.Mode().Perm())
		}
	}
}

// Non-zero exit is the branch clangd tolerates; success would have it treat the
// empty output as a real clang path and sysroot.
func TestXcrunStubRefusesAndSaysSo(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the shadows are /bin/sh scripts")
	}

	logPath := logPathWithSpace(t)
	stub := writeStub(t, toolStub{name: "xcrun"}, logPath)

	var stderr bytes.Buffer
	cmd := exec.Command(stub, "--show-sdk-path")
	cmd.Stderr = &stderr
	if err := cmd.Run(); err == nil {
		t.Fatal("xcrun stub exited 0, want non-zero")
	}

	// Both channels, because they cover different failures: the log file survives a
	// server that swallows its children's stderr, and stderr survives a log file we
	// cannot write.
	if !strings.Contains(stderr.String(), "xcrun stub refusing") {
		t.Fatalf("stderr = %q, want it to name the refusal", stderr.String())
	}
	logged, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatalf("read %s: %v", logPath, err)
	}
	if !strings.Contains(string(logged), "refusing") {
		t.Fatalf("log = %q, want a refusal line", logged)
	}
}

// The delegation path is what makes one shared shadow directory safe for every
// server: a consumer that genuinely needs the tool still gets it.
func TestInterpreterStubDelegatesToARealTool(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the shadows are /bin/sh scripts")
	}

	realDir := filepath.Join(t.TempDir(), "developer tools")
	if err := os.MkdirAll(realDir, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", realDir, err)
	}
	real := filepath.Join(realDir, "python3")
	if err := os.WriteFile(real, []byte("#!/bin/sh\nprintf 'real python3 got: %s\\n' \"$*\"\n"), 0o755); err != nil {
		t.Fatalf("write %s: %v", real, err)
	}

	logPath := logPathWithSpace(t)
	stub := writeStub(t, toolStub{name: "python3", searchPath: []string{realDir}}, logPath)

	out, err := exec.Command(stub, "--version", "-c", "print(1)").Output()
	if err != nil {
		t.Fatalf("stub did not delegate: %v", err)
	}
	// Arguments have to survive the hand-off, or a probe that delegates still gets a
	// wrong answer.
	if want := "real python3 got: --version -c print(1)\n"; string(out) != want {
		t.Fatalf("stdout = %q, want %q", out, want)
	}

	logged, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatalf("read %s: %v", logPath, err)
	}
	if !strings.Contains(string(logged), "delegating to "+real) {
		t.Fatalf("log = %q, want it to name the delegate", logged)
	}
}

func TestInterpreterStubRefusesWhenNothingRealExists(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the shadows are /bin/sh scripts")
	}

	logPath := logPathWithSpace(t)
	missing := filepath.Join(t.TempDir(), "no such developer dir")
	stub := writeStub(t, toolStub{name: "python3", searchPath: []string{missing}}, logPath)

	if err := exec.Command(stub).Run(); err == nil {
		t.Fatal("python3 stub exited 0 with nothing to delegate to, want non-zero")
	}
	logged, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatalf("read %s: %v", logPath, err)
	}
	if !strings.Contains(string(logged), "refusing") {
		t.Fatalf("log = %q, want a refusal line", logged)
	}
}

// /usr/bin is the shim, and executing it is the one thing the shadows exist to
// prevent — so it must never appear as a delegate, however the list is edited.
func TestDeveloperToolDirsExcludeUsrBin(t *testing.T) {
	for _, dir := range developerToolDirs {
		if dir == "/usr/bin" {
			t.Fatal("developerToolDirs contains /usr/bin, which is the shim that raises the dialog")
		}
	}
}

// The guarantee lives at the composition, not in either half: prependToPath returns
// only PATH, and paths.NewProcess merges it into os.Environ() — where PATH then
// appears twice and exec's last-wins deduplication decides which one the child
// gets. Both halves can pass their own tests while the child still sees /usr/bin
// first, which is exactly the dialog we are preventing.
func TestSpawnedChildSeesTheStubDirFirst(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("uses /bin/sh")
	}

	t.Setenv("PATH", "/usr/bin:/bin")
	t.Setenv("APPLAB_TEST_MARKER", "kept")

	const stubDir = "/stub/dir"
	process, err := paths.NewProcess(prependToPath(stubDir), "/bin/sh", "-c", `printf '%s\n%s' "$PATH" "$APPLAB_TEST_MARKER"`)
	if err != nil {
		t.Fatalf("NewProcess: %v", err)
	}
	var out bytes.Buffer
	process.RedirectStdoutTo(&out)
	if err := process.Run(); err != nil {
		t.Fatalf("run: %v", err)
	}

	gotPath, gotMarker, _ := strings.Cut(out.String(), "\n")
	if want := stubDir + string(os.PathListSeparator) + "/usr/bin:/bin"; gotPath != want {
		t.Fatalf("child PATH = %q, want %q", gotPath, want)
	}
	// The rest of the environment has to arrive too: the servers read TMPDIR to find
	// the workspace.
	if gotMarker != "kept" {
		t.Fatalf("child APPLAB_TEST_MARKER = %q, want it preserved", gotMarker)
	}
}
