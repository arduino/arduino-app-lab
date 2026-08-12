package lsp

import (
	"os"
	"path/filepath"
	"testing"
)

// The pyright config lives outside the app directory, which makes that outside
// directory pyright's project root — and therefore the root it resolves
// absolute imports against. Only executionEnvironments points it back at the
// app's Python sources, so pin that the config keeps saying so.
//
// The root has to be <app>/python, matching sys.path[0] when the board runs
// <app>/python/main.py. At <app> the imports still resolve, but only via
// basedpyright's implicit-relative fallback, which flags every sibling import
// as reportImplicitRelativeImport; at the config's own directory they do not
// resolve at all and go-to-definition dies.
func TestBuildPyrightConfigRootsExecutionEnvAtPythonDir(t *testing.T) {
	const workspaceDir = "/tmp/arduino_applab_workspace/app"
	const stubsDir = "/data/arduino_applab_workspace/python-stubs"
	const venvBase = "/data/arduino_applab_workspace/python-venv"

	config := buildPyrightConfig(workspaceDir, stubsDir, venvBase)

	envs, ok := config["executionEnvironments"].([]map[string]any)
	if !ok {
		t.Fatalf("executionEnvironments = %#v, want []map[string]any", config["executionEnvironments"])
	}
	if len(envs) != 1 {
		t.Fatalf("got %d execution environments, want 1", len(envs))
	}
	want := filepath.Join(workspaceDir, "python")
	if root := envs[0]["root"]; root != want {
		t.Fatalf("execution environment root = %v, want %q", root, want)
	}

	// The environment inherits these, so the stubs must stay at the top level.
	extraPaths, ok := config["extraPaths"].([]string)
	if !ok || len(extraPaths) != 1 || extraPaths[0] != stubsDir {
		t.Fatalf("extraPaths = %#v, want [%q]", config["extraPaths"], stubsDir)
	}

	// Analysis still covers the whole app, not just python/ — an app can hold
	// .py files elsewhere and they should keep getting diagnostics.
	include, ok := config["include"].([]string)
	if !ok || len(include) != 1 || include[0] != workspaceDir {
		t.Fatalf("include = %#v, want [%q]", config["include"], workspaceDir)
	}
}

// basedpyright only skips its interpreter probe when venvPath AND venv are both
// set and the site-packages under them exists. Drop either and it spawns a bare
// `python3`, which on a Mac without the Xcode Command Line Tools is a system
// dialog rather than an interpreter.
func TestBuildPyrightConfigPinsStubVenv(t *testing.T) {
	const workspaceDir = "/tmp/arduino_applab_workspace/app"
	const stubsDir = "/data/arduino_applab_workspace/python-stubs"
	const venvBase = "/data/arduino_applab_workspace/python-venv"

	config := buildPyrightConfig(workspaceDir, stubsDir, venvBase)

	if got := config["venvPath"]; got != venvBase {
		t.Fatalf("venvPath = %v, want %q", got, venvBase)
	}
	if got := config["venv"]; got != pythonVenvName {
		t.Fatalf("venv = %v, want %q", got, pythonVenvName)
	}
}

// The layout is basedpyright's, not ours: it probes
// <venvPath>/<venv>/{lib,lib64,Lib}/site-packages and only that shape short-
// circuits the interpreter probe, so pin it against a silent rename.
func TestEnsurePythonVenvStubCreatesSitePackages(t *testing.T) {
	base := t.TempDir()

	ensurePythonVenvStub(base)

	sitePackages := filepath.Join(base, pythonVenvName, "lib", "site-packages")
	info, err := os.Stat(sitePackages)
	if err != nil {
		t.Fatalf("stat %s: %v", sitePackages, err)
	}
	if !info.IsDir() {
		t.Fatalf("%s is not a directory", sitePackages)
	}
}

// The board supplies this string and it now names a directory, so a separator or a
// parent reference would point extraPaths outside python-stubs entirely.
func TestValidateStubsVersionRejectsUnusableNames(t *testing.T) {
	for _, tc := range []struct {
		version string
		wantErr bool
	}{
		{version: "1.4.2"},
		{version: "2026.8.0-rc1"},
		{version: "", wantErr: true},
		{version: "   ", wantErr: true},
		{version: ".", wantErr: true},
		{version: "..", wantErr: true},
		{version: "../../evil", wantErr: true},
		// Dot-names are our own bookkeeping namespace: a version named like the
		// staging prefix or the ready marker would be invisible to pruning and
		// fallback, which skip them by design.
		{version: stubsStagingPrefix + "1.0.0", wantErr: true},
		{version: stubsReadyMarker, wantErr: true},
		{version: ".hidden", wantErr: true},
		{version: "a/b", wantErr: true},
		{version: `a\b`, wantErr: true},
	} {
		err := validateStubsVersion(tc.version)
		if tc.wantErr && err == nil {
			t.Errorf("validateStubsVersion(%q) = nil, want an error", tc.version)
		}
		if !tc.wantErr && err != nil {
			t.Errorf("validateStubsVersion(%q) = %v, want nil", tc.version, err)
		}
	}
}

// writeReadyStubs plants a complete version directory, the way publishStubsForVersion
// leaves one behind.
func writeReadyStubs(t *testing.T, root, version string) string {
	t.Helper()

	dir := filepath.Join(root, version)
	pkg := filepath.Join(dir, "arduino", "app_bricks")
	if err := os.MkdirAll(pkg, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", pkg, err)
	}
	if err := os.WriteFile(filepath.Join(pkg, "__init__.py"), []byte("x = 1\n"), 0o644); err != nil {
		t.Fatalf("write stub: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, stubsReadyMarker), []byte(version), 0o644); err != nil {
		t.Fatalf("write marker: %v", err)
	}
	return dir
}

// A directory without the marker is a half-finished extraction. Handing one to
// basedpyright is the failure that reached a tester as "app bricks stopped working",
// so it must never be chosen.
func TestNewestReadyStubsDirSkipsIncompleteAndStagingDirs(t *testing.T) {
	root := t.TempDir()

	// Incomplete: files but no marker.
	partial := filepath.Join(root, "9.9.9", "arduino")
	if err := os.MkdirAll(partial, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", partial, err)
	}
	// Mid-extraction, marker and all.
	staging := filepath.Join(root, stubsStagingPrefix+"9.9.9-tmp")
	if err := os.MkdirAll(staging, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", staging, err)
	}
	if err := os.WriteFile(filepath.Join(staging, stubsReadyMarker), []byte("9.9.9"), 0o644); err != nil {
		t.Fatalf("write marker: %v", err)
	}

	if got := newestReadyStubsDir(root); got != "" {
		t.Fatalf("newestReadyStubsDir() = %q, want \"\" with nothing complete", got)
	}

	want := writeReadyStubs(t, root, "1.0.0")
	if got := newestReadyStubsDir(root); got != want {
		t.Fatalf("newestReadyStubsDir() = %q, want %q", got, want)
	}
}

func TestPruneStubsDirsKeepsCompleteVersionsAndSweepsTheRest(t *testing.T) {
	root := t.TempDir()

	inUse := writeReadyStubs(t, root, "2.0.0")
	otherComplete := writeReadyStubs(t, root, "1.0.0")

	// The layout this replaced: package dirs and a .version file directly under root.
	legacyPkg := filepath.Join(root, "arduino", "app_bricks")
	if err := os.MkdirAll(legacyPkg, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", legacyPkg, err)
	}
	legacyVersion := filepath.Join(root, ".version")
	if err := os.WriteFile(legacyVersion, []byte("0.9.0"), 0o644); err != nil {
		t.Fatalf("write %s: %v", legacyVersion, err)
	}
	// A half-finished directory for a version nobody is using.
	incomplete := filepath.Join(root, "1.5.0")
	if err := os.MkdirAll(incomplete, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", incomplete, err)
	}

	pruneStubsDirs(root, "2.0.0")

	for _, keep := range []string{inUse, otherComplete} {
		if _, err := os.Stat(filepath.Join(keep, stubsReadyMarker)); err != nil {
			// Other complete versions stay: a second app instance on different board
			// firmware may have one on its extraPaths right now.
			t.Fatalf("%s was pruned, want it kept: %v", keep, err)
		}
	}
	for _, gone := range []string{filepath.Join(root, "arduino"), legacyVersion, incomplete} {
		if _, err := os.Stat(gone); err == nil {
			t.Fatalf("%s survived pruning, want it swept", gone)
		}
	}
}

// An empty extraPath is not the same as no extraPath: pyright resolves a relative one
// against the project root, so passing "" would add the root to the search path.
func TestBuildPyrightConfigOmitsExtraPathsWithoutStubs(t *testing.T) {
	config := buildPyrightConfig(t.TempDir(), "", t.TempDir())
	if _, ok := config["extraPaths"]; ok {
		t.Fatalf("extraPaths = %v, want the key absent when there are no stubs", config["extraPaths"])
	}

	stubs := t.TempDir()
	config = buildPyrightConfig(t.TempDir(), stubs, t.TempDir())
	got, ok := config["extraPaths"].([]string)
	if !ok || len(got) != 1 || got[0] != stubs {
		t.Fatalf("extraPaths = %v, want [%q]", config["extraPaths"], stubs)
	}
}
