//go:build !dev

package app

import (
	"strings"
	"testing"
)

// The release policy has to keep denying the sinks that could get script into
// our origin, where the bindings are reachable.
func TestReleaseCSPPolicyDeniesScriptSinks(t *testing.T) {
	for _, directive := range []string{
		"object-src 'none'",
		"frame-src 'none'",
		"frame-ancestors 'none'",
		"base-uri 'none'",
	} {
		if !strings.Contains(cspPolicy, directive) {
			t.Errorf("release policy %q is missing %q", cspPolicy, directive)
		}
	}
}

// connect-src is the one directive that can break the app rather than just
// harden it: the orchestrator, the serial monitor socket, login, Edge Impulse
// and the downloads bucket are all reached by the webview itself.
func TestReleaseCSPPolicyKeepsReachableOriginsConnectable(t *testing.T) {
	connectSrc := ""
	for _, directive := range strings.Split(cspPolicy, "; ") {
		if strings.HasPrefix(directive, "connect-src ") {
			connectSrc = directive
		}
	}
	if connectSrc == "" {
		t.Fatalf("release policy %q has no connect-src", cspPolicy)
	}

	for _, source := range []string{
		"http://localhost:*",             // orchestrator and cloud connector, on a runtime port
		"http://127.0.0.1:*",             // the same, under the numeric address CSP will not infer
		"ws://localhost:*",               // serial monitor, which an http: source would not cover
		"ws://127.0.0.1:*",               // and its numeric spelling, for the same reason
		"https://login.arduino.cc",       // auth0 token endpoint
		"https://studio.edgeimpulse.com", // edge impulse api and oauth
		"https://downloads.arduino.cc",   // startup message, release notes, mandatory updates
	} {
		if !strings.Contains(connectSrc, source) {
			t.Errorf("connect-src %q is missing %q", connectSrc, source)
		}
	}
}
