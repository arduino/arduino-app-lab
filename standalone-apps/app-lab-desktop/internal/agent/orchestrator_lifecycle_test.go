//go:build !windows

package agent

import (
	"bufio"
	"context"
	"io"
	"os"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"
)

// The core guarantee: Stop must tear down the entire tree, not just the
// direct child. The shell spawns a background sleep, prints its pid, then waits;
// after Stop that grandchild must be gone.
func TestStopKillsProcessTree(t *testing.T) {
	loc := StaticLocator{
		NodePath:     "/bin/sh",
		AdapterEntry: "-c",
		ExtraArgs:    []string{"sleep 30 & echo $!; wait"},
	}
	a := New(Config{Locator: loc})

	_, stdout, err := a.Start(context.Background())
	if err != nil {
		t.Fatalf("start: %v", err)
	}

	grandchild := readFirstPid(t, stdout)
	if err := a.Stop(); err != nil {
		t.Fatalf("stop: %v", err)
	}
	if !waitGone(grandchild, time.Second) {
		t.Fatalf("grandchild pid %d survived Stop", grandchild)
	}
	if a.Running() {
		t.Fatal("agent still reports running after Stop")
	}
}

func readFirstPid(t *testing.T, r io.Reader) int {
	t.Helper()
	line, err := bufio.NewReader(r).ReadString('\n')
	if err != nil {
		t.Fatalf("read pid: %v", err)
	}
	pid, err := strconv.Atoi(strings.TrimSpace(line))
	if err != nil {
		t.Fatalf("parse pid %q: %v", line, err)
	}
	return pid
}

// waitGone reports whether pid disappears within timeout (signal 0 probes it).
func waitGone(pid int, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if err := syscall.Kill(pid, 0); err != nil {
			return true
		}
		time.Sleep(20 * time.Millisecond)
	}
	return false
}

// A crash ends the tree too: a crashed adapter's CLI left running would go on writing to the chat's transcript.
func TestACrashKillsTheRestOfTheProcessTree(t *testing.T) {
	exited := make(chan struct{}, 1)
	// The grandchild's output goes elsewhere, as the CLI's does: Wait returns with the crash, not waitDelay later.
	a := New(Config{
		Locator: StaticLocator{NodePath: "/bin/sh", AdapterEntry: "-c", ExtraArgs: []string{"sleep 30 >/dev/null 2>&1 & echo $!; read line; exit 1"}},
		OnExit:  func(ExitInfo) { exited <- struct{}{} },
	})
	stdin, stdout, err := a.Start(context.Background())
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	grandchild := readFirstPid(t, stdout)
	crashed := time.Now()
	_, _ = io.WriteString(stdin, "crash\n")
	select {
	case <-exited:
	case <-time.After(3 * time.Second):
		t.Fatal("the crash was never reported")
	}
	if !waitGone(grandchild, time.Second) {
		_ = syscall.Kill(grandchild, syscall.SIGKILL)
		t.Fatalf("grandchild pid %d survived the crash of its parent", grandchild)
	}
	if took := time.Since(crashed); took > time.Second {
		t.Errorf("the grandchild went %s after the crash, want at once: nothing is left to stop gracefully", took)
	}
}

// A normal Stop gives what the adapter started its own SIGTERM shutdown, though nothing of it holds App Lab's pipes: so is the Claude CLI.
func TestStopGivesTheAdaptersChildrenTheirGrace(t *testing.T) {
	finished := t.TempDir() + "/finished"
	script := `sh -c 'trap "sleep 1; touch ` + finished + `; exit 0" TERM; echo $$; exec >/dev/null 2>&1; while :; do sleep 0.1; done' & cat`
	a := New(Config{Locator: StaticLocator{NodePath: "/bin/sh", AdapterEntry: "-c", ExtraArgs: []string{script}}})
	_, stdout, err := a.Start(context.Background())
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	grandchild := readFirstPid(t, stdout)
	t.Cleanup(func() { _ = syscall.Kill(grandchild, syscall.SIGKILL) })
	start := time.Now()
	if err := a.Stop(); err != nil {
		t.Fatalf("stop: %v", err)
	}
	took := time.Since(start)
	if _, err := os.Stat(finished); err != nil {
		t.Errorf("Stop returned after %s, before the grandchild's TERM handler finished", took)
	}
	if took > groupGrace+500*time.Millisecond {
		t.Errorf("Stop took %s, want at most the grace", took)
	}
	if !waitGone(grandchild, time.Second) {
		t.Errorf("grandchild pid %d survived Stop", grandchild)
	}
}

// What ignores Stop's SIGTERM still goes, once the grace is over, whether or not it holds App Lab's pipes.
func TestStopKillsADescendantThatIgnoresSIGTERM(t *testing.T) {
	// The grandchild prints its pid only once its trap is set, so Stop's SIGTERM cannot land before it.
	for name, script := range map[string]string{
		"holds App Lab's pipes": `sh -c 'trap "" TERM; echo $$; exec sleep 30' & cat`,
		"has pipes of its own":  `sh -c 'trap "" TERM; echo $$; exec sleep 30 >/dev/null 2>&1' & cat`,
	} {
		t.Run(name, func(t *testing.T) {
			a := New(Config{Locator: StaticLocator{NodePath: "/bin/sh", AdapterEntry: "-c", ExtraArgs: []string{script}}})
			_, stdout, err := a.Start(context.Background())
			if err != nil {
				t.Fatalf("start: %v", err)
			}
			grandchild := readFirstPid(t, stdout)
			start := time.Now()
			if err := a.Stop(); err != nil {
				t.Fatalf("stop: %v", err)
			}
			if took := time.Since(start); took > groupGrace+time.Second {
				t.Errorf("Stop took %s, want about the grace", took)
			}
			if !waitGone(grandchild, time.Second) {
				_ = syscall.Kill(grandchild, syscall.SIGKILL)
				t.Fatalf("grandchild pid %d survived Stop", grandchild)
			}
		})
	}
}

// Stop's graceful path is closing the child's stdin: it is the only one Windows has, and it lets a well-behaved
// adapter finish writing instead of being killed mid-message.
func TestStopClosesStdinToStopGracefully(t *testing.T) {
	// SIGTERM is trapped away (children inherit an ignored signal), so only the stdin EOF can end this quickly —
	// otherwise the test would pass on interrupt's SIGTERM alone and prove nothing about the portable path.
	a := New(Config{Locator: StaticLocator{NodePath: "/bin/sh", AdapterEntry: "-c", ExtraArgs: []string{"trap '' TERM; echo ready; cat"}}})
	_, stdout, err := a.Start(context.Background())
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	// Wait for the trap to be in place, or Stop's SIGTERM could win the race and kill the shell before it is.
	if line, err := bufio.NewReader(stdout).ReadString('\n'); err != nil || strings.TrimSpace(line) != "ready" {
		t.Fatalf("child never signalled readiness (line=%q err=%v)", line, err)
	}

	start := time.Now()
	if err := a.Stop(); err != nil {
		t.Fatalf("stop: %v", err)
	}
	// Well inside shutdownGrace: without the stdin close we'd only exit via the forceful kill that follows it.
	if elapsed := time.Since(start); elapsed >= shutdownGrace {
		t.Fatalf("Stop took %s; the child should have exited on stdin EOF, not been killed", elapsed)
	}
	if a.Running() {
		t.Fatal("the agent must be stopped")
	}
}

// Note: the WaitDelay / bounded-wait guards have no test here. Reproducing them needs a descendant that both holds the
// inherited stderr pipe and escapes the process group (otherwise terminate's group kill closes the pipe anyway), which
// isn't portable to write — a test without setsid passes with or without the guards, so it would only look like cover.
