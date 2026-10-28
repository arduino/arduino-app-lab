//go:build linux

package terminal

// Test with:
// cd standalone-apps/app-lab-desktop
// go test -v ./internal/terminal

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// makeStubTerminal creates an executable stub of a terminal emulator in a
// temporary directory and returns the directory. The stub records the arguments
// it receives in the file pointed by the STUB_ARGS_FILE environment variable and
// it fails when the first argument is the one listed in STUB_FAIL_ON.
func makeStubTerminal(t *testing.T, names ...string) string {
	t.Helper()
	dir := t.TempDir()
	for _, name := range names {
		script := "#!/bin/sh\n" +
			"if [ -n \"$STUB_ARGS_FILE\" ]; then printf '%s\\n' \"$*\" > \"$STUB_ARGS_FILE\"; fi\n" +
			"if [ \"$STUB_FAIL_ALWAYS\" = \"${0##*/}\" ]; then echo \"unsupported option\" >&2; exit 1; fi\n" +
			"if [ \"$1\" = \"$STUB_FAIL_ON\" ]; then echo \"unsupported option\" >&2; exit 1; fi\n" +
			"exit 0\n"
		require.NoError(t, os.WriteFile(filepath.Join(dir, name), []byte(script), 0755))
	}
	return dir
}

// availableTerminals returns the terminals that are installed on the system.
func availableTerminals(terminals []TerminalInfo) []TerminalInfo {
	available := []TerminalInfo{}
	for _, terminal := range terminals {
		if terminal.Available {
			available = append(available, terminal)
		}
	}
	return available
}

func TestDetectTerminals(t *testing.T) {
	dir := makeStubTerminal(t, "alacritty", "ghostty")
	t.Setenv("PATH", dir)

	detected := detectTerminals()
	// Every known terminal is reported, the ones that are not installed are
	// reported as not available.
	require.Len(t, detected, len(linuxTerminals))

	available := availableTerminals(detected)
	require.Len(t, available, 2)
	require.Equal(t, "alacritty", available[0].ID)
	require.Equal(t, "Alacritty", available[0].Label)
	require.Equal(t, filepath.Join(dir, "alacritty"), available[0].Path)
	require.Equal(t, "ghostty", available[1].ID)

	for _, terminal := range detected {
		if terminal.ID == "alacritty" || terminal.ID == "ghostty" {
			continue
		}
		require.False(t, terminal.Available, terminal.ID)
		require.Empty(t, terminal.Path, terminal.ID)
	}
}

func TestDetectTerminalsWithoutTerminals(t *testing.T) {
	t.Setenv("PATH", t.TempDir())

	detected := detectTerminals()
	require.Len(t, detected, len(linuxTerminals))
	require.Empty(t, availableTerminals(detected))
}

func TestListAvailable(t *testing.T) {
	dir := makeStubTerminal(t, "kitty")
	t.Setenv("PATH", dir)

	catalog := ListAvailable()
	require.True(t, catalog.Supported)

	available := availableTerminals(catalog.Terminals)
	require.Len(t, available, 1)
	require.Equal(t, "kitty", available[0].ID)
}

func TestExpandInvocation(t *testing.T) {
	const script = "/tmp/app-lab-terminal-123/run.sh"

	var invocationTests = map[string]struct {
		candidate string
		expected  []string
	}{
		"GNOME Terminal": {
			candidate: "gnome-terminal",
			expected:  []string{"--", "sh", script},
		},
		"Konsole": {
			candidate: "konsole",
			expected:  []string{"-e", "sh", script},
		},
		"Xfce Terminal": {
			candidate: "xfce4-terminal",
			expected:  []string{"-e", "sh " + script},
		},
		"MATE Terminal": {
			candidate: "mate-terminal",
			expected:  []string{"--disable-factory", "-e", "sh " + script},
		},
		"Ptyxis": {
			candidate: "ptyxis",
			expected:  []string{"--", "sh", script},
		},
		"Alacritty": {
			candidate: "alacritty",
			expected:  []string{"-e", "sh", script},
		},
		"Kitty": {
			candidate: "kitty",
			expected:  []string{"sh", script},
		},
		"Ghostty": {
			candidate: "ghostty",
			expected:  []string{"-e", "sh", script},
		},
		"WezTerm": {
			candidate: "wezterm",
			expected:  []string{"start", "--", "sh", script},
		},
		"Foot": {
			candidate: "foot",
			expected:  []string{"sh", script},
		},
		"Default Terminal": {
			candidate: "x-terminal-emulator",
			expected:  []string{"-e", "sh " + script},
		},
	}

	for name, test := range invocationTests {
		t.Run(name, func(t *testing.T) {
			candidate, found := findCandidate(linuxTerminals, test.candidate)
			require.True(t, found, test.candidate)
			require.NotEmpty(t, candidate.invocations, test.candidate)

			actual := expandInvocation(candidate.invocations[0], launchContext{script: script})
			require.Equal(t, test.expected, actual, test.candidate)
		})
	}
}

// launchPreferredError launches the selected terminal and discards the outcome,
// it keeps the tests of the launch itself short.
func launchPreferredError(preferred string, candidates []terminalCandidate, ctx *launchContext) error {
	_, err := launchPreferred(preferred, candidates, ctx)
	return err
}

func TestMergeExtraArgs(t *testing.T) {
	inv := invocation{args: []string{"start", "--", "sh", "{cmd}"}}

	// The invocation already provides the extra arguments.
	require.Nil(t, mergeExtraArgs(inv, []string{"start", "--"}))
	// The extra arguments are not part of the invocation.
	require.Equal(t, []string{"--title", "foo"}, mergeExtraArgs(inv, []string{"--title", "foo"}))
	// No extra arguments.
	require.Nil(t, mergeExtraArgs(inv, nil))
}

func TestLaunchPreferredUsesTheSelectedTerminal(t *testing.T) {
	dir := makeStubTerminal(t, "alacritty", "ghostty")
	t.Setenv("PATH", dir)
	argsFile := filepath.Join(t.TempDir(), "args.txt")
	t.Setenv("STUB_ARGS_FILE", argsFile)

	const script = "/tmp/run.sh"
	require.NoError(t, launchPreferredError("alacritty", linuxTerminals, &launchContext{script: script}))

	recorded, err := os.ReadFile(argsFile)
	require.NoError(t, err)
	require.Equal(t, "-e sh "+script, strings.TrimSpace(string(recorded)))
}

func TestLaunchPreferredFallsBackToTheNextInvocation(t *testing.T) {
	dir := makeStubTerminal(t, "alacritty")
	t.Setenv("PATH", dir)
	argsFile := filepath.Join(t.TempDir(), "args.txt")
	t.Setenv("STUB_ARGS_FILE", argsFile)
	// The first invocation of alacritty is not supported by the stub.
	t.Setenv("STUB_FAIL_ON", "-e")

	const script = "/tmp/run.sh"
	require.NoError(t, launchPreferredError("alacritty", linuxTerminals, &launchContext{script: script}))

	recorded, err := os.ReadFile(argsFile)
	require.NoError(t, err)
	require.Equal(t, "-- sh "+script, strings.TrimSpace(string(recorded)))
}

func TestLaunchPreferredWithCustomCommand(t *testing.T) {
	dir := makeStubTerminal(t, "myterminal")
	t.Setenv("PATH", dir)
	argsFile := filepath.Join(t.TempDir(), "args.txt")
	t.Setenv("STUB_ARGS_FILE", argsFile)

	const script = "/tmp/run.sh"
	require.NoError(t, launchPreferredError("myterminal", linuxTerminals, &launchContext{script: script}))

	recorded, err := os.ReadFile(argsFile)
	require.NoError(t, err)
	require.Equal(t, "-e sh "+script, strings.TrimSpace(string(recorded)))
}

func TestLaunchPreferredWithUnknownTerminal(t *testing.T) {
	t.Setenv("PATH", t.TempDir())

	require.Error(t, launchPreferredError("this-terminal-does-not-exist", linuxTerminals, &launchContext{script: "/tmp/run.sh"}))
}

func TestLaunchPreferredWithCustomCommandWithArguments(t *testing.T) {
	dir := makeStubTerminal(t, "wezterm")
	t.Setenv("PATH", dir)
	argsFile := filepath.Join(t.TempDir(), "args.txt")
	t.Setenv("STUB_ARGS_FILE", argsFile)

	const script = "/tmp/run.sh"
	// The arguments of the terminal are not repeated: wezterm already runs
	// "start --".
	require.NoError(t, launchPreferredError("wezterm start --", linuxTerminals, &launchContext{script: script}))

	recorded, err := os.ReadFile(argsFile)
	require.NoError(t, err)
	require.Equal(t, "start -- sh "+script, strings.TrimSpace(string(recorded)))
}

func TestLaunchPreferredWithCustomCommandWithExtraArguments(t *testing.T) {
	dir := makeStubTerminal(t, "wezterm")
	t.Setenv("PATH", dir)
	argsFile := filepath.Join(t.TempDir(), "args.txt")
	t.Setenv("STUB_ARGS_FILE", argsFile)

	const script = "/tmp/run.sh"
	// The arguments of the user are added in front of the ones of the
	// terminal.
	require.NoError(t, launchPreferredError("wezterm --title foo", linuxTerminals, &launchContext{script: script}))

	recorded, err := os.ReadFile(argsFile)
	require.NoError(t, err)
	require.Equal(t, "--title foo start -- sh "+script, strings.TrimSpace(string(recorded)))
}

func TestLaunchPreferredWithInvalidCustomCommand(t *testing.T) {
	t.Setenv("PATH", t.TempDir())

	// A line break would split the command in two.
	require.Error(t, launchPreferredError("sh\n--title foo", linuxTerminals, &launchContext{script: "/tmp/run.sh"}))
}

func TestOpenTerminalFallsBackToTheAutomaticDetection(t *testing.T) {
	dir := makeStubTerminal(t, "alacritty")
	t.Setenv("PATH", dir)
	t.Setenv("STUB_FAIL_ON", "-e")
	t.Setenv("STUB_ARGS_FILE", filepath.Join(t.TempDir(), "args.txt"))

	result, err := openTerminal(Options{}, "echo", "hello")
	require.NoError(t, err)
	require.Equal(t, "alacritty", result.Terminal)
}

func TestOpenTerminalWithoutTerminals(t *testing.T) {
	t.Setenv("PATH", t.TempDir())

	_, err := openTerminal(Options{}, "echo", "hello")
	require.Error(t, err)
	require.Contains(t, err.Error(), "no terminal emulator was found on this system")
}

func TestOpenTerminalWarnsWhenTheSelectedTerminalFails(t *testing.T) {
	dir := makeStubTerminal(t, "alacritty", "ghostty")
	t.Setenv("PATH", dir)
	t.Setenv("STUB_ARGS_FILE", filepath.Join(t.TempDir(), "args.txt"))

	// The selected terminal can not be started at all.
	t.Setenv("STUB_FAIL_ALWAYS", "alacritty")

	// Another terminal is used, and the user is told why the selected one was
	// not used.
	result, err := openTerminal(Options{PreferredTerminal: "alacritty"}, "echo", "hello")
	require.NoError(t, err)
	require.Equal(t, "ghostty", result.Terminal)
	require.Contains(t, result.Warning, "the terminal selected in the settings could not be started")
}

func TestOpenTerminalWithoutAnyWorkingTerminal(t *testing.T) {
	dir := makeStubTerminal(t, "alacritty")
	t.Setenv("PATH", dir)
	t.Setenv("STUB_ARGS_FILE", filepath.Join(t.TempDir(), "args.txt"))
	t.Setenv("STUB_FAIL_ALWAYS", "alacritty")

	_, err := openTerminal(Options{PreferredTerminal: "alacritty"}, "echo", "hello")
	require.Error(t, err, "no terminal can be started when they all fail")
}

func TestOpenTerminalWithoutWarning(t *testing.T) {
	dir := makeStubTerminal(t, "alacritty")
	t.Setenv("PATH", dir)
	t.Setenv("STUB_ARGS_FILE", filepath.Join(t.TempDir(), "args.txt"))

	result, err := openTerminal(Options{PreferredTerminal: "alacritty"}, "echo", "hello")
	require.NoError(t, err)
	require.Equal(t, "alacritty", result.Terminal)
	require.Empty(t, result.Warning)
}

func TestCreateWrapperScript(t *testing.T) {
	scriptPath, err := createWrapperScript([]string{"adb", "-s", "1234", "shell"})
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(filepath.Dir(scriptPath)) })

	require.True(t, strings.HasPrefix(filepath.Dir(scriptPath), os.TempDir()))
	require.Equal(t, "run.sh", filepath.Base(scriptPath))

	content, err := os.ReadFile(scriptPath)
	require.NoError(t, err)
	require.Contains(t, string(content), "adb -s 1234 shell")
	// The script removes itself when it terminates.
	require.Contains(t, string(content), `rm -f "$0"`)

	info, err := os.Stat(scriptPath)
	require.NoError(t, err)
	require.Equal(t, os.FileMode(0700), info.Mode().Perm())
}

func TestCreateWrapperScriptQuotesTheArguments(t *testing.T) {
	scriptPath, err := createWrapperScript([]string{"/opt/my tools/adb", "shell"})
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(filepath.Dir(scriptPath)) })

	content, err := os.ReadFile(scriptPath)
	require.NoError(t, err)
	require.Contains(t, string(content), "'/opt/my tools/adb' shell")
}
