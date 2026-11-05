//go:build windows

// Hard-link identity for the runtime's disk usage (Windows).

package airuntime

import (
	"os"

	"golang.org/x/sys/windows"
)

// linkCheckMinSize skips the small files: Windows tells a file's links only through a handle, and the runtime holds tens of thousands of files.
const linkCheckMinSize = 1 << 20

// hardLinkID names a file that has more than one name, so a size total can count it once.
func hardLinkID(path string, info os.FileInfo) (fileID, bool) {
	if info.Size() < linkCheckMinSize {
		return fileID{}, false
	}
	p, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return fileID{}, false
	}
	h, err := windows.CreateFile(p, 0, windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE, nil, windows.OPEN_EXISTING, windows.FILE_FLAG_OPEN_REPARSE_POINT, 0)
	if err != nil {
		return fileID{}, false
	}
	defer windows.CloseHandle(h)
	var d windows.ByHandleFileInformation
	if err := windows.GetFileInformationByHandle(h, &d); err != nil || d.NumberOfLinks < 2 {
		return fileID{}, false
	}
	return fileID{dev: uint64(d.VolumeSerialNumber), ino: uint64(d.FileIndexHigh)<<32 | uint64(d.FileIndexLow)}, true
}
