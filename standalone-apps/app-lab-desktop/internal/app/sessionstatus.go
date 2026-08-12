package app

// Per-session last-turn status (e.g. "error"): a sessionId->status map in the agent config dir, overlaid onto listSessions.

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const sessionStatusFile = "session-status.json"

// readSessionStatus loads the sessionId -> status map; a missing or unparseable file reads as empty.
func readSessionStatus(dir string) (map[string]string, error) {
	data, err := os.ReadFile(filepath.Join(dir, sessionStatusFile))
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]string{}, nil
		}
		return nil, err
	}
	statuses := map[string]string{}
	if err := json.Unmarshal(data, &statuses); err != nil {
		return map[string]string{}, nil
	}
	return statuses, nil
}

// writeSessionStatus persists the map atomically (temp file + rename) so an interrupted write can't corrupt it.
func writeSessionStatus(dir string, statuses map[string]string) error {
	data, err := json.MarshalIndent(statuses, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(dir, sessionStatusFile+".tmp")
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(dir, sessionStatusFile))
}
