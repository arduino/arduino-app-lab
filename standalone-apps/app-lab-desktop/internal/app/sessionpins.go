package app

// Client-side pinned sessions: a set of sessionIds in the agent config dir, overlaid onto listSessions.

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const sessionPinsFile = "session-pins.json"

// readSessionPins loads the set of pinned session ids; a missing or unparseable file reads as empty.
func readSessionPins(dir string) (map[string]bool, error) {
	data, err := os.ReadFile(filepath.Join(dir, sessionPinsFile))
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]bool{}, nil
		}
		return nil, err
	}
	pins := map[string]bool{}
	if err := json.Unmarshal(data, &pins); err != nil {
		return map[string]bool{}, nil
	}
	return pins, nil
}

// writeSessionPins persists the set atomically (temp file + rename) so an interrupted write can't corrupt it.
func writeSessionPins(dir string, pins map[string]bool) error {
	data, err := json.MarshalIndent(pins, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(dir, sessionPinsFile+".tmp")
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(dir, sessionPinsFile))
}
