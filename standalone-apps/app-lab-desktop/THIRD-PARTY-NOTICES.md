# Third-party notices

How Arduino App Lab attributes the third-party software it ships, and why the
machinery looks the way it does. The attribution itself lives in
`internal/notices` and falls into three categories:

| Category | What | Notice |
| --- | --- | --- |
| Bundled executables | arduino-cli, clangd, node, the language servers, … run as subprocesses | `internal/notices/licenses/*.txt` |
| Compiled-in dependencies | Go modules and npm packages built into the app | `internal/notices/{go,npm}-dependencies.txt` |
| Vendored assets | seti-ui icons, noto-emoji SVGs — no manifest, invisible to scanners | `internal/notices/vendored-assets.txt` |

## How this is kept honest

Everything in `internal/notices` is generated; nothing is written by hand.

**Bundled executables.** `internal/lsp/scripts/versions.json` pins each
binary's version; `licenses.json` beside it records the licence, origin and
corresponding source; `download_licenses.sh` turns that manifest into the
committed texts. Two independent gates fail when they drift: `check_licenses.sh`
runs at the end of `download_lsps.sh` (offline, against the `Component:` header
in each text, so a version bump that skips the licence refresh cannot pass),
and the Go tests in `internal/notices` pin the embedded set to the manifest in
both directions.

**Go and npm dependencies.** `dev-utils/al-license/generate_dependency_notices.sh`
renders the committed `licensed` caches under `.licenses/` into the two
dependency notices, deduplicated by licence text. It runs inside
`task general:cache-dep-licenses` — the same task that regenerates those caches
— so the check-cache CI job, which re-runs that task and fails on any git diff,
catches a stale notice exactly like a stale cache. The same generator emits
`dev-utils/al-license/.licenses/NOTICE`, the repo-facing copy of all three
notices for anyone browsing the source tree.

The cache's canonical environment is **Linux/amd64**: `licensed` enumerates Go
dependencies with the build constraints of the machine it runs on, and the
check-cache job runs on ubuntu. `task general:cache-dep-licenses` pins
`GOOS=linux GOARCH=amd64` on the `licensed cache` call so a refresh on any
machine — a Mac included — reproduces that same set; the pin is a no-op on the
Linux CI runner. Consequence: Go modules reached only on other platforms are
absent by design — e.g. `al.essio.dev/pkg/shellescape` (MIT), linked into the
macOS build via go-keyring's keychain backend, is not enumerated because the
cache always reflects the Linux/amd64 build.

**Vendored assets.** Each vendored asset keeps a verbatim copy of its upstream
licence committed next to where it is vendored (seti-ui under
`ui-packages/images/assets/file-icons/seti`; noto-emoji beside
`internal/emoji/download_emojis.sh`; the socket.io browser bundle beside
`dev-utils/dev-config/scripts/download_socket_io.sh` — a different copy from
the npm-installed socket.io-client, and embedded into user-generated WebUI
projects). Each download script fails if the committed text stops matching
upstream at the pinned version. The same generator collects them all into
`vendored-assets.txt`.

## What is deliberately not in these notices

Swept for and excluded on purpose, so nobody re-litigates them from scratch:

- **The `internal/board` executables** (`arduino-flasher-cli`,
  `serial-discovery`, `mdns-discovery`, `adb`) are a known, documented gap:
  their licence texts reach the user's disk next to each installed tool, but
  not the installers, and adb's redistribution terms need a legal decision.
  The audit and remaining work live in
  [`docs/board-bundled-binaries-licensing.md`](../../docs/board-bundled-binaries-licensing.md).
- **The AI runtime packages** (`internal/airuntime/runtime-deps`) are not
  redistributed by App Lab: only the pinned `package.json` and lockfile are
  embedded, and `npm ci` fetches the packages from the registry onto the
  user's machine at runtime, under their own terms, each landing with its own
  licence file in the runtime directory.
- **The learn content** (`internal/learn`) is Arduino's own documentation,
  cloned from a first-party repository — not third-party material.
- **The Arduino package index** (`internal/board/resources_index`) is
  first-party data, not software.

## What we bundle

Versions are those pinned in `internal/lsp/scripts/versions.json` at the time of
writing; the manifest, not this table, is authoritative.

| Binary | Version | Licence | Copyleft |
| --- | --- | --- | --- |
| `arduino-cli` | 1.5.2-rc.1 | GPL-3.0-only | yes |
| `arduino-language-server` | 0.8.0-rc.1 | AGPL-3.0-only | yes |
| `clangd` + `clang-resource/` | 22.1.8-2-rc2 (LLVM 22.1.8) | Apache-2.0 WITH LLVM-exception | no |
| `ctags` | 5.8-arduino11 (macOS arm64 only) | GPL-2.0-only, **modified** | yes |
| `node` | v24.18.0 | Node.js licence + bundled notices | no |
| `ruff` | 0.15.21 | MIT | no |
| `basedpyright` (+ `node_modules`) | 1.39.9 | MIT | no |
| `typescript-language-server` (+ `node_modules`) | 5.3.0 | Apache-2.0 | no |
| `typescript` | 6.0.3 | Apache-2.0 | no |
| `vscode-langservers-extracted` (+ `node_modules`) | 4.10.0 | MIT | no |

All ten are standalone executables (or scripts run by the bundled `node`),
launched as subprocesses over stdio. **None is linked into App Lab**, so the
copyleft licences above reach only their own binaries and do not propagate to
App Lab itself.

### The three obligations that need attention

**`arduino-cli` — GPL-3.0, and `arduino-language-server` — AGPL-3.0.** Both are
Arduino's own projects, so the upstream licensing decision is ours; the
redistribution duties to end users are not. Each needs its licence text
delivered with the binary (done, twice over) and an offer of corresponding
source, satisfied by the public repositories recorded as `source_url` in
`licenses.json`. Neither is modified. Both ship their own `LICENSE.txt` inside
their release archives; App Lab extracts those next to the executables and must
not delete them (see the note on `assetPostProcessors` in
`internal/lsp/artifacts/artifacts.go`).

**`ctags` — GPL-2.0, and modified.** `internal/lsp/scripts/lsps/arduino/build_ctags.sh`
applies one mechanical change at build time: the private `__unused__` macro is
renamed to `CTAGS_UNUSED` so the sources compile against a modern macOS SDK,
whose `<sys/cdefs.h>` defines `__unused` in terms of it. No behavioural change.
That script, together with the commit pinned in `versions.json`, is the complete
corresponding source for the binary we ship.

Bundled because arduino-cli's builtin package index publishes ctags for
`x86_64-apple-darwin` only, so Apple Silicon would otherwise need Rosetta 2 —
see the comments in `build_ctags.sh` and `ensureCtagsExecutable` in
`internal/lsp/lsp_arduino.go`. Remove this entry along with the build step once
an `arm64-apple-darwin` build is published upstream; see
`docs/upstream-clangd-static-crt.md`.

**`node` — an aggregate.** Node's `LICENSE` is not a single grant: it is Node's
own MIT terms followed by notices for everything statically linked into the
binary (V8, OpenSSL, ICU, zlib, llhttp and more). It ships whole, and must; the
SPDX expression in `licenses.json` is indicative only.

### On the bundled `node_modules` trees

`basedpyright`, `typescript-language-server` and `vscode-langservers-extracted`
ship as npm trees executed by our bundled `node`. `internal/notices/licenses/`
carries the licence of each of those three top-level packages; their
dependencies keep their own per-package `LICENSE` files inside the shipped
`node_modules`, which the bundles preserve. `licensed` does not see these trees
(it scans the yarn workspace, not `internal/lsp/artifacts/resources`), so
enumerating their transitive dependencies into the aggregate notice is possible
future work, not a current gap in delivery.

## Where the notices ship

`scripts/ship_notices.sh` is the single packaging step: it delivers everything
in `internal/notices` plus this file, as a folder of files or appended into one
document. Every route below covers all three categories.

| Distribution | Location | How |
| --- | --- | --- |
| `.deb` (linux/arm64) | `/usr/share/doc/arduino-app-lab/copyright` | assembled by `dev-utils/al-license/licensed.sh` from `build/debian/copyright.base` + `ship_notices.sh --into-file` |
| `.tar.gz` (linux/amd64) | `licenses/` beside the executable | `ship_notices.sh --to-folder`, in the release workflow before `tar` |
| macOS `.dmg` | `Licenses/` beside `Arduino App Lab.app` | `ship_notices.sh --to-folder`, in the `generate-dmg` job |
| Windows installer | app data dir, written on first run | compiled in — see below |

Those four are exactly the assets `reusable-gh-release.yml` publishes.

On top of the file copies, the bundled-executable licences (336 KB) are embedded
into the binary on *every* platform and written next to the extracted binaries
on start-up — cheap insurance against a packaging mistake, and the only route
into a signed macOS `.app`, which cannot be amended after the build without
invalidating its signature.

### Why Windows is deliberately embed-only

This is the one place this rationale is written out; the code and scripts point
here.

`build/windows/installer/project.nsi` is **not** touched, and shouldn't be. On
Windows the auto-update flow *is* the installer: `go-updater` downloads
`..._Windows_x86-64_installer.exe` and runs it elevated
(`updater/apply_windows.go`, `exec_windows.go`), with `SilentInstall silent`, and
treats any non-zero exit as a failed update. Every NSIS edit therefore executes
on every Windows update, on end-user machines, with admin rights. A browsable
licences folder is not worth that exposure.

So Windows is the one platform with no file route, and therefore the one
platform where the Go and npm notices (~3.2 MB) are compiled into the binary —
`internal/notices` embeds them behind a build tag and writes them to the app
data directory on start-up. Embedding them on the other platforms too would add
weight without adding coverage, since those already carry the same text as
files.

The two dists that *are* update payloads were checked rather than assumed. The
Linux `.tar.gz` is one: `updater/apply_default.go` extracts it and takes the
first *file* whose mode has any of `0111` set. The added `licenses/` directory
is safe on two independent counts — the texts are `0644` (ship_notices.sh
enforces this), and `arduino-app-lab` sorts before `licenses` anyway. Keep both
properties if that step is ever reworked.

One consequence worth knowing: `reusable-s3-publish-with-metadata.yml` publishes
the macOS build as `_macOS_universal.app.zip`, not as the `.dmg`. Anyone taking
that route gets the licences from the embedded copy only — correct, but not
browsable without launching the app. If the `.app.zip` ever needs a visible
copy too, add it as a sibling inside the zip; do not put it in the bundle.

---

> Before this machinery, notices reached the `.deb` only, and only for npm
> packages; the macOS, Windows and amd64 Linux builds shipped no third-party
> notices at all.

> The Microsoft Visual C++ Redistributable previously appeared here, because the
> Windows clangd linked the MSVC runtime dynamically and the installer chained
> Microsoft's redistributable. Fixed upstream in clangd `22.1.8-2-rc2` (static
> CRT), so App Lab no longer redistributes it and the entry is gone.

> An earlier version of this file listed `clang-format` as bundled. It is not:
> `download_clangd.sh` fetches only the `clangd_*` archive, which contains
> `clangd` and `clang-resource/`, and nothing in the codebase references
> `clang-format`.
