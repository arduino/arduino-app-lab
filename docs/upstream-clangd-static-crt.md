# Windows clangd and the MSVC runtime — resolved upstream

**Outcome: fixed in `arduino/clang-static-binaries`, no issue filed.**
Branch `fix/windows-broken-resolution`, PR
[#29](https://github.com/arduino/clang-static-binaries/pull/29), commit `8942c7d`.
Released as clangd **`22.1.8-2-rc2`**, which App Lab is pinned to in
`internal/lsp/scripts/versions.json`.

Kept as a record because it explains why several pieces of this repo exist — and
why others were removed again.

## What was wrong

clangd `22.1.8-2-rc1` for Windows imported the MSVC C/C++ runtime instead of
linking it statically. On a machine without a 2019-or-later Visual C++
Redistributable, `clangd.exe` exited immediately with `0xC0000135`
(`STATUS_DLL_NOT_FOUND`) and printed nothing, even for `--version`.

| binary | CRT imports | linker |
| --- | --- | --- |
| `clangd` x64 | `MSVCP140`, `VCRUNTIME140`, `VCRUNTIME140_1` (+ `api-ms-win-crt-*`) | 14.51 |
| `clangd` ARM64 | `MSVCP140`, `VCRUNTIME140` (+ `api-ms-win-crt-*`) | 14.44 |

`VCRUNTIME140_1.dll` was added in the 2019 redistributable, so a machine carrying
an older 2015/2017 one had two of the three files — any "is the redistributable
installed" check passed while clangd still could not start. That was a real user's
machine, and the reason the presence check we briefly shipped was the wrong shape.

It was a **regression**, not a long-standing gap: `clangd_15.0.0_Windows_64bit`
imports only `VERSION`, `ADVAPI32`, `KERNEL32` and `OLEAUT32` — fully static, not
even the UCRT stubs. So this was a second, independent reason 22.1.8 failed on
Windows where 15.0.0 worked, alongside the missing resource headers.

`clang-format.exe` had the same exposure. Our report covered only `clangd`.

## The fix

```
-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded
```

CMP0091 is `NEW` because LLVM declares `cmake_minimum_required(VERSION 3.20.0)`, so
CMake routes this properly instead of leaving `/MD` in the config flags. A new
**Check Windows CRT linkage** CI step now greps the built `clangd.exe` *and*
`clang-format.exe` for the three DLL names and fails the build if any appear —
validated in both directions against the dynamic 22.1.8 and static 15.0.0 binaries.

### Correction to our original suggestion

Our draft proposed `-DLLVM_USE_CRT_RELEASE=MT`. **That would have been a no-op**, for
two reasons worth recording:

1. The variable no longer exists. It was implemented by
   `llvm/cmake/modules/ChooseMSVCCRT.cmake`, which LLVM deleted in 18 — present
   through `llvmorg-17.0.1`, gone from `llvmorg-18.1.0`.
2. These are `MinSizeRel` builds, so the old variable would have had to be
   `LLVM_USE_CRT_MINSIZEREL` in any case — and the workflow already passed exactly
   that, silently dead since the repo moved past LLVM 17. CMake does not error on an
   unused `-D`; it emits a "manually specified variables were not used" notice.

The flag that works was the parenthetical in our draft, not the headline. Worth
remembering: for LLVM's CMake, prefer `CMAKE_MSVC_RUNTIME_LIBRARY` over the
`LLVM_USE_CRT_*` family, and treat a build flag that produces no observable change
as unproven rather than applied.

## What this retired in App Lab

Added for rc1, removed again for rc2:

- `applab.vcredist` in `build/windows/installer/project.nsi`
- the redistributable fetch step in `.github/workflows/release-app-lab-from-branch.yml`
- `build/windows/installer/.gitignore`
- the Microsoft entry in `THIRD-PARTY-NOTICES.md`

Kept, because neither is specific to this bug:

- `verifyClangdExecutable` (`internal/lsp/lsp_arduino.go`) — `resourcesExist` only
  stats a path and compares a version file, so "present but unrunnable" was
  invisible for any reason, not just a missing DLL.
- `Lost connection with clangd` in `clangStartFailedMarkers`
  (`internal/lsp/lsp.go`) — a clangd that dies after starting reports a *successful*
  compile, so without this marker nothing was probed and nothing reached the UI.

Also already in place before this, and confirmed still correct: `download_clangd.sh`
extracts the whole archive (`--strip-components=1`, no named member) so the
`clang-resource/` headers survive, and `artifacts.go` lists
`arduino/clangd/clang-resource` in `requiredAssets`.

---

## Still to file: `arduino/ctags`

Unrelated repo, unresolved, and the workaround here (`build_ctags.sh`,
`ensureCtagsExecutable`) is still carrying it. Two asks:

1. **Publish an `arm64-apple-darwin` build.** `package_index.json` lists ctags
   `5.8-arduino11` for `aarch64-linux-gnu`, `arm-linux-gnueabihf`, `i686-mingw32`,
   `i686-pc-linux-gnu`, `x86_64-apple-darwin` and `x86_64-pc-linux-gnu` — macOS
   arm64 is the only gap. arduino-cli runs ctags on every `.ino` preprocess with no
   way to opt out, so Apple Silicon needs Rosetta 2, which macOS does not
   preinstall. Without it every compile fails with
   `fork/exec .../ctags: bad CPU type in executable`, the language server cannot
   build a compilation database, and the editor sits at 0%.

2. **Fix the build against modern macOS SDKs.** `general.h` defines `__unused__` as
   `__attribute__((unused))`, and the SDK defines `__unused` as
   `__attribute__((__unused__))`; any SDK header using `__unused` (`dirent.h` does)
   expands through ctags' macro and the build fails with
   `use of undeclared identifier 'unused'`. Renaming ctags' private macro out of the
   reserved namespace is sufficient — it is not part of any API. Worth upstreaming
   regardless of (1), since the repository currently does not build on any recent
   Xcode.
