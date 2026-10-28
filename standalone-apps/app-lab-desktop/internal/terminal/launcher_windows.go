//go:build windows

package terminal

import (
	"errors"
	"io"
	"os/exec"
	"strings"
	"syscall"

	"golang.org/x/sys/windows"
)

// genericInvocations are used for the terminal emulators that are not known to
// the application, they cover the most common ways to run a command.
func genericInvocations() []invocation {
	return []invocation{
		{args: []string{"/C", "{cmd}"}},
		{args: []string{"/K", "{cmd}"}},
		{args: []string{"-e", "{cmd}"}},
	}
}

// genericTerminalIsConsole tells whether a terminal that is not known to the
// application is a console application. The generic invocations follow the
// cmd.exe conventions, so the terminal is expected to be a console application
// and it is started with a console window of its own.
const genericTerminalIsConsole = true

// newTerminalProcess creates the process that runs the given terminal.
//
// A console application (cmd.exe, powershell.exe, ...) needs a console window
// of its own: App Lab is a graphical application and has no console, so the
// terminal would run without a window to type in. The console is allocated by
// cmd.exe's "start" builtin and not by CreateProcess: a console created with
// CREATE_NEW_CONSOLE does not get the console handles, because the Go runtime
// always sets STARTF_USESTDHANDLES and fills the standard handles with the
// null device (syscall/exec_windows.go and os/exec/exec.go), so the shell
// would read EOF on its standard input and exit at once.
//
// The outer cmd.exe is started with CREATE_NO_WINDOW: it has no console of its
// own, so there is no window to flash and no hidden console that the new
// console could inherit. paths.NewProcess can not be used here, it sets
// SysProcAttr.HideWindow unconditionally (go-paths-helper/process_windows.go)
// and the Go runtime maps it to STARTF_USESHOWWINDOW|SW_HIDE, which makes the
// console window of the terminal invisible.
//
// The terminal is started through "start", so the outer cmd.exe exits right
// away: the output of the terminal is not available to the application any
// more and a failure of the terminal can not be reported. The previous
// implementation behaved the same way.
func newTerminalProcess(console bool, path string, args []string, stdout, stderr io.Writer) (terminalProcess, error) {
	if !console {
		cmd := exec.Command(path, args...)
		cmd.Stdout = stdout
		cmd.Stderr = stderr
		return cmd, nil
	}

	// The empty argument is the title of the window: "start" takes the first
	// quoted token as the title and would mistake the command for it.
	cmdArgs := append([]string{"/C", "start", "", path}, args...)
	cmd := exec.Command("cmd.exe", cmdArgs...)
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: windows.CREATE_NO_WINDOW}
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	return cmd, nil
}

// validateCustomCommand checks the command line of a custom terminal.
//
// The console terminals are started through "cmd.exe /C start", so the command
// line is parsed by cmd.exe: the characters that separate the commands would
// split it and run a second command.
func validateCustomCommand(command string) error {
	if strings.ContainsAny(command, "&|<>^%") {
		return errors.New("the terminal command contains a character that cmd.exe would interpret: & | < > ^ %")
	}
	return nil
}
