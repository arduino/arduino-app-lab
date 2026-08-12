# Windows development setup

Getting this repo running natively on Windows, without WSL and without ever
granting administrator rights.

The existing setup instructions in [`README.md`](../README.md) and
[`standalone-apps/app-lab-desktop/README.md`](../standalone-apps/app-lab-desktop/README.md)
are written for macOS and Linux. They mostly work on Windows, but several steps
fail in ways whose error messages point somewhere unhelpful. This document
records what actually breaks, why, and what to do about it.

Two of the fixes were changes to the repo itself and are noted inline.

## Starting point

The machine this was worked out on had Git for Windows, Node, Yarn, and
`direnv.exe` in `C:\tools` already on `PATH`. Nothing else — no Go, no Wails,
no `wget`, `jq`, or `zip`, no shell startup files at all, and no bash hook for
direnv. If your machine differs, skip whatever is already done.

Everything below is installed per-user. `winget` is used where a package
extracts to `%LOCALAPPDATA%`; anything that insists on an elevated MSI is
avoided in favour of a portable equivalent.

## 1. Use Git Bash, not PowerShell

The repo's [`.envrc`](../.envrc) sources a bash script, so direnv only works
under Git Bash. Running `direnv allow` from PowerShell gives:

```
direnv: error Couldn't find a configuration directory for direnv
```

That is not a direnv problem. Windows defines `USERPROFILE` but not `HOME`, and
direnv locates its config directory from `HOME` or `XDG_CONFIG_HOME`. Git Bash
sets `HOME`; PowerShell does not.

Run every command in this document from Git Bash unless stated otherwise.

## 2. direnv

Install `direnv.exe` per the [gist referenced by the
README](https://gist.github.com/rmtuckerphx/4ace28c1605300462340ffa7b7001c6d)
— version `2.19.2` is the one this project has been tested against — and put it
somewhere on `PATH` such as `C:\tools`.

### The bash hook

The gist's step 7 tells you to add `eval "$(direnv hook bash)"` to `~/.bashrc`.
On Git Bash that alone is not enough, because of a long-standing path mangling
bug: [direnv#343](https://github.com/direnv/direnv/issues/343).

`direnv.exe` is a native Windows binary. MSYS2 converts `PATH` to Windows form
(`C:\a;C:\b`) when handing it to a native child process, and direnv echoes that
back into the shell. Bash cannot parse a semicolon-separated `PATH`, so after
the first hook fires **every** command fails with `command not found`.

The fix is to convert `PATH` back with `cygpath -p` after each `direnv export`.
Create `~/.bashrc`:

```bash
[ -f ~/.bash-preexec.sh ] && . ~/.bash-preexec.sh

# direnv's Windows build returns PATH in Windows form (C:\a;C:\b), which bash
# cannot use -- cygpath -p converts it back to POSIX form. See direnv/direnv#343.
_direnv_hook() {
  local previous_exit_status=$?
  eval "$(direnv export bash)"
  PATH=$(/usr/bin/cygpath -p "$PATH")
  return $previous_exit_status
}
if ! [[ "$PROMPT_COMMAND" =~ _direnv_hook ]]; then
  PROMPT_COMMAND="_direnv_hook;$PROMPT_COMMAND"
fi
```

Git Bash warns if `~/.bashrc` exists with no profile beside it, so also create
`~/.bash_profile`:

```bash
[ -f ~/.bashrc ] && . ~/.bashrc
```

### bash-preexec

Required by the READMEs, for the reasons in
[direnv#796](https://github.com/direnv/direnv/issues/796). Download it to your
home directory — `~/.bashrc` above sources it before installing the hook, which
is the order that matters:

```bash
curl -fsSL -o ~/.bash-preexec.sh \
  https://raw.githubusercontent.com/rcaloras/bash-preexec/master/bash-preexec.sh
```

### Allow the .envrc

```bash
cd /c/path/to/cloud-editor-mono
direnv allow
```

### Repo fix: PROJECT_ROOT

> Changed in [`dev-utils/dev-config/scripts/setup-dev-env.sh`](../dev-utils/dev-config/scripts/setup-dev-env.sh).

Even with the hook corrected, `PATH` came out corrupted — entries like
`C:\Program Files\Git\Users\Dave\...\node_bin`.

The script derived its root from `git rev-parse --show-toplevel`, which on Git
for Windows returns a Windows path, `C:/Users/...`. That value was prepended to
a POSIX `PATH`, where the colon after the drive letter is a separator. `PATH`
gained a bogus `C` entry and a rootless `/Users/Dave/...` one, which MSYS then
resolved relative to the Git installation directory.

Piping through `pwd` normalises it to `/c/Users/...`, with no behavioural change
on macOS or Linux:

```bash
PROJECT_ROOT=$(cd "$(git rev-parse --show-toplevel)" && pwd)
```

### Verify

Open a fresh Git Bash in the repo. direnv should download the pinned engines to
`__engines__/` on first entry:

```console
$ which node && node -v
/c/.../cloud-editor-mono/__engines__/node_bin/node
v18.15.0
```

A `ln: .../yarn_bin/...: cannot overwrite directory` warning on every load is
expected and harmless. Git Bash cannot create real symlinks without Developer
Mode, so `ln -s` copies the directory instead and the next `ln -nsf` refuses to
clobber it. Yarn still resolves to 3.5.0.

## 3. GitHub package registry token

The first direnv load writes a placeholder `.env` in the repo root. Replace the
value with a [token](https://github.com/settings/tokens) that has `repo` and
`read:package` scopes and is SSO-authorised for `arduino` and `bcmi-labs`, or
`yarn` will fail on the private `@bcmi-labs` packages.

`.env` is gitignored. Treat it as a secret — don't `cat` it into a terminal you
are sharing or recording.

## 4. Local SSL certificate

```powershell
winget install FiloSottile.mkcert
```

Then, in the repo:

```bash
mkcert -install
cd dev-utils/dev-config
mkcert -cert-file localhost+1.pem -key-file localhost+1-key.pem \
  local.arduino.cc localhost 127.0.0.1
```

Those exact filenames are what
[`dev-utils/dev-config/vite.config.shared.js`](../dev-utils/dev-config/vite.config.shared.js)
loads. Both are covered by `.gitignore`.

`mkcert -install` writes to the trust store without prompting for elevation.
The hosts entry does need it — run this once in an **elevated** PowerShell:

```powershell
Add-Content "$env:WINDIR\System32\drivers\etc\hosts" "`n127.0.0.1`tlocal.arduino.cc"
```

At this point `yarn` and `yarn start-editor` work. App Lab needs the rest.

## 5. App Lab prerequisites

[`internal/lsp/scripts/download_lsps.sh`](../standalone-apps/app-lab-desktop/internal/lsp/scripts/download_lsps.sh)
checks for `wget`, `unzip`, `zip`, `tar`, `npm`, and `jq` and exits if any is
missing. Git Bash supplies `unzip`, `tar`, and `curl`; the rest need installing.

```powershell
winget install JernejSimoncic.Wget
winget install jqlang.jq
```

### zip

`zip` is the awkward one. It is genuinely needed on Windows: `archive_asset()`
in [`internal/lsp/scripts/common.sh`](../standalone-apps/app-lab-desktop/internal/lsp/scripts/common.sh)
re-packages each downloaded language server into a bundle that gets embedded in
the binary, and `get_extension()` selects `zip` over `tar.gz` when the platform
folder name contains `windows`. On macOS and Linux the binary is checked for but
never invoked, which is why the dependency went unnoticed.

winget's `GnuWin32.Zip` is an NSIS installer that requires elevation, and the
binary it ships was built in 2008 and is unmaintained. MSYS2 packages the same
upstream source (Info-ZIP 3.0 — also what Debian and Homebrew ship), currently
built, GPG-signed, and installable by dropping one file:

```powershell
winget install Meta.Zstandard   # to unpack .tar.zst
```

```bash
cd /tmp
PKG=zip-3.0-5-x86_64.pkg.tar.zst
curl -fsSLO "https://repo.msys2.org/msys/x86_64/$PKG"
curl -fsSLO "https://repo.msys2.org/msys/x86_64/$PKG.sig"

# Verify against the MSYS2 packager key, in a throwaway keyring
curl -fsSLO https://raw.githubusercontent.com/msys2/MSYS2-keyring/master/packager/lazka.asc
export GNUPGHOME=$(mktemp -d)
gpg --quiet --import lazka.asc
gpg --verify "$PKG.sig" "$PKG"

tar --zstd -xf "$PKG" usr/bin/zip.exe
cp usr/bin/zip.exe /c/tools/
```

The signature should report key `5F944B027F7FE2091985AA2EFA11531AA0AA7F57`,
which is the `lazka` entry in MSYS2's
[`packager-keyids`](https://raw.githubusercontent.com/msys2/MSYS2-keyring/master/packager-keyids).
The "not certified with a trusted signature" warning is expected — no ownertrust
is set in a throwaway keyring.

The binary links against `msys-2.0.dll` and `msys-bz2-1.dll`, both of which Git
Bash already ships in `C:\Program Files\Git\usr\bin`, so it runs as-is.

### Go and Wails

The Go MSI wants elevation; the official zip does not.

```powershell
Invoke-WebRequest -Uri 'https://go.dev/dl/go1.26.5.windows-amd64.zip' -OutFile "$env:TEMP\go.zip"
Expand-Archive -Path "$env:TEMP\go.zip" -DestinationPath 'C:\tools' -Force
```

Add `C:\tools\go\bin` and `%USERPROFILE%\go\bin` to your **user** `PATH`, then
install the Wails CLI. Pin it to the version in
[`go.mod`](../standalone-apps/app-lab-desktop/go.mod) rather than using
`@latest`:

```powershell
go install github.com/wailsapp/wails/v2/cmd/wails@v2.13.0
```

### Verify

From a fresh Git Bash:

```bash
for t in wget jq unzip zip tar npm go wails; do
  printf '%-6s %s\n' "$t" "$(command -v "$t" || echo MISSING)"
done
```

Then `yarn start-app-lab-desktop`. The first run downloads board packages,
language servers, emoji, and learn content in parallel, which takes a while.

## 6. Line endings

> Changed in [`.gitattributes`](../.gitattributes).

`core.autocrlf=true` is the Git for Windows default, and `.gitattributes` did
not exempt `app/core-ui/src/app-lab/assets/socket.io.min.js`. Git was rewriting
that vendored bundle to CRLF on checkout, which changed its SHA-256 and so
permanently failed the integrity gate in
[`dev-utils/dev-config/scripts/download_socket_io.sh`](../dev-utils/dev-config/scripts/download_socket_io.sh):

```
worktree  e759359a3cd50622c15cd13fd19e90f80778c639c54086ca409629f62d5c0179
expected  b0e735814f8dcfecd6cdb8a7ce95a297a7e1e5f2727a29e6f5901801d52fa0c5
```

Every dev run re-downloaded it, and left a stray `socket.io.min.js.tmp` behind
when it failed. This mattered beyond noise: those bytes are embedded verbatim
into user-generated WebUI projects.

Marking the file `-text` fixes it. If you cloned before that change, force a
re-checkout:

```bash
rm app/core-ui/src/app-lab/assets/socket.io.min.js
git checkout -- app/core-ui/src/app-lab/assets/socket.io.min.js
```

## 7. Don't commit the Wails artefacts

`wails dev` dirties the working tree on every run. None of it should be
committed:

- `frontend/wailsjs/**` and `go.mod` — regenerated **byte-identically**. Only
  the mtime changes, which stales Git's stat cache; `git diff` shows nothing.
- `frontend/package.json.md5` — Wails' own cache key, unrelated to your work.
- `build/windows/icon.ico`, `info.json`, `wails.exe.manifest` — scaffolding
  Wails writes when missing. The repo intentionally tracks only
  `build/windows/installer/`.

```bash
git restore standalone-apps/app-lab-desktop/frontend/package.json.md5 \
            standalone-apps/app-lab-desktop/frontend/wailsjs \
            standalone-apps/app-lab-desktop/go.mod
rm -f standalone-apps/app-lab-desktop/build/windows/{icon.ico,info.json,wails.exe.manifest}
```

## 8. Known cosmetic issues

### `The process "NNNNN" not found` on Ctrl+C

Harmless, and upstream. `killProc` in Wails'
`cmd/wails/internal/dev/dev_windows.go` runs `TASKKILL /T /F /PID` on the
frontend dev command, but
[`frontend/scripts/dev.sh`](../standalone-apps/app-lab-desktop/frontend/scripts/dev.sh)
has already terminated that process tree via its own trap. `taskkill` exits
`128`, and Wails only suppresses exit `1`, so the message leaks through.

Shutdown is otherwise clean — ports 8000 and 34115 are released and nothing is
orphaned.

### The lsof line in dev.sh does nothing

`dev.sh` ends its shutdown trap with `lsof -ti:8000 | xargs -r kill -9`, to
catch Vite processes reparented to launchd on macOS. Git Bash has no `lsof` and
stderr is redirected, so it silently no-ops. Nothing is lost: the `TASKKILL /T`
above already kills the whole tree.

## Summary of changes to this repo

| File | Change |
| --- | --- |
| [`dev-utils/dev-config/scripts/setup-dev-env.sh`](../dev-utils/dev-config/scripts/setup-dev-env.sh) | Normalise `PROJECT_ROOT` to a POSIX path so it can be prepended to `PATH` |
| [`.gitattributes`](../.gitattributes) | Mark the vendored Socket.IO bundle `-text` so autocrlf cannot break its checksum |

Everything else is local machine setup.
