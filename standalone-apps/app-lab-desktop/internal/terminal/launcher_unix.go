//go:build !windows

package terminal

import (
	"io"

	"github.com/arduino/go-paths-helper"
)

// genericInvocations are used for the terminal emulators that are not known to
// the application, they cover the most common ways to run a command.
func genericInvocations() []invocation {
	return []invocation{
		{args: []string{"-e", "{cmd}"}, singleArg: true},
		{args: []string{"-e", "sh", "{cmd}"}},
		{args: []string{"--", "sh", "{cmd}"}},
		{args: []string{"sh", "{cmd}"}},
	}
}

// genericTerminalIsConsole tells whether a terminal that is not known to the
// application is a console application. On unix the terminal is started
// directly, it opens its own window.
const genericTerminalIsConsole = false

// newTerminalProcess creates the process that runs the given terminal.
//
// paths.NewProcess is used because it starts the terminal in its own process
// group (go-paths-helper/process_unix.go), so the terminal is not killed when
// the application is interrupted.
//
// The console flag is only meaningful on windows, on unix every terminal opens
// its own window.
func newTerminalProcess(console bool, path string, args []string, stdout, stderr io.Writer) (terminalProcess, error) {
	cmd, err := paths.NewProcess(nil, append([]string{path}, args...)...)
	if err != nil {
		return nil, err
	}
	cmd.RedirectStdoutTo(stdout)
	cmd.RedirectStderrTo(stderr)
	return cmd, nil
}

// validateCustomCommand checks the command line of a custom terminal. On unix
// the arguments are given to the terminal as they are, without a shell, so
// there is nothing to reject.
func validateCustomCommand(command string) error {
	return nil
}
