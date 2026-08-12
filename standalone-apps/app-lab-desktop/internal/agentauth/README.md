# agentauth

Credential isolation for the on-demand AI agent runtime. It builds the locked-down
environment every agent process runs in, so the agent only ever sees credentials we place
there on purpose — never the developer's shell (`ANTHROPIC_API_KEY`) or home (`~/.claude`).
This is the Go backend behind App Lab's agent authentication; it sits next to
[`airuntime`](../airuntime) (which installs the runtime) and is deliberately
**Wails-agnostic** — `internal/app` wires it to the UI separately. Everything is keyed by
`airuntime.AgentID`; Claude is the only agent today.

## Layout

| File | Responsibility |
|---|---|
| `auth.go` | `Method` (None / APIKey) and `Options` |
| `profile.go` | Per-agent descriptor (`authProfile`) + the registry seam (`profileFor`) |
| `env.go` | `IsolatedEnv` — the isolated child environment (the security boundary) |
| `cli.go` | `RunCLI` + resolution of the agent CLI from the installed runtime |
| `env_test.go` | Unit test for the env isolation |

## Architecture

```
UI (internal/app)
   │  run agent → IsolatedEnv + adapter spawn;   sign in → RunCLI (the agent CLI's login)
   ▼
agentauth ──uses──> airuntime (node + agent packages, install paths)
   │  builds the isolated env; injects the API key (subscription stays in the keychain)
   ▼
agent CLI / ACP adapter  (bundled node, scrubbed env, isolated CLAUDE_CONFIG_DIR)
```

## Auth model

Subscription login is owned by the agent CLI itself; we never hold the raw token:

- **Subscription** — the agent CLI's own login (browser OAuth) writes the credential to the
  OS keychain. We run that flow under the isolated environment (`RunCLI`) but inject
  **nothing** of our own (`Method: None`); the adapter picks the credential up at spawn.
- **API key** — an explicit, caller-supplied key injected as the agent's API-key env var
  (`Method: APIKey`). This is the only credential we inject.

## Isolation (the security boundary)

`IsolatedEnv` starts from **`agent.ChildEnv()`** — the allow-list of variables the agent
genuinely needs — and not from `os.Environ()`, so ambient secrets (`GITHUB_TOKEN`, `AWS_*`,
`NPM_TOKEN`, …) never reach the agent or anything it spawns. Over that base it: drops the
agent's config-dir var and a denylist of credential vars (`ANTHROPIC_API_KEY`,
`ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, …); prepends the bundled node bin to
`PATH`; forces `CLAUDE_CONFIG_DIR` to `<runtime>/config`; and injects the API key when one
is supplied. Proxy and CA vars pass through, as do the session vars a sign-in needs to reach
the OS keychain. It is the one unit-tested piece (`env_test.go`). The agent CLI is launched
from the installed runtime's `node_modules/.bin` shim — never `npx`/PATH.

## Multi-agent

The per-agent specifics (config-dir var, scrub set, CLI package) live in one `authProfile`
selected by `profileFor`. Adding an agent is a new profile (and, if its sign-in differs —
e.g. Gemini's "Login with Google" — its own login wiring), not a rewrite. There is no agent
registry yet (that is a later, platform-level concern).

## Notes

- **Adapter wiring:** the ACP adapter spawn runs under this package's isolation via a small
  `Env` hook on `internal/agent`'s spawn config — added with the ACP/Wails integration, kept
  out here so this package stays Wails-agnostic. It is layered over `agent`'s allow-list base
  env (`agent.ChildEnv()`, the stronger scrubber), which is fed to `buildIsolatedEnv` as its
  `base` rather than scrubbing `os.Environ()` twice.
- **Subscription credential location:** the CLI's login writes to the shared OS keychain
  (per-OS-user, survives uninstall). `CLAUDE_CONFIG_DIR` isolates config and account but not
  that keychain entry — uninstall must clear it.
- **API-key UI** and token management (Settings entry, refresh) are a later task.
- **Platforms:** validated on **macOS**; Linux and Windows are unvalidated. All code
  cross-compiles (`GOOS=windows go build`).
