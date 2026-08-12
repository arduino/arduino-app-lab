package agent

import (
	"os"
	"runtime"
)

// allowedEnv is the allow-list of variables passed to the agent process tree
// (adapter, engine, and anything they spawn): only what it needs to run and to
// find its own login config (HOME / config dir). Everything else in the host
// environment is dropped, so unrelated ambient secrets never reach the agent
// or its tools.
var allowedEnv = []string{
	"PATH", "HOME", "USER", "LOGNAME", "SHELL",
	"LANG", "LC_ALL", "LC_CTYPE", "TZ",
	"TMPDIR", "TMP", "TEMP",
	"HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY",
	"http_proxy", "https_proxy", "no_proxy",
	"NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR", // corporate CA / MITM proxy
	"CLAUDE_CONFIG_DIR", "XDG_CONFIG_HOME",
}

// desktopEnv are the Linux session variables the sign-in flow needs: the CLI's
// login persists its credential via the Secret Service (D-Bus) and may open a
// browser. None carries a secret; absent on macOS/Windows.
var desktopEnv = []string{
	"DBUS_SESSION_BUS_ADDRESS", "XDG_RUNTIME_DIR", "XDG_CURRENT_DESKTOP",
	"DISPLAY", "WAYLAND_DISPLAY", "XAUTHORITY",
}

// windowsEnv are extra variables Windows processes need to start at all.
var windowsEnv = []string{
	"SystemRoot", "SystemDrive", "windir", "ComSpec", "PATHEXT",
	"APPDATA", "LOCALAPPDATA", "ProgramData", "ProgramFiles", "ProgramFiles(x86)",
	"USERPROFILE", "HOMEDRIVE", "HOMEPATH", "USERNAME", "NUMBER_OF_PROCESSORS",
}

// ChildEnv builds the agent's environment from the allow-list, keeping only the
// variables actually present in the host environment. It is the base every
// agent process starts from, including the ones agentauth spawns.
func ChildEnv() []string {
	allow := append(append([]string{}, allowedEnv...), desktopEnv...)
	if runtime.GOOS == "windows" {
		allow = append(allow, windowsEnv...)
	}
	env := make([]string, 0, len(allow))
	for _, k := range allow {
		if v, ok := os.LookupEnv(k); ok {
			env = append(env, k+"="+v)
		}
	}
	return env
}
