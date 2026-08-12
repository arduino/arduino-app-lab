//go:build !dev

package app

import "strings"

// Gated on the `dev` tag alone, NOT on Wails' wider `dev || debug || devtools`
// inspector set: the release workflow ships with `wails build --devtools`
// (.github/actions/wails-build-action), so a policy absent from devtools
// builds would be absent from every artifact we ship. `debug` and `devtools`
// builds run the production frontend against production hosts, which is
// exactly what this policy describes - only `wails dev` (staging login host,
// Vite dev server) needs it off.
var cspPolicy = strings.Join([]string{
	// No plugins and no nested browsing contexts: `<object>`, `<embed>` and
	// `<iframe srcdoc="...">` are the ways rendered content could get script
	// running in our origin, where the Wails bindings live.
	"object-src 'none'",
	"frame-src 'none'",
	// Nothing may frame us, and nothing may retarget relative URLs.
	"frame-ancestors 'none'",
	"base-uri 'none'",
	// Where the webview itself is allowed to talk. Everything else the app
	// needs goes out through Go (the Arduino Cloud REST calls behind
	// MakeHTTPRequest, updates, the Learn bundle), which no policy governs.
	//
	//   localhost      the board's orchestrator and cloud connector, reached on
	//                  a tunnel port allocated at runtime - hence the wildcard.
	//                  `ws:` is listed separately because an `http:` source does
	//                  not authorize a `ws:` URL, and the serial monitor
	//                  connects to /v1/monitor/ws.
	//   127.0.0.1      the same loopback services under their numeric address.
	//                  CSP compares hosts as written, so this is not implied by
	//                  `localhost`, and a service that binds the numeric address
	//                  (an in-process helper listening on 127.0.0.1:0) would be
	//                  refused without it.
	//   login          Auth0 token exchange and refresh. Only the production
	//                  host: a build pointed at staging is a
	//                  dev build, and those get no policy at all.
	//   studio         Edge Impulse API and its OAuth token endpoint.
	//   downloads      startup message, release notes, mandatory-update check.
	//
	// Note `'self'` is `wails://wails` here (`http://wails.localhost` on
	// Windows), not an http origin, so it covers only same-origin requests to
	// the asset server.
	strings.Join([]string{
		"connect-src 'self'",
		"http://localhost:*",
		"http://127.0.0.1:*",
		"ws://localhost:*",
		"ws://127.0.0.1:*",
		"https://login.arduino.cc",
		"https://studio.edgeimpulse.com",
		"https://downloads.arduino.cc",
	}, " "),
}, "; ")
