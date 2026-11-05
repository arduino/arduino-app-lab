package boardmcp

import (
	"context"
	"fmt"
	"path"
	"strings"
	"unicode"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"app-lab-desktop/internal/appid"
	"app-lab-desktop/internal/appmirror"
)

type appFilesRenameInput struct {
	ID   string `json:"id" jsonschema:"the app id from apps_list"`
	From string `json:"from" jsonschema:"the file or folder to rename, relative to the app folder, e.g. python/utils.py or assets/icons"`
	To   string `json:"to" jsonschema:"its new path, relative to the app folder, e.g. python/helpers.py or assets/images; nothing may exist there yet"`
}

type appFilesDeleteInput struct {
	ID   string `json:"id" jsonschema:"the app id from apps_list"`
	Path string `json:"path" jsonschema:"the file or folder to delete, relative to the app folder, e.g. python/old.py or assets/unused"`
}

const appFilesRenameDescription = "Rename or move a file or folder inside one of the user's Arduino Apps on the connected board. " +
	"It is the rename of App Lab's file tree: the user's open editor tabs follow it, and your checkout of the app is refreshed from the board. " +
	"Use it whenever the user asks to rename or move app files or folders: never re-create them under the new name with Write, and never use board_exec. " +
	"Paths are relative to the app folder; nothing may exist at the new path yet. The tool checks the board itself, so a path your checkout does not show yet is fine. " +
	"app.yaml, python/main.py, sketch/sketch.ino, sketch/sketch.yaml and the python/, sketch/ and assets/ folders keep their names and places, and the files of a built-in example, an installed App release or an app outside the user's apps folder cannot be changed. " +
	"Mutating — asks the user for permission."

const appFilesDeleteDescription = "Delete a file or folder, with everything in it, inside one of the user's Arduino Apps on the connected board. " +
	"It is the delete of App Lab's file tree, and your checkout of the app is refreshed from the board. This CANNOT be undone. " +
	"Use it whenever the user asks to delete app files or folders: never use board_exec. " +
	"The path is relative to the app folder. " +
	"As in App Lab's file tree, app.yaml, the python/ folder, python/main.py, sketch/sketch.ino and sketch/sketch.yaml cannot be deleted, and the files of a built-in example, an installed App release or an app outside the user's apps folder cannot be changed. " +
	"Mutating — asks the user for permission."

// fileTreeProtected are the paths App Lab's file tree never renames, moves or deletes (canEditFile and the python folder in ui-components file-tree/utils.ts).
var fileTreeProtected = map[string]bool{
	"app.yaml": true, "app.yml": true, "python": true, "python/main.py": true,
	"sketch/sketch.ino": true, "sketch/sketch.yaml": true, "sketch/sketch.yml": true,
}

// fixedFolders are optional, so deleting one is fine, but the app only finds them under these names: the file tree allows the move, the tool does not.
var fixedFolders = map[string]bool{"sketch": true, "assets": true}

// registerAppFilesRename adds app_files_rename (mutating). Off the read-only allowlist so the agent must get user permission first.
func registerAppFilesRename(srv *mcp.Server, access BoardAccess) {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "app_files_rename",
		Description: appFilesRenameDescription,
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: false},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appFilesRenameInput) (*mcp.CallToolResult, any, error) {
		id := appid.Canonical(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		from, to, err := renamePaths(in.From, in.To)
		if err != nil {
			return nil, nil, err
		}
		warn, err := flushBeforeFileChange(access, id)
		if err != nil {
			return nil, nil, err
		}
		note, err := access.RenameAppFile(ctx, id, from, to)
		if err != nil {
			return nil, nil, err
		}
		return textResult(warn + strings.TrimSpace(fmt.Sprintf("Renamed %s to %s. %s", from, to, note))), nil, nil
	})
}

// registerAppFilesDelete adds app_files_delete (mutating). Off the read-only allowlist so the agent must get user permission first.
func registerAppFilesDelete(srv *mcp.Server, access BoardAccess) {
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "app_files_delete",
		Description: appFilesDeleteDescription,
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: false},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in appFilesDeleteInput) (*mcp.CallToolResult, any, error) {
		id := appid.Canonical(in.ID)
		if id == "" {
			return nil, nil, fmt.Errorf("app id is required")
		}
		rel, err := appRelPath(in.Path)
		if err != nil {
			return nil, nil, err
		}
		warn, err := flushBeforeFileChange(access, id)
		if err != nil {
			return nil, nil, err
		}
		note, err := access.DeleteAppFile(ctx, id, rel)
		if err != nil {
			return nil, nil, err
		}
		return textResult(warn + strings.TrimSpace(fmt.Sprintf("Deleted %s. %s", rel, note))), nil, nil
	})
}

// flushBeforeFileChange pushes the pending checkout edits first: one left under the old path would put the file back on the board at the next sync.
func flushBeforeFileChange(access BoardAccess, id string) (string, error) {
	failed, conflicts, _, notes := access.FlushMirrorEdits(id)
	if failed[id] != nil {
		return "", fmt.Errorf("the pending edits for this app could not be synced to the board (%v) — nothing was changed. The local edits are preserved and will be re-pushed automatically; check the board connection and try again", failed[id])
	}
	if conflicts[id] != nil {
		return "", fmt.Errorf("your edits to this app conflict with the board (%v) — nothing was changed. Retrying will not help: call apps_checkout to pick up the board's version (it saves your edits as %s files), re-apply what you need, then try again", conflicts[id], appmirror.ParkedSuffix)
	}
	return SyncIssueWarning(notes) + SyncIssueWarning(access.PendingSyncIssues()) + GhostEditWarning(access.PendingGhostEdits()), nil
}

// renamePaths catches what mv would refuse with a less clear message: a rename onto itself or into itself.
func renamePaths(fromIn, toIn string) (from, to string, err error) {
	if from, err = appRelPath(fromIn); err != nil {
		return "", "", err
	}
	if to, err = appRelPath(toIn); err != nil {
		return "", "", err
	}
	switch {
	case fixedFolders[from]:
		return "", "", fmt.Errorf("%s keeps its name and place: the app only finds it there. Tell the user it cannot be renamed or moved", from)
	case from == to:
		return "", "", fmt.Errorf("%s already has that name: there is nothing to rename", from)
	case strings.HasPrefix(to, from+"/"):
		return "", "", fmt.Errorf("%s cannot be moved inside itself", from)
	}
	return from, to, nil
}

// appRelPath cleans a path the model gave: one that is absolute, leaves the app folder or is protected must never reach the board.
func appRelPath(p string) (string, error) {
	p = strings.TrimSpace(p)
	if p == "" {
		return "", fmt.Errorf("a path relative to the app folder is required, e.g. python/main.py")
	}
	// On the board a backslash is part of a name, so turning it into a folder would change what the user approved.
	if strings.ContainsRune(p, '\\') {
		return "", fmt.Errorf("%q has a backslash in it: separate folders with /, e.g. python/lib/x.py. A file name cannot hold a backslash", p)
	}
	// The board's listing keeps the escapes ls -Q writes for these, so a name taken that way would look free.
	if strings.ContainsRune(p, '"') || strings.IndexFunc(p, func(r rune) bool { return !unicode.IsGraphic(r) }) >= 0 {
		return "", fmt.Errorf("%q has a double quote or a non-printing character in it, and App Lab cannot work with such names: tell the user", p)
	}
	driveLetter := len(p) >= 2 && p[1] == ':' && unicode.IsLetter(rune(p[0])) && (len(p) == 2 || p[2] == '/')
	if path.IsAbs(p) || driveLetter {
		return "", fmt.Errorf("%s is an absolute path: pass it relative to the app folder, e.g. python/main.py", p)
	}
	clean := path.Clean(p)
	if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") {
		return "", fmt.Errorf("%s is not a file or folder inside the app: pass a path relative to the app folder, e.g. python/main.py", p)
	}
	if fileTreeProtected[clean] {
		return "", fmt.Errorf("%s keeps its name and place: the app needs it there, and App Lab's file tree does not rename, move or delete it either. Tell the user it cannot be done", clean)
	}
	return clean, nil
}
