package board

// test with `go test ./internal/board`

import (
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
	"github.com/stretchr/testify/assert"
)

func TestIsNoPortsError(t *testing.T) {
	// The text arduino-app-cli's FromFQBN returns when discovery lists no port.
	assert.True(t, isNoPortsError(errors.New("no hardware ID found for FQBNs arduino:zephyr:unoq,arduino:zephyr:ventunoq")))
	assert.False(t, isNoPortsError(errors.New("failed to get info for FQBNs arduino:zephyr:unoq: timeout")))
	assert.False(t, isNoPortsError(nil))
}

// osReleaseConn serves /etc/os-release and records whether its reader was closed.
type osReleaseConn struct {
	remote.RemoteConn
	content string
	closed  bool
}

func (c *osReleaseConn) ReadFile(string) (io.ReadCloser, error) {
	return closeRecorder{Reader: strings.NewReader(c.content), closed: &c.closed}, nil
}

type closeRecorder struct {
	io.Reader
	closed *bool
}

func (r closeRecorder) Close() error {
	*r.closed = true
	return nil
}

// The close waits the adb or ssh process behind the read: without it every Settings visit left one defunct child.
func TestGetLinuxDistributionClosesTheFile(t *testing.T) {
	for name, tc := range map[string]struct {
		content, want string
		found         bool
	}{
		"the name is found before the end": {"NAME=\"Debian GNU/Linux\"\nPRETTY_NAME=\"Debian GNU/Linux 13 (trixie)\"\nVERSION_ID=\"13\"\n", "Debian GNU/Linux 13 (trixie)", true},
		"no name in the file":              {"NAME=\"Debian GNU/Linux\"\n", "", false},
	} {
		conn := &osReleaseConn{content: tc.content}
		b := Noop()
		b.Conn = conn
		got, err := b.GetLinuxDistribution()
		if got != tc.want || (err == nil) != tc.found {
			t.Errorf("%s: GetLinuxDistribution = %q, %v; want %q", name, got, err, tc.want)
		}
		if !conn.closed {
			t.Errorf("%s: the os-release reader was never closed", name)
		}
	}
}
