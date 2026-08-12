package lsp

import (
	"testing"

	"app-lab-desktop/internal/hostread"
)

// recordFrom feeds a raw server message through processMessage, so these cases
// cover the real path rather than a restatement of it.
func recordFrom(t *testing.T, message string) *hostread.AllowSet {
	t.Helper()

	allow := hostread.NewAllowSet()
	handler := &LSPHandler{hostReads: allow}

	if _, skip := handler.processMessage(&lspProcess{}, []byte(message)); skip {
		t.Fatalf("processMessage skipped the test message: %s", message)
	}
	return allow
}

// go-to-definition into a library header: the server answers with LocationLinks.
func TestRecordNavigableFilesFromLocationLinks(t *testing.T) {
	allow := recordFrom(t, `{
		"id": 4,
		"result": [
			{
				"targetUri": "file:///usr/include/stdio.h",
				"targetRange": { "start": { "line": 1 }, "end": { "line": 2 } }
			}
		]
	}`)

	if !allow.Allows("file:///usr/include/stdio.h") {
		t.Error("expected the definition target to be readable")
	}
}

// find-references answers with plain Locations.
func TestRecordNavigableFilesFromLocations(t *testing.T) {
	allow := recordFrom(t, `{
		"id": 7,
		"result": [
			{ "uri": "file:///Users/me/lib/sensor.cpp" },
			{ "uri": "file:///Users/me/lib/sensor.h" }
		]
	}`)

	for _, uri := range []string{
		"file:///Users/me/lib/sensor.cpp",
		"file:///Users/me/lib/sensor.h",
	} {
		if !allow.Allows(uri) {
			t.Errorf("expected %s to be readable", uri)
		}
	}
}

// WorkspaceEdit keys its changes by document URI rather than naming a field.
func TestRecordNavigableFilesFromWorkspaceEditKeys(t *testing.T) {
	allow := recordFrom(t, `{
		"id": 9,
		"result": {
			"changes": {
				"file:///Users/me/lib/sensor.h": [
					{ "newText": "renamed" }
				]
			}
		}
	}`)

	if !allow.Allows("file:///Users/me/lib/sensor.h") {
		t.Error("expected the edited document to be readable")
	}
}

func TestRecordNavigableFilesIgnoresOtherStrings(t *testing.T) {
	allow := recordFrom(t, `{
		"id": 11,
		"result": {
			"message": "loaded file:///etc/passwd",
			"rootUri": "https://example.invalid/etc/passwd"
		}
	}`)

	if allow.Allows("file:///etc/passwd") {
		t.Error("a path merely mentioned in a message must not become readable")
	}
	if allow.Allows("/etc/passwd") {
		t.Error("a non-file scheme must not become readable")
	}
}

// Notifications carry a `uri` too, but they are the server talking about files
// rather than answering a navigation request, so they must not widen the set.
func TestRecordNavigableFilesIgnoresNotifications(t *testing.T) {
	allow := recordFrom(t, `{
		"method": "textDocument/publishDiagnostics",
		"params": {
			"uri": "file:///Users/me/.ssh/id_rsa",
			"diagnostics": []
		}
	}`)

	if allow.Allows("file:///Users/me/.ssh/id_rsa") {
		t.Error("a notification must not make a file readable")
	}
}

// Nor may a server-initiated request, which is params-shaped like a response.
func TestRecordNavigableFilesIgnoresServerRequests(t *testing.T) {
	allow := recordFrom(t, `{
		"id": 12,
		"method": "workspace/applyEdit",
		"params": {
			"edit": {
				"changes": {
					"file:///Users/me/.aws/credentials": [{ "newText": "x" }]
				}
			}
		}
	}`)

	if allow.Allows("file:///Users/me/.aws/credentials") {
		t.Error("a server-initiated edit must not make a file readable")
	}
}
