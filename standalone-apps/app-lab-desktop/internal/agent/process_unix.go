//go:build !windows

package agent

import (
	"os/exec"
	"syscall"
	"time"
)

type unixGroup struct{ pid int }

func newProcessGroup() processGroup { return &unixGroup{} }

func (*unixGroup) configure(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true} // own group (pgid == pid)
}

func (g *unixGroup) adopt(cmd *exec.Cmd) error {
	g.pid = cmd.Process.Pid
	return nil
}

// interrupt asks the whole group to stop with SIGTERM.
func (*unixGroup) interrupt(cmd *exec.Cmd) {
	_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM)
}

// terminate SIGKILLs the whole group (a negative pid addresses the group).
func (*unixGroup) terminate(cmd *exec.Cmd) error {
	return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
}

// drain waits while the group has a member left; zombies, which macOS refuses to signal, count as gone.
func (g *unixGroup) drain(deadline time.Time) {
	for g.pid != 0 && time.Now().Before(deadline) && syscall.Kill(-g.pid, 0) == nil {
		time.Sleep(drainPoll)
	}
}

// release kills what is left of the group once its leader is gone, as closing the job does on Windows: a crashed adapter's CLI would go on writing its transcript.
func (g *unixGroup) release() error {
	if g.pid == 0 {
		return nil
	}
	err := syscall.Kill(-g.pid, syscall.SIGKILL)
	g.pid = 0
	if err == syscall.ESRCH || err == syscall.EPERM {
		return nil // no member left, or only zombies, which macOS refuses to signal
	}
	return err
}
