package artifacts

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"app-lab-desktop/internal/notices"

	"github.com/codeclysm/extract/v4"
)

type assetEntry struct {
	path  string
	isDir bool
}

type postExtractFunc func(destDir string) error

// Fixups applied to an asset directory once its archive has been extracted,
// keyed by the asset's path under resources/<platform>.
//
// Note what is deliberately not here: nothing deletes the LICENSE.txt that
// arduino-cli and arduino-language-server ship inside their release archives.
// An earlier version did, and it must not come back — arduino-cli is GPL-3.0
// and arduino-language-server is AGPL-3.0, and both require that text to
// accompany the binary we redistribute. Letting it extract is what puts a copy
// next to each executable on the user's disk. Our installers also ship the full
// set of bundled-binary licences from internal/notices/licenses, but that is a
// second, independent mechanism — not a reason to strip this one.
var assetPostProcessors = map[string]postExtractFunc{
	"python/ruff":                     postProcessRuff,
	"arduino/arduino-language-server": postProcessArduinoLS,
}

var requiredAssets = []assetEntry{
	{path: filepath.Join("arduino", "arduino-language-server", "arduino-language-server")},
	{path: filepath.Join("arduino", "arduino-cli", "arduino-cli")},
	{path: filepath.Join("arduino", "clangd", "clangd")},
	{path: filepath.Join("arduino", "clangd", "clang-resource"), isDir: true},
	{path: filepath.Join("python", "ruff", "ruff")},
	{path: filepath.Join("node", "node")},
	{path: filepath.Join("python", "pyright", "basedpyright-langserver")},
	{path: filepath.Join("python", "pyright", "node_modules"), isDir: true},
	{path: filepath.Join("typescript", "typescript-language-server")},
	{path: filepath.Join("typescript", "node_modules"), isDir: true},
	{path: filepath.Join("vscode-web", "vscode-html-language-server")},
	{path: filepath.Join("vscode-web", "vscode-css-language-server")},
	{path: filepath.Join("vscode-web", "node_modules"), isDir: true},
}

// stagingPrefix names the scratch directory an archive is unpacked into before
// its contents are moved into place. Recognisable by name so a leftover one can
// be identified as ours on a later launch.
const stagingPrefix = ".staging-"

// stagingGracePeriod is how long another process's staging directory is left
// alone before it is treated as abandoned rather than in use.
//
// It only has to outlast an extraction. The directory's own mtime is refreshed
// whenever a top-level entry appears in it, so the longest it can sit still
// during a live pass is one archive's unpacking — 1.3s for the largest bundle on
// a laptop, tens of seconds on the slowest board we ship for. Ten minutes is
// generous by more than an order of magnitude, and erring long only costs
// re-extractions while the clock runs down (see sweepExtractionLeftovers).
const stagingGracePeriod = 10 * time.Minute

// stagingPath is where this process unpacks the archive destined for destPath.
//
// The pid suffix keeps two App Lab processes out of each other's scratch space.
// They can genuinely overlap: the resources directory has one fixed name per
// platform and is shared by every build on the machine, ensureResources' lock is
// an in-process mutex, and macOS deliberately runs without a single-instance
// lock so go-updater can start the updated app beside the old one — which is
// exactly when a pinned tool version changes and both processes decide to
// extract. Sharing one staging directory made that corrupting: one process's
// cleanup would delete files the other was still writing, and the other would
// then move whatever it found — including half-written files — into place. With
// a directory each, the worst they can do to one another is unlink a whole file
// mid-pass, which makes that pass fail and retry rather than publish a partial
// binary.
func stagingPath(destPath string) string {
	return filepath.Join(filepath.Dir(destPath), stagingPrefixFor(destPath)+strconv.Itoa(os.Getpid()))
}

func stagingPrefixFor(destPath string) string {
	return stagingPrefix + filepath.Base(destPath) + "-"
}

// CopyResources puts the bundled language-server binaries on disk, and has to
// survive being interrupted while doing it. A crash, a force-quit or a lost
// battery during the first launch after a version bump used to leave a
// half-written binary at the path a working one had occupied, beside a .version
// marker that had already landed — and resourcesExist, which only stats paths
// and compares markers, then pronounced the install good on every launch
// afterwards. The user got a language server that never started, for as long as
// the app stayed on that version. Two rules prevent that:
//
//  1. An archive is unpacked into a staging directory and moved into place only
//     once it is whole, so what sits at the real path is never a partial file.
//  2. The .version markers are written last, once every archive in the pass has
//     landed, so a marker means "the pass that produced these binaries
//     finished" rather than "a pass started".
//
// Installs already damaged by the old behaviour repair themselves: the archive
// that never finished unpacking is still sitting beside the binary it was meant
// to produce, because it is deleted only on success, and resourcesExist reads
// that (and any leftover staging directory) as proof the pass did not finish.
func CopyResources(resourcesDir string) error {
	if err := os.MkdirAll(resourcesDir, 0755); err != nil {
		return fmt.Errorf("failed to create resources directory: %w", err)
	}

	// Ahead of the early return below, deliberately: the licences must appear
	// even when the binaries are already extracted and verified. An App Lab
	// upgrade that leaves every pinned tool version untouched takes that fast
	// path, and it is the upgrade most likely to be the one adding a licence
	// that was previously missing.
	if err := notices.WriteBinaryLicenses(filepath.Join(resourcesDir, "licenses")); err != nil {
		// Not fatal: a read-only or full disk should not stop the language
		// servers from starting. The texts also ship in the installers, so
		// this copy is the convenient one rather than the only one.
		slog.Warn("Failed to write bundled-binary licences", "err", err)
	}

	platformDir, err := detectPlatformDir()
	if err != nil {
		return err
	}

	subFS, err := fs.Sub(lspFS, path.Join("resources", platformDir))
	if err != nil {
		return fmt.Errorf("failed to access embedded resources for %s: %w", platformDir, err)
	}

	if resourcesExist(subFS, resourcesDir) {
		slog.Info("LSP resources already verified, skipping extraction", "path", resourcesDir)
		return nil
	}

	slog.Info("Extracting bundled LSP resources...", "platform", platformDir, "dest", resourcesDir)

	if err := extractResources(subFS, resourcesDir); err != nil {
		// A second App Lab process can be extracting into the same directory at
		// the same time — see stagingPath. If it finished while we were working,
		// its tree is as good as the one we were building, and what we tripped
		// over was its cleanup rather than damage. Checking beats failing here:
		// otherwise the loser of that race reports a broken language server for
		// a session, over resources that are sitting there intact.
		if resourcesExist(subFS, resourcesDir) {
			slog.Warn("LSP extraction failed, but another process completed one", "err", err)
			return nil
		}
		return err
	}

	return nil
}

func extractResources(fSys fs.FS, resourcesDir string) error {
	// Archives and plain files first, .version markers only once all of them
	// have landed — see the note on CopyResources.
	var payloads, markers []string
	err := fs.WalkDir(fSys, ".", func(srcPath string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || srcPath == "." {
			return err
		}
		if isVersionMarker(srcPath) {
			markers = append(markers, srcPath)
		} else {
			payloads = append(payloads, srcPath)
		}
		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to scan embedded resources: %w", err)
	}

	if err := extractResourceFiles(fSys, resourcesDir, payloads); err != nil {
		return fmt.Errorf("failed to extract LSP resources: %w", err)
	}

	if err := extractResourceFiles(fSys, resourcesDir, markers); err != nil {
		return fmt.Errorf("failed to record LSP resource versions: %w", err)
	}

	// Only now that the pass has worked: the leftovers are what brought us here,
	// and a pass that succeeded while they remained would still look unfinished
	// on the next launch.
	sweepExtractionLeftovers(fSys, resourcesDir)

	return nil
}

// extractResourceFiles extracts the given embedded paths in parallel, reporting
// the first failure once they have all settled.
func extractResourceFiles(fSys fs.FS, resourcesDir string, srcPaths []string) error {
	var wg sync.WaitGroup
	errChan := make(chan error, len(srcPaths))

	for _, srcPath := range srcPaths {
		wg.Add(1)
		go func(src string) {
			defer wg.Done()
			destPath := filepath.Join(resourcesDir, src)
			if err := extractResourceFile(fSys, src, destPath); err != nil {
				errChan <- err
			}
		}(srcPath)
	}

	wg.Wait()
	close(errChan)

	// Return the first error if any
	for err := range errChan {
		return err
	}

	return nil
}

func resourcesExist(fSys fs.FS, resourcesDir string) bool {
	for _, asset := range requiredAssets {
		found := false

		if asset.isDir {
			p := filepath.Join(resourcesDir, asset.path)
			if info, err := os.Stat(p); err == nil && info.IsDir() {
				found = true
			}
		} else {
			for _, ext := range []string{"", ".exe", ".bat"} {
				p := filepath.Join(resourcesDir, asset.path+ext)
				if info, err := os.Stat(p); err == nil && !info.IsDir() {
					found = true
					break
				}
			}
		}

		if !found {
			slog.Warn("Missing required LSP asset", "path", asset.path)
			return false
		}
		slog.Info("LSP asset verified", "path", asset.path)
	}

	err := fs.WalkDir(fSys, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}

		// An archive still sitting at its real path is an older App Lab's
		// interrupted pass: it unpacked over the binaries in place and deleted
		// the archive only on success, so what it was producing may exist with a
		// matching version marker and still be half a binary. That has to be
		// caught before either is believed, and it is what repairs the installs
		// damaged before staging existed.
		//
		// A staging directory is deliberately not evidence of the same thing. It
		// says a pass was interrupted, but never anything the checks around it
		// have missed: one interrupted on a version bump leaves the markers
		// stale, and one interrupted mid-move leaves a required asset missing.
		// Treating it as evidence would mean re-extracting on every Start for as
		// long as a dead peer's directory sat there waiting out
		// stagingGracePeriod, in exchange for nothing. Cleaning it up is the
		// sweep's job, not this function's.
		if isArchive(p) {
			for _, leftover := range extractionLeftovers(resourcesDir, p) {
				if !isStagingLeftover(leftover) {
					return fmt.Errorf("unfinished extraction left %s behind", leftover)
				}
			}
			return nil
		}

		if !isVersionMarker(p) {
			return nil
		}

		embeddedVersion, _ := fs.ReadFile(fSys, p)
		localPath := filepath.Join(resourcesDir, p)
		localVersion, err := os.ReadFile(localPath)
		if err != nil || strings.TrimSpace(string(embeddedVersion)) != strings.TrimSpace(string(localVersion)) {
			return fmt.Errorf("version mismatch or missing for %s", p)
		}
		slog.Info("LSP version match", "path", p, "version", strings.TrimSpace(string(embeddedVersion)))
		return nil
	})

	if err != nil {
		slog.Warn("LSP resources need extracting", "reason", err)
	}

	return err == nil
}

func isVersionMarker(p string) bool {
	return strings.HasSuffix(p, ".version")
}

// extractionLeftovers returns whatever survives under resourcesDir from a pass
// over the embedded archive at srcPath that did not finish: the archive copy an
// older App Lab left at the real path, and any staging directory, whichever
// process created it.
func extractionLeftovers(resourcesDir, srcPath string) []string {
	destPath := filepath.Join(resourcesDir, srcPath)

	var found []string
	if _, err := os.Stat(destPath); err == nil {
		found = append(found, destPath)
	}

	entries, err := os.ReadDir(filepath.Dir(destPath))
	if err != nil {
		return found
	}
	prefix := stagingPrefixFor(destPath)
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), prefix) {
			found = append(found, filepath.Join(filepath.Dir(destPath), entry.Name()))
		}
	}
	return found
}

// isStagingLeftover distinguishes the two kinds extractionLeftovers reports: a
// staging directory this or another process was unpacking into, or an archive
// left at its real path by an App Lab too old to stage.
func isStagingLeftover(leftover string) bool {
	return strings.HasPrefix(filepath.Base(leftover), stagingPrefix)
}

// sweepExtractionLeftovers clears the debris of an interrupted pass so that a
// pass which has just succeeded leaves nothing behind that would make the next
// launch think it hadn't.
//
// Runs after a successful pass rather than before one: the leftovers are what
// brought us here, and clearing them before we know our own pass worked would
// hide the evidence that the install is still unfinished.
//
// Only what sweepable accepts is removed, so a peer that is mid-extraction keeps
// its scratch space. The cost of that restraint is bounded: until the directory
// ages out, resourcesExist keeps answering false and each launch re-extracts —
// slow, but a working install either way, where deleting a live peer's files
// costs it the pass outright.
func sweepExtractionLeftovers(fSys fs.FS, resourcesDir string) {
	_ = fs.WalkDir(fSys, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !isArchive(p) {
			return err
		}
		for _, leftover := range extractionLeftovers(resourcesDir, p) {
			if !sweepable(leftover) {
				slog.Info("Leaving a staging directory that may still be in use", "path", leftover)
				continue
			}
			if err := removeAllWithRetry(leftover); err != nil {
				slog.Warn("Failed to clear leftover from an interrupted extraction", "path", leftover, "err", err)
			}
		}
		return nil
	})
}

// sweepable reports whether a leftover can be removed without pulling the rug
// out from a process that is still using it.
func sweepable(leftover string) bool {
	// An archive at the real path. Nothing puts one there any more — an
	// extraction keeps its copy inside its staging directory, and moveInto
	// refuses to publish it — so this is residue from an older App Lab.
	if !isStagingLeftover(leftover) {
		return true
	}

	// Our own scratch space, whose removal in extractResourceFile must have
	// failed. By the time the sweep runs we are finished with it either way, and
	// the retry below is the second chance a transient lock needs.
	if strings.HasSuffix(filepath.Base(leftover), "-"+strconv.Itoa(os.Getpid())) {
		return true
	}

	// A peer's, and two App Lab processes really do extract at once — see
	// stagingPath. Taking it while the peer is unpacking into it costs that
	// process its pass and puts "language support failed to install" in front of
	// someone who has just updated, which is the one moment the overlap is
	// guaranteed. Age is what separates a live peer from an abandoned pass.
	info, err := os.Stat(leftover)
	if err != nil {
		// Gone, or unreadable: nothing to remove, and nothing worth guessing at.
		return false
	}
	return time.Since(info.ModTime()) > stagingGracePeriod
}

// removeAllWithRetry deletes a path, giving a transient holder a moment to let go
// before giving up.
//
// The holder we have actually seen is a Windows antivirus scanner opening a
// freshly written binary to inspect it, which clears in well under a second. The
// retry is here because of what a permanent failure costs rather than how likely
// it is: a leftover keeps resourcesExist answering false, ensureResources runs on
// every Start, and so the whole bundle re-extracts before any language server can
// come up — on every app open, for as long as the leftover survives.
func removeAllWithRetry(path string) error {
	var err error
	for _, backoff := range []time.Duration{0, 100 * time.Millisecond, 250 * time.Millisecond} {
		if backoff > 0 {
			time.Sleep(backoff)
		}
		if err = os.RemoveAll(path); err == nil {
			return nil
		}
	}
	return err
}

func detectPlatformDir() (string, error) {
	entries, err := lspFS.ReadDir("resources")
	if err != nil {
		return "", fmt.Errorf("failed to read embedded resources: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			return entry.Name(), nil
		}
	}

	return "", fmt.Errorf("no platform directory found in embedded resources")
}

func extractResourceFile(fSys fs.FS, srcPath, destPath string) error {
	if !isArchive(srcPath) {
		return copyEmbeddedFile(fSys, srcPath, destPath)
	}

	// Unpack out of the way and move the result in, rather than unpacking over
	// the binaries already there: an interruption then costs a re-extraction
	// instead of leaving a truncated binary where a working one used to be. The
	// staging directory is a sibling of the destination so it is on the same
	// filesystem and the moves are renames.
	destDir := filepath.Dir(destPath)
	staging := stagingPath(destPath)
	if err := removeAllWithRetry(staging); err != nil {
		return err
	}
	defer func() { _ = removeAllWithRetry(staging) }()

	// The archive is copied inside the staging directory too, so an interrupted
	// pass leaves exactly one thing behind per asset for the next launch to find.
	archivePath := filepath.Join(staging, filepath.Base(destPath))
	if err := copyEmbeddedFile(fSys, srcPath, archivePath); err != nil {
		return err
	}

	slog.Info("Decompressing archive", "path", destPath)
	if err := extractArchive(archivePath, staging); err != nil {
		return err
	}
	if err := verifyExtractedSizes(archivePath, staging); err != nil {
		return err
	}

	// Not fatal. On Windows an antivirus scanner can still hold an archive we
	// have written and closed — the reason the copy above closes its handle
	// explicitly — and refusing to publish binaries that are already verified
	// and staged over a scratch file we failed to tidy would turn a transient
	// lock into "language support failed to install". moveInto is told to leave
	// the archive where it is, so a copy that survives cannot reach the real path
	// and be read as an interrupted pass on the next launch.
	if err := os.Remove(archivePath); err != nil {
		slog.Warn("Failed to remove archive after extraction", "path", archivePath, "err", err)
	}

	// Post-processing runs on the staged copy, so what moves into place is the
	// final shape rather than one a later step still has to fix up.
	assetKey := path.Dir(srcPath)
	if postProcess, ok := assetPostProcessors[assetKey]; ok {
		slog.Info("Applying post-processing for asset", "key", assetKey)
		if err := postProcess(staging); err != nil {
			return err
		}
	}

	return moveInto(staging, destDir, filepath.Base(archivePath))
}

func copyEmbeddedFile(fSys fs.FS, srcPath, destPath string) error {
	src, err := fSys.Open(srcPath)
	if err != nil {
		return fmt.Errorf("failed to open embedded file %s: %w", srcPath, err)
	}
	defer src.Close()

	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return err
	}

	_ = os.RemoveAll(destPath)
	dst, err := os.OpenFile(destPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}

	if _, err = io.Copy(dst, src); err != nil {
		dst.Close()
		return err
	}

	// Close explicitly (not deferred): on Windows an open handle prevents the
	// archive from being removed once it has been extracted.
	return dst.Close()
}

// moveInto replaces destDir's copy of each top-level entry in staging with the
// staged one, other than the named ones. Entry by entry rather than one directory
// rename because destDir holds the rest of that tool's assets — a licence lifted
// out of an earlier archive, the previous node_modules — and must keep whatever
// this archive does not carry.
//
// The exceptions are for an archive that could not be deleted after unpacking:
// it has to stay out of destDir, where the next launch would take it for the
// residue of an interrupted pass.
func moveInto(staging, destDir string, except ...string) error {
	entries, err := os.ReadDir(staging)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(destDir, 0755); err != nil {
		return err
	}

	skip := make(map[string]bool, len(except))
	for _, name := range except {
		skip[name] = true
	}

	for _, entry := range entries {
		if skip[entry.Name()] {
			continue
		}
		target := filepath.Join(destDir, entry.Name())
		// Renaming onto an existing directory fails, and on Windows an open
		// handle can make it fail on a file too, so clear the way first.
		if err := os.RemoveAll(target); err != nil {
			return err
		}
		if err := os.Rename(filepath.Join(staging, entry.Name()), target); err != nil {
			return err
		}
	}

	return nil
}

func isArchive(p string) bool {
	lower := strings.ToLower(p)
	return strings.HasSuffix(lower, ".tar.gz") || strings.HasSuffix(lower, ".zip") || strings.HasSuffix(lower, ".tgz")
}

// verifyExtractedSizes checks every regular file the archive declares against
// what actually landed, before any of it is moved into place.
//
// A binary that is present but short is the failure this file is organised
// around, and it is the one form of damage the language servers cannot report
// usefully: the process starts, dies immediately, and the frontend has nothing
// to show but a generic timeout. Running a bundled binary to prove it works is
// only possible for the few that answer --version — not for the language server
// executables themselves, not for ruff, and not for the node_modules trees the
// JavaScript servers are. Comparing sizes covers all of them, at the one moment
// where failing is free: the previous install is still in place and the marker
// that would bless this one has not been written.
//
// It is a check on extraction, not a running integrity check. Damage after the
// fact — an antivirus neutering a binary weeks later — is out of its reach,
// because by then the archive it would have been compared against is gone.
func verifyExtractedSizes(archivePath, dir string) error {
	declared, err := archiveFileSizes(archivePath)
	if err != nil {
		return fmt.Errorf("could not read %s to verify it: %w", filepath.Base(archivePath), err)
	}

	for name, size := range declared {
		extracted := filepath.Join(dir, filepath.FromSlash(name))
		info, err := os.Stat(extracted)
		if err != nil {
			return fmt.Errorf("%s: %s did not extract: %w", filepath.Base(archivePath), name, err)
		}
		if info.Size() != size {
			return fmt.Errorf("%s: %s extracted %d of %d bytes", filepath.Base(archivePath), name, info.Size(), size)
		}
	}

	return nil
}

// archiveFileSizes reads the size every regular file entry declares, keyed by
// its slash-separated path within the archive. Windows bundles are zips and the
// rest are tarballs, so both shapes have to be readable here.
func archiveFileSizes(archivePath string) (map[string]int64, error) {
	if strings.HasSuffix(strings.ToLower(archivePath), ".zip") {
		return zipFileSizes(archivePath)
	}
	return tarGzFileSizes(archivePath)
}

func tarGzFileSizes(archivePath string) (map[string]int64, error) {
	f, err := os.Open(archivePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return nil, err
	}
	defer gz.Close()

	sizes := map[string]int64{}
	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			return sizes, nil
		}
		if err != nil {
			return nil, err
		}
		// Regular files only: a directory declares no size, and a symlink or
		// hardlink is a name rather than bytes on disk.
		if hdr.Typeflag == tar.TypeReg {
			sizes[path.Clean(hdr.Name)] = hdr.Size
		}
	}
}

func zipFileSizes(archivePath string) (map[string]int64, error) {
	r, err := zip.OpenReader(archivePath)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	sizes := map[string]int64{}
	for _, f := range r.File {
		if f.Mode().IsRegular() {
			sizes[path.Clean(f.Name)] = int64(f.UncompressedSize64)
		}
	}
	return sizes, nil
}

func extractArchive(srcArchive, destDir string) error {
	f, err := os.Open(srcArchive)
	if err != nil {
		return err
	}
	defer f.Close()
	return extract.Archive(context.Background(), f, destDir, nil)
}

func postProcessRuff(destDir string) error {
	return moveSubDirContent(destDir, "ruff-")
}

// postProcessArduinoLS flattens the per-platform directory that
// arduino-language-server nests its binary inside from 0.8.0 on. The rc packages
// Linux and Windows nested but macOS flat:
//
//	Linux_64bit    arduino-language-server_linux_amd64/arduino-language-server
//	Linux_ARM64    arduino-language-server_linux_arm_64/...   (note the extra "_")
//	Windows_ARM64  arduino-language-server_windows_arm64/arduino-language-server.exe
//	macOS_ARM64    arduino-language-server                    (no directory)
//
// Both shapes have to end up with the binary at the top of the asset dir,
// because getResourcePath and requiredAssets look for
// arduino/arduino-language-server/arduino-language-server. Matching on the
// prefix rather than the exact names covers the inconsistent spelling and any
// platform added later; on a flat archive it finds nothing and is a no-op, which
// keeps a rollback to 0.7.7 working.
//
// The move also lifts the archive's LICENSE.txt to the top level, which is where
// it needs to end up — see assetPostProcessors.
func postProcessArduinoLS(destDir string) error {
	return moveSubDirContent(destDir, "arduino-language-server_")
}

func moveSubDirContent(destDir, prefix string) error {
	entries, err := os.ReadDir(destDir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() && strings.HasPrefix(entry.Name(), prefix) {
			subDir := filepath.Join(destDir, entry.Name())
			files, err := os.ReadDir(subDir)
			if err != nil {
				return err
			}
			for _, f := range files {
				if err := os.Rename(filepath.Join(subDir, f.Name()), filepath.Join(destDir, f.Name())); err != nil {
					return err
				}
			}
			_ = os.RemoveAll(subDir)
			return nil
		}
	}
	return nil
}
