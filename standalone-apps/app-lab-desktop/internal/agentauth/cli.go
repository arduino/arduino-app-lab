// Resolves and runs the agent CLI from the installed runtime (its node_modules/.bin shim,
// never npx / PATH) under the isolated environment.

package agentauth

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"sync"

	paths "github.com/arduino/go-paths-helper"

	"app-lab-desktop/internal/airuntime"
)

// RunCLIStreaming runs the agent CLI under the isolated environment, streaming stdout+stderr
// to onLine, serialized so callers see one line at a time (used to surface output such as the
// login URL). Spawned via go-paths-helper: no console window on Windows, and cancel kills the
// whole CLI tree (cmd.exe → node), not just the shim.
// A non-nil onStdin gets the CLI's stdin pipe, to answer prompts; nil stdin reads EOF at once.
func RunCLIStreaming(ctx context.Context, agent airuntime.AgentID, opts Options, onLine func(string), onStdin func(io.WriteCloser), args ...string) error {
	argv, err := cliCommand(agent)
	if err != nil {
		return err
	}
	env, err := IsolatedEnv(agent, opts)
	if err != nil {
		return err
	}
	argv = append(argv, args...)
	cmd, err := paths.NewProcess(nil, argv...)
	if err != nil {
		return err
	}
	cmd.SetEnvironment(env)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}
	var stdin io.WriteCloser
	if onStdin != nil {
		if stdin, err = cmd.StdinPipe(); err != nil {
			return err
		}
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	if onStdin != nil {
		onStdin(stdin) // left open: Wait closes it, so a late write fails instead of hanging
	}

	// Kill on cancel, armed for the whole run: the pipes are drained before Wait,
	// so a cancel mid-stream must still tear the tree down to unblock the scanners.
	watchDone := make(chan struct{})
	defer close(watchDone)
	go func() {
		select {
		case <-ctx.Done():
			_ = cmd.Kill()
		case <-watchDone:
		}
	}()

	var wg sync.WaitGroup
	var lineMu sync.Mutex // stdout+stderr are scanned concurrently; serialize onLine
	scan := func(r io.Reader) {
		defer wg.Done()
		sc := bufio.NewScanner(r)
		for sc.Scan() {
			lineMu.Lock()
			onLine(sc.Text())
			lineMu.Unlock()
		}
	}
	wg.Add(2)
	go scan(stdout)
	go scan(stderr)
	wg.Wait() // drain output before Wait, per exec.StdoutPipe docs

	if err := cmd.Wait(); err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return err
	}
	return nil
}

// cliCommand resolves the agent CLI from the installed runtime's node_modules/.bin shim.
func cliCommand(agent airuntime.AgentID) ([]string, error) {
	runtimeDir, err := airuntime.RuntimeDir(agent)
	if err != nil {
		return nil, err
	}
	p, err := profileFor(agent)
	if err != nil {
		return nil, err
	}
	shim := filepath.Join(runtimeDir, "node_modules", ".bin", p.cliBin)
	if runtime.GOOS == "windows" {
		shim += ".cmd"
	}
	if _, err := os.Stat(shim); errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("agentauth: CLI %q not installed in runtime (%s)", p.cliBin, shim)
	} else if err != nil {
		return nil, fmt.Errorf("agentauth: stat CLI %q (%s): %w", p.cliBin, shim, err)
	}
	return []string{shim}, nil
}
