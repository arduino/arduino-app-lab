package artifacts

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"testing/fstest"
	"time"
)

// makeTarGz builds a .tar.gz in memory from path -> contents.
func makeTarGz(t *testing.T, entries map[string]string) []byte {
	t.Helper()

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)

	for name, body := range entries {
		hdr := &tar.Header{
			Name: name,
			Mode: 0755,
			Size: int64(len(body)),
		}
		if err := tw.WriteHeader(hdr); err != nil {
			t.Fatalf("WriteHeader(%q): %v", name, err)
		}
		if _, err := tw.Write([]byte(body)); err != nil {
			t.Fatalf("Write(%q): %v", name, err)
		}
	}

	if err := tw.Close(); err != nil {
		t.Fatalf("tar Close: %v", err)
	}
	if err := gz.Close(); err != nil {
		t.Fatalf("gzip Close: %v", err)
	}
	return buf.Bytes()
}

// extractOne runs the real extraction path — including the assetPostProcessors
// dispatch, which is the part under test — for a single embedded archive.
func extractOne(t *testing.T, archivePath string, entries map[string]string) string {
	t.Helper()

	srcFS := fstest.MapFS{
		archivePath: &fstest.MapFile{Data: makeTarGz(t, entries)},
	}

	destRoot := t.TempDir()
	destPath := filepath.Join(destRoot, archivePath)

	if err := extractResourceFile(srcFS, archivePath, destPath); err != nil {
		t.Fatalf("extractResourceFile(%q): %v", archivePath, err)
	}
	return filepath.Dir(destPath)
}

func assertFileWithBody(t *testing.T, dir, name, want string) {
	t.Helper()

	got, err := os.ReadFile(filepath.Join(dir, name))
	if err != nil {
		t.Fatalf("expected %s in %s: %v", name, dir, err)
	}
	if string(got) != want {
		t.Errorf("%s: got %q, want %q", name, got, want)
	}
}

// arduino-cli is GPL-3.0, so the LICENSE.txt upstream ships inside the release
// archive has to survive extraction and sit next to the binary. An earlier
// postProcessArduino deleted it; this pins that it stays deleted-from.
func TestExtractKeepsArduinoCLILicense(t *testing.T) {
	dir := extractOne(t, "arduino/arduino-cli/arduino-cli_1.5.2_macOS_ARM64.tar.gz", map[string]string{
		"arduino-cli": "#!/bin/sh\n",
		"LICENSE.txt": "GNU GENERAL PUBLIC LICENSE Version 3\n",
	})

	assertFileWithBody(t, dir, "LICENSE.txt", "GNU GENERAL PUBLIC LICENSE Version 3\n")
	assertFileWithBody(t, dir, "arduino-cli", "#!/bin/sh\n")
}

// arduino-language-server is AGPL-3.0 and, from 0.8.0, nests both the binary
// and its LICENSE.txt inside a per-platform directory. Flattening has to bring
// the licence up with the binary rather than leave it behind.
func TestExtractKeepsArduinoLanguageServerLicenseWhenNested(t *testing.T) {
	dir := extractOne(t, "arduino/arduino-language-server/arduino-language-server_0.8.0_Linux_64bit.tar.gz", map[string]string{
		"arduino-language-server_linux_amd64/arduino-language-server": "#!/bin/sh\n",
		"arduino-language-server_linux_amd64/LICENSE.txt":             "GNU AFFERO GENERAL PUBLIC LICENSE\n",
	})

	assertFileWithBody(t, dir, "LICENSE.txt", "GNU AFFERO GENERAL PUBLIC LICENSE\n")
	assertFileWithBody(t, dir, "arduino-language-server", "#!/bin/sh\n")

	// The nested directory should be gone, not merely emptied.
	if _, err := os.Stat(filepath.Join(dir, "arduino-language-server_linux_amd64")); !os.IsNotExist(err) {
		t.Errorf("nested platform directory survived flattening (err=%v)", err)
	}
}

// The macOS archives stayed flat when the others gained a nested directory, so
// flattening must be a no-op there rather than an error.
func TestExtractKeepsArduinoLanguageServerLicenseWhenFlat(t *testing.T) {
	dir := extractOne(t, "arduino/arduino-language-server/arduino-language-server_0.8.0_macOS_ARM64.tar.gz", map[string]string{
		"arduino-language-server": "#!/bin/sh\n",
		"LICENSE.txt":             "GNU AFFERO GENERAL PUBLIC LICENSE\n",
	})

	assertFileWithBody(t, dir, "LICENSE.txt", "GNU AFFERO GENERAL PUBLIC LICENSE\n")
	assertFileWithBody(t, dir, "arduino-language-server", "#!/bin/sh\n")
}

// ---------------------------------------------------------------------------
// Surviving an interrupted extraction.
//
// The incident these pin: a pass interrupted partway through on a VENTUNO Q
// left node, clangd and arduino-cli truncated (node 16.8MB of 121.7MB), each
// beside a .version marker that had already been written. Every launch
// afterwards logged "LSP resources already verified, skipping extraction" and
// then failed to start a language server, because a truncated binary passes
// both of the checks resourcesExist makes.
// ---------------------------------------------------------------------------

// truncatedTarGz is an archive that cannot be extracted — what an interrupted
// download or a damaged bundle produces.
func truncatedTarGz(t *testing.T, entries map[string]string) []byte {
	t.Helper()

	full := makeTarGz(t, entries)
	if len(full) < 8 {
		t.Fatalf("archive too small to truncate: %d bytes", len(full))
	}
	return full[:len(full)/2]
}

// seedRequiredAssets creates every path resourcesExist insists on, so a test can
// reach the checks that come after it.
func seedRequiredAssets(t *testing.T, resourcesDir string) {
	t.Helper()

	for _, asset := range requiredAssets {
		p := filepath.Join(resourcesDir, asset.path)
		if asset.isDir {
			if err := os.MkdirAll(p, 0755); err != nil {
				t.Fatalf("seed %s: %v", asset.path, err)
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
			t.Fatalf("seed %s: %v", asset.path, err)
		}
		if err := os.WriteFile(p, []byte("binary\n"), 0755); err != nil {
			t.Fatalf("seed %s: %v", asset.path, err)
		}
	}
}

// A pass that cannot finish must not leave the marker that would make the next
// launch trust what it produced.
func TestExtractResourcesWritesNoVersionMarkerWhenAnArchiveFails(t *testing.T) {
	srcFS := fstest.MapFS{
		"node/node-bundle.tar.gz": &fstest.MapFile{Data: truncatedTarGz(t, map[string]string{
			"node": "the real node binary\n",
		})},
		"node/node.version": &fstest.MapFile{Data: []byte("v24.18.0\n")},
	}

	resourcesDir := t.TempDir()
	if err := extractResources(srcFS, resourcesDir); err == nil {
		t.Fatal("extractResources succeeded on a damaged archive")
	}

	if _, err := os.Stat(filepath.Join(resourcesDir, "node", "node.version")); !os.IsNotExist(err) {
		t.Errorf("version marker written despite the failed extraction (err=%v)", err)
	}
}

// The binary already in place has to survive a failed replacement: unpacking
// over it is what turned a working install into a truncated one.
func TestExtractResourcesKeepsTheWorkingBinaryWhenAnArchiveFails(t *testing.T) {
	// Big enough that halving the archive lands inside the entry rather than
	// before it, which is what makes this fixture cut a file in half.
	body := strings.Repeat("node binary payload\n", 60_000)
	damaged := truncatedTarGz(t, map[string]string{"node": body})

	// Unpacked where it lands, this archive really does leave a partial file
	// behind — the assertion below is only worth making because of that.
	inPlace := t.TempDir()
	archive := filepath.Join(inPlace, "node-bundle.tar.gz")
	if err := os.WriteFile(archive, damaged, 0644); err != nil {
		t.Fatal(err)
	}
	if err := extractArchive(archive, inPlace); err == nil {
		t.Fatal("the damaged archive extracted cleanly")
	}
	partial, err := os.ReadFile(filepath.Join(inPlace, "node"))
	if err != nil || len(partial) == 0 || len(partial) >= len(body) {
		t.Fatalf("fixture does not truncate a file in place: %d of %d bytes (err=%v)", len(partial), len(body), err)
	}

	srcFS := fstest.MapFS{
		"node/node-bundle.tar.gz": &fstest.MapFile{Data: damaged},
	}

	resourcesDir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(resourcesDir, "node"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(resourcesDir, "node", "node"), []byte("the previous node\n"), 0755); err != nil {
		t.Fatal(err)
	}

	if err := extractResources(srcFS, resourcesDir); err == nil {
		t.Fatal("extractResources succeeded on a damaged archive")
	}

	assertFileWithBody(t, filepath.Join(resourcesDir, "node"), "node", "the previous node\n")
}

// An archive still sitting in the resources directory means the pass that
// unpacked it never got to the line that deletes it, whatever the binaries and
// markers around it look like.
func TestResourcesExistRejectsLeftoverArchive(t *testing.T) {
	srcFS := fstest.MapFS{
		"node/node-bundle.tar.gz": &fstest.MapFile{Data: makeTarGz(t, map[string]string{"node": "x\n"})},
		"node/node.version":       &fstest.MapFile{Data: []byte("v24.18.0\n")},
	}

	resourcesDir := t.TempDir()
	seedRequiredAssets(t, resourcesDir)
	if err := os.WriteFile(filepath.Join(resourcesDir, "node", "node.version"), []byte("v24.18.0\n"), 0644); err != nil {
		t.Fatal(err)
	}

	if !resourcesExist(srcFS, resourcesDir) {
		t.Fatal("a complete extraction was reported as incomplete")
	}

	leftover := filepath.Join(resourcesDir, "node", "node-bundle.tar.gz")
	if err := os.WriteFile(leftover, []byte("archive\n"), 0644); err != nil {
		t.Fatal(err)
	}

	if resourcesExist(srcFS, resourcesDir) {
		t.Error("an interrupted extraction was reported as verified")
	}
}

// A staging directory is not treated the same way, and the difference matters:
// a dead peer's directory outlives it by stagingGracePeriod, and counting it as
// evidence would re-extract the whole bundle on every Start for those ten
// minutes. Clearing it belongs to the sweep.
//
// The relaxation is only safe because the checks around it already cover what a
// staging directory could indicate, so all three cases are pinned together here
// rather than the happy one alone.
func TestResourcesExistIgnoresLeftoverStagingDirButNotWhatItWouldImply(t *testing.T) {
	srcFS := fstest.MapFS{
		"node/node-bundle.tar.gz": &fstest.MapFile{Data: makeTarGz(t, map[string]string{"node": "x\n"})},
		"node/node.version":       &fstest.MapFile{Data: []byte("v24.18.0\n")},
	}

	// A pass that died leaving its scratch space behind, named for the process
	// that made it — so this must hold for any pid, not just ours.
	seed := func(t *testing.T) string {
		t.Helper()
		resourcesDir := t.TempDir()
		seedRequiredAssets(t, resourcesDir)
		if err := os.WriteFile(filepath.Join(resourcesDir, "node", "node.version"), []byte("v24.18.0\n"), 0644); err != nil {
			t.Fatal(err)
		}
		abandoned := stagingPrefixFor(filepath.Join(resourcesDir, "node", "node-bundle.tar.gz")) + "999999"
		if err := os.MkdirAll(filepath.Join(resourcesDir, "node", abandoned), 0755); err != nil {
			t.Fatal(err)
		}
		return resourcesDir
	}

	t.Run("consistent tree is still verified", func(t *testing.T) {
		if !resourcesExist(srcFS, seed(t)) {
			t.Error("a leftover staging directory alone forced a re-extraction")
		}
	})

	// What an interruption on a version bump leaves: the markers never reached
	// the disk, so they still name the version being replaced.
	t.Run("stale marker beside it is caught", func(t *testing.T) {
		resourcesDir := seed(t)
		if err := os.WriteFile(filepath.Join(resourcesDir, "node", "node.version"), []byte("v20.0.0\n"), 0644); err != nil {
			t.Fatal(err)
		}
		if resourcesExist(srcFS, resourcesDir) {
			t.Error("a stale version marker was accepted")
		}
	})

	// What an interruption partway through moveInto leaves: the entry was
	// cleared out of the way and its replacement never arrived.
	t.Run("missing asset beside it is caught", func(t *testing.T) {
		resourcesDir := seed(t)
		if err := os.Remove(filepath.Join(resourcesDir, "node", "node")); err != nil {
			t.Fatal(err)
		}
		if resourcesExist(srcFS, resourcesDir) {
			t.Error("a missing required asset was accepted")
		}
	})
}

// verifyExtractedSizes is a backstop rather than a response to a demonstrated
// path: a well-formed archive that unpacks short makes the extractor itself
// fail, which the tests above already cover. What it does catch is an entry that
// went missing without a complaint — an extractor that skips a path it dislikes,
// a filesystem that reports a short write as success — for the assets that have
// nothing runnable to probe: the language server binaries, ruff, the
// node_modules trees. Both halves are exercised directly, since a legitimate
// archive cannot be made to produce either.
func TestVerifyExtractedSizesRejectsAShortFile(t *testing.T) {
	dir := t.TempDir()
	archive := filepath.Join(dir, "node-bundle.tar.gz")
	if err := os.WriteFile(archive, makeTarGz(t, map[string]string{"node": strings.Repeat("x", 4096)}), 0644); err != nil {
		t.Fatal(err)
	}
	if err := extractArchive(archive, dir); err != nil {
		t.Fatal(err)
	}
	if err := verifyExtractedSizes(archive, dir); err != nil {
		t.Fatalf("a clean extraction was rejected: %v", err)
	}

	if err := os.WriteFile(filepath.Join(dir, "node"), []byte("short"), 0755); err != nil {
		t.Fatal(err)
	}

	err := verifyExtractedSizes(archive, dir)
	if err == nil {
		t.Fatal("a short file was accepted")
	}
	if !strings.Contains(err.Error(), "5 of 4096 bytes") {
		t.Errorf("error does not name the shortfall: %v", err)
	}
}

func TestVerifyExtractedSizesRejectsAMissingFile(t *testing.T) {
	dir := t.TempDir()
	archive := filepath.Join(dir, "pyright-bundle.tar.gz")
	if err := os.WriteFile(archive, makeTarGz(t, map[string]string{
		"node_modules/basedpyright/langserver.index.js": "server\n",
	}), 0644); err != nil {
		t.Fatal(err)
	}
	if err := extractArchive(archive, dir); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(filepath.Join(dir, "node_modules", "basedpyright", "langserver.index.js")); err != nil {
		t.Fatal(err)
	}

	err := verifyExtractedSizes(archive, dir)
	if err == nil {
		t.Fatal("a missing entry was accepted")
	}
	if !strings.Contains(err.Error(), "did not extract") {
		t.Errorf("error does not say what happened: %v", err)
	}
}

// Windows bundles are zips, so the size reader has to understand both shapes —
// and Windows is where an antivirus is most likely to be the thing damaging a
// freshly written binary.
func TestArchiveFileSizesReadsZipAndTarGz(t *testing.T) {
	dir := t.TempDir()

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, err := zw.Create("clangd.exe")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.Write([]byte(strings.Repeat("x", 300))); err != nil {
		t.Fatal(err)
	}
	if _, err := zw.Create("clang-resource/"); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}

	zipPath := filepath.Join(dir, "clangd-bundle.zip")
	if err := os.WriteFile(zipPath, buf.Bytes(), 0644); err != nil {
		t.Fatal(err)
	}

	sizes, err := archiveFileSizes(zipPath)
	if err != nil {
		t.Fatalf("archiveFileSizes(zip): %v", err)
	}
	if got := sizes["clangd.exe"]; got != 300 {
		t.Errorf("clangd.exe: got %d, want 300", got)
	}
	if _, ok := sizes["clang-resource"]; ok {
		t.Error("directory entry counted as a file")
	}

	tarPath := filepath.Join(dir, "clangd-bundle.tar.gz")
	if err := os.WriteFile(tarPath, makeTarGz(t, map[string]string{"./clangd": "abc"}), 0644); err != nil {
		t.Fatal(err)
	}
	sizes, err = archiveFileSizes(tarPath)
	if err != nil {
		t.Fatalf("archiveFileSizes(tar.gz): %v", err)
	}
	// "./clangd" and "clangd" have to agree, since that is how the path is
	// resolved against the directory it was extracted into.
	if got := sizes["clangd"]; got != 3 {
		t.Errorf("clangd: got %d, want 3 (keys: %v)", got, sizes)
	}
}

// Two App Lab processes can extract into the same directory at once — macOS runs
// without a single-instance lock so the updater can start the new app beside the
// old one. They must not share scratch space, or one will move the other's
// half-written files into place.
func TestStagingPathIsPerProcess(t *testing.T) {
	dest := filepath.Join(t.TempDir(), "node", "node-bundle.tar.gz")

	staging := filepath.Base(stagingPath(dest))
	if !strings.HasPrefix(staging, stagingPrefixFor(dest)) {
		t.Fatalf("staging directory %q is not recognisable as ours", staging)
	}
	if suffix := strings.TrimPrefix(staging, stagingPrefixFor(dest)); suffix != strconv.Itoa(os.Getpid()) {
		t.Errorf("staging directory is not process-specific: suffix %q", suffix)
	}
}

// Recovery has to be one pass, not one per launch: an extraction that succeeds
// must clear the leftovers that triggered it, or every later launch re-extracts.
func TestExtractResourcesClearsLeftoversItRecoversFrom(t *testing.T) {
	srcFS := fstest.MapFS{
		"node/node-bundle.tar.gz": &fstest.MapFile{Data: makeTarGz(t, map[string]string{"node": "the real node binary\n"})},
		"node/node.version":       &fstest.MapFile{Data: []byte("v24.18.0\n")},
	}

	resourcesDir := t.TempDir()
	seedRequiredAssets(t, resourcesDir)

	// The state a pre-fix install is stuck in: a truncated binary, a matching
	// marker, and the archive that was meant to produce the binary still there.
	nodeDir := filepath.Join(resourcesDir, "node")
	if err := os.MkdirAll(nodeDir, 0755); err != nil {
		t.Fatal(err)
	}
	for name, body := range map[string]string{
		"node":               "trunc",
		"node.version":       "v24.18.0\n",
		"node-bundle.tar.gz": "archive\n",
	} {
		if err := os.WriteFile(filepath.Join(nodeDir, name), []byte(body), 0755); err != nil {
			t.Fatal(err)
		}
	}

	if resourcesExist(srcFS, resourcesDir) {
		t.Fatal("the stuck state was reported as verified")
	}

	if err := extractResources(srcFS, resourcesDir); err != nil {
		t.Fatalf("extractResources: %v", err)
	}

	assertFileWithBody(t, nodeDir, "node", "the real node binary\n")
	if !resourcesExist(srcFS, resourcesDir) {
		t.Error("resources still look unfinished after a successful extraction")
	}
}

// An archive that will not delete after unpacking must not follow its contents
// into the resources directory: sitting at the real path it is indistinguishable
// from the residue of an interrupted pass, so resourcesExist would reject the
// install it belongs to for as long as it survived.
func TestMoveIntoLeavesTheArchiveInStaging(t *testing.T) {
	base := t.TempDir()
	staging := filepath.Join(base, "staging")
	destDir := filepath.Join(base, "node")

	if err := os.MkdirAll(staging, 0755); err != nil {
		t.Fatal(err)
	}
	for name, body := range map[string]string{
		"node":               "the real node binary\n",
		"node-bundle.tar.gz": "the archive we could not delete\n",
	} {
		if err := os.WriteFile(filepath.Join(staging, name), []byte(body), 0755); err != nil {
			t.Fatal(err)
		}
	}

	if err := moveInto(staging, destDir, "node-bundle.tar.gz"); err != nil {
		t.Fatalf("moveInto: %v", err)
	}

	assertFileWithBody(t, destDir, "node", "the real node binary\n")
	if _, err := os.Stat(filepath.Join(destDir, "node-bundle.tar.gz")); !os.IsNotExist(err) {
		t.Errorf("the archive was published alongside the binary (err=%v)", err)
	}
}

// The sweep runs while another App Lab process may be unpacking into its own
// staging directory. Taking that directory costs it the pass, so age is what
// decides — and an abandoned directory still has to go, or it forces a
// re-extraction on every launch for good.
func TestSweepSpareTheLiveStagingDirButNotTheAbandonedOne(t *testing.T) {
	srcFS := fstest.MapFS{
		"node/node-bundle.tar.gz": &fstest.MapFile{Data: makeTarGz(t, map[string]string{"node": "x\n"})},
	}

	resourcesDir := t.TempDir()
	nodeDir := filepath.Join(resourcesDir, "node")
	archive := filepath.Join(nodeDir, "node-bundle.tar.gz")

	// Two peers' scratch space, told apart only by how long it has sat still.
	live := filepath.Join(nodeDir, stagingPrefixFor(archive)+"111111")
	abandoned := filepath.Join(nodeDir, stagingPrefixFor(archive)+"222222")
	for _, dir := range []string{live, abandoned} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
	}
	stale := time.Now().Add(-2 * stagingGracePeriod)
	if err := os.Chtimes(abandoned, stale, stale); err != nil {
		t.Fatal(err)
	}

	// And an archive an older App Lab left at the real path, which is never live.
	if err := os.WriteFile(archive, []byte("archive\n"), 0644); err != nil {
		t.Fatal(err)
	}

	sweepExtractionLeftovers(srcFS, resourcesDir)

	if _, err := os.Stat(live); err != nil {
		t.Errorf("a staging directory that may still be in use was removed: %v", err)
	}
	if _, err := os.Stat(abandoned); !os.IsNotExist(err) {
		t.Errorf("an abandoned staging directory survived the sweep (err=%v)", err)
	}
	if _, err := os.Stat(archive); !os.IsNotExist(err) {
		t.Errorf("a leftover archive survived the sweep (err=%v)", err)
	}
}

// Our own scratch space is exempt from the wait: by the time the sweep runs this
// process is done with it, and a removal that failed earlier — the antivirus
// holding a file it has just been handed — deserves the retry now rather than in
// ten minutes' time.
func TestSweepClearsOurOwnStagingDirImmediately(t *testing.T) {
	srcFS := fstest.MapFS{
		"node/node-bundle.tar.gz": &fstest.MapFile{Data: makeTarGz(t, map[string]string{"node": "x\n"})},
	}

	resourcesDir := t.TempDir()
	ours := stagingPath(filepath.Join(resourcesDir, "node", "node-bundle.tar.gz"))
	if err := os.MkdirAll(ours, 0755); err != nil {
		t.Fatal(err)
	}

	sweepExtractionLeftovers(srcFS, resourcesDir)

	if _, err := os.Stat(ours); !os.IsNotExist(err) {
		t.Errorf("our own staging directory was left behind (err=%v)", err)
	}
}
