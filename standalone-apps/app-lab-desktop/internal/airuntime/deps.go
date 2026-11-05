// Embedded, pinned package.json + package-lock.json used by `npm ci`.

package airuntime

import (
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path"
	"path/filepath"
)

//go:embed runtime-deps
var runtimeDepsFS embed.FS

// One set per agent: they install different packages, each recorded against its own lockfile.
func depsPath(agent AgentID, name string) string {
	return path.Join("runtime-deps", string(agent), name)
}

const (
	packageJSONName = "package.json"
	lockfileName    = "package-lock.json"
)

func materializeDeps(runtimeDir string, agent AgentID) error {
	for _, name := range []string{packageJSONName, lockfileName} {
		data, err := runtimeDepsFS.ReadFile(depsPath(agent, name))
		if err != nil {
			return fmt.Errorf("read embedded %s for %s: %w", name, agent, err)
		}
		dst := filepath.Join(runtimeDir, name)
		if err := os.WriteFile(dst, data, 0o644); err != nil {
			return fmt.Errorf("write %s: %w", dst, err)
		}
	}
	return nil
}

func lockfileSHA256(agent AgentID) (string, error) {
	data, err := runtimeDepsFS.ReadFile(depsPath(agent, lockfileName))
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:]), nil
}

func pinnedPackages(agent AgentID) (map[string]string, error) {
	data, err := runtimeDepsFS.ReadFile(depsPath(agent, packageJSONName))
	if err != nil {
		return nil, err
	}
	var pkg struct {
		Dependencies map[string]string `json:"dependencies"`
	}
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil, fmt.Errorf("parse embedded package.json: %w", err)
	}
	return pkg.Dependencies, nil
}
