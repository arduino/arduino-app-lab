//go:build windows

package terminal

// Test with:
// cd standalone-apps/app-lab-desktop
// go test -v ./internal/terminal

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExpandInvocation(t *testing.T) {
	const script = `C:\Users\test\AppData\Local\Temp\app-lab-terminal-123\run.cmd`

	var invocationTests = map[string]struct {
		candidate string
		expected  []string
	}{
		"Windows Terminal": {
			candidate: "wt.exe",
			expected:  []string{"-w", "new", "cmd.exe", "/C", script},
		},
		"Command Prompt": {
			candidate: "cmd.exe",
			expected:  []string{"/C", script},
		},
		"Windows PowerShell": {
			candidate: "powershell.exe",
			expected:  []string{"-Command", "& '" + script + "'"},
		},
		"ConEmu": {
			candidate: "ConEmu64.exe",
			expected:  []string{"-RunAs", "/cmd", script},
		},
		"Tabby": {
			candidate: "tabby.exe",
			expected:  []string{"run", script},
		},
		"Alacritty": {
			candidate: "alacritty.exe",
			expected:  []string{"-e", "cmd.exe", "/C", script},
		},
	}

	for name, test := range invocationTests {
		t.Run(name, func(t *testing.T) {
			candidate, found := findCandidate(windowsTerminals, test.candidate)
			require.True(t, found, test.candidate)
			require.NotEmpty(t, candidate.invocations, test.candidate)

			actual := expandInvocation(candidate.invocations[0], launchContext{script: script})
			require.Equal(t, test.expected, actual, test.candidate)
		})
	}
}

func TestExpandInvocationWithTheRawCommand(t *testing.T) {
	const script = `C:\Users\test\AppData\Local\Temp\app-lab-terminal-123\run.cmd`

	candidate, found := findCandidate(windowsTerminals, "wsl.exe")
	require.True(t, found)
	require.True(t, candidate.rawCommand, "wsl runs the command with its own shell")

	// The command is resolved inside the distribution, the executable is
	// searched by its name.
	ctx := launchContext{
		command: []string{`C:\Program Files\adb\adb.exe`, "-s", "1234", "shell"},
		script:  script,
		raw:     true,
	}
	actual := expandInvocation(candidate.invocations[0], ctx)
	require.Equal(t, []string{"--", "sh", "-c", "adb -s 1234 shell"}, actual)
}

func TestConsoleTerminals(t *testing.T) {
	// The console applications need a console window of their own, the
	// graphical ones open their own window.
	for _, id := range []string{"cmd.exe", "powershell.exe", "pwsh.exe", "wsl.exe"} {
		candidate, found := findCandidate(windowsTerminals, id)
		require.True(t, found, id)
		require.True(t, candidate.console, id)
	}
	for _, id := range []string{"wt.exe", "ConEmu64.exe", "tabby.exe", "alacritty.exe"} {
		candidate, found := findCandidate(windowsTerminals, id)
		require.True(t, found, id)
		require.False(t, candidate.console, id)
	}
}

func TestRemoteCommand(t *testing.T) {
	require.Equal(t,
		[]string{"/mnt/c/Program Files/adb/adb.exe", "-s", "1234", "shell"},
		remoteCommand([]string{`C:\Program Files\adb\adb.exe`, "-s", "1234", "shell"}))
	require.Equal(t,
		[]string{"ssh", "arduino@192.168.1.2"},
		remoteCommand([]string{"ssh", "arduino@192.168.1.2"}))
	require.Empty(t, remoteCommand(nil))
}

func TestWslPath(t *testing.T) {
	var wslPathTests = map[string]struct {
		path       string
		expected   string
		translated bool
	}{
		"Windows path": {
			path:       `C:\Program Files\adb\adb.exe`,
			expected:   "/mnt/c/Program Files/adb/adb.exe",
			translated: true,
		},
		"Upper case drive": {
			path:       `D:\adb.exe`,
			expected:   "/mnt/d/adb.exe",
			translated: true,
		},
		"Executable name": {
			path:       "adb.exe",
			expected:   "",
			translated: false,
		},
		"Relative path": {
			path:       `adb\adb.exe`,
			expected:   "",
			translated: false,
		},
	}

	for name, test := range wslPathTests {
		t.Run(name, func(t *testing.T) {
			actual, translated := wslPath(test.path)
			require.Equal(t, test.translated, translated)
			require.Equal(t, test.expected, actual)
		})
	}
}

func TestScriptContent(t *testing.T) {
	content, err := scriptContent([]string{`C:\Program Files\adb\adb.exe`, "-s", "1234", "shell"})
	require.NoError(t, err)

	require.Contains(t, content, "@echo off")
	require.Contains(t, content, `"C:\Program Files\adb\adb.exe" "-s" "1234" "shell"`)
	require.Contains(t, content, "pause >nul")
	// The deletion of the script is the last statement of the file: cmd.exe
	// reads the file one line at a time and it would not read the statements
	// after the deletion of the file.
	lines := strings.Split(strings.TrimRight(content, "\r\n"), "\r\n")
	require.Equal(t, `del "%~f0" 2>nul`, lines[len(lines)-1])
}

func TestQuoteWindowsArg(t *testing.T) {
	var quoteTests = map[string]struct {
		arg      string
		expected string
	}{
		"Simple word": {
			arg:      "adb",
			expected: `"adb"`,
		},
		"Path with spaces": {
			arg:      `C:\Program Files\adb.exe`,
			expected: `"C:\Program Files\adb.exe"`,
		},
		"Empty string": {
			arg:      "",
			expected: `""`,
		},
		// The percent expansion is the first phase of the batch line parser, it
		// happens even inside a quoted string: the percent has to be doubled.
		"Percent sign": {
			arg:      "50%",
			expected: `"50%%"`,
		},
		"Environment variable": {
			arg:      "%PATH%",
			expected: `"%%PATH%%"`,
		},
		// A quote can not be escaped, it has to be doubled.
		"Double quote": {
			arg:      `say "hi"`,
			expected: `"say ""hi"""`,
		},
		// Inside a quoted string the command characters are not special.
		"Command characters": {
			arg:      "a&b|c<d>e^f",
			expected: `"a&b|c<d>e^f"`,
		},
	}

	for name, test := range quoteTests {
		t.Run(name, func(t *testing.T) {
			actual, err := quoteWindowsArg(test.arg)
			require.NoError(t, err)
			require.Equal(t, test.expected, actual)
		})
	}
}

func TestQuoteWindowsArgRejectsALineBreak(t *testing.T) {
	_, err := quoteWindowsArg("adb\nshell")
	require.Error(t, err)
	require.Contains(t, err.Error(), "line break")

	_, err = quoteWindowsArg("adb\rshell")
	require.Error(t, err)
	require.Contains(t, err.Error(), "line break")
}

func TestValidateCustomCommand(t *testing.T) {
	// The console terminals are started through cmd.exe, the characters that
	// separate the commands would split the command line.
	for _, command := range []string{"cmd.exe & calc", "cmd.exe | more", "cmd.exe > out.txt", "cmd.exe ^ x", "cmd.exe %PATH%"} {
		require.Error(t, validateCustomCommand(command), command)
	}
	require.NoError(t, validateCustomCommand("wezterm start --"))
	require.NoError(t, validateCustomCommand(`alacritty --title "My Terminal"`))
}
