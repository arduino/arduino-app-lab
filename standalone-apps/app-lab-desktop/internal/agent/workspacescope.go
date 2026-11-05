package agent

import (
	"path/filepath"
	"strings"

	"app-lab-desktop/internal/appid"
)

// Tool kinds that change files: reads and searches outside the workspace are fine, a write is what the user has to be told about.
var mutatingFileKinds = map[string]bool{"edit": true, "delete": true, "move": true}

// toolCallPaths lists the files a call will touch: ACP's locations when the agent sends them, otherwise the native file tools' path arguments.
func toolCallPaths(tc *ToolCall) []string {
	if tc == nil {
		return nil
	}
	if len(tc.Paths) > 0 {
		return tc.Paths
	}
	input, ok := tc.Input.(map[string]any)
	if !ok {
		return nil
	}
	var paths []string
	for _, key := range []string{"file_path", "filePath", "path", "notebook_path"} {
		if p, ok := input[key].(string); ok && strings.TrimSpace(p) != "" {
			paths = append(paths, p)
		}
	}
	return paths
}

// actsOutsideWorkspace reports whether a call changes something outside the session's workspace app; an unknown target reads as inside, since guessing "outside" would prompt for everything.
func actsOutsideWorkspace(tc *ToolCall, workspaceApp, workspaceDir, sessionCwd string) bool {
	if tc == nil || workspaceApp == "" {
		return false
	}
	if target, ok := toolCallAppID(tc); ok {
		return target != workspaceApp
	}
	kind := strings.ToLower(tc.Kind)
	// A permission request can arrive without a kind (toToolCallRef leaves it empty), and reading that as
	// "inside" would give an edit in another app the same grant key as one at home. Judged by path instead:
	// the cost is a prompt on a read that left the workspace, against a silent write the other way.
	if workspaceDir == "" || (kind != "" && !mutatingFileKinds[kind]) {
		return false
	}
	for _, p := range toolCallPaths(tc) {
		if !withinDir(workspaceDir, resolvePath(sessionCwd, p)) {
			return true
		}
	}
	return false
}

// resolvePath anchors a relative tool path to the session's cwd — the mirror root — which is what the agent's paths are relative to, not App Lab's own directory.
func resolvePath(sessionCwd, path string) string {
	if filepath.IsAbs(path) || sessionCwd == "" {
		return path
	}
	return filepath.Join(sessionCwd, path)
}

// appTargetedToolPrefixes are the board tools acting on one app, matched by NAME: other tools take an "id" that is not an app's (models_delete, bricks_get).
var appTargetedToolPrefixes = []string{"apps_", "app_bricks_", "app_files_", "sketch_libraries_"}

// toolCallAppID reads the app a board tool is aimed at, "" when it targets none — apps_create names no app, and non-board tools have none at all.
func toolCallAppID(tc *ToolCall) (string, bool) {
	if !namesAnApp(tc.Title) {
		return "", false
	}
	input, ok := tc.Input.(map[string]any)
	if !ok {
		return "", false
	}
	for _, key := range []string{"appId", "appID", "id"} {
		// Read as the board tools read it, so a call names the app it acts on.
		if v, ok := input[key].(string); ok && appid.Canonical(v) != "" {
			return appid.Canonical(v), true
		}
	}
	return "", false
}

// namesAnApp reports whether a board tool acts on an app it must name; apps_create makes a new one instead.
func namesAnApp(title string) bool {
	name := bareToolName(title)
	return name != "apps_create" && targetsAnApp(name)
}

func targetsAnApp(name string) bool {
	for _, p := range appTargetedToolPrefixes {
		if strings.HasPrefix(name, p) {
			return true
		}
	}
	return false
}

// isBoardTool reports a call to the board's MCP server, in either engine's spelling.
func isBoardTool(title string) bool { return bareToolName(title) != title }

// bareToolName drops the board server's prefix in either engine's spelling, and only that: an edit's title holds a "<board>__<app>" path.
func bareToolName(title string) string {
	for _, prefix := range []string{claudeToolName(boardMCPServerName, ""), openCodeToolName(boardMCPServerName, "")} {
		if name, ok := strings.CutPrefix(title, prefix); ok && name != "" {
			return name
		}
	}
	return title
}

// withinDir reports whether path sits inside dir, comparing cleaned absolute paths so ".." cannot walk out of it.
func withinDir(dir, path string) bool {
	absDir, err := filepath.Abs(dir)
	if err != nil {
		return false
	}
	absPath, err := filepath.Abs(path)
	if err != nil {
		return false
	}
	rel, err := filepath.Rel(absDir, absPath)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
