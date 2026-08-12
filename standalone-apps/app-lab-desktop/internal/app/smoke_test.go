package app

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"app-lab-desktop/internal/agent"
	"app-lab-desktop/internal/agentauth"
	"app-lab-desktop/internal/airuntime"
)

// TestACPSmoke drives a real round-trip against the installed adapter via the production path; opt-in with ACP_SMOKE=1.
func TestACPSmoke(t *testing.T) {
	if os.Getenv("ACP_SMOKE") != "1" {
		t.Skip("set ACP_SMOKE=1 to run the live ACP smoke (needs an installed, signed-in runtime)")
	}
	id := airuntime.AgentClaude

	rt, err := airuntime.New(id)
	if err != nil {
		t.Fatalf("airuntime.New: %v", err)
	}
	ctx := context.Background()
	if st, err := rt.Status(ctx); err != nil {
		t.Fatalf("runtime status: %v", err)
	} else if !st.Installed {
		t.Skip("runtime not installed — run RuntimeInstall + sign in first")
	}

	env, err := agentauth.IsolatedEnv(id, agentauth.Options{Method: agentauth.None})
	if err != nil {
		t.Fatalf("isolated env: %v", err)
	}

	var mu sync.Mutex
	var reply strings.Builder
	perms := 0

	var mgr *agent.Manager
	mgr = agent.NewManager(
		agent.New(agent.Config{Locator: runtimeLocator{agentID: id}, Env: env}),
		agent.DefaultConnFactory,
		agent.ManagerConfig{
			OnUpdate: func(_ agent.SessionID, u agent.Update) {
				if u.Type == "message_chunk" {
					mu.Lock()
					reply.WriteString(u.Delta)
					mu.Unlock()
				}
			},
			OnPermission: func(req agent.PermissionRequest) {
				mu.Lock()
				perms++
				mu.Unlock()
				mgr.ReplyPermission(req.ID, agent.PermissionOutcome{Cancelled: true}) // deny so nothing blocks
			},
		},
	)

	startCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if err := mgr.Start(startCtx); err != nil {
		t.Fatalf("manager start: %v", err)
	}
	defer func() { _ = mgr.Stop() }()

	ws, err := airuntime.WorkspaceDir()
	if err != nil {
		t.Fatalf("workspace dir: %v", err)
	}
	if err := os.MkdirAll(ws, 0o755); err != nil {
		t.Fatalf("mkdir workspace: %v", err)
	}

	// round-trip: a prompt yields a streamed reply.
	sid, err := mgr.NewSession(ctx, ws)
	if err != nil {
		t.Fatalf("new session: %v", err)
	}
	promptCtx, cancel2 := context.WithTimeout(ctx, 90*time.Second)
	defer cancel2()
	if err := mgr.Prompt(promptCtx, sid, "Reply with exactly the word PONG and nothing else."); err != nil {
		t.Fatalf("prompt: %v", err)
	}
	mu.Lock()
	got := reply.String()
	mu.Unlock()
	if strings.TrimSpace(got) == "" {
		t.Fatal("round-trip failed: no streamed response")
	}
	t.Logf("round-trip ok — reply %q (permission requests seen: %d)", got, perms)

	// tool policy: Bash is disallowed via the session _meta, so an explicit shell write must not land on disk.
	sentinel := filepath.Join(ws, "smoke-should-not-exist.txt")
	_ = os.Remove(sentinel)
	sid2, err := mgr.NewSession(ctx, ws)
	if err != nil {
		t.Fatalf("new session (policy): %v", err)
	}
	policyCtx, cancel3 := context.WithTimeout(ctx, 90*time.Second)
	defer cancel3()
	if err := mgr.Prompt(policyCtx, sid2, "Use the Bash tool to run exactly: echo PWNED > smoke-should-not-exist.txt"); err != nil {
		t.Fatalf("prompt (policy): %v", err)
	}
	if _, err := os.Stat(sentinel); err == nil {
		_ = os.Remove(sentinel)
		t.Errorf("tool-policy breach: %s was written — Bash ran despite the disallow list", sentinel)
	} else {
		t.Logf("tool policy ok — Bash write was blocked")
	}
}

// TestLoginStdinSmoke proves the CLI still reads a piped stdin and still words a refusal as loginCodeRejected expects; opt-in with LOGIN_SMOKE=1.
func TestLoginStdinSmoke(t *testing.T) {
	if os.Getenv("LOGIN_SMOKE") != "1" {
		t.Skip("set LOGIN_SMOKE=1 to run the live login smoke (needs an installed runtime; opens a browser tab)")
	}
	id := airuntime.AgentClaude
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	rt, err := airuntime.New(id)
	if err != nil {
		t.Fatalf("airuntime.New: %v", err)
	}
	if st, err := rt.Status(ctx); err != nil {
		t.Fatalf("runtime status: %v", err)
	} else if !st.Installed {
		t.Skip("runtime not installed — run RuntimeInstall first")
	}

	var urlOnce, rejectOnce sync.Once
	sawURL, rejected := make(chan struct{}), make(chan struct{})
	onLine := func(line string) {
		if loginURL(line) != "" {
			urlOnce.Do(func() { close(sawURL) })
			return
		}
		if loginCodeRejected(line) {
			rejectOnce.Do(func() { close(rejected) })
		}
	}
	stdinCh := make(chan io.WriteCloser, 1)

	done := make(chan error, 1)
	go func() {
		done <- agentauth.RunCLIStreaming(ctx, id,
			agentauth.Options{Method: agentauth.None, ConfigDir: t.TempDir()},
			onLine, func(w io.WriteCloser) { stdinCh <- w },
			"auth", "login", "--claudeai")
	}()

	var stdin io.WriteCloser
	select {
	case stdin = <-stdinCh:
	case err := <-done:
		t.Fatalf("login CLI never handed over its stdin: %v", err)
	case <-time.After(30 * time.Second):
		t.Fatal("login CLI never started")
	}
	select {
	case <-sawURL:
	case <-time.After(30 * time.Second):
		t.Fatal("login CLI printed no OAuth URL")
	}

	if _, err := stdin.Write([]byte("smoke-test-deliberately-invalid-code\n")); err != nil {
		t.Fatalf("writing a code to the login CLI's stdin: %v", err)
	}
	select {
	case <-rejected:
	case err := <-done:
		t.Fatalf("login CLI exited (%v) instead of answering the code — check whether it still prompts when stdin is a pipe", err)
	case <-time.After(60 * time.Second):
		t.Fatal("login CLI never answered the code: it may no longer read a piped stdin, or loginCodeRejected no longer matches its wording")
	}

	cancel()
	<-done
}
