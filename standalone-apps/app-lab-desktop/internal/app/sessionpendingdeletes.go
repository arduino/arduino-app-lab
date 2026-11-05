package app

// Chats of a deleted app their engine could not delete yet (a JSON list of session ids) in the agent config dir: hidden from the list, deleted by the engine's next run.

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
)

const sessionPendingDeletesFile = "session-pending-deletes.json"

// readSessionPendingDeletes loads the ids; a missing file reads as empty, and an unreadable one is an error so no write replaces the ids it holds.
func readSessionPendingDeletes(dir string) ([]string, error) {
	data, err := os.ReadFile(filepath.Join(dir, sessionPendingDeletesFile))
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var ids []string
	if err := json.Unmarshal(data, &ids); err != nil {
		return nil, err
	}
	return ids, nil
}

// writeSessionPendingDeletes persists the ids atomically (temp file + rename) so an interrupted write can't corrupt them.
func writeSessionPendingDeletes(dir string, ids []string) error {
	data, err := json.MarshalIndent(ids, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(dir, sessionPendingDeletesFile+".tmp")
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(dir, sessionPendingDeletesFile))
}
