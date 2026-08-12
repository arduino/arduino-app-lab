# Licensing the `internal/board` bundled binaries

Audit of the executables Arduino App Lab redistributes out of
`standalone-apps/app-lab-desktop/internal/board`, and what remains to be done
about them.

`internal/lsp` was brought up to standard separately — see
[`standalone-apps/app-lab-desktop/THIRD-PARTY-NOTICES.md`](../standalone-apps/app-lab-desktop/THIRD-PARTY-NOTICES.md).
The board binaries are **not** covered by that work: `licenses.json`,
`download_licenses.sh`, `check_licenses.sh` and the embedded
`internal/notices/licenses` all stop at `internal/lsp`.

This document is the audit, not the fix. (Finding 1 has since been fixed — see
below.)

---

## What we bundle

Downloaded by `internal/board/download_resources.sh` into
`internal/board/resources_<platform>/`, then embedded with `go:embed` and
unpacked at runtime by `internal/board/operations.go`.

| Binary | Version | Licence | Obtained from |
| --- | --- | --- | --- |
| `arduino-flasher-cli` | 0.5.1 | GPL-3.0 | `arduino/arduino-flasher-cli` releases |
| `serial-discovery` | v1.5.2 | GPL-3.0 | Arduino package index |
| `mdns-discovery` | v1.1.0 | GPL-3.0 | Arduino package index |
| `adb` (+ the rest of `platform-tools`) | r32.0.0 | **unresolved — see below** | Android platform-tools, mirrored via the Arduino package index |
| `package_index.tar.bz2` | n/a | Arduino data, not an executable | `downloads.arduino.cc` |

The three Arduino tools were confirmed GPL-3.0 via the GitHub licence API. All
are standalone executables run as subprocesses; none is linked into App Lab, so
the copyleft terms reach only their own binaries.

## Does the licence text currently reach the user?

Yes, for all four — better than `internal/lsp` managed before its fix, because
`operations.go` unpacks these archives whole rather than cherry-picking the
executable.

| Binary | Licence text on the user's disk? | Why |
| --- | --- | --- |
| `serial-discovery` | ✅ | its archive is copied into arduino-cli's downloads dir and arduino-cli installs it intact, `LICENSE.txt` included |
| `mdns-discovery` | ✅ | same |
| `adb` | ✅ | the `platform-tools` archive is extracted whole; `stripRoot` drops the leading directory, so `NOTICE.txt` (140 KB of AOSP notices) lands in the adb tool directory |
| `arduino-flasher-cli` | ✅ | fixed — see finding 1 |

None of them reaches any **installer**, though — that is the gap the
`internal/lsp` work closed and this one has not.

---

## Finding 1 — ~~we discard the flasher's licence at download time~~ (fixed)

`download_resources.sh` used to extract only the executable from the flasher
release archive, throwing away the GPL-3.0 `LICENSE` that upstream deliberately
ships alongside the binary — the same class of problem as the
`postProcessArduino` deletion fixed in `internal/lsp`, just occurring at
download rather than at extraction.

**Fixed:** the download now extracts `LICENSE` as well (renamed
`arduino-flasher-cli.LICENSE`, since the resources folder holds several tools'
files), it ships in the embed, and `GetFlasherCli` writes it next to the
executable wherever it is unpacked.

## Finding 2 — `adb` needs a decision, not a notice

This one cannot be settled from the repository.

The adb **sources** are Apache-2.0 (AOSP). What we ship is Google's **prebuilt
`platform-tools` archive**, which is distributed under the Android Software
Development Kit License Agreement. Which governs our redistribution is a question
for legal, not something to infer. Two things make it worth resolving properly
rather than papering over:

- **We ship more than adb.** The archive also contains `mke2fs`, `e2fsdroid`,
  `etc1tool`, `make_f2fs_casefold`, `dmtracedump` and `lib64/libc++.dylib`, and
  `operations.go` extracts all of it. Whatever terms apply, they apply to the
  whole set. Worth asking whether we should extract only `adb` — smaller
  resources, narrower obligation.
- **There may be precedent.** Arduino already redistributes adb through the
  package index and the IDE, so the question has likely been answered elsewhere
  in the organisation. Check before starting from scratch.

The `NOTICE.txt` already reaching users covers the AOSP attribution requirements;
it does not answer the SDK Terms question.

## Finding 3 — board tool versions aren't pinned, so the `lsp` guard won't port directly

`check_licenses.sh` works by comparing a committed licence text against the
version pinned in `versions.json`. Board has no equivalent: `download_resources.sh`
resolves `serial-discovery`, `mdns-discovery` and `adb` **dynamically** from the
package index, taking the highest version available:

```bash
max_by(.version | [splits("[.]")] | map(tonumber))
```

Only the flasher has an explicit version (`FLASHER_VERSION="0.5.1"`).

That makes "does the committed licence match the shipped version?" unanswerable as
written. Note also that adb is *effectively* pinned by accident rather than
design: the script hardcodes `platform-tools_r32.0.0-<os>.zip` in its `mv` calls
and `operations.go` hardcodes the `32.0.0` install path, so a newer adb in the
index would break the build rather than flow through.

Three options, in the order I'd consider them:

1. **Pin board tool versions explicitly**, in a `versions.json` of its own or a
   shared one, and reuse the `internal/lsp` scripts nearly unchanged. Most
   consistent, and it fixes the accidental-adb-pin fragility as a side effect.
   Changes download behaviour, so it needs care.
2. **Record the resolved versions at download time** into a generated file, and
   have the guard compare against that. Keeps the dynamic resolution, but the
   committed licence can then lag a resolved version by one build.
3. **Loosen the check for board** to presence-only — every bundled binary must
   have *a* licence, without asserting which version it documents. Weakest, but
   still catches a new binary arriving with nothing.

Don't force the `internal/lsp` design onto board if it genuinely doesn't fit.

---

## What "done" looks like

1. ~~Extract and ship the flasher's `LICENSE` (finding 1)~~ — done.
2. Resolve the adb licensing question with legal (finding 2), including whether to
   narrow the extraction to `adb` alone.
3. Pick a versioning approach (finding 3), then add board to the manifest and the
   guard, reusing `internal/lsp/scripts/` rather than duplicating it.
4. Get the board licence texts into all four distributions the way the lsp ones
   now go, via `internal/notices` and `scripts/ship_notices.sh`.
5. Preserve what already works: `operations.go` extracts these archives whole and
   deletes nothing. Don't regress that while refactoring.

## Reference

- Download script: `standalone-apps/app-lab-desktop/internal/board/download_resources.sh`
- Runtime unpacking: `standalone-apps/app-lab-desktop/internal/board/operations.go`
- The equivalent work for the language servers, including the manifest, guard and
  per-dist delivery: [`THIRD-PARTY-NOTICES.md`](../standalone-apps/app-lab-desktop/THIRD-PARTY-NOTICES.md)
