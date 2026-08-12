package agent

import (
	"strings"
	"testing"
)

// ChildEnv must carry what the agent needs but drop unrelated ambient secrets.
func TestChildEnvDropsUnrelatedSecrets(t *testing.T) {
	t.Setenv("HOME", "/home/test")
	t.Setenv("AWS_SECRET_ACCESS_KEY", "leak-me")

	var hasHome, leaked bool
	for _, kv := range ChildEnv() {
		switch {
		case strings.HasPrefix(kv, "HOME="):
			hasHome = true
		case strings.HasPrefix(kv, "AWS_SECRET_ACCESS_KEY="):
			leaked = true
		}
	}
	if !hasHome {
		t.Fatal("ChildEnv must pass HOME (the agent's login dir)")
	}
	if leaked {
		t.Fatal("ChildEnv must not leak unrelated ambient secrets")
	}
}

// The allow-list must keep what the agent and its sign-in genuinely need:
// dropping one of these breaks them in ways no other test would catch.
func TestChildEnvKeepsWhatTheAgentNeeds(t *testing.T) {
	for _, k := range []string{
		"PATH", "HOME", "TMPDIR",
		"LANG",                    // locale, so output isn't mojibake
		"HTTPS_PROXY", "NO_PROXY", // corporate egress
		"NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", // MITM proxy CA
		"DBUS_SESSION_BUS_ADDRESS", "XDG_RUNTIME_DIR", // the login CLI's keychain access on Linux
	} {
		t.Setenv(k, "set-"+k)
		if envValue(ChildEnv(), k) != "set-"+k {
			t.Errorf("ChildEnv must pass %s", k)
		}
	}
}

func envValue(env []string, key string) string {
	for _, kv := range env {
		if k, v, ok := strings.Cut(kv, "="); ok && k == key {
			return v
		}
	}
	return ""
}
