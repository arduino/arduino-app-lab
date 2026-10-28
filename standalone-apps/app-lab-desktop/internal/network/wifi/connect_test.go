package wifi

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

func TestConnectSetsWaitDeviceTimeout(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the fake nmcli needs sh")
	}

	const wifiUUID = "0f5d6c1e-6a1b-4c39-9a37-2d7e8b1c4a90"
	activated := "Device 'wlan0' successfully activated with '" + wifiUUID + "'."
	modify := fmt.Sprintf("connection modify uuid %s connection.wait-device-timeout %d", wifiUUID, waitDeviceTimeout.Milliseconds())

	for _, tc := range []struct {
		name         string
		password     string
		connectReply string
		connectFail  bool
		modifyFail   bool
		wantErr      bool
		wantModify   bool
	}{
		{
			name:         "open network",
			connectReply: activated,
			wantModify:   true,
		},
		{
			name:         "secured network",
			password:     "secret",
			connectReply: activated,
			wantModify:   true,
		},
		{
			name:         "no UUID in the reply",
			connectReply: "Device 'wlan0' successfully activated.",
		},
		{
			// The board is connected, so the setup still succeeds.
			name:         "modify fails",
			connectReply: activated,
			modifyFail:   true,
			wantModify:   true,
		},
		{
			name:        "connect fails",
			connectFail: true,
			wantErr:     true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			if err := os.WriteFile(filepath.Join(dir, "nmcli"), []byte(fakeNmcli), 0o755); err != nil {
				t.Fatal(err)
			}
			cmdLog := filepath.Join(dir, "cmd.log")
			conn := &fakeConn{dir: dir, env: append(os.Environ(),
				"FAKE_LOG="+cmdLog,
				"FAKE_PASSWORD="+tc.password,
				"FAKE_CONNECT_REPLY="+tc.connectReply,
				"FAKE_CONNECT_FAIL="+flag(tc.connectFail),
				"FAKE_MODIFY_FAIL="+flag(tc.modifyFail),
			)}

			err := Connect(context.Background(), conn, "test-ssid", tc.password)
			if (err != nil) != tc.wantErr {
				t.Fatalf("Connect error = %v, want error %v", err, tc.wantErr)
			}

			out, err := os.ReadFile(cmdLog)
			if err != nil {
				t.Fatal(err)
			}
			var modified []string
			for _, cmd := range strings.Split(strings.TrimSpace(string(out)), "\n") {
				if strings.HasPrefix(cmd, "connection modify") {
					modified = append(modified, cmd)
				}
			}
			switch {
			case tc.wantModify && (len(modified) != 1 || modified[0] != modify):
				t.Fatalf("modify commands = %q, want [%q]", modified, modify)
			case !tc.wantModify && len(modified) != 0:
				t.Fatalf("modify commands = %q, want none", modified)
			}
		})
	}
}

// fakeNmcli answers the commands of a connect and logs each of them. With
// --ask, it reads the password from stdin as nmcli does.
const fakeNmcli = `#!/bin/sh
echo "$*" >> "$FAKE_LOG"
case "$*" in
"radio wifi on"|"device wifi rescan")
	;;
"radio wifi")
	echo enabled ;;
"device wifi list")
	echo test-ssid ;;
"--wait 20 device wifi connect test-ssid"|"--ask --wait 20 device wifi connect test-ssid")
	if [ "$1" = --ask ]; then
		read -r password
		[ "$password" = "$FAKE_PASSWORD" ] || exit 4
	fi
	[ -z "$FAKE_CONNECT_FAIL" ] || { echo 'Error: Connection activation failed.' >&2; exit 4; }
	echo "$FAKE_CONNECT_REPLY" ;;
"connection modify uuid "*)
	[ -z "$FAKE_MODIFY_FAIL" ] || { echo 'Error: Failed to modify connection.' >&2; exit 1; } ;;
*)
	exit 2 ;;
esac
`

func flag(b bool) string {
	if b {
		return "1"
	}
	return ""
}

// fakeConn runs the command from dir, like the board would over SSH. It never
// falls back to PATH, so a missing fake cannot reach the real nmcli.
type fakeConn struct {
	remote.RemoteConn // only GetCmd is reached

	dir string
	env []string
}

func (c *fakeConn) GetCmd(name string, args ...string) remote.Cmder {
	return &fakeCmder{name: filepath.Join(c.dir, name), args: args, env: c.env}
}

type fakeCmder struct {
	remote.Cmder // only Output and Interactive are reached

	name string
	args []string
	env  []string
}

func (c *fakeCmder) Output(ctx context.Context) ([]byte, error) {
	cmd := exec.CommandContext(ctx, c.name, c.args...)
	cmd.Env = c.env
	// SSHCommand.Output also merges stderr into the reply.
	return cmd.CombinedOutput()
}

func (c *fakeCmder) Interactive() (io.WriteCloser, io.Reader, io.Reader, remote.Closer, error) {
	cmd := exec.Command(c.name, c.args...)
	cmd.Env = c.env
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, nil, nil, nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, nil, nil, nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, nil, nil, nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, nil, nil, nil, err
	}
	return stdin, stdout, stderr, cmd.Wait, nil
}
