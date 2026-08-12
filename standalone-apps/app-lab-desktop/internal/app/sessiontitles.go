package app

// Client-side session titles (ACP has no rename): a sessionId->title map in the agent config dir, overlaid onto listSessions.

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const sessionTitlesFile = "session-titles.json"

// readSessionTitles loads the sessionId -> title map; a missing or unparseable file reads as empty.
func readSessionTitles(dir string) (map[string]string, error) {
	data, err := os.ReadFile(filepath.Join(dir, sessionTitlesFile))
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]string{}, nil
		}
		return nil, err
	}
	titles := map[string]string{}
	if err := json.Unmarshal(data, &titles); err != nil {
		return map[string]string{}, nil
	}
	return titles, nil
}

// writeSessionTitles persists the map atomically (temp file + rename) so an interrupted write can't corrupt it.
func writeSessionTitles(dir string, titles map[string]string) error {
	data, err := json.MarshalIndent(titles, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(dir, sessionTitlesFile+".tmp")
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(dir, sessionTitlesFile))
}
