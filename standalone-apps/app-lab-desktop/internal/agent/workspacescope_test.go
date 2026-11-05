package agent

import (
	"path/filepath"
	"strings"
	"testing"
)

// One "Always allow" on Edit used to cover every app's mirror, reaching the board with nothing shown; this predicate is what stops that and badges the prompt.
func TestWritesOutsideWorkspace(t *testing.T) {
	root := t.TempDir()
	ws := filepath.Join(root, "board__user-blink-3fa2c1")
	other := filepath.Join(root, "board__user-other-9de4f0")

	edit := func(path string) *ToolCall {
		return &ToolCall{Kind: "edit", Title: "Edit", Paths: []string{path}}
	}

	cases := []struct {
		name string
		tc   *ToolCall
		dir  string
		want bool
	}{
		{"a write inside the workspace app", edit(filepath.Join(ws, "python/main.py")), ws, false},
		{"a write into another app", edit(filepath.Join(other, "python/main.py")), ws, true},
		{"a write in the mirror root itself", edit(filepath.Join(root, "stray.py")), ws, true},
		{"a traversal out of the workspace", edit(filepath.Join(ws, "..", "other", "x.py")), ws, true},
		// The general workspace scopes nothing, and reading elsewhere is allowed on purpose: the workspace steers, it does not jail.
		{"a read outside", &ToolCall{Kind: "read", Paths: []string{filepath.Join(other, "main.py")}}, ws, false},
		// Deletes and moves change the board just as much as an edit.
		{"a delete outside", &ToolCall{Kind: "delete", Paths: []string{filepath.Join(other, "main.py")}}, ws, true},
		// A call whose target we cannot see must not be treated as outside, or everything would prompt forever.
		{"no path at all", &ToolCall{Kind: "edit", Title: "Edit"}, ws, false},
		{"nil tool call", nil, ws, false},
		// Kind is optional on a permission request (toToolCallRef leaves it empty). Reading that as "inside" would
		// give this the same grant key as an edit at home, and the next one would be auto-approved unprompted.
		{"no kind, path in another app", &ToolCall{Title: "Edit", Paths: []string{filepath.Join(other, "main.py")}}, ws, true},
		{"no kind, path at home", &ToolCall{Title: "Edit", Paths: []string{filepath.Join(ws, "main.py")}}, ws, false},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := actsOutsideWorkspace(c.tc, "user:blink", c.dir, root); got != c.want {
				t.Errorf("got %v, want %v", got, c.want)
			}
		})
	}
}

// Locations are what the agent declares; without them the native file tools still carry the path in their arguments.
func TestToolCallPathsFallsBackToArguments(t *testing.T) {
	tc := &ToolCall{Kind: "edit", Input: map[string]any{"file_path": "/m/app/main.py", "old_string": "a"}}
	if got := toolCallPaths(tc); len(got) != 1 || got[0] != "/m/app/main.py" {
		t.Errorf("path not read from the arguments: %v", got)
	}
	if got := toolCallPaths(&ToolCall{Kind: "edit", Input: "not a map"}); got != nil {
		t.Errorf("a non-map input should yield no paths, got %v", got)
	}
}

// Board tools name their target app, so "outside" is exact for them: apps_start on another app must still prompt.
func TestActsOutsideWorkspaceForBoardTools(t *testing.T) {
	const mine, theirs = "dXNlcjpibGluaw", "dXNlcjpvdGhlcg"
	callFn := func(input map[string]any) *ToolCall {
		return &ToolCall{Kind: "other", Title: "mcp__arduino-board__apps_start", Input: input}
	}

	if actsOutsideWorkspace(callFn(map[string]any{"id": mine}), mine, "", "") {
		t.Error("acting on the workspace app was flagged as outside")
	}
	if !actsOutsideWorkspace(callFn(map[string]any{"id": theirs}), mine, "", "") {
		t.Error("acting on another app was not flagged")
	}
	if !actsOutsideWorkspace(callFn(map[string]any{"appId": theirs}), mine, "", "") {
		t.Error("the appId spelling was not read")
	}
	// apps_create names no app: it is allowed to land outside, and its own tool description says so.
	if actsOutsideWorkspace(callFn(map[string]any{"name": "new one"}), mine, "", "") {
		t.Error("a tool that names no app was flagged")
	}
	// Without a workspace there is nothing to be outside of.
	if actsOutsideWorkspace(callFn(map[string]any{"id": theirs}), "", "", "") {
		t.Error("the general workspace constrained a call")
	}
}

// models_delete takes a MODEL id, bricks_get a BRICK id: reading any "id" as an app's would badge them wrongly and break their "Always allow".
func TestOnlyAppToolsAreMatchedByAppID(t *testing.T) {
	const mine = "dXNlcjpibGluaw"
	callFn := func(title string, input map[string]any) *ToolCall {
		return &ToolCall{Kind: "other", Title: "mcp__arduino-board__" + title, Input: input}
	}

	notAnApp := []struct{ tool, id string }{
		{"models_delete", "yolox-object-detection"},
		{"bricks_get", "arduino:video_object_detection"},
	}
	for _, c := range notAnApp {
		if actsOutsideWorkspace(callFn(c.tool, map[string]any{"id": c.id}), mine, "", "") {
			t.Errorf("%s: a %q id was read as an app id", c.tool, c.id)
		}
	}

	appTools := []string{"apps_start", "apps_delete", "app_bricks_add", "app_files_rename", "app_files_delete", "sketch_libraries_add"}
	for _, tool := range appTools {
		key := "id"
		if strings.HasPrefix(tool, "app_bricks_") {
			key = "appId"
		}
		if !actsOutsideWorkspace(callFn(tool, map[string]any{key: "dXNlcjpvdGhlcg"}), mine, "", "") {
			t.Errorf("%s on another app was not flagged", tool)
		}
		if actsOutsideWorkspace(callFn(tool, map[string]any{key: mine}), mine, "", "") {
			t.Errorf("%s on the workspace app was flagged", tool)
		}
	}

	// apps_create names no app on purpose: a new app is allowed to land outside.
	if actsOutsideWorkspace(callFn("apps_create", map[string]any{"name": "new"}), mine, "", "") {
		t.Error("apps_create was flagged")
	}
}

// The agent's paths are relative to the session's cwd, not App Lab's: the wrong base made every relative edit look like it left the workspace.
func TestRelativePathsAreAnchoredToTheSessionCwd(t *testing.T) {
	root := "/tmp/ai-mirror"
	ws := filepath.Join(root, "board__user-blink-3fa2c1")
	rel := func(p string) *ToolCall { return &ToolCall{Kind: "edit", Paths: []string{p}} }

	if actsOutsideWorkspace(rel("board__user-blink-3fa2c1/python/main.py"), "user:blink", ws, root) {
		t.Error("a relative path inside the workspace was read as outside")
	}
	if !actsOutsideWorkspace(rel("board__user-other-9de4f0/python/main.py"), "user:blink", ws, root) {
		t.Error("a relative path in another app was not flagged")
	}
}

// The prefix is the engine's; the name behind it is what decides the app scope and the grant key.
func TestBareToolNameStripsTheWirePrefix(t *testing.T) {
	cases := map[string]string{
		"mcp__arduino-board__apps_start":     "apps_start",
		"apps_start":                         "apps_start", // bare, as our MCP server declares it
		"Edit":                               "Edit",       // a native tool carries no prefix
		"":                                   "",
		"arduino-board_apps_start":           "apps_start", // OpenCode: one underscore, no wrapping
		"mcp__arduino-board__app_bricks_add": "app_bricks_add",
		"arduino-board_sketch_libraries_add": "sketch_libraries_add",
		// A native name of its own, underscores and all: trimming inside it would lose the tool.
		"read_file":                "read_file",
		"sketch_libraries_add":     "sketch_libraries_add",
		"arduino_board_apps_start": "arduino_board_apps_start", // not the server name
		// Another server's tool, and an edit whose title holds a "<board>__<app>" mirror path: none is a board tool.
		"mcp__another-server__apps_start":                              "mcp__another-server__apps_start",
		"Edit 2923045065__user-blink-6b812e/python/main.py":            "Edit 2923045065__user-blink-6b812e/python/main.py",
		"/root/ai-mirror/2923045065__user-blink-6b812e/python/main.py": "/root/ai-mirror/2923045065__user-blink-6b812e/python/main.py",
	}
	for title, want := range cases {
		if got := bareToolName(title); got != want {
			t.Errorf("bareToolName(%q) = %q, want %q", title, got, want)
		}
	}
}

// The app a board tool names scopes both the "outside this app" badge and the "Always allow" grant.
func TestBoardToolsAreScopedUnderEitherEnginesNaming(t *testing.T) {
	const mine, theirs = "dXNlcjpibGluaw", "dXNlcjpvdGhlcg"
	for _, title := range []string{
		"mcp__arduino-board__apps_start", // Claude's adapter
		"arduino-board_apps_start",       // OpenCode: a single underscore
		// A bare name carrying underscores of its own, in both spellings.
		"mcp__arduino-board__sketch_libraries_add",
		"arduino-board_sketch_libraries_add",
	} {
		t.Run(title, func(t *testing.T) {
			own := &ToolCall{Kind: "other", Title: title, Input: map[string]any{"id": mine}}
			other := &ToolCall{Kind: "other", Title: title, Input: map[string]any{"id": theirs}}

			if got, ok := toolCallAppID(other); !ok || got != theirs {
				t.Fatalf("toolCallAppID = %q, %v; want the app the call names", got, ok)
			}
			if !actsOutsideWorkspace(other, mine, "", "") {
				t.Error("starting another app was not flagged as outside the workspace")
			}
			if actsOutsideWorkspace(own, mine, "", "") {
				t.Error("starting the workspace app was flagged as outside it")
			}
			ownKey, _ := grantKey(own)
			otherKey, _ := grantKey(other)
			if ownKey == otherKey {
				t.Errorf("both apps share the grant key %q, so one always-allow covers every app", ownKey)
			}
		})
	}
}

// A model sometimes pads an app id with "=": it still names the same app, so the call is not outside it and shares its grant.
func TestAPaddedAppIDNamesTheSameApp(t *testing.T) {
	const mine = "dXNlcjpxYS1pbXAtbDQtMTAwMjQxLWk"
	padded := &ToolCall{Kind: "other", Title: "mcp__arduino-board__apps_start", Input: map[string]any{"id": mine + "="}}
	if got, ok := toolCallAppID(padded); !ok || got != mine {
		t.Errorf("toolCallAppID = %q, %v; want %q", got, ok, mine)
	}
	if actsOutsideWorkspace(padded, mine, "", "") {
		t.Error("a call on the chat's own app, with a padded id, was flagged as outside it")
	}
	plain := &ToolCall{Kind: "other", Title: "mcp__arduino-board__apps_start", Input: map[string]any{"id": mine}}
	paddedKey, _ := grantKey(padded)
	plainKey, _ := grantKey(plain)
	if paddedKey != plainKey {
		t.Errorf("grant keys differ: %q and %q", paddedKey, plainKey)
	}
	if _, ok := toolCallAppID(&ToolCall{Title: "mcp__arduino-board__apps_start", Input: map[string]any{"id": "=="}}); ok {
		t.Error("an id of padding alone named an app")
	}
}

// A model also passes the id decoded (user:<folder>) or in base64's standard alphabet; the board tools take both, so each names the same app here too.
func TestADecodedAppIDNamesTheSameApp(t *testing.T) {
	const mine = "dXNlcjpxYS1pbXAtbDQtMTAwMjQxLWk" // user:qa-imp-l4-100241-i
	call := func(id string) *ToolCall {
		return &ToolCall{Kind: "other", Title: "mcp__arduino-board__apps_start", Input: map[string]any{"id": id}}
	}
	plainKey, _ := grantKey(call(mine))
	for _, spelling := range []string{"user:qa-imp-l4-100241-i", " user:qa-imp-l4-100241-i\n"} {
		if got, ok := toolCallAppID(call(spelling)); !ok || got != mine {
			t.Errorf("toolCallAppID(%q) = %q, %v; want %q", spelling, got, ok, mine)
		}
		if actsOutsideWorkspace(call(spelling), mine, "", "") {
			t.Errorf("a call on the chat's own app, as %q, was flagged as outside it", spelling)
		}
		if key, _ := grantKey(call(spelling)); key != plainKey {
			t.Errorf("grant key for %q = %q, want %q", spelling, key, plainKey)
		}
	}
	if got, _ := toolCallAppID(call("dXNlcjp+")); got != "dXNlcjp-" { // user:~
		t.Errorf("an id in the standard alphabet read as %q, want %q", got, "dXNlcjp-")
	}
}

// A native title can hold "__" of its own (a Python package's __init__.py, a __main__.py): it is no board tool, and its grant is the file's.
func TestANativeTitleWithDoubleUnderscoresIsNoBoardTool(t *testing.T) {
	for name, tc := range map[string]*ToolCall{
		"Claude, cwd-relative": {Title: "Edit python/__init__.py", Kind: "edit",
			Input: map[string]any{"file_path": "/root/ai-mirror/python/__init__.py", "old_string": "a", "new_string": "SECRET = 'x'"}},
		"Claude, in a mirror folder": {Title: "Edit 2923045065__user-blink-6b812e/python/__init__.py", Kind: "edit",
			Input: map[string]any{"file_path": "/root/ai-mirror/2923045065__user-blink-6b812e/python/__init__.py", "old_string": "a", "new_string": "SECRET = 'x'"}},
		"OpenCode": {Title: "/root/ai-mirror/2923045065__user-blink-6b812e/python/__main__.py", Kind: "edit",
			Paths: []string{"/root/ai-mirror/2923045065__user-blink-6b812e/python/__main__.py"},
			Input: map[string]any{"filepath": "/root/ai-mirror/2923045065__user-blink-6b812e/python/__main__.py", "diff": "+SECRET = 'x'"}},
	} {
		if isBoardTool(tc.Title) || bareToolName(tc.Title) != tc.Title || namesAnApp(tc.Title) {
			t.Errorf("%s: isBoardTool %v, bareToolName %q, namesAnApp %v; want false, the title, false",
				name, isBoardTool(tc.Title), bareToolName(tc.Title), namesAnApp(tc.Title))
		}
		if key, ok := grantKey(tc); !ok || key != "edit\x00"+tc.Title+"\x00" {
			t.Errorf("%s: grant key %q (%v), want the file's own key with no edit text", name, key, ok)
		}
	}
}
