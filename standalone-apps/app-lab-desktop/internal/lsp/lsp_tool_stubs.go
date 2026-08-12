package lsp

import (
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// cltStubDirName holds a shadow for every macOS Command Line Tools shim a language
// server or its children can reach, placed ahead of /usr/bin on the PATH of every
// server we spawn. See ensureCltStubDir.
const cltStubDirName = "clt-shim"

// toolStubLogName records every shadow invocation.
//
// This class of bug is reported from the field and does not reproduce: a tester saw
// the python3 dialog once, then never again after restarting and reinstalling. With
// no record there is no way to tell "our shadow intercepted the probe" from "the
// probe reached /usr/bin anyway" from "the dialog was left over from an older
// build" — three explanations needing three different fixes. The shadows are shell
// scripts we already write on every start, so saying so costs nothing.
const toolStubLogName = "tool-stubs.log"

// developerToolDirs are the real tool directories behind the /usr/bin shims, in the
// order xcode-select would consult them.
//
// /usr/bin is deliberately absent: that is the shim, and executing it is the one
// thing these shadows exist to prevent. Reaching the same binary by its true path
// never raises a dialog.
//
// Third-party interpreter locations (/opt/homebrew/bin, /usr/local/bin) are
// deliberately absent too, though it may look like an oversight. A Finder-launched
// app inherits PATH=/usr/bin:/bin:/usr/sbin:/sbin from launchd, so a Homebrew
// interpreter was never reachable from a spawned server to begin with. Delegating
// there would hand our servers an interpreter they have never had — a new
// capability, not the restoration of an old one, and one that would vary per
// machine. Delegating only here means a shadow behaves exactly as if it were not
// installed, minus the dialog.
var developerToolDirs = []string{
	"/Library/Developer/CommandLineTools/usr/bin",
	"/Applications/Xcode.app/Contents/Developer/usr/bin",
}

// toolStub is one shadowed tool. An empty searchPath means the shadow always
// refuses: the prober's answer is unused, so there is nothing to delegate to.
type toolStub struct {
	name       string
	searchPath []string
}

// cltStubs is every tool we shadow.
//
// One directory shared by every server rather than one per server. The previous
// split — an xcrun shim for the Arduino server, a python3 shim for the Python one —
// scoped each shadow to the tree that was known to probe it, which left the other
// trees with no net: nothing stopped an arduino-cli platform recipe from invoking
// python3, and the formatter and the Node-based servers had no shadows at all.
// Since a shadow that delegates is inert where the tool is legitimately used, the
// tight scoping bought less than the uniformity costs.
func cltStubs() []toolStub {
	return []toolStub{
		// clangd probes the Apple toolchain once at startup regardless of the target
		// it is asked to compile for: `xcrun --find clang` for a clang path and
		// `xcrun --show-sdk-path` for a sysroot.
		//
		// Neither answer is used: we cross-compile for arm-zephyr-eabi with the
		// toolchain's own headers (the cc1 line is -nostdsysteminc plus explicit
		// -internal-isystem paths). Verified by A/B — a real working xcrun and a
		// failing one produce byte-identical include paths and diagnostics, and
		// clangd itself logs "If you have a non-apple toolchain, this is OK" and
		// carries on.
		//
		// So this one never delegates: there is nothing to delegate *for*, and a
		// real xcrun on a machine with Xcode would hand clangd a macOS sysroot it
		// has never had. Exiting non-zero is the branch clangd already handles;
		// succeeding with empty output would risk it building an invalid empty
		// sysroot instead.
		{name: "xcrun"},

		// basedpyright probes for a host interpreter as soon as it analyses a file.
		//
		// This is the belt to ensurePythonVenvStub's braces, and it is the part that
		// actually works for the language server. venvPath/venv makes the *CLI*
		// short circuit before it ever looks for an interpreter, which is what was
		// verified originally — but the language server does not take that path.
		// Driving a real LSP session shows zero probes during `initialize` and then
		// six the moment it starts analysing a file, with our venvPath config
		// already applied. So the config alone never stops the dialog.
		//
		// Refusing is safe when there is nothing to delegate to, for the same reason
		// the venv stub is: nothing we analyse needs the host interpreter. Verified
		// by driving the language server with python3 unreachable — it still
		// resolves stdlib from the bundled typeshed and arduino.app_bricks from
		// extraPaths, and still reports the one genuine type error.
		//
		// Delegation matters for the other trees rather than this one. An
		// arduino-cli platform recipe may shell out to python3 (esp32-style cores
		// do), and on a machine with the Command Line Tools that call resolves
		// today through /usr/bin. Refusing outright would turn a working build into
		// a broken one; delegating keeps it working while still never touching the
		// shim.
		//
		// Both names are shadowed because the probe falls back from python3 to
		// python.
		{name: "python3", searchPath: developerToolDirs},
		{name: "python", searchPath: developerToolDirs},
	}
}

func toolStubLogPath() string {
	return filepath.Join(getLspTempWorkspaceLogsDir(), toolStubLogName)
}

// cltStubDir installs the shadows and returns the directory to prepend to a spawned
// server's PATH.
func cltStubDir() string {
	return ensureCltStubDir(getPersistentWorkspaceBase(), toolStubLogPath())
}

// ensureCltStubDir writes a shadow for every tool in cltStubs() into
// <base>/clt-shim and returns that directory.
//
// macOS ships shims at /usr/bin for the developer tools (xcrun, python3, cc, git,
// make…) whose only job, when the Xcode Command Line Tools are absent, is to raise
// the "requires the command line developer tools" dialog. Several language servers
// probe for those tools unconditionally, so on a stock Mac the user gets a system
// dialog — one we cannot dismiss and did not ask for — for a probe whose answer we
// do not need. Shadowing the tool for one process tree means the probe never
// reaches Apple's shim.
//
// Takes base and logPath rather than resolving them so a test does not write into
// the caller's real install (getPersistentWorkspaceBase is fixed at init and cannot
// be redirected).
//
// Returns "" off darwin (nothing to intercept) or if a shadow cannot be written. An
// empty PathPrefix leaves the child's environment untouched, which is precisely the
// state in which the dialog can appear — hence the warning rather than a silent
// return.
func ensureCltStubDir(base, logPath string) string {
	if runtime.GOOS != "darwin" {
		return ""
	}

	dir := getSubDir(base, cltStubDirName)
	for _, stub := range cltStubs() {
		path := filepath.Join(dir, stub.name)
		// Rewritten on every start rather than checked: these are short scripts,
		// and a truncated or non-executable one would silently hand the probe back
		// to /usr/bin.
		if err := os.WriteFile(path, []byte(stubScript(stub, logPath)), 0o755); err != nil {
			slog.Warn("could not write tool stub; the developer-tools dialog may appear", "path", path, "error", err)
			return ""
		}
	}
	return dir
}

// stubScript renders the shadow for one tool.
func stubScript(stub toolStub, logPath string) string {
	var delegate strings.Builder
	for _, dir := range stub.searchPath {
		delegate.WriteString(strings.NewReplacer(
			"__CANDIDATE__", shQuote(filepath.Join(dir, stub.name)),
		).Replace(stubDelegateBlock))
	}
	return strings.NewReplacer(
		"__TOOL__", shQuote(stub.name),
		"__LOG__", shQuote(logPath),
		"__DELEGATE__", delegate.String(),
	).Replace(stubScriptTemplate)
}

// Kept as a template rather than built with fmt so the shell stays readable, and so
// its own printf verbs need no escaping.
const stubScriptTemplate = `#!/bin/sh
# Installed by App Lab — see ensureCltStubDir in lsp_tool_stubs.go. Rewritten on
# every language server start, so edits here are lost.
#
# Shadows the /usr/bin Command Line Tools shim of the same name. Executing that
# shim on a Mac without Xcode raises the "requires the command line developer
# tools" dialog, which is the whole reason this file exists.
tool=__TOOL__
log=__LOG__

note() {
	printf '%s %s stub: %s\n' "$(/bin/date -u '+%Y-%m-%dT%H:%M:%SZ')" "$tool" "$1" >>"$log" 2>/dev/null
}
__DELEGATE__
# Refusing is the branch every prober reaching this point already tolerates.
# Also on stderr: the parent server's stderr is captured (see logProcessStderr), so
# this still reaches the app log when the log file itself is unwritable — the case
# where a missing PathPrefix and a working shadow look identical from outside.
note 'refusing: no real tool outside /usr/bin'
printf 'app-lab: %s stub refusing: no real tool outside /usr/bin\n' "$tool" >&2
exit 1
`

// stubDelegateBlock hands off to a real installation when the machine has one, so a
// consumer that genuinely needs the tool still works. Recorded in the log file
// only: this is the everything-is-normal path, and writing to stderr would pollute
// the output of the tool we are about to become.
const stubDelegateBlock = `
candidate=__CANDIDATE__
if [ -x "$candidate" ]; then
	note "delegating to $candidate"
	exec "$candidate" "$@"
fi
`

// shQuote renders s as a single /bin/sh word. The workspace base sits under
// ~/Library/Application Support, so these paths contain spaces.
func shQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}
