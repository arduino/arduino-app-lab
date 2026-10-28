//go:build darwin

package terminal

// Test with:
// cd standalone-apps/app-lab-desktop
// go test -v ./internal/terminal

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExpandInvocation(t *testing.T) {
	const script = "/var/folders/x/app-lab-terminal-123/run.sh"

	var invocationTests = map[string]struct {
		candidate string
		expected  []string
	}{
		"Alacritty": {
			candidate: "alacritty",
			expected:  []string{"-e", "sh", script},
		},
		"Kitty": {
			candidate: "kitty",
			expected:  []string{"sh", script},
		},
		"WezTerm": {
			candidate: "wezterm",
			expected:  []string{"start", "--", "sh", script},
		},
		"Ghostty": {
			candidate: "ghostty",
			expected:  []string{"-e", "sh", script},
		},
		"Rio": {
			candidate: "rio",
			expected:  []string{"sh", script},
		},
	}

	for name, test := range invocationTests {
		t.Run(name, func(t *testing.T) {
			candidate, found := findCandidate(darwinTerminals, test.candidate)
			require.True(t, found, test.candidate)
			require.NotEmpty(t, candidate.invocations, test.candidate)

			actual := expandInvocation(candidate.invocations[0], launchContext{script: script})
			require.Equal(t, test.expected, actual, test.candidate)
		})
	}
}

func TestApplicationTerminals(t *testing.T) {
	terminal, found := findCandidate(darwinTerminals, "Terminal")
	require.True(t, found)
	require.NotNil(t, terminal.app, "Terminal is opened as an application")
	require.Equal(t, "open", terminal.app.command)
	require.Equal(t, []string{"-a", "Terminal", "{script}"}, terminal.app.args)

	iterm, found := findCandidate(darwinTerminals, "iTerm")
	require.True(t, found)
	require.NotNil(t, iterm.app, "iTerm2 is opened with AppleScript")
	require.Equal(t, "osascript", iterm.app.command)
}

func TestEscapeAppleScript(t *testing.T) {
	require.Equal(t, `/tmp/run.sh`, escapeAppleScript("/tmp/run.sh"))
	require.Equal(t, `/tmp/my\ run.sh`, escapeAppleScript("/tmp/my run.sh"))
	require.Equal(t, `/tmp/run\"x.sh`, escapeAppleScript(`/tmp/run"x.sh`))
}

func TestScriptContent(t *testing.T) {
	content, err := scriptContent([]string{"adb", "-s", "1234", "shell"})
	require.NoError(t, err)

	require.Contains(t, content, "#!/bin/sh")
	require.Contains(t, content, "adb -s 1234 shell")
	require.Contains(t, content, "read dummy")
}
