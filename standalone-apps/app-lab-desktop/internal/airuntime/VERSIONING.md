# AI runtime version pinning & bump cadence

The `airuntime` package installs a **pinned** Node.js plus **pinned** agent npm
packages, so the runtime is reproducible and supply-chain-stable — nothing is
ever resolved as `@latest`.

## Integrity model

- **npm packages**: each agent's `runtime-deps/<agent>/package-lock.json` carries
  per-package SHA-512 integrity hashes; `npm ci` verifies every downloaded tarball
  against them.
- **Node binary**: not covered by the lockfile. The installer downloads Node's
  official `SHASUMS256.txt` and verifies the archive's SHA-256 against it before
  extracting.

## What is pinned, and where

| Thing | Pinned in | Current value |
|---|---|---|
| Node version | `defaultNodeVersion` in [`node.go`](node.go) | `v22.16.0` |
| Claude's npm packages | [`runtime-deps/claude/package.json`](runtime-deps/claude/package.json) | `@anthropic-ai/claude-code` `2.1.287`, `@agentclientprotocol/claude-agent-acp` `0.85.0` |
| OpenCode's npm package | [`runtime-deps/opencode/package.json`](runtime-deps/opencode/package.json) | `opencode-ai` `1.18.33` |
| Full transitive tree | `runtime-deps/<agent>/package-lock.json` | locked per agent, with integrity hashes |
| Manifest layout | `manifestSchema` in [`manifest.go`](manifest.go) | `2` |

## How to bump Node

1. Pick the new version (Active LTS line; minimum **v22** — both the ACP adapter
   and the Claude Code CLI declare `engines.node >= 22`).
2. Update `defaultNodeVersion` in `node.go`. The installer fetches the matching
   `SHASUMS256.txt` and verifies the download against it — no hashes to hardcode.
3. Recommended when bumping: GPG-verify the release out of band first.
   ```sh
   curl -fsSLO https://nodejs.org/dist/<ver>/SHASUMS256.txt
   curl -fsSLO https://nodejs.org/dist/<ver>/SHASUMS256.txt.sig
   gpg --verify SHASUMS256.txt.sig SHASUMS256.txt   # against the Node release keys
   ```

## How to bump the agent packages

One set per agent, under `runtime-deps/<agent>/`. Bump one without touching the other.

1. Edit the **exact** versions in `runtime-deps/<agent>/package.json` (never `^`/`~`/`latest`).
2. Regenerate that agent's lockfile:
   ```sh
   cd internal/airuntime/runtime-deps/<agent> && npm install --package-lock-only --no-audit --no-fund
   ```
3. Commit both files. The new lockfile sha changes `Manifest.LockfileSHA256`, so
   existing installs become detectable as stale (a future "update available" cue).
4. The ACP adapter is `@agentclientprotocol/claude-agent-acp` (formerly
   `@zed-industries/claude-agent-acp`); confirm version bumps with the agent owner.

### OpenCode specifics

- `opencode-ai` ships the engine as a **native per-platform binary**, declared as an
  optional dependency. `npm ci` downloads only the host's, and the lockfile pins all
  of them — check after a bump that `linux-arm64` is still among them, since that is
  the VentunoQ.
- Node is needed to **install**, not to run: the binary is self-contained. An OpenCode
  install therefore still costs one Node download (~178 MB), and Node is per agent, so
  a user with both agents has two copies.
- The engine reads configuration, plugins and skills from several places outside our
  control. `openCodeProfile.containment` in
  [`../agentauth/profile.go`](../agentauth/profile.go) is what confines it, and every
  line there closes a specific one. **Re-check it at every bump**: a new scan path, or a
  renamed flag, reopens a hole silently — nothing errors when a variable stops being read.
- GitHub Copilot's sign-in drives OpenCode's own login: re-check at every bump the method label
  and the Enter that answers its first question (`openCodeOffered` in
  [`../agentauth/providers.go`](../agentauth/providers.go)), and the `Go to:` / `Enter code:`
  lines `deviceLoginURL` and `deviceLoginCode` read in `internal/app/agentapi.go`. A change
  shows no code, and the panel gives up after 45 seconds.
- Google Gemini's key is injected as `GOOGLE_GENERATIVE_AI_API_KEY` too, because OpenCode
  passes a key on only for a provider with one variable (`KeyEnvs` in `openCodeOffered`).

## Cadence

- Review on Node security advisories and at least quarterly; track the latest
  Active LTS patch.
- Bump the adapter in lockstep with the ACP integration it is validated against.

## Schema migrations

When `Manifest` fields change incompatibly, bump `manifestSchema` in
`manifest.go`; older manifests are then treated as "needs reinstall".
