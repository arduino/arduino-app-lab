//go:build linux

package terminal

import (
	"log/slog"
	"os/exec"
)

// terminalSelectionSupported tells if the user can pick the terminal emulator.
// On the platforms where the terminal is detected from the system the user can
// choose one, on the other platforms the terminal emulator is a fixed one.
const terminalSelectionSupported = true

// linuxTerminals are the terminal emulators known to the application, in the
// order they are tried when the user has not selected one.
var linuxTerminals = []terminalCandidate{
	{ID: "gnome-terminal", Label: "GNOME Terminal", invocations: []invocation{
		{args: []string{"--", "sh", "{cmd}"}},
	}},
	{ID: "konsole", Label: "Konsole", invocations: []invocation{
		{args: []string{"-e", "sh", "{cmd}"}},
		{args: []string{"-e", "{cmd}"}, singleArg: true},
	}},
	{ID: "xfce4-terminal", Label: "Xfce Terminal", invocations: []invocation{
		{args: []string{"-e", "{cmd}"}, singleArg: true},
	}},
	{ID: "mate-terminal", Label: "MATE Terminal", invocations: []invocation{
		// --disable-factory avoids GTK widget management issues:
		// error: "terminal_window_remove_screen: assertion 'gtk_widget_get_toplevel (GTK_WIDGET (screen)) == GTK_WIDGET (window)' failed\n"
		{args: []string{"--disable-factory", "-e", "{cmd}"}, singleArg: true},
	}},
	{ID: "ptyxis", Label: "Ptyxis", invocations: []invocation{
		{args: []string{"--", "sh", "{cmd}"}},
	}},
	{ID: "kgx", Label: "GNOME Console", invocations: []invocation{
		{args: []string{"-e", "{cmd}"}, singleArg: true},
		{args: []string{"--", "sh", "{cmd}"}},
	}},
	{ID: "alacritty", Label: "Alacritty", invocations: []invocation{
		{args: []string{"-e", "sh", "{cmd}"}},
		{args: []string{"--", "sh", "{cmd}"}},
	}},
	{ID: "kitty", Label: "Kitty", invocations: []invocation{
		{args: []string{"sh", "{cmd}"}},
	}},
	{ID: "ghostty", Label: "Ghostty", invocations: []invocation{
		{args: []string{"-e", "sh", "{cmd}"}},
	}},
	{ID: "wezterm", Label: "WezTerm", invocations: []invocation{
		{args: []string{"start", "--", "sh", "{cmd}"}},
	}},
	{ID: "foot", Label: "Foot", invocations: []invocation{
		{args: []string{"sh", "{cmd}"}},
	}},
	{ID: "tilix", Label: "Tilix", invocations: []invocation{
		{args: []string{"-e", "{cmd}"}, singleArg: true},
	}},
	{ID: "terminator", Label: "Terminator", invocations: []invocation{
		{args: []string{"-x", "{cmd}"}, singleArg: true},
		{args: []string{"-e", "{cmd}"}, singleArg: true},
	}},
	{ID: "lxterminal", Label: "LXTerminal", invocations: []invocation{
		{args: []string{"-e", "{cmd}"}, singleArg: true},
	}},
	{ID: "xterm", Label: "XTerm", invocations: []invocation{
		{args: []string{"-e", "sh", "{cmd}"}},
	}},
	{ID: "urxvt", Label: "URxvt", invocations: []invocation{
		{args: []string{"-e", "sh", "{cmd}"}},
	}},
	{ID: "st", Label: "Suckless Terminal", invocations: []invocation{
		{args: []string{"-e", "sh", "{cmd}"}},
	}},
	{ID: "qterminal", Label: "QTerminal", invocations: []invocation{
		{args: []string{"-e", "{cmd}"}, singleArg: true},
	}},
	{ID: "io.elementary.terminal", Label: "Elementary Terminal", invocations: []invocation{
		{args: []string{"-e", "{cmd}"}, singleArg: true},
	}},
	{ID: "deepin-terminal", Label: "Deepin Terminal", invocations: []invocation{
		{args: []string{"-e", "{cmd}"}, singleArg: true},
	}},
	{ID: "terminology", Label: "Terminology", invocations: []invocation{
		{args: []string{"-e", "{cmd}"}, singleArg: true},
	}},
	{ID: "cool-retro-term", Label: "Cool Retro Term", invocations: []invocation{
		{args: []string{"-e", "{cmd}"}, singleArg: true},
	}},
	// x-terminal-emulator is a link to another terminal, it is the last resort
	// because the terminal it points to may not accept the '-e' argument.
	{ID: "x-terminal-emulator", Label: "Default Terminal", invocations: []invocation{
		{args: []string{"-e", "{cmd}"}, singleArg: true},
		{args: []string{"-e", "sh", "{cmd}"}},
	}},
}

// detectTerminals returns the terminal emulators known to the application, in
// the order they are tried. The terminals that are not installed are reported
// too, so the user can tell that the terminal they selected is gone.
func detectTerminals() []TerminalInfo {
	detected := []TerminalInfo{}
	for _, candidate := range linuxTerminals {
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
	return launchInvocations(candidate, path, launchCtx)
}

// openTerminal opens the given command in a terminal emulator.
func openTerminal(opts Options, args ...string) (LaunchResult, error) {
	return openTerminalIn(linuxTerminals, opts, args...)
}
