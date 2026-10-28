package terminal

// Test with:
// cd standalone-apps/app-lab-desktop
// go test -v ./internal/terminal

import (
	"app-lab-desktop/internal/board"
	"testing"

	oBoard "github.com/arduino/arduino-app-cli/pkg/board"
	"github.com/stretchr/testify/require"
)

func TestOpenTerminal(t *testing.T) {
	var openTerminalTests = map[string]struct {
		Info        board.BoardInfo
		expectError bool
	}{
		"Invalid Serial Number": {
			Info: board.BoardInfo{
				Protocol: oBoard.SerialProtocol,
				Serial:   "1234; touch injected.txt && echo /",
			},
		},
		"Invalid Network Address": {
			Info: board.BoardInfo{
				Protocol: oBoard.NetworkProtocol,
				Address:  "invalid_address",
			},
		},
	}

	for name, test := range openTerminalTests {
		t.Run(name, func(t *testing.T) {
			b := &board.Board{
				Info: test.Info,
			}
			_, err := OpenTerminal(t.Context(), b, Options{})
			require.Error(t, err, name)
		})
	}
}

func TestSanitizeIPAddress(t *testing.T) {
	var sanitezeIpAddressTests = map[string]struct {
		input       string
		expectError bool
	}{
		"Valid IPv6": {
			input:       "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
			expectError: false,
		},
		"Valid IPv6 2": {
			input:       "2001:db8::1",
			expectError: false,
		},
		"INVALID IPv6": {
			input:       "2001:0db8:85a3:0000:0000:8a2e:0370:7334; touch injected.txt && echo /",
			expectError: true,
		},
		"INVALID IPv6 2": {
			input:       "2001:db8::1; touch injected.txt; echo",
			expectError: true,
		},
		"Valid IPv4": {
			input:       "0.0.0.0",
			expectError: false,
		},
		"INVALID IPv4": {
			input:       "127.0.0.1; touch /tmp/hacked | echo",
			expectError: true,
		},
	}

	for name, test := range sanitezeIpAddressTests {
		t.Run(name, func(t *testing.T) {
			actual, err := SanitizeIPAddress(test.input)
			if test.expectError {
				require.Error(t, err, name)
				return
			} else {
				require.NoError(t, err)
				require.Equal(t, test.input, actual)
			}
		})
	}
}

func TestSanitizeSerialNumber(t *testing.T) {
	var sanitizeSerialNumberTests = map[string]struct {
		input       string
		expectError bool
	}{
		"Valid Serial": {
			input:       "131234123",
			expectError: false,
		},
		"Out of Range Serial": {
			input:       "1312341231312341231312341231312341231312341231312341",
			expectError: true,
		},
		"Negative Serial": {
			input:       "-131234",
			expectError: true,
		},
		"INVALID Serial": {
			input:       "1420; touch hacked.txt; echo",
			expectError: true,
		},
		"Scientific Notation": {
			input:       "1E2",
			expectError: true,
		},
		"Floating Point Notation": {
			input:       "10.0000000",
			expectError: true,
		},
	}

	for name, test := range sanitizeSerialNumberTests {
		t.Run(name, func(t *testing.T) {
			actual, err := SanitizeSerialNumber(test.input)
			if test.expectError {
				require.Error(t, err, name)
				return
			} else {
				require.NoError(t, err)
				require.Equal(t, test.input, actual)
			}
		})
	}
}
