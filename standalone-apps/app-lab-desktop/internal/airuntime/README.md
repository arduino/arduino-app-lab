# airuntime

Manages the on-demand AI agent runtime — a **pinned Node.js** plus the **pinned
agent npm packages** (Claude Code + its ACP adapter) — installed into a per-user
app-data directory. This is the Go backend behind the App Lab AI assistant's
`AiRuntimeService`.

## Layout

One self-contained directory per agent under the OS app-data root, e.g.
`~/Library/Application Support/arduino-app-lab/ai-runtime/claude/`, each with its
own Node, its own `node_modules` and a private npm cache (`npm-cache/`), so a
broken user-level `~/.npm` — typically root-owned sudo-npm leftovers — cannot
break the install, and `Uninstall` leaves no trace behind. The user's `.npmrc`
(registry mirrors, proxies) still applies. `version.json` records what is
installed; its presence is the single source of truth for "is the runtime
installed?".

## Integrity

- **Node binary**: version-pinned; the download's SHA-256 is verified against
  Node's official `SHASUMS256.txt`.
- **npm packages**: installed with `npm ci` against a shipped, embedded
  `package-lock.json` (per-package SHA-512 integrity) — never `@latest`,
  transitive deps locked.

See [VERSIONING.md](VERSIONING.md) for exactly what is pinned and how to bump it.

## Public API

```go
m, err := airuntime.New(airuntime.AgentClaude) // also: nodejs.org, proxy-aware, 3 retries
m.Status(ctx)              // installed? version? disk usage?
m.Install(ctx, onProgress) // download+verify+extract Node -> npm ci -> write manifest
m.Uninstall(ctx)
m.Cancel()                 // abort an in-flight Install
```

`Install` is idempotent (the manifest is written last, so any failure leaves
"not installed") and guarded by a disk-space preflight, an in-process mutex and a
cross-process file lock.

## Layering

This package is deliberately **Wails-agnostic**: it imports no UI/runtime
packages and reports progress through a `ProgressFunc` callback (mirroring
`internal/flasher`). The Wails surface (`Runtime*` methods + the
`airuntime:progress` event) is wired separately in `internal/app`, and the
TypeScript `AiRuntimeService` binding in `app/ai-assistant` consumes it.
The `Progress` and `Status` JSON tags match that TS contract so the generated
bindings line up.
