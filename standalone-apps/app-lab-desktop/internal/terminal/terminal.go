package terminal

import (
	"app-lab-desktop/internal/board"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	oBoard "github.com/arduino/arduino-app-cli/pkg/board"

	"github.com/arduino/arduino-app-cli/pkg/board/remote/adb"
	"github.com/arduino/go-paths-helper"
)

func OpenTerminal(ctx context.Context, b *board.Board) error {
	if b == nil {
		return fmt.Errorf("no board selected")
	}

	switch b.Info.Protocol {
	case oBoard.SerialProtocol:
		err := openTerminalWithArgs([]string{adb.FindAdbPath(), "-s", b.Info.Serial, "shell"}...)
		if err != nil {
			return err
		}
	case oBoard.NetworkProtocol:
		err := openTerminalWithArgs([]string{"ssh", fmt.Sprintf("arduino@%s", b.Info.Address)}...)
		if err != nil {
			return err
		}
	default:
		return fmt.Errorf("open terminal not supported for protocol %s", b.Info.Protocol)
	}

	return nil
}

func openTerminalWithArgs(args ...string) error {
	switch runtime.GOOS {
	case "windows":
		cmdArgs := append([]string{"cmd.exe", "/C", "start", "cmd.exe", "/K"}, args...)
		cmd, err := paths.NewProcess(nil, cmdArgs...)
		if err != nil {
			slog.Error("failed to strt cmd.exe terminal", "err", err, "args", cmdArgs)
			return errors.New("fail to open terminal")
		}
		slog.Info("Opening terminal", "cmd", cmd.GetArgs())
		stdout, err := cmd.RunAndCaptureCombinedOutput(context.Background())
		if err != nil {
			slog.Error("failed to start terminal", "err", err, "cmd", cmd.GetArgs(), "output", string(stdout))
			return errors.New("fail to start terminal")
		}
	case "darwin":
		tmpScript := filepath.Join(os.TempDir(), "run_in_terminal.sh")
		scriptContent := fmt.Sprintf("#!/bin/sh\n%s", strings.Join(args, " "))
		err := os.WriteFile(tmpScript, []byte(scriptContent), 0700)
		if err != nil {
			slog.Error("failed to write file", "err", err, "path", tmpScript)
			return errors.New("fail to prepare opening terminal")
		}
		cmd, err := paths.NewProcess(nil, "open", "-a", "Terminal", tmpScript)
		if err != nil {
			slog.Error("failed to open terminal", "err", err, "path", tmpScript)
			return errors.New("fail to open terminal")
		}
		slog.Info("Opening terminal", "cmd", cmd.GetArgs())
		stdout, err := cmd.RunAndCaptureCombinedOutput(context.Background())
		if err != nil {
			slog.Error("failed to run terminal", "err", err, "cmd", cmd.GetArgs(), "output", string(stdout))
			return errors.New("fail to run terminal")
		}
	case "linux":
		return openLinuxTerminal(args...)
	default:
		return fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}
	return nil
}

// openLinuxTerminal detects and opens the most common Linux terminals with the args
func openLinuxTerminal(args ...string) error {
	commandStr := strings.Join(args, " ")

	// Create a temporary wrapper script that keeps the terminal open after command execution
	tmpScript := filepath.Join(os.TempDir(), "run_in_terminal_sh")
	scriptContent := fmt.Sprintf("#!/bin/sh\n%s\necho \"Press Enter to close...\"\nread dummy\n", commandStr)
	err := os.WriteFile(tmpScript, []byte(scriptContent), 0700)
	if err != nil {
		slog.Error("failed to write file", "err", err, "path", tmpScript)
		return errors.New("fail to create temporary script")
	}
	defer os.Remove(tmpScript)

	terminals := []struct {
		cmd []string
	}{
		{[]string{"gnome-terminal", "--", "sh", tmpScript}},
		{[]string{"xfce4-terminal", "-e", tmpScript}},
		{[]string{"konsole", "-e", tmpScript}},
		// mate-terminal with --disable-factory to avoid GTK widget management issues:
		// error: "terminal_window_remove_screen: assertion 'gtk_widget_get_toplevel (GTK_WIDGET (screen)) == GTK_WIDGET (window)' failed\n"
		{[]string{"mate-terminal", "--disable-factory", "-e", tmpScript}},
		// x-terminal-emulator is a link to another terminal. It could fail if the underline terminal does not accept the '-e' argument.
		{[]string{"x-terminal-emulator", "-e", tmpScript}},
	}

	for _, terminal := range terminals {
		cmd, err := paths.NewProcess(nil, terminal.cmd...)
		if err != nil {
			return err
		}
		slog.Info("Trying opening terminal", "command", terminal.cmd)
		stdout, err := cmd.RunAndCaptureCombinedOutput(context.Background())
		if err == nil {
			return nil
		} else {
			slog.Warn("[skip] start terminal", "command", terminal.cmd, "error", string(stdout))
		}
	}

	terminalNames := make([]string, 0, len(terminals))
	for _, t := range terminals {
		if len(t.cmd) > 0 {
			terminalNames = append(terminalNames, t.cmd[0])
		}
	}
	return fmt.Errorf("not supported terminal found: %s", strings.Join(terminalNames, ","))
}
