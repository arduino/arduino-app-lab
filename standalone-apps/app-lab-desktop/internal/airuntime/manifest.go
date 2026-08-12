// Read/write of the on-disk version.json runtime manifest.

package airuntime

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"
)

// manifestSchema is the version.json layout version.
const manifestSchema = 2

// Manifest is persisted at <runtime>/version.json; its presence means "installed".
type Manifest struct {
	Schema         int               `json:"schema"`
	NodeVersion    string            `json:"nodeVersion"`
	LockfileSHA256 string            `json:"lockfileSha256"`
	Packages       map[string]string `json:"packages,omitempty"`
	InstalledAt    time.Time         `json:"installedAt"`
}

// readManifest loads version.json, returning (nil, nil) when it is absent.
func readManifest(path string) (*Manifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, fmt.Errorf("read manifest %s: %w", path, err)
	}
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("parse manifest %s: %w", path, err)
	}
	return &m, nil
}

// writeManifest atomically writes version.json (tmp file + rename).
func writeManifest(path string, m *Manifest) error {
	if m.Schema == 0 {
		m.Schema = manifestSchema
	}
	if m.InstalledAt.IsZero() {
		m.InstalledAt = time.Now().UTC()
	}
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return fmt.Errorf("encode manifest: %w", err)
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("write manifest tmp: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("rename manifest: %w", err)
	}
	return nil
}
