package network

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

func extractPasswordArg(args []string) (string, []string) {
	var (
		passwordArg string
		rest        []string
	)
	for i, arg := range args {
		if arg != "password" {
			rest = append(rest, arg)
		}
		if arg == "password" && i+1 < len(args) {
			passwordArg = strings.TrimSpace(args[i+1])
			break
		}
	}
	return passwordArg, rest
}

type Manager struct {
	Timeout time.Duration
	Conn    remote.RemoteConn
}

func (m *Manager) run(ctx context.Context, args ...string) (string, error) {
	passwordArg, parsed := extractPasswordArg(args)
	if passwordArg != "" {
		cmd := m.Conn.GetCmd("nmcli", parsed...)
		stdin, stdout, stderr, closer, err := cmd.Interactive()
		if err != nil {
			stderrStr, _ := io.ReadAll(stderr)
			return "", fmt.Errorf("interactive exec failed: %w; stderr: %s", err, stderrStr)
		}

		// helper to handle resource closing and accumulate errors
		cleanup := func(prev error) error {
			if err := stdin.Close(); err != nil {
				prev = errors.Join(prev, fmt.Errorf("stdin close: failed: %w", err))
			}
			if err := closer(); err != nil {
				prev = errors.Join(prev, fmt.Errorf("nmcli exit: failed: %w", err))
			}
			return prev
		}

		if _, err = stdin.Write([]byte(passwordArg + "\n")); err != nil {
			return "", cleanup(fmt.Errorf("stdin write failed: %w", err))
		}

		out, err := io.ReadAll(stdout)
		if err != nil {
			return "", cleanup(fmt.Errorf("stdout read failed: %w", err))
		}

		if err := cleanup(nil); err != nil {
			return "", fmt.Errorf("nmcli exit error: %w; output: %s",
				err, strings.TrimSpace(string(out)))
		}

		return strings.TrimSpace(string(out)), nil
	}

	cmd := m.Conn.GetCmd("nmcli", parsed...)
	out, err := cmd.Output(ctx)
	if err != nil {
		return "", fmt.Errorf("output failed: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

func (m *Manager) withTimeout(ctx context.Context, args ...string) (string, error) {
	ctxTimeout, cancel := context.WithTimeout(ctx, m.Timeout)
	defer cancel()

	out, err := m.run(ctxTimeout, args...)
	if errors.Is(err, context.DeadlineExceeded) ||
		ctxTimeout.Err() == context.DeadlineExceeded ||
		ctx.Err() == context.DeadlineExceeded {
		return out, fmt.Errorf(
			"network manager command %q timed out after %s: %w",
			strings.Join(args, " "), m.Timeout, context.DeadlineExceeded,
		)
	}
	return out, err
}

func (m *Manager) Run(ctx context.Context, args ...string) (string, error) {
	return m.withTimeout(ctx, args...)
}

type RunUntilSuccessCfg struct {
	Command  []string
	Expected string
	Attempts int
}

func (m *Manager) RunUntilSuccess(ctx context.Context, cfg RunUntilSuccessCfg) error {
	var success bool
	for range cfg.Attempts {
		out, err := m.Run(ctx, cfg.Command...)
		if err != nil {
			return fmt.Errorf("failed to run nmcli %s command: %w", strings.Join(cfg.Command, " "), err)
		}
		if strings.Contains(string(out), cfg.Expected) {
			success = true
			break
		}
		time.Sleep(500 * time.Millisecond)
	}
	if !success {
		return fmt.Errorf(
			"nmcli command %q did not return expected output %q after %d attempts",
			strings.Join(cfg.Command, " "),
			cfg.Expected,
			cfg.Attempts,
		)
	}
	return nil
}
