//go:build windows

package agent

import (
	"fmt"
	"os/exec"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

// windowsGroup binds the process and its descendants to a Job Object with
// KILL_ON_JOB_CLOSE, so closing the job tears down the whole tree.
type windowsGroup struct {
	job windows.Handle
}

func newProcessGroup() processGroup { return &windowsGroup{} }

func (g *windowsGroup) configure(cmd *exec.Cmd) {
	// A GUI parent otherwise pops a console window for the node child.
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}

func (g *windowsGroup) adopt(cmd *exec.Cmd) error {
	job, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return fmt.Errorf("create job object: %w", err)
	}
	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{
		BasicLimitInformation: windows.JOBOBJECT_BASIC_LIMIT_INFORMATION{
			LimitFlags: windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
		},
	}
	if _, err = windows.SetInformationJobObject(job, windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)), uint32(unsafe.Sizeof(info))); err != nil {
		windows.CloseHandle(job)
		return fmt.Errorf("set job limits: %w", err)
	}
	h, err := windows.OpenProcess(windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE, false, uint32(cmd.Process.Pid))
	if err != nil {
		windows.CloseHandle(job)
		return fmt.Errorf("open process: %w", err)
	}
	defer windows.CloseHandle(h)
	if err = windows.AssignProcessToJobObject(job, h); err != nil {
		windows.CloseHandle(job)
		return fmt.Errorf("assign to job: %w", err)
	}
	g.job = job
	return nil
}

// interrupt is a no-op here: a windowless child has no console for CTRL_BREAK and Windows has no SIGTERM. The graceful
// path is closing the child's stdin, which Agent.Stop does on every platform before falling back to terminate.
func (g *windowsGroup) interrupt(*exec.Cmd) {}

func (g *windowsGroup) terminate(cmd *exec.Cmd) error {
	if g.job == 0 {
		// adopt() failed or never ran, so there is no job to kill — but the process was started and would otherwise be
		// left running. Kill it directly: that covers the child, though without the job not any descendants it spawned.
		if cmd != nil && cmd.Process != nil {
			return cmd.Process.Kill()
		}
		return nil
	}
	return windows.TerminateJobObject(g.job, 1)
}

func (g *windowsGroup) release() error {
	if g.job == 0 {
		return nil
	}
	err := windows.CloseHandle(g.job)
	g.job = 0
	return err
}
