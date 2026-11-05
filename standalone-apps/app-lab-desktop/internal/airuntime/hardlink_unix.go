//go:build !windows

// Hard-link identity for the runtime's disk usage (Unix).

package airuntime

import (
	"os"
	"syscall"
)

// hardLinkID names a file that has more than one name, so a size total can count it once.
func hardLinkID(_ string, info os.FileInfo) (fileID, bool) {
	st, ok := info.Sys().(*syscall.Stat_t)
	if !ok || st.Nlink < 2 {
		return fileID{}, false
	}
	return fileID{dev: uint64(st.Dev), ino: st.Ino}, true
}
