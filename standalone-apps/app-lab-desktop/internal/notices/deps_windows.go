//go:build windows

package notices

import "embed"

//go:embed go-dependencies.txt npm-dependencies.txt vendored-assets.txt
var depNoticesFS embed.FS

// WriteDependencyNotices puts the Go/npm/vendored-asset notices in destDir.
// Windows is the only platform where these are compiled in rather than shipped
// as files — see "Why Windows is deliberately embed-only" in
// THIRD-PARTY-NOTICES.md.
func WriteDependencyNotices(destDir string) error {
	return writeFiles(depNoticesFS, FileNames, destDir)
}
