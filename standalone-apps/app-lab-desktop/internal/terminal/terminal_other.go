//go:build !linux && !darwin && !windows

package terminal

import (
	"errors"
	"fmt"
)

// terminalSelectionSupported tells if the user can pick the terminal emulator.
// On the platforms where the terminal is detected from the system the user can
// choose one, on the other platforms the terminal emulator is a fixed one.
const terminalSelectionSupported = false

// detectTerminals returns the terminal emulators installed on the system, on the
// platforms where the terminal is a fixed one there is nothing to detect.
func detectTerminals() []TerminalInfo {
	return []TerminalInfo{}
}

// lookupTerminal reports that no terminal emulator is known on this platform.
func lookupTerminal(candidate terminalCandidate) (string, error) {
	return "", fmt.Errorf("terminal not found: %s", candidate.ID)
}

// launchCandidate reports that no terminal emulator can be started on this
// platform.
func launchCandidate(candidate terminalCandidate, path string, ctx *launchContext, extraArgs []string) error {
	return fmt.Errorf("failed to start the terminal: %s", candidate.ID)
}

// openTerminal is not available on this platform, the terminal emulator is not
// known.
func openTerminal(opts Options, args ...string) (LaunchResult, error) {
	return LaunchResult{}, errors.New("open terminal is not supported on this platform")
}
