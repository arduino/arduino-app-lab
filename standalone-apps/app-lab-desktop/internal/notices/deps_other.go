//go:build !windows

package notices

// WriteDependencyNotices is a no-op everywhere except Windows: the .deb, the
// Linux tarball and the macOS dmg already carry the Go/npm notices as files,
// so embedding ~3 MB into those binaries would add weight without adding
// coverage. See "Why Windows is deliberately embed-only" in
// THIRD-PARTY-NOTICES.md.
func WriteDependencyNotices(destDir string) error {
	return nil
}
