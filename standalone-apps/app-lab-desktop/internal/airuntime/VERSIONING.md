# AI runtime version pinning & bump cadence

The `airuntime` package installs a **pinned** Node.js plus **pinned** agent npm
packages, so the runtime is reproducible and supply-chain-stable — nothing is
ever resolved as `@latest`.

## Integrity model

- **npm packages**: `runtime-deps/package-lock.json` carries per-package SHA-512
  integrity hashes; `npm ci` verifies every downloaded tarball against them.
- **Node binary**: not covered by the lockfile. The installer downloads Node's
  official `SHASUMS256.txt` and verifies the archive's SHA-256 against it before
  extracting.

## What is pinned, and where

| Thing | Pinned in | Current value |
|---|---|---|
| Node version | `defaultNodeVersion` in [`node.go`](node.go) | `v22.16.0` |
| Agent npm packages | [`runtime-deps/package.json`](runtime-deps/package.json) | `@anthropic-ai/claude-code` `2.1.220`, `@agentclientprotocol/claude-agent-acp` `0.63.0` |
| Full transitive tree | [`runtime-deps/package-lock.json`](runtime-deps/package-lock.json) | locked, with integrity hashes |
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

1. Edit the **exact** versions in `runtime-deps/package.json` (never `^`/`~`/`latest`).
2. Regenerate the lockfile:
   ```sh
   cd internal/airuntime/runtime-deps && npm install --package-lock-only --no-audit --no-fund
   ```
3. Commit both files. The new lockfile sha changes `Manifest.LockfileSHA256`, so
   existing installs become detectable as stale (a future "update available" cue).
4. The ACP adapter is `@agentclientprotocol/claude-agent-acp` (formerly
   `@zed-industries/claude-agent-acp`); confirm version bumps with the agent owner.

## Cadence

- Review on Node security advisories and at least quarterly; track the latest
  Active LTS patch.
- Bump the adapter in lockstep with the ACP integration it is validated against.

## Schema migrations

When `Manifest` fields change incompatibly, bump `manifestSchema` in
`manifest.go`; older manifests are then treated as "needs reinstall".
