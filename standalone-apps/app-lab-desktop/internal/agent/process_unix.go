//go:build !windows

package agent

import (
	"os/exec"
	"syscall"
)

type unixGroup struct{}

func newProcessGroup() processGroup { return unixGroup{} }

func (unixGroup) configure(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true} // own group (pgid == pid)
}

func (unixGroup) adopt(*exec.Cmd) error { return nil }

// interrupt asks the whole group to stop with SIGTERM.
func (unixGroup) interrupt(cmd *exec.Cmd) {
	_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM)
}

// terminate SIGKILLs the whole group (a negative pid addresses the group).
func (unixGroup) terminate(cmd *exec.Cmd) error {
	return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
}

func (unixGroup) release() error { return nil }
