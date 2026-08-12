package notices

import (
	"embed"
	"fmt"
	"io/fs"
)

// Embedded on every platform, deliberately: it guarantees the texts ship no
// matter how the app was packaged, and on macOS — where the .app is signed and
// notarised inside the build action, so nothing can be added to it afterwards —
// it is the only route. The installers additionally place a browsable copy;
// see THIRD-PARTY-NOTICES.md.
//
//go:embed licenses/*.txt
var binaryLicensesFS embed.FS

// WriteBinaryLicenses copies the licence text of every third-party executable
// App Lab bundles (arduino-cli, clangd, node, the language servers, ...) into
// destDir. This is what puts them on the user's disk alongside the binaries
// they cover.
func WriteBinaryLicenses(destDir string) error {
	names, err := fs.Glob(binaryLicensesFS, "licenses/*.txt")
	if err != nil {
		return fmt.Errorf("failed to enumerate embedded licences: %w", err)
	}
	return writeFiles(binaryLicensesFS, names, destDir)
}
