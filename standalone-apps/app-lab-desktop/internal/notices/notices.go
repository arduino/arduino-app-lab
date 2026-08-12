// Package notices carries every piece of third-party attribution App Lab
// delivers at runtime:
//
//   - licenses/*.txt — the licence texts of the executables bundled out of
//     internal/lsp, embedded on every platform and written next to the
//     extracted binaries on start-up (WriteBinaryLicenses);
//   - *-dependencies.txt and vendored-assets.txt — generated notices for the
//     Go modules, npm packages and vendored assets compiled into the app
//     itself, embedded on Windows only (WriteDependencyNotices).
//
// What ships where, and why the Windows/others split exists, is documented in
// "Where the notices ship" in THIRD-PARTY-NOTICES.md. The packaging
// counterpart that puts the same texts into the other distributions as
// browsable files is scripts/ship_notices.sh.
//
// Everything here is generated — the licence texts by
// internal/lsp/scripts/download_licenses.sh, the dependency notices by
// dev-utils/al-license/generate_dependency_notices.sh. Do not edit by hand.
package notices

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
)

// FileNames are the dependency notice files this package delivers, named in
// one place so the packaging script and the runtime copy cannot drift apart.
var FileNames = []string{
	"go-dependencies.txt",
	"npm-dependencies.txt",
	// Vendored assets have no package manifest, so no scanner sees them. They
	// ship inside the frontend all the same.
	"vendored-assets.txt",
}

// writeFiles copies the named files out of src into destDir, creating it if
// needed. Existing files are overwritten: they are small, and rewriting is
// what lets an App Lab upgrade correct a text that changed without anything
// else changing.
func writeFiles(src fs.FS, names []string, destDir string) error {
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return fmt.Errorf("failed to create notices directory: %w", err)
	}

	for _, name := range names {
		body, err := fs.ReadFile(src, name)
		if err != nil {
			return fmt.Errorf("failed to read embedded %s: %w", name, err)
		}
		// 0644, not 0755: these are documents, not the executables beside them.
		if err := os.WriteFile(filepath.Join(destDir, filepath.Base(name)), body, 0644); err != nil {
			return fmt.Errorf("failed to write %s: %w", filepath.Base(name), err)
		}
	}

	return nil
}
