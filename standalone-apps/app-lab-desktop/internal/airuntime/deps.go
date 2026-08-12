// Embedded, pinned package.json + package-lock.json used by `npm ci`.

package airuntime

import (
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

//go:embed runtime-deps/package.json runtime-deps/package-lock.json
var runtimeDepsFS embed.FS

const (
	embeddedPackageJSON = "runtime-deps/package.json"
	embeddedLockfile    = "runtime-deps/package-lock.json"
)

// materializeDeps writes the embedded package.json + lockfile into runtimeDir.
func materializeDeps(runtimeDir string) error {
	for _, name := range []string{embeddedPackageJSON, embeddedLockfile} {
		data, err := runtimeDepsFS.ReadFile(name)
		if err != nil {
			return fmt.Errorf("read embedded %s: %w", name, err)
		}
		dst := filepath.Join(runtimeDir, filepath.Base(name))
		if err := os.WriteFile(dst, data, 0o644); err != nil {
			return fmt.Errorf("write %s: %w", dst, err)
		}
	}
	return nil
}

// lockfileSHA256 returns the hex sha256 of the embedded lockfile.
func lockfileSHA256() (string, error) {
	data, err := runtimeDepsFS.ReadFile(embeddedLockfile)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:]), nil
}

// pinnedPackages returns the embedded package.json dependencies (name -> version).
func pinnedPackages() (map[string]string, error) {
	data, err := runtimeDepsFS.ReadFile(embeddedPackageJSON)
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
