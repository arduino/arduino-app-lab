package terminal

// The terminal emulators are described in a platform independent way, every
// platform provides its own list of candidates and the way they are started.

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	// startupTimeout is the time given to a terminal to report a failure. The
	// terminals that do not support the arguments they received exit
	// immediately with an error, the terminals that are working keep running
	// or exit successfully right away.
	startupTimeout = time.Second

	// startupPollInterval is how often the output of the terminal is checked
	// while it starts: a terminal that fails late still prints the reason of
	// the failure on its standard error.
	startupPollInterval = 50 * time.Millisecond

	// maxOutputSize is the maximum amount of output collected from a
	// terminal, the output is only used to report a failure.
	maxOutputSize = 64 * 1024
)

// invocation is a way to run a command inside a terminal emulator.
type invocation struct {
	// args are the arguments passed to the terminal, the "{cmd}" placeholder is
	// replaced by the command to run.
	args []string
	// singleArg makes the placeholder be expanded to a single argument, some
	// terminals accept only one string after the option used to run a command.
	singleArg bool
}

// terminalCandidate is a terminal emulator known to the application.
type terminalCandidate struct {
	// ID identifies the terminal, it is the name of the executable or of the
	// application bundle.
	ID string
	// Label is the human readable name of the terminal.
	Label string
	// bundle is the name of the application bundle of the terminal, it is used
	// to find the terminal outside of the PATH (macOS).
	bundle string
	// app is set for the terminals that are opened as an application (macOS),
	// they run the wrapper script themselves.
	app *appLaunch
	// invocations are the ways to run the command inside the terminal, they
	// are tried in order because every terminal has its own convention.
	invocations []invocation
	// rawCommand expands the placeholder with the command to run instead of
	// the wrapper script, it is used by the terminals that run the command
	// with a shell of their own (wsl).
	rawCommand bool
	// console marks the terminals that are console applications: they need a
	// console window of their own, a graphical application has none. On
	// windows they are started through "cmd.exe /C start", see
	// launcher_windows.go.
	console bool
}

// appLaunch describes how an application is opened with the wrapper script.
type appLaunch struct {
	// command is the executable used to open the application.
	command string
	// args are the arguments of the command, the "{script}" placeholder is
	// replaced by the path of the wrapper script.
	args []string
}

// launchContext holds the command to run inside the terminal.
type launchContext struct {
	// command are the arguments of the command to run.
	command []string
	// script is the path of the wrapper script, it is created the first time
	// a terminal that runs it is started.
	script string
	// extraArgs are the arguments added in front of the ones of the terminal.
	extraArgs []string
	// raw makes the terminal run the command with a shell of its own, the
	// wrapper script is not used.
	raw bool
}

// withExtraArgs returns a copy of the context with the given extra arguments.
func (c launchContext) withExtraArgs(extraArgs []string) launchContext {
	c.extraArgs = extraArgs
	return c
}

// ensureScript creates the wrapper script the first time it is needed and
// returns its path.
//
// The terminals that run the command with a shell of their own (wsl) do not
// need the script: creating it for them would leave a temporary directory
// behind on every launch.
func (c *launchContext) ensureScript() (string, error) {
	if c.script != "" {
		return c.script, nil
	}
	script, err := createWrapperScript(c.command)
	if err != nil {
		return "", err
	}
	c.script = script
	return script, nil
}

// terminalProcess is the process that runs a terminal emulator. It is
// implemented by *paths.Process and by *exec.Cmd, the two ways a process can
// be started on the supported platforms.
type terminalProcess interface {
	// Start starts the process.
	Start() error
	// Wait waits for the process to terminate and returns its error.
	Wait() error
}

// launchOutcome tells how the terminal was opened.
type launchOutcome struct {
	// terminal is the id of the terminal that was used.
	terminal string
	// warning tells why the terminal selected by the user was not used.
	warning string
}

// launchTerminals starts the terminal selected by the user, when none is
// selected the first terminal that can be started is used.
func launchTerminals(candidates []terminalCandidate, opts Options, ctx *launchContext) (launchOutcome, error) {
	outcome := launchOutcome{}
	if preferred := strings.TrimSpace(opts.PreferredTerminal); preferred != "" {
		result, err := launchPreferred(preferred, candidates, ctx)
		if err == nil {
			return result, nil
		}
		outcome.warning = fmt.Sprintf("the terminal selected in the settings could not be started: %s", shortError(err))
		slog.Warn("failed to start the selected terminal, falling back to the automatic detection", "terminal", preferred, "err", err)
	}

	tried := []string{}
	for _, candidate := range candidates {
		path, err := lookupTerminal(candidate)
		if err != nil {
			continue
		}
		tried = append(tried, candidate.ID)
		if err := launchCandidate(candidate, path, ctx, nil); err == nil {
			outcome.terminal = candidate.ID
			if outcome.warning != "" {
				// The user has to know which terminal was used instead of the
				// one they selected.
				outcome.warning = fmt.Sprintf("%s; %s was used instead", outcome.warning, candidate.Label)
			}
			return outcome, nil
		} else {
			slog.Warn("[skip] start terminal", "terminal", candidate.ID, "err", err)
		}
	}

	if len(tried) == 0 {
		return outcome, errors.New("no terminal emulator was found on this system: install one, or set a custom command in the settings")
	}
	return outcome, fmt.Errorf("no supported terminal found, tried: %s", strings.Join(tried, ", "))
}

// launchPreferred launches the terminal selected by the user. The selection is
// either the id of a known terminal or a custom command.
func launchPreferred(preferred string, candidates []terminalCandidate, ctx *launchContext) (launchOutcome, error) {
	if candidate, found := findCandidate(candidates, preferred); found {
		path, err := lookupTerminal(candidate)
		if err != nil {
			return launchOutcome{}, fmt.Errorf("terminal not found: %s", candidate.ID)
		}
		if err := launchCandidate(candidate, path, ctx, nil); err != nil {
			return launchOutcome{}, err
		}
		return launchOutcome{terminal: candidate.ID}, nil
	}

	fields, err := splitCommand(preferred)
	if err != nil {
		return launchOutcome{}, err
	}
	if len(fields) == 0 {
		return launchOutcome{}, errors.New("empty terminal command")
	}
	// The preference is stored in a file, it may have been edited after it
	// was validated.
	if err := validateCommandLine(preferred); err != nil {
		return launchOutcome{}, err
	}
	binary, extraArgs := fields[0], fields[1:]
	path, err := exec.LookPath(binary)
	if err != nil {
		return launchOutcome{}, fmt.Errorf("terminal not found: %s", binary)
	}
	slog.Info("Using the custom terminal command", "terminal", binary, "args", extraArgs)

	// A known terminal is launched with the arguments it expects, the extra
	// arguments given by the user are added in front of them.
	if candidate, found := findCandidate(candidates, binary); found {
		if err := launchCandidate(candidate, path, ctx, extraArgs); err != nil {
			return launchOutcome{}, err
		}
		return launchOutcome{terminal: candidate.ID}, nil
	}

	for _, inv := range genericInvocations() {
		args := expandInvocation(inv, ctx.withExtraArgs(extraArgs))
		slog.Info("Trying opening terminal", "terminal", binary, "args", args)
		if err := runTerminal(genericTerminalIsConsole, path, args); err == nil {
			return launchOutcome{terminal: binary}, nil
		} else {
			slog.Warn("[skip] start terminal", "terminal", binary, "args", args, "err", err)
		}
	}
	return launchOutcome{}, fmt.Errorf("failed to start the terminal: %s", binary)
}

// shortError returns the first line of an error message. The rest is the
// output of the terminal, which is too long for a notification.
func shortError(err error) string {
	message := strings.TrimSpace(err.Error())
	if index := strings.IndexAny(message, "\r\n"); index >= 0 {
		message = message[:index]
	}
	return message
}

// prepareLaunch returns the context to launch the given candidate with.
//
// The terminals that run the wrapper script need it: it is created the first
// time one of them is started. The terminals that run the command with a shell
// of their own (wsl) do not need it, creating it for them would leave a
// temporary directory behind on every launch.
func prepareLaunch(candidate terminalCandidate, ctx *launchContext) (launchContext, error) {
	launchCtx := *ctx
	if candidate.rawCommand {
		return launchCtx, nil
	}
	script, err := ctx.ensureScript()
	if err != nil {
		return launchCtx, err
	}
	launchCtx.script = script
	return launchCtx, nil
}

// launchInvocations starts the terminal with the invocations it supports, in
// order, until one of them works.
func launchInvocations(candidate terminalCandidate, path string, ctx launchContext) error {
	var lastErr error
	for _, inv := range candidate.invocations {
		args := expandInvocation(inv, ctx.withExtraArgs(mergeExtraArgs(inv, ctx.extraArgs)))
		slog.Info("Trying opening terminal", "terminal", candidate.ID, "args", args)
		if err := runTerminal(candidate.console, path, args); err == nil {
			return nil
		} else {
			lastErr = err
			slog.Warn("[skip] start terminal", "terminal", candidate.ID, "args", args, "err", err)
		}
	}
	if lastErr == nil {
		return fmt.Errorf("failed to start the terminal: %s", candidate.ID)
	}
	return lastErr
}

// openTerminalIn opens the given command in one of the given terminal
// emulators.
func openTerminalIn(candidates []terminalCandidate, opts Options, args ...string) (LaunchResult, error) {
	ctx := &launchContext{command: args}
	outcome, err := launchTerminals(candidates, opts, ctx)
	if err != nil {
		// The terminal was not started, the wrapper script will never run.
		if ctx.script != "" {
			os.RemoveAll(filepath.Dir(ctx.script))
		}
		return LaunchResult{}, err
	}
	return LaunchResult{
		Terminal: outcome.terminal,
		Warning:  outcome.warning,
	}, nil
}

// findCandidate returns the terminal with the given id.
func findCandidate(candidates []terminalCandidate, id string) (terminalCandidate, bool) {
	for _, candidate := range candidates {
		if candidate.ID == id {
			return candidate, true
		}
	}
	return terminalCandidate{}, false
}

// mergeExtraArgs returns the extra arguments to add in front of the invocation,
// they are skipped when the invocation already provides them (e.g. the user
// selected "wezterm start --" and the terminal already runs "start --").
func mergeExtraArgs(inv invocation, extraArgs []string) []string {
	if len(extraArgs) == 0 {
		return nil
	}
	if len(inv.args) >= len(extraArgs) {
		matches := true
		for i, arg := range extraArgs {
			if inv.args[i] != arg {
				matches = false
				break
			}
		}
		if matches {
			return nil
		}
	}
	return extraArgs
}

// expandInvocation replaces the placeholder of the invocation with the command
// to run.
func expandInvocation(inv invocation, ctx launchContext) []string {
	args := make([]string, 0, len(ctx.extraArgs)+len(inv.args)+2)
	args = append(args, ctx.extraArgs...)
	for _, arg := range inv.args {
		if !strings.Contains(arg, "{cmd}") {
			args = append(args, arg)
			continue
		}
		args = append(args, strings.ReplaceAll(arg, "{cmd}", ctx.commandText(inv)))
	}
	return args
}

// commandText returns the text that replaces the "{cmd}" placeholder of an
// invocation.
//
// A terminal that runs the command with a shell of its own (wsl) gets the
// command itself, quoted for that shell. The other terminals run the wrapper
// script: they get its path, or a single command string when they accept only
// one string after the option used to run a command.
func (c launchContext) commandText(inv invocation) string {
	if c.raw {
		return shellQuoteAll(c.command)
	}
	if inv.singleArg {
		return c.scriptCommand()
	}
	return c.script
}

// scriptCommand returns the command that runs the wrapper script, for the
// terminals that accept the command as a single string.
//
// The wrapper script is a unix shell script, it is run by "sh". The windows
// terminals run the batch file directly and never use this form.
func (c launchContext) scriptCommand() string {
	return "sh " + shellQuote(c.script)
}

// runTerminal starts the terminal and waits for it to report a failure. The
// terminal is started detached, so the application is not blocked until the
// terminal window is closed.
//
// console tells whether the terminal is a console application that needs a
// console window of its own, it only matters on windows.
func runTerminal(console bool, path string, args []string) error {
	output := &outputBuffer{limit: maxOutputSize}
	proc, err := newTerminalProcess(console, path, args, io.Discard, output)
	if err != nil {
		return err
	}

	if err := proc.Start(); err != nil {
		return err
	}

	exited := make(chan error, 1)
	go func() {
		exited <- proc.Wait()
	}()

	deadline := time.NewTimer(startupTimeout)
	defer deadline.Stop()
	ticker := time.NewTicker(startupPollInterval)
	defer ticker.Stop()

	for {
		select {
		case err := <-exited:
			if err == nil {
				// Some terminals exit successfully even when they failed to open
				// the window, in that case the error is reported on the stderr.
				if message := strings.TrimSpace(output.String()); isDisplayError(message) {
					return fmt.Errorf("failed to open the terminal window: %s", message)
				}
				// The terminal detached itself and the window is open.
				return nil
			}
			if message := strings.TrimSpace(output.String()); message != "" {
				return fmt.Errorf("%w: %s", err, message)
			}
			return err
		case <-ticker.C:
			// The terminal is still running, it may print the reason of the
			// failure a bit later.
			if message := strings.TrimSpace(output.String()); isDisplayError(message) {
				return fmt.Errorf("failed to open the terminal window: %s", message)
			}
		case <-deadline.C:
			// The terminal is running.
			if message := strings.TrimSpace(output.String()); isDisplayError(message) {
				return fmt.Errorf("failed to open the terminal window: %s", message)
			}
			return nil
		}
	}
}

// isDisplayError tells if the given output reports that the terminal could not
// open its window.
func isDisplayError(output string) bool {
	for _, marker := range []string{
		"cannot open display",
		"unable to open display",
		"failed to open display",
		"cannot connect to display",
	} {
		if strings.Contains(strings.ToLower(output), marker) {
			return true
		}
	}
	return false
}

// outputBuffer collects the output of a terminal. The terminal is polled
// while it starts, so the output is read while the process is still writing
// it.
type outputBuffer struct {
	mu    sync.Mutex
	buf   bytes.Buffer
	limit int
}

// Write collects the output, up to the limit of the buffer. The output beyond
// the limit is discarded, but it is always consumed: the terminal would block
// if nobody read its output.
func (b *outputBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.limit > 0 && b.buf.Len() < b.limit {
		remaining := b.limit - b.buf.Len()
		if len(p) > remaining {
			b.buf.Write(p[:remaining])
		} else {
			b.buf.Write(p)
		}
	}
	return len(p), nil
}

// String returns the output collected so far.
func (b *outputBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}
