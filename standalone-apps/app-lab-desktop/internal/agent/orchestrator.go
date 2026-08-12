package agent

import (
	"context"
	"errors"
	"io"
	"os/exec"
	"sync"
	"time"
)

const (
	stderrBufferSize = 64 * 1024
	shutdownGrace    = 3 * time.Second
	// waitDelay bounds how long cmd.Wait lingers after the process exits, waiting on the stderr-copy goroutine. A
	// descendant that inherited the stderr pipe (the adapter spawns the engine, which spawns more) holds it open, and
	// without a delay Wait blocks on it forever — which during Shutdown hangs the quit.
	waitDelay = 2 * time.Second
	// waitTimeout bounds Stop's own wait for the process to be reaped. Kept short: with shutdownGrace it caps teardown at ~5s, under any host's own shutdown budget.
	waitTimeout = 2 * time.Second
)

// ExitInfo describes an unexpected agent exit, passed to the crash callback.
type ExitInfo struct {
	Err    error
	Stderr string
}

type Config struct {
	Locator RuntimeLocator
	Env     []string       // child env for the adapter; nil → ChildEnv() default
	OnExit  func(ExitInfo) // called only on an unexpected exit
}

// Agent spawns and supervises the ACP adapter subprocess.
type Agent struct {
	cfg Config

	mu       sync.Mutex
	cmd      *exec.Cmd
	pg       processGroup
	stdin    io.WriteCloser // kept so Stop can close it: EOF on stdin is the portable graceful stop
	stderr   *ringBuffer
	done     chan struct{}
	stopping bool
}

func New(cfg Config) *Agent { return &Agent{cfg: cfg} }

// Start launches the adapter and returns its stdio for the ACP client. The
// process is tied to ctx (cancelling ctx kills the whole tree).
func (a *Agent) Start(ctx context.Context) (stdin io.WriteCloser, stdout io.ReadCloser, err error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.cmd != nil {
		return nil, nil, errors.New("agent already running")
	}

	path, args, err := a.cfg.Locator.Command()
	if err != nil {
		return nil, nil, err
	}
	// Tool restrictions travel in-band via the session _meta (see acpconn), not CLI flags the adapter ignores.

	cmd := exec.CommandContext(ctx, path, args...)
	cmd.WaitDelay = waitDelay // a descendant holding the stderr pipe must not keep Wait (and Shutdown) blocked
	cmd.Env = a.cfg.Env
	if cmd.Env == nil {
		cmd.Env = ChildEnv() // default allow-list when the host provides no isolated env
	}
	pg := newProcessGroup()
	pg.configure(cmd)
	cmd.Cancel = func() error { return pg.terminate(cmd) }

	if stdin, err = cmd.StdinPipe(); err != nil {
		return nil, nil, err
	}
	if stdout, err = cmd.StdoutPipe(); err != nil {
		_ = stdin.Close()
		return nil, nil, err
	}
	a.stderr = newRingBuffer(stderrBufferSize)
	cmd.Stderr = a.stderr

	if err = cmd.Start(); err != nil {
		_ = stdin.Close()
		_ = stdout.Close()
		return nil, nil, err
	}
	if err = pg.adopt(cmd); err != nil {
		_ = pg.terminate(cmd)
		_ = stdin.Close()
		_ = stdout.Close()
		return nil, nil, err
	}

	a.cmd, a.pg, a.stdin, a.done, a.stopping = cmd, pg, stdin, make(chan struct{}), false
	go a.supervise(cmd, pg, a.done)
	return stdin, stdout, nil
}

// supervise waits for the process; on an unexpected exit it frees the process
// group and reports the crash. (On an intentional Stop, Stop owns the teardown.)
func (a *Agent) supervise(cmd *exec.Cmd, pg processGroup, done chan struct{}) {
	waitErr := cmd.Wait()
	// WaitDelay reports itself when a descendant held the stderr pipe past the process's own exit — that says nothing about why the agent stopped, so don't report it as the crash cause.
	if errors.Is(waitErr, exec.ErrWaitDelay) {
		waitErr = nil
	}
	close(done)

	a.mu.Lock()
	stopping, stderr := a.stopping, a.stderr.String()
	a.cmd, a.stdin = nil, nil
	a.mu.Unlock()

	if stopping {
		return
	}
	_ = pg.release()
	if a.cfg.OnExit != nil {
		a.cfg.OnExit(ExitInfo{Err: waitErr, Stderr: stderr})
	}
}

// Stop tears down the whole subprocess tree: gracefully first, then forcefully after a grace period.
//
// The graceful step closes the child's stdin — the ACP adapter's read loop sees EOF and exits. That is the portable
// one, and on Windows the only one (a windowless child has no SIGTERM), where teardown was therefore always a hard
// TerminateJobObject that killed the adapter mid-write. It also unwedges an adapter that stopped answering but is
// still reading. Where the OS has a signal, interrupt sends it too. Every wait is bounded: an unresponsive child
// must not turn app shutdown into a hang.
func (a *Agent) Stop() error {
	a.mu.Lock()
	if a.cmd == nil {
		a.mu.Unlock()
		return nil
	}
	a.stopping = true
	cmd, pg, done, stdin := a.cmd, a.pg, a.done, a.stdin
	a.mu.Unlock()

	if stdin != nil {
		_ = stdin.Close()
	}
	pg.interrupt(cmd)
	select {
	case <-done:
		return pg.release()
	case <-time.After(shutdownGrace):
	}
	_ = pg.terminate(cmd)
	select {
	case <-done:
	case <-time.After(waitTimeout):
		// Not reaped in time. Releasing anyway is the lesser evil: on Windows closing the job handle is itself what
		// kills the tree (KILL_ON_JOB_CLOSE), and blocking here would hang the quit.
	}
	return pg.release()
}

func (a *Agent) Running() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.cmd != nil
}
