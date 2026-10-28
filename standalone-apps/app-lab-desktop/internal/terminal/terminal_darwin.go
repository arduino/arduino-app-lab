//go:build darwin

package terminal

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// terminalSelectionSupported tells if the user can pick the terminal emulator.
// On the platforms where the terminal is detected from the system the user can
// choose one, on the other platforms the terminal emulator is a fixed one.
const terminalSelectionSupported = true

// darwinTerminals are the terminal emulators known to the application, in the
// order they are tried when the user has not selected one.
//
// The applications that are not distributed as a command line tool are opened
// with "open -a" or with AppleScript, they run the wrapper script themselves.
var darwinTerminals = []terminalCandidate{
	{ID: "Terminal", Label: "Terminal", bundle: "Terminal", app: &appLaunch{
		command: "open",
		args:    []string{"-a", "Terminal", "{script}"},
	}},
	{ID: "iTerm", Label: "iTerm2", bundle: "iTerm", app: &appLaunch{
		command: "osascript",
		args:    []string{"-e", `tell application "iTerm" to create window with default profile command "sh {script}"`},
	}},
	{ID: "alacritty", Label: "Alacritty", bundle: "Alacritty", invocations: []invocation{
		{args: []string{"-e", "sh", "{cmd}"}},
		{args: []string{"--", "sh", "{cmd}"}},
	}},
	{ID: "kitty", Label: "Kitty", bundle: "kitty", invocations: []invocation{
		{args: []string{"sh", "{cmd}"}},
	}},
	{ID: "wezterm", Label: "WezTerm", bundle: "WezTerm", invocations: []invocation{
		{args: []string{"start", "--", "sh", "{cmd}"}},
	}},
	{ID: "ghostty", Label: "Ghostty", bundle: "Ghostty", invocations: []invocation{
		{args: []string{"-e", "sh", "{cmd}"}},
	}},
	{ID: "rio", Label: "Rio", bundle: "Rio", invocations: []invocation{
		{args: []string{"sh", "{cmd}"}},
	}},
}

// darwinSearchPaths are the directories where the terminal emulators are
// installed when they are not in the PATH, the applications installed with
// homebrew are not in the PATH of the applications launched from the desktop.
var darwinSearchPaths = []string{
	"/opt/homebrew/bin",
	"/usr/local/bin",
}

// detectTerminals returns the terminal emulators known to the application, in
// the order they are tried. The terminals that are not installed are reported
// too, so the user can tell that the terminal they selected is gone.
func detectTerminals() []TerminalInfo {
	detected := []TerminalInfo{}
	for _, candidate := range darwinTerminals {
		path, err := lookupTerminal(candidate)
		if err != nil {
			slog.Debug("terminal not installed", "terminal", candidate.ID)
			detected = append(detected, TerminalInfo{
				ID:    candidate.ID,
				Label: candidate.Label,
			})
			continue
		}
		detected = append(detected, TerminalInfo{
			ID:        candidate.ID,
			Label:     candidate.Label,
			Path:      path,
			Available: true,
		})
	}
	return detected
}

// lookupTerminal returns the path of the terminal, it looks for the executable
// in the PATH, in the directories where homebrew installs it and inside the
// application bundle.
func lookupTerminal(candidate terminalCandidate) (string, error) {
	if candidate.app != nil {
		// The application is opened with another command, it only has to exist.
		path := bundlePath(candidate.bundle)
		if path == "" {
			return "", fmt.Errorf("application not found: %s", candidate.bundle)
		}
		return path, nil
	}

	if path, err := exec.LookPath(candidate.ID); err == nil {
		return path, nil
	}
	for _, dir := range darwinSearchPaths {
		path := filepath.Join(dir, candidate.ID)
		if isExecutable(path) {
			return path, nil
		}
	}
	if candidate.bundle != "" {
		path := filepath.Join(bundlePath(candidate.bundle), "Contents", "MacOS", candidate.ID)
		if isExecutable(path) {
			return path, nil
		}
	}
	return "", fmt.Errorf("terminal not found: %s", candidate.ID)
}

// bundlePath returns the path of the application bundle, it is empty when the
// application is not installed.
func bundlePath(bundle string) string {
	if bundle == "" {
		return ""
	}
	home, err := os.UserHomeDir()
	if err != nil {
		home = ""
	}
	for _, dir := range []string{"/Applications", filepath.Join(home, "Applications")} {
		if dir == "" {
			continue
		}
		path := filepath.Join(dir, bundle+".app")
		if info, err := os.Stat(path); err == nil && info.IsDir() {
			return path
		}
	}
	return ""
}

// isExecutable tells if the given path is an executable file.
func isExecutable(path string) bool {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return false
	}
	return info.Mode()&0111 != 0
}

// launchCandidate starts the given terminal with the invocations it supports.
func launchCandidate(candidate terminalCandidate, path string, ctx *launchContext, extraArgs []string) error {
	launchCtx, err := prepareLaunch(candidate, ctx)
	if err != nil {
		return err
	}
	launchCtx.extraArgs = extraArgs

	if candidate.app != nil {
		args := make([]string, 0, len(candidate.app.args))
		for _, arg := range candidate.app.args {
			args = append(args, strings.ReplaceAll(arg, "{script}", escapeAppleScript(launchCtx.script)))
		}
		slog.Info("Trying opening terminal", "terminal", candidate.ID, "args", args)
		if err := runTerminal(candidate.console, candidate.app.command, args); err != nil {
			slog.Warn("[skip] start terminal", "terminal", candidate.ID, "args", args, "err", err)
			return fmt.Errorf("failed to start the terminal: %s", candidate.ID)
		}
		return nil
	}

	return launchInvocations(candidate, path, launchCtx)
}

// escapeAppleScript escapes a string so it can be used inside an AppleScript
// string literal.
func escapeAppleScript(value string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `"`, `\"`)
	return replacer.Replace(value)
}

// openTerminal opens the given command in a terminal emulator.
func openTerminal(opts Options, args ...string) (LaunchResult, error) {
	return openTerminalIn(darwinTerminals, opts, args...)
}
