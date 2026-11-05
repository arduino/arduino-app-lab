package airuntime

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

// The id arrives from the webview and is joined into a filesystem path and an argv further down.
func TestParseAgentAcceptsOnlyARegisteredID(t *testing.T) {
	for _, id := range SupportedAgents() {
		got, err := ParseAgent(string(id))
		if err != nil || got != id {
			t.Errorf("ParseAgent(%q) = %q, %v; want it accepted", id, got, err)
		}
	}

	refuse := []string{
		"", // names no agent: must not fall through to the default
		"some-future-agent",
		"Claude",  // the registry is keyed on the exact id
		"claude ", // and on it alone
		"claude/../opencode",
		"../../../../etc/passwd",
		"/absolute/claude",
		`..\..\windows\system32`,
		"claude; rm -rf ~",
		"claude$(whoami)",
		"claude\nopencode",
		"claude\x00opencode",
	}
	for _, s := range refuse {
		got, err := ParseAgent(s)
		if err == nil {
			t.Errorf("ParseAgent(%q) = %q, want an error", s, got)
		}
		if got != "" {
			t.Errorf("ParseAgent(%q) returned %q beside its error", s, got)
		}
	}
}

// enabled=false is how an agent is withdrawn, so every lookup has to read it, not only the list.
func TestAWithdrawnAgentIsOfferedNowhere(t *testing.T) {
	const id = AgentID("withdrawn-agent")
	supportedAgents[id] = agentSpec{
		enabled:        false,
		primaryPackage: "withdrawn-pkg",
		launch:         Launch{Entry: []string{"node_modules", "withdrawn", "cli"}},
	}
	t.Cleanup(func() { delete(supportedAgents, id) })

	for _, listed := range SupportedAgents() {
		if listed == id {
			t.Error("a withdrawn agent is still offered for install")
		}
	}
	if _, err := ParseAgent(string(id)); err == nil {
		t.Error("ParseAgent accepted a withdrawn agent")
	}
	if _, err := LaunchFor(id); err == nil {
		t.Error("LaunchFor handed out a withdrawn agent's launch spec")
	}
	if _, err := New(id); err == nil {
		t.Error("New built a runtime manager for a withdrawn agent")
	}
}

// The registry is a map, so without the sort the agent list would reshuffle between runs.
func TestSupportedAgentsIsStablyOrderedAndHoldsTheDefault(t *testing.T) {
	first := SupportedAgents()
	if len(first) < 2 {
		t.Fatalf("got %v; this branch ships two agents", first)
	}
	if !sort.SliceIsSorted(first, func(i, j int) bool { return first[i] < first[j] }) {
		t.Errorf("SupportedAgents() = %v, want a stable order", first)
	}
	// A caller mutating the returned slice must not reach the registry.
	first[0] = AgentID("mutated")
	for _, id := range SupportedAgents() {
		if id == "mutated" {
			t.Fatal("SupportedAgents() hands out the registry itself")
		}
	}
	if _, err := ParseAgent(string(DefaultAgent)); err != nil {
		t.Errorf("the default agent is not registered: %v", err)
	}
}

// Registering an agent is several entries; a missing one otherwise shows only at first use.
func TestAHalfRegisteredAgentFailsTheRegistryChecks(t *testing.T) {
	const id = AgentID("half-registered")
	supportedAgents[id] = agentSpec{enabled: true}
	t.Cleanup(func() { delete(supportedAgents, id) })

	// LaunchFor answers for any enabled agent, so an empty Entry is the whole signal.
	launch, err := LaunchFor(id)
	if err != nil {
		t.Fatalf("LaunchFor: %v", err)
	}
	if len(launch.Entry) != 0 {
		t.Fatal("the half-registered agent has a launch spec, so this test proves nothing")
	}
	if _, err := pinnedPackages(id); err == nil {
		t.Error("pinnedPackages answered for an agent with no embedded package.json")
	}
	if _, err := lockfileSHA256(id); err == nil {
		t.Error("lockfileSHA256 answered for an agent with no embedded lockfile")
	}
	if err := materializeDeps(t.TempDir(), id); err == nil {
		t.Error("materializeDeps wrote an install set for an agent that has none")
	}
}

// The agent version in the UI is read out of the manifest under this name; a typo reads as blank.
func TestEveryAgentsPrimaryPackageIsOneItInstalls(t *testing.T) {
	for _, id := range SupportedAgents() {
		pkgs, err := pinnedPackages(id)
		if err != nil {
			t.Errorf("%s: %v", id, err)
			continue
		}
		primary := supportedAgents[id].primaryPackage
		if primary == "" {
			t.Errorf("%s: no primary package, so it would report no version at all", id)
			continue
		}
		if _, ok := pkgs[primary]; !ok {
			names := make([]string, 0, len(pkgs))
			for name := range pkgs {
				names = append(names, name)
			}
			sort.Strings(names)
			t.Errorf("%s: primary package %q is not among its dependencies %v", id, primary, names)
		}
	}
}

// The consequence of that name: Status reads the manifest under it, and the settings row shows it.
func TestStatusReportsTheAgentsOwnVersion(t *testing.T) {
	for _, id := range SupportedAgents() {
		dir := t.TempDir()
		if err := os.MkdirAll(filepath.Join(dir, "node_modules", "anything"), 0o755); err != nil {
			t.Fatal(err)
		}
		primary := supportedAgents[id].primaryPackage
		if err := writeManifest(manifestPathOf(dir), &Manifest{
			NodeVersion: "v18.20.4",
			Packages:    map[string]string{primary: "1.2.3"},
		}); err != nil {
			t.Fatal(err)
		}
		st, err := (&Manager{agent: id, runtimeDir: dir}).Status(context.Background())
		if err != nil {
			t.Fatalf("%s: Status: %v", id, err)
		}
		if !st.Installed {
			t.Errorf("%s: a manifest with installed packages must read as installed", id)
		}
		if st.AgentVersion != "1.2.3" {
			t.Errorf("%s: AgentVersion = %q, want the version recorded for %q", id, st.AgentVersion, primary)
		}
		if st.Version != "v18.20.4" {
			t.Errorf("%s: Version = %q, want Node's", id, st.Version)
		}
	}
}

// An emptied node_modules with the manifest left behind is what a failed npm ci leaves.
func TestAnEmptiedRuntimeIsNotInstalled(t *testing.T) {
	dir := t.TempDir()
	if err := writeManifest(manifestPathOf(dir), &Manifest{NodeVersion: "v18.20.4"}); err != nil {
		t.Fatal(err)
	}
	st, err := (&Manager{agent: AgentClaude, runtimeDir: dir}).Status(context.Background())
	if err != nil {
		t.Fatalf("Status: %v", err)
	}
	if st.Installed {
		t.Error("a runtime with no packages reported as installed")
	}
}

// Rounded down to "1 GB" the refusal sent the user to free a gigabyte that is still turned away.
func TestTheDiskSpaceRefusalNamesTheFootprintItEnforces(t *testing.T) {
	// A filesystem with no free blocks, without making one: devfs reports none.
	const full = "/dev"
	free, err := freeBytes(full)
	if err != nil || free >= installFootprintBytes {
		t.Skipf("%s reports %d bytes free, so the refusal is not reachable here", full, free)
	}

	err = checkFreeSpace(full)
	if !errors.Is(err, ErrInsufficientDiskSpace) {
		t.Fatalf("checkFreeSpace(%s) = %v, want the disk-space refusal", full, err)
	}
	if !strings.Contains(err.Error(), "1.5 GB") {
		t.Errorf("refusal %q does not name the 1.5 GB it enforces", err)
	}
}

// A filesystem that cannot answer must not stand in the way; a real ENOSPC is still caught mid-write.
func TestAFilesystemThatCannotBeMeasuredDoesNotBlockTheInstall(t *testing.T) {
	if err := checkFreeSpace(filepath.Join(t.TempDir(), "no", "such", "dir")); err != nil {
		t.Errorf("an install was refused over a path whose free space could not be read: %v", err)
	}
}
