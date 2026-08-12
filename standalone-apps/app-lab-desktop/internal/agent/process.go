package agent

import "os/exec"

// processGroup ties the agent and its descendants into one OS group so the whole
// tree dies together (POSIX process group on Unix, Job Object on Windows).
type processGroup interface {
	configure(cmd *exec.Cmd)
	adopt(cmd *exec.Cmd) error
	// interrupt asks the tree to stop where the OS offers a signal for it. Best-effort and possibly a no-op (Windows has
	// none for a windowless child): closing the child's stdin is the portable graceful path and Stop always does that,
	// so the grace period is given regardless of what happens here.
	interrupt(cmd *exec.Cmd)
	terminate(cmd *exec.Cmd) error // forceful: kill the whole tree
	release() error
}
