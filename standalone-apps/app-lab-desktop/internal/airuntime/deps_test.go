package airuntime

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The embed pattern is a directory, so a relocated file still builds; walking the registry catches it.
func TestEveryRegisteredAgentHasItsEmbeddedDeps(t *testing.T) {
	if len(supportedAgents) == 0 {
		t.Fatal("no agents registered: this test would pass by having nothing to check")
	}
	for agent := range supportedAgents {
		t.Run(string(agent), func(t *testing.T) {
			pkgs, err := pinnedPackages(agent)
			if err != nil {
				t.Fatalf("pinnedPackages: %v", err)
			}
			if len(pkgs) == 0 {
				t.Error("package.json declares no dependencies, so npm ci would install nothing")
			}
			for name, version := range pkgs {
				// ai-agent.md §1.3: pinned exactly, so an install is reproducible and a bump is deliberate.
				if strings.ContainsAny(version, "^~*") || version == "latest" || version == "" {
					t.Errorf("%s is pinned as %q; the version must be exact", name, version)
				}
			}
			sum, err := lockfileSHA256(agent)
			if err != nil {
				t.Fatalf("lockfileSHA256: %v", err)
			}
			if len(sum) != 64 {
				t.Errorf("lockfile sha256 = %q, want 64 hex characters", sum)
			}
		})
	}
}

// npm ci refuses a disagreeing lockfile on the user's machine; here is where that is cheap to find.
func TestEmbeddedLockfileAgreesWithItsPackageJSON(t *testing.T) {
	for agent := range supportedAgents {
		t.Run(string(agent), func(t *testing.T) {
			pkgRaw, err := runtimeDepsFS.ReadFile(depsPath(agent, packageJSONName))
			if err != nil {
				t.Fatalf("read package.json: %v", err)
			}
			lockRaw, err := runtimeDepsFS.ReadFile(depsPath(agent, lockfileName))
			if err != nil {
				t.Fatalf("read lockfile: %v", err)
			}
			var pkg struct {
				Name         string            `json:"name"`
				Dependencies map[string]string `json:"dependencies"`
			}
			if err := json.Unmarshal(pkgRaw, &pkg); err != nil {
				t.Fatalf("parse package.json: %v", err)
			}
			var lock struct {
				Name            string `json:"name"`
				LockfileVersion int    `json:"lockfileVersion"`
				Packages        map[string]struct {
					Name         string            `json:"name"`
					Dependencies map[string]string `json:"dependencies"`
				} `json:"packages"`
			}
			if err := json.Unmarshal(lockRaw, &lock); err != nil {
				t.Fatalf("parse lockfile: %v", err)
			}
			if lock.Name != pkg.Name {
				t.Errorf("lockfile name %q != package name %q; npm ci rejects that", lock.Name, pkg.Name)
			}
			if lock.LockfileVersion < 2 {
				t.Errorf("lockfileVersion = %d; integrity hashes need 2 or later", lock.LockfileVersion)
			}
			root := lock.Packages[""]
			for name, version := range pkg.Dependencies {
				if got := root.Dependencies[name]; got != version {
					t.Errorf("%s: package.json says %q, lockfile root says %q", name, version, got)
				}
			}
		})
	}
}

// A wrong destination is silent: npm ci simply resolves nothing.
func TestMaterializeDepsWritesWhatNpmCiReads(t *testing.T) {
	for agent := range supportedAgents {
		t.Run(string(agent), func(t *testing.T) {
			dir := t.TempDir()
			if err := materializeDeps(dir, agent); err != nil {
				t.Fatalf("materializeDeps: %v", err)
			}
			for _, name := range []string{packageJSONName, lockfileName} {
				data, err := os.ReadFile(filepath.Join(dir, name))
				if err != nil {
					t.Fatalf("%s: %v", name, err)
				}
				if !json.Valid(data) {
					t.Errorf("%s is not valid JSON", name)
				}
			}
		})
	}
}

// An agent with no embedded set must fail at the call, not install an empty tree.
func TestEmbeddedDepsRefuseAnUnknownAgent(t *testing.T) {
	unknown := AgentID("some-future-agent")
	if _, err := pinnedPackages(unknown); err == nil {
		t.Error("pinnedPackages accepted an agent with no embedded package.json")
	}
	if _, err := lockfileSHA256(unknown); err == nil {
		t.Error("lockfileSHA256 accepted an agent with no embedded lockfile")
	}
	if err := materializeDeps(t.TempDir(), unknown); err == nil {
		t.Error("materializeDeps accepted an agent with no embedded set")
	}
}

// An entry with no launch spec installs fine and then cannot be started, which only shows at first use.
func TestEveryRegisteredAgentHasALaunchSpec(t *testing.T) {
	for _, id := range SupportedAgents() {
		launch, err := LaunchFor(id)
		if err != nil {
			t.Errorf("%s: %v", id, err)
			continue
		}
		if len(launch.Entry) == 0 {
			t.Errorf("%s: no entry path inside the runtime dir", id)
		}
	}
	if _, err := LaunchFor(AgentID("some-future-agent")); err == nil {
		t.Error("LaunchFor accepted an unregistered agent")
	}
}
