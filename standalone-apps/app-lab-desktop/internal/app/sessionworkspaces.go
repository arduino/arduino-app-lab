package app

// Client-side session workspaces: sessionId → the app it was opened for (an empty app id is the general workspace) and the board it was opened on. The name sits beside the id so reopening needs no board call.

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const sessionWorkspacesFile = "session-workspaces.json"

type sessionWorkspaceEntry struct {
	AppID string `json:"appId"`
	Name  string `json:"name,omitempty"` // best-effort at pick time; empty just means the prompt falls back to the id
	// BoardID is the board the session was opened on: app ids repeat across boards, so the sidebar lists only this board's sessions. Empty means written before board scoping.
	BoardID string `json:"boardId,omitempty"`
}

// onBoard reports whether the entry belongs to the given board; one written before board scoping belongs to whichever
// board asks. Deliberately not lenient about an empty boardID: these callers write, and "no board" must not mean "every board".
func (e sessionWorkspaceEntry) onBoard(boardID string) bool {
	return e.BoardID == "" || e.BoardID == boardID
}

// readSessionWorkspaces loads the map; a missing or unparseable file reads as empty, like the titles and pins stores.
func readSessionWorkspaces(dir string) (map[string]sessionWorkspaceEntry, error) {
	data, err := os.ReadFile(filepath.Join(dir, sessionWorkspacesFile))
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]sessionWorkspaceEntry{}, nil
		}
		return nil, err
	}
	entries := map[string]sessionWorkspaceEntry{}
	if err := json.Unmarshal(data, &entries); err == nil {
		if entries == nil { // null decodes to a nil map
			return map[string]sessionWorkspaceEntry{}, nil
		}
		return entries, nil
	}
	// The first version of this file mapped straight to an app id: keep those picks instead of dropping them silently.
	legacy := map[string]string{}
	if err := json.Unmarshal(data, &legacy); err != nil {
		return map[string]sessionWorkspaceEntry{}, nil
	}
	for sessionID, appID := range legacy {
		entries[sessionID] = sessionWorkspaceEntry{AppID: appID}
	}
	return entries, nil
}

// writeSessionWorkspaces persists the map atomically (temp file + rename) so an interrupted write can't corrupt it.
func writeSessionWorkspaces(dir string, workspaces map[string]sessionWorkspaceEntry) error {
	data, err := json.MarshalIndent(workspaces, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(dir, sessionWorkspacesFile+".tmp")
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(dir, sessionWorkspacesFile))
}
