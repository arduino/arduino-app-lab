# agent — the AI coding-agent backend

This package runs the AI coding agent and talks to it over **ACP** (Agent Client
Protocol). It spawns the agent CLI (an "ACP adapter") as a subprocess, supervises
it, and drives the conversation — sessions, streaming prompts, cancellation,
tool-permission requests — behind a small Go API that the desktop app's Wails
layer binds to the webview.

It lives in Go because the webview can't spawn subprocesses or speak stdio.

**Agent-agnostic by design.** ACP is vendor-neutral, so the core
(`Agent` → `Manager` → `AgentConn`) works for any ACP agent. Claude is the first
(via its adapter); others (e.g. Gemini, which speaks ACP natively) plug in by
supplying their launch command, disallowed-tools list, and config-dir env — the only
agent-specific knobs. A pluggable registry + a second agent come later (Phase 5).

## How to read this package

Top-down, following the layers:

1. **`orchestrator.go`** — `Agent`: owns the OS process (spawn, supervise, tear
   down the whole tree, crash hook). Start here.
2. **`manager.go`** — `Manager`: sits on top of `Agent` and runs the ACP
   conversation. This is the entry point for callers.
3. **`conn.go`** — the seam between the two worlds: `AgentConn` (what the Manager
   calls), `ClientHandler` (callbacks back into the Manager), `ConnFactory`.
4. **`acpconn.go`** — the only file that imports the ACP SDK; implements `AgentConn`.

Everything else is a focused helper (process groups, ring buffer, permission
registry, tool policy, shared types).

## Layout

| File | Responsibility |
|------|----------------|
| `orchestrator.go` | `Agent`: spawn + supervise the subprocess, tree teardown, crash hook |
| `process.go` | `processGroup` interface — OS abstraction for killing the whole tree |
| `process_unix.go` | POSIX process-group impl (`setpgid`, signal the group) — `//go:build !windows` |
| `process_windows.go` | Windows Job Object impl (`KILL_ON_JOB_CLOSE`) — `//go:build windows` |
| `ringbuffer.go` | bounded stderr buffer kept for crash diagnostics |
| `runtime.go` | `RuntimeLocator` (resolves the adapter command) + `StaticLocator` placeholder |
| `toolpolicy.go` | `nativeMutatingTools`: engine tools disallowed via the session `_meta` (Claude-specific) |
| `manager.go` | `Manager`: sessions, prompts, cancel, permission routing, auto-restart |
| `conn.go` | `AgentConn` / `ClientHandler` / `ConnFactory` — the SDK seam |
| `permission.go` | permission request↔reply registry (waits for the UI reply; optional timeout-to-deny, off in production) |
| `types.go` | domain types shared with the frontend (JSON-tagged) |
| `acpconn.go` | ACP-SDK-backed `AgentConn` (`NewSDKConn`) — the only SDK importer |
| `*_test.go` | unit tests for the security-critical paths |

## Layering

```
caller (desktop app / smoke harness)
   │  builds Agent, then Manager(agent, connFactory, cfg)
   ▼
Manager ── ACP conversation: sessions, prompts, cancel, permissions, auto-restart
   │  composes
   ├─▶ Agent (orchestrator) ── owns the OS process and its whole tree
   │       ├─ processGroup     (unix process group | windows job object)
   │       └─ RuntimeLocator   (where the adapter binary is)
   └─▶ AgentConn (via ConnFactory) ── the actual ACP protocol
           └─ sdkConn (acpconn.go) wraps the SDK; disallows mutating tools via session _meta
   ▲
   └── callbacks (ClientHandler): updates + permission requests flow back up
```

Two boundaries carry the design:

- **`Agent` vs `Manager`** — `Agent` knows nothing about ACP (just a process and
  its stdio); `Manager` knows nothing about OS process internals. They compose.
- **The SDK is contained** — only `acpconn.go` imports `coder/acp-go-sdk`, behind
  the `AgentConn` interface, so tests inject a fake conn (never the real SDK) and
  the pre-1.0 SDK can churn without rippling into the rest of the package.

## Public API

```go
ag := agent.New(agent.Config{Locator: loc})        // the process owner
mgr := agent.NewManager(ag, agent.NewSDKConn, agent.ManagerConfig{
    OnUpdate:     func(sid agent.SessionID, u agent.Update) { /* emit to the UI */ },
    OnPermission: func(req agent.PermissionRequest) { /* show UI; reply via mgr.ReplyPermission */ },
})

mgr.Start(ctx)                    // spawn → connect → initialize
sid, _ := mgr.NewSession(ctx, cwd)
mgr.Prompt(ctx, sid, "hello")     // blocks until the turn ends; updates stream via OnUpdate
mgr.Cancel(ctx, sid)
mgr.Stop()                        // closes the connection and tears down the tree
```

- **`Manager`** is the entry point; **`Agent`** is the process layer beneath it.
- **`ConnFactory`** is injected: production passes `NewSDKConn` (real ACP); tests
  pass a fake — so the Manager is testable without the agent.
- **Auth surface + rehydration:** `mgr.AuthMethods()` / `mgr.Authenticate(ctx, methodID)`
  expose the agent's advertised login methods (the ACP RPC); `mgr.GetSessionState(sid)`
  reports the turn status, model and pending permission so the UI can rehydrate after a
  webview reload; `mgr.SetModel(ctx, sid, modelID)` is the optional model knob.
- **Domain types** (`Update`, `ToolCall`, `PermissionRequest`, `PermissionOutcome`,
  `SessionState`, `AuthMethod`, `SessionID`) carry JSON tags matching the frontend
  contract, so the Wails binding is a mechanical map.

## Integrity & guarantees

- **No orphaned processes.** Stop and crash tear down the *entire* subprocess
  tree (the agent spawns node → engine → tool servers) via a POSIX process group
  on Unix and a Job Object on Windows — never a bare `Process.Kill()`.
- **Mutations are gated in layers (best-effort, not a hard sandbox).** First line:
  the native mutating tools (Bash, Edit, Write, …) are disallowed via the session
  `_meta` (`claudeCode.options.disallowedTools`) in `acpconn` — the `claude-agent-acp`
  adapter ignores the `--disallowedTools` CLI flag, so the list must travel in-band;
  the tool names are engine-specific. Host backstop: client-side filesystem and
  terminal calls return "not implemented". Anything else surfaces as an ACP
  permission request the host gates.
- **No ambient env leak.** The adapter is spawned with a controlled allow-list
  environment (`env.go`) — only what it needs (PATH, HOME, locale, proxies, CA
  certs, the CLI login dir), never the host's full environment, so unrelated ambient secrets
  never reach the agent or its tools.
- **Unanswered permissions deny.** A permission request that times out (or whose
  context is cancelled) resolves to *cancelled* — never auto-allow.
- **The SDK can't leak.** Only `acpconn.go` references the ACP SDK; everything
  else depends on the `AgentConn` interface.
- **Concurrency-safe.** `Agent` and `Manager` guard their mutable state with a
  mutex; the permission registry uses a buffered channel so a reply never blocks.
  Tests pass under `-race`.
- **Resilient.** A crash *after* a successful start auto-restarts with bounded
  exponential backoff, then gives up with a typed event; a failed *initial* start
  is returned as an error, not retried.

## How it works (key flows)

- **Prompt turn:** `Manager.Prompt` → `AgentConn.Prompt`; the agent streams back,
  `sdkConn` translates each ACP update into a domain `Update` and calls
  `Manager.HandleUpdate` → your `OnUpdate`. `Prompt` returns when the turn ends.
- **Permission request:** the agent asks → `sdkConn.RequestPermission` →
  `Manager.HandlePermission` registers it, fires `OnPermission`, and **blocks**
  until `Manager.ReplyPermission(id, outcome)` (or it times out → deny). The
  outcome is translated back to the SDK.
- **Crash:** the process exits unexpectedly → `Agent` invokes its `OnExit` hook
  (claimed by the `Manager`) → the Manager relaunches (spawn → connect →
  initialize) with backoff up to the budget, emitting `OnRestart`. (Resuming the
  prior conversation across a restart is a planned follow-up.)

## Building & testing

- `go build ./...` and `go test ./...` compile the ACP SDK as a normal dependency;
  the Manager is still tested with a fake conn, so the real SDK isn't exercised:
  ```
  go build ./internal/agent/
  ```
- Tests cover the security-critical paths (process-tree teardown, permission
  timeout-to-deny, auto-restart bounds, tool-policy disallow list, ctx-cancel ≠ restart,
  initialize-failure cleanup):
  ```
  go test -race ./internal/agent/
  ```
  Not covered here: the Windows process path (cross-compiled + verified manually)
  and the registry timeout/reply race.

## Boundaries (handled elsewhere)

- **Wails binding** — the desktop `App` (`internal/app/agentapi.go`) binds the Manager
  as Wails methods (`AgentStart`/`NewSession`/`Prompt`/`Cancel`/`PermissionReply`/
  `SetSessionModel`/`GetSessionState`/`AuthMethods`/`Authenticate`/`Stop`, plus the
  `Runtime*` runtime-manager methods) and emits the callbacks as webview events
  `acp:update`, `acp:permission`, `acp:restart` (and `airuntime:progress`). `NewSDKConn`
  is the default conn factory.
- **Authentication** — the package exposes the ACP auth surface (`Initialize` advertises
  the agent's auth methods; `Authenticate` forwards the ACP RPC, which the Claude adapter
  implements only for *gateway* methods). **Claude subscription login is NOT the ACP RPC:**
  the host runs `claude auth login --claudeai` under an isolated env (the `agentauth`
  package — credential isolation, wired in P1.5b) and the adapter reads the resulting
  OS-keychain credential at spawn. That CLI's OAuth redirect returns the authorization
  code to the sign-in page rather than to a local listener, so the login only completes
  once the code the user pastes is written to the CLI's stdin — see
  `App.AgentSubmitLoginToken` and `pendingLogin` in `agentapi.go`. The ambient API key is never inherited (API-key auth is
  GA-only). The env allow-list here (`env.go`) is superseded by `agentauth.IsolatedEnv`
  once P1.5b lands.
- **Runtime install / real `RuntimeLocator`** — provided by the runtime manager;
  `StaticLocator` is the placeholder used until then.
