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
| `manager.go` | `Manager`: sessions, prompts, cancel, permission routing, auto-restart, the per-session update log and its replay, what a turn touched, App Lab notes |
| `conn.go` | `AgentConn` / `ClientHandler` / `ConnFactory` — the SDK seam |
| `permission.go` | permission request↔reply registry (waits for the UI reply; optional timeout-to-deny, off in production; cancels a session's open requests when its turn ends) |
| `sessionpicks.go` | `PickStore`: each chat's model and mode in `session-picks.json` in the agent's config dir, put back after a load |
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
mgr.Prompt(ctx, sid, "hello", nil) // blocks until the turn ends; updates stream via OnUpdate
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
- **Editor context:** `Prompt` takes the file in view in the editor beside the chat
  (`*EditorContext`, nil without one) and sends the agent, ahead of the text, only what it has not
  seen of it yet (`editorcontext.go`); the replay drops that block.
- **Notes:** `Notify(sid, text)` queues what App Lab tells a chat once (a withheld file, a
  rename); `Prompt` sends the queue first, as an `<app-lab-note>` block, and drops it only after
  a turn that neither failed nor was stopped. The replay drops these blocks too.
- **Turn record:** `Touched(sid)` reports the apps a session's current or last turn named in
  board tools and the files its edits wrote; the host's turn-end sync reads it to leave an app to
  another chat still editing it. `AppsChanged(sid)` keeps the apps named by board tools that are
  not read-only, and `CallRunning(sid, tool, appID)` tells the host which chat is still in the
  call that flushed, so a sync note reaches only the chats that edited the app, and the caller
  once. `SessionsNamingApp(id)` lists the chats that used an app in this run, for a rename note;
  `RebindWorkspace(oldID, newID, newName)` moves all of it to a renamed app.
- **Log and replay:** each live session keeps its updates (`liveSession.log`, at most 4 MiB). A
  `LoadSession` of a session whose log is whole sends `replay_start` and the log, with no engine
  call; otherwise the engine replays and the log fills from it, one engine load per session at a
  time. Text chunks merge into one entry as the UI keeps one part: across a tool call's update, or
  a checklist or question shown again, which change a part in place. A chunk that repeats the text
  so far is dropped, as the UI drops it live. A prompt waits for an engine load of its session; a
  Stop during that wait ends it unsent. `Prompt` registers the prompt as its first step; a host
  with work of its own before the prompt takes `HoldPrompt(sid)` first and sends with the hold's
  `Prompt`, so a Stop that comes during that work ends the prompt unsent. A Stop that comes before
  the hold belongs to an earlier turn and leaves the prompt alone. `TurnStopped(sid)` tells the
  host the last turn was stopped (Stop pressed and the engine did not finish it), for the stored
  session status.
- **Model and mode:** `ManagerConfig.Picks` keeps the model and mode each chat last ran on: what
  `SetModel` / `SetMode` set, and a change the engine reports outside a load. After every load (a
  reopen, the resume, the load before a prompt) the chat is put back on them when the engine still
  offers them, before any prompt is sent: the Claude adapter loads a chat in its default mode.
  `PickFileOf(agentID)` keeps them in `session-picks.json`, so they hold across an agent or App Lab
  restart; `DropSessionPick(dir, sid)` forgets a deleted chat's. A pick for a chat the running engine
  does not hold is only kept, for that load to apply: the engine has no such session to set. To
  know which case it is, `SetModel` and `SetMode` first wait for a crash restart and for a load of
  the chat in progress, up to 30 s each (`restartWait`, `sessionLoadTimeout`). Until
  the engine shows the chat, `GetSessionState` reports the lists it last advertised, and as the
  current model and mode the kept pick where those lists hold it, else the current model and mode
  the engine reported with them. After a muted load or a resume `mode_change` carries the mode list
  too. For every agent, `NewSession` opens a chat on the model the user last switched to (the
  `NewChatPick` entry, written by a `SetModel` that changes a known model), else on the first paid
  model when the engine opened it on a free one. `NewProbeSession`, the hidden chat of
  `AgentValidateAuth` and `AgentNewSessionState`, stays on the engine's model so its turn bills no
  provider; `NewChatModel` reports the model a new chat starts on. `AgentSetProviderKey` and `AgentProviderSignIn`
  drop a free `NewChatPick`, so a new provider moves new chats to its models.
- **Stopped turns in a replay:** Claude records a stopped turn as an interrupt mark, which the
  replay turns into `turn_stopped`, and drops the "No response requested." the CLI writes after it
  when it next resumes the chat. It drops it only while that load runs, so a live reply is never
  dropped. App Lab's own log keeps a `turn_stopped` for every stopped turn.
- **Domain types** (`Update`, `ToolCall`, `PermissionRequest`, `PermissionOutcome`,
  `SessionState`, `AuthMethod`, `SessionID`) carry JSON tags matching the frontend
  contract, so the Wails binding is a mechanical map.

## Integrity & guarantees

- **No orphaned processes.** Stop and crash tear down the *entire* subprocess
  tree (the agent spawns node → engine → tool servers) via a POSIX process group
  on Unix and a Job Object on Windows — never a bare `Process.Kill()`. A Stop
  closes the adapter's stdin and sends SIGTERM to the group (Unix only), then gives
  what the adapter started, such as the Claude CLI, up to 2 s from the start of the
  Stop (`groupGrace`) to exit on its own. Then whatever is left is killed (Unix `release`;
  on Windows closing the job does it). An adapter still running after 3 s
  (`shutdownGrace`) is killed with its whole tree. After a crash what is left is
  killed at once, so a crashed adapter's CLI cannot go on writing the chat's
  transcript.
- **Mutations are gated in layers (best-effort, not a hard sandbox).** First line:
  the native mutating tools (Bash, Edit, Write, …) are disallowed via the session
  `_meta` (`claudeCode.options.disallowedTools`) in `acpconn` — the `claude-agent-acp`
  adapter ignores the `--disallowedTools` CLI flag, so the list must travel in-band;
  the tool names are engine-specific. OpenCode ignores `_meta`: its launch config
  (`openCodeLaunchConfig`) denies `bash`, `task`, `webfetch` and `websearch` with a
  bare `deny`, which removes the tool. Host backstop: client-side filesystem and
  terminal calls return "not implemented". Anything else surfaces as an ACP
  permission request the host gates.
- **No ambient env leak.** The adapter is spawned with a controlled allow-list
  environment (`env.go`) — only what it needs (PATH, HOME, locale, proxies, CA
  certs, the CLI login dir), never the host's full environment, so unrelated ambient secrets
  never reach the agent or its tools.
- **Unanswered permissions deny.** A permission request that times out (or whose
  context is cancelled) resolves to *cancelled* — never auto-allow.
- **No request outlives its turn.** Stop (after the ACP cancel), the turn's end, closing and
  deleting a session answer its open permissions and questions with a cancel; one that arrives
  when no turn runs is cancelled at once, with no card. One registered just before the turn ends
  can still reach the UI as a card that answers nothing. OpenCode queues a session's requests
  with no timer, so one left open blocks every later card.
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
- **Before the prompt is sent** (`readyToSend`), the running engine must hold the chat:
  - a crash restart in progress → the prompt waits for the engine, up to 30 s (`restartWait`); a
    restart that gives up fails it. `NewSession` (a new chat's first prompt opens it) and
    `LoadSession` wait the same way.
  - a load in progress (a reopen's, the resume's, another prompt's) → the prompt waits for it, then
    looks again, as that load can fail.
  - a chat the engine never created or loaded (`liveSession.loaded` false, cleared when an engine
    exits) → `loadBeforePrompt` loads it, muted, with the cwd and workspace from
    `ManagerConfig.SessionScope`. Its replay fills the log and is not forwarded; then `model_change`
    and `mode_change` tell the UI the chat's model and mode.

  A Stop, a delete or a close ends every prompt of the chat still waiting (`promptStop`), at once and
  unsent. The load runs to its end: the engine would go on replaying into a chat no longer muted.
  `DeleteSession` and `CloseSession` wait for it before the engine deletes or closes the chat;
  `DeleteSession` waits even before it refuses an engine without `session/delete`, whose chat the
  host then deletes through its CLI. A failed load returns a JSON-RPC error the UI reads, with
  `errorKind` `session_gone` (start a new chat) when the engine has no such chat and
  `session_load_failed` (try again) otherwise; an auth refusal comes as the engine sent it.
  OpenCode answers a chat its store lost with the error it gives any failure of that store
  (`-32603 "OpenCode service failure"`, `service: "session"`), so that answer is `session_gone`
  only when the engine's own list no longer holds the chat. A Stop while that list is read ends
  the prompt as stopped, at once.
- **Stop on OpenCode:** its cancel stops only a run already started (`Dialect.DropsEarlyCancel`).
  A Stop that came before the turn sent any content is sent again at the turn's first content
  update: a message, thinking, tool call, tool call update or checklist (`runUpdates`); a `usage`,
  `model_change` or `mode_change` update does not count. Each re-send writes one line to the dev log.
- **Delete:** a chat the engine held is deleted once more 2 s later (`deletedStubDelay`), as the
  Claude CLI that held it can write one last line after the delete.
- **Permission request:** the agent asks → `sdkConn.RequestPermission` adds the
  arguments the call announced and drops "Always allow" where its grant would cover more
  than the call (`perCallOptions`) → `Manager.HandlePermission` registers it, fires
  `OnPermission`, and **blocks** until `Manager.ReplyPermission(id, outcome)` (or it times
  out → deny, or its turn ends → cancel). The outcome is translated back to the SDK.
- **Crash:** the process exits unexpectedly → `Agent` invokes its `OnExit` hook
  (claimed by the `Manager`) → the Manager relaunches (spawn → connect →
  initialize) with backoff up to the budget, emitting `OnRestart`, then reloads the
  open sessions (`resumeSessions`). Their replay is not forwarded, as the UI already
  shows that history; only model and mode changes are. `OnRestart` with `Resumed`
  then tells the UI the reload is done.
- **MCP servers:** Claude gets the board server in every `session/new` and
  `session/load`; OpenCode only in its launch config (`Dialect.MCPInLaunchConfig`), with
  `MCPServer.CallTimeout` as its per-call limit, because a server sent again in a session
  request rebuilds the MCP client every OpenCode session shares.

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
