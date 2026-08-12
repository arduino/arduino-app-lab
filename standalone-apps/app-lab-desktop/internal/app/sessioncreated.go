package app

// Client-side session creation times (id → ISO 8601) in the agent config dir: ACP's SessionInfo exposes only updatedAt, so we record creation ourselves to keep the sidebar ordered by creation, not reshuffled by activity.

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const sessionCreatedFile = "session-created.json"

// readSessionCreated loads id→creation-time; a missing or unparseable file reads as empty.
func readSessionCreated(dir string) (map[string]string, error) {
	data, err := os.ReadFile(filepath.Join(dir, sessionCreatedFile))
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]string{}, nil
		}
		return nil, err
	}
	created := map[string]string{}
	if err := json.Unmarshal(data, &created); err != nil {
		return map[string]string{}, nil
	}
	return created, nil
}

// writeSessionCreated persists the map atomically (temp file + rename) so an interrupted write can't corrupt it.
func writeSessionCreated(dir string, created map[string]string) error {
	data, err := json.MarshalIndent(created, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(dir, sessionCreatedFile+".tmp")
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(dir, sessionCreatedFile))
}
