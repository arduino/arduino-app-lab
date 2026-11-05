package airuntime

import (
	"os"
	"path/filepath"
	"testing"
)

// The engine's install stores its binary once under two names: counted per name, Disk usage shows far more than the disk holds.
func TestDirSizeCountsAHardLinkOnce(t *testing.T) {
	root := t.TempDir()
	bin := filepath.Join(root, "bin")
	const size = 2 << 20 // above the size Windows starts checking links at
	if err := os.WriteFile(bin, make([]byte, size), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "pkg"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Link(bin, filepath.Join(root, "pkg", "bin.exe")); err != nil {
		t.Skipf("this filesystem has no hard links: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "other"), make([]byte, 10), 0o644); err != nil {
		t.Fatal(err)
	}
	_ = os.Symlink(bin, filepath.Join(root, "link")) // not counted; Windows may refuse to make it

	if got := dirSize(root); got != size+10 {
		t.Errorf("dirSize = %d, want %d", got, size+10)
	}
}
