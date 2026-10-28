//go:build windows

package terminal

import (
	"log/slog"
	"os/exec"
	"path/filepath"
	"strings"
)

// terminalSelectionSupported tells if the user can pick the terminal emulator.
// On the platforms where the terminal is detected from the system the user can
// choose one, on the other platforms the terminal emulator is a fixed one.
const terminalSelectionSupported = true

// windowsTerminals are the terminal emulators known to the application, in the
// order they are tried when the user has not selected one.
//
// The console applications need a console window of their own, the graphical
// ones open their own window.
var windowsTerminals = []terminalCandidate{
	{ID: "wt.exe", Label: "Windows Terminal", invocations: []invocation{
		{args: []string{"-w", "new", "cmd.exe", "/C", "{cmd}"}},
	}},
	{ID: "cmd.exe", Label: "Command Prompt", console: true, invocations: []invocation{
		{args: []string{"/C", "{cmd}"}},
	}},
	{ID: "powershell.exe", Label: "Windows PowerShell", console: true, invocations: []invocation{
		{args: []string{"-Command", "& '{cmd}'"}},
	}},
	{ID: "pwsh.exe", Label: "PowerShell", console: true, invocations: []invocation{
		{args: []string{"-Command", "& '{cmd}'"}},
	}},
	{ID: "ConEmu64.exe", Label: "ConEmu", invocations: []invocation{
		{args: []string{"-RunAs", "/cmd", "{cmd}"}},
	}},
	{ID: "tabby.exe", Label: "Tabby", invocations: []invocation{
		{args: []string{"run", "{cmd}"}},
	}},
	{ID: "alacritty.exe", Label: "Alacritty", invocations: []invocation{
		{args: []string{"-e", "cmd.exe", "/C", "{cmd}"}},
	}},
	// The Windows Subsystem for Linux runs the command with a linux shell, the
	// command is resolved inside the distribution instead of on windows.
	{ID: "wsl.exe", Label: "WSL", console: true, rawCommand: true, invocations: []invocation{
		{args: []string{"--", "sh", "-c", "{cmd}"}},
		{args: []string{"-e", "sh", "-c", "{cmd}"}},
	}},
}

// detectTerminals returns the terminal emulators known to the application, in
// the order they are tried. The terminals that are not installed are reported
// too, so the user can tell that the terminal they selected is gone.
func detectTerminals() []TerminalInfo {
	detected := []TerminalInfo{}
	for _, candidate := range windowsTerminals {
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

// lookupTerminal returns the path of the executable of the given terminal.
func lookupTerminal(candidate terminalCandidate) (string, error) {
	if candidate.app != nil {
		return "", nil
	}
	return exec.LookPath(candidate.ID)
}

// launchCandidate starts the given terminal with the invocations it supports.
func launchCandidate(candidate terminalCandidate, path string, ctx *launchContext, extraArgs []string) error {
	launchCtx, err := prepareLaunch(candidate, ctx)
	if err != nil {
		return err
	}
	launchCtx.extraArgs = extraArgs
	if candidate.rawCommand {
		// The command is run by a shell of the terminal, it is resolved there
		// and not on the host.
		launchCtx.command = remoteCommand(launchCtx.command)
		launchCtx.raw = true
	}
	return launchInvocations(candidate, path, launchCtx)
}

// remoteCommand returns the command to run inside a remote environment (wsl).
//
// The command is resolved inside the distribution: a windows path is
// translated into the path of the same file in the distribution (the drives
// are mounted under /mnt), so that the windows adb can be used from wsl too. A
// command that is not a path is resolved by its name, as the distribution does
// not have the windows PATH.
func remoteCommand(command []string) []string {
	if len(command) == 0 {
		return command
	}
	remote := make([]string, len(command))
	copy(remote, command)
	executable, translated := remoteExecutable(command[0])
	remote[0] = executable
	if !translated {
		slog.Warn("the command is resolved by name inside the distribution, it must be installed in it", "command", command[0])
	}
	return remote
}

// remoteExecutable returns the executable as it is resolved inside a wsl
// distribution and tells whether it could be translated.
func remoteExecutable(path string) (string, bool) {
	if translated, ok := wslPath(path); ok {
		return translated, true
	}
	name := filepath.Base(path)
	return strings.TrimSuffix(name, ".exe"), false
}

// wslPath translates a windows path into the path of the same file inside a
// wsl distribution, where the drives are mounted under /mnt.
func wslPath(path string) (string, bool) {
	volume := filepath.VolumeName(path)
	if volume == "" {
		return "", false
	}
	rest := strings.ReplaceAll(strings.TrimPrefix(path, volume), `\`, "/")
	return "/mnt/" + strings.ToLower(volume[:1]) + rest, true
}

// openTerminal opens the given command in a terminal emulator.
func openTerminal(opts Options, args ...string) (LaunchResult, error) {
	return openTerminalIn(windowsTerminals, opts, args...)
}
