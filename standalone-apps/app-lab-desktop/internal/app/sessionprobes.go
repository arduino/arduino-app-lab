package app

// Auth-probe session ids (a JSON list) in the agent config dir: one a quit left mid-check is hidden and deleted by the next run, not shown as a chat.

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const sessionProbesFile = "session-probes.json"

// readSessionProbes loads the probe ids; a missing or unparseable file reads as empty.
func readSessionProbes(dir string) []string {
	data, err := os.ReadFile(filepath.Join(dir, sessionProbesFile))
	if err != nil {
		return nil
	}
	var ids []string
	if err := json.Unmarshal(data, &ids); err != nil {
		return nil
	}
	return ids
}

// writeSessionProbes persists the ids atomically (temp file + rename) so an interrupted write can't corrupt them.
func writeSessionProbes(dir string, ids []string) error {
	data, err := json.MarshalIndent(ids, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(dir, sessionProbesFile+".tmp")
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(dir, sessionProbesFile))
}
