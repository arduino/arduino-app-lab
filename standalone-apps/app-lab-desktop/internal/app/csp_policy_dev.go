//go:build dev

package app

// `wails dev` serves the frontend built in development mode - Auth0 goes to
// the staging host, which the release policy deliberately
// does not list - so dev builds get no policy at all.
//
// Only the `dev` tag, not Wails' `dev || debug || devtools` inspector set:
// shipped builds carry `--devtools`, and `wails build -debug`/`--devtools`
// both run the production frontend the release policy is written for.
var cspPolicy = ""
