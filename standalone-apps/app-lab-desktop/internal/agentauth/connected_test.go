package agentauth

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"app-lab-desktop/internal/airuntime"
)

// The record is what tells "the user chose this agent" from "its runtime happens to be on disk".
func TestConnectingAnAgentWithoutACredentialIsRecorded(t *testing.T) {
	isolatedAppData(t)

	if at := ConnectedAt(airuntime.AgentOpenCode); !at.IsZero() {
		t.Fatalf("a fresh install reads as connected at %v", at)
	}
	before := time.Now().UTC().Add(-time.Second)
	if err := MarkConnected(airuntime.AgentOpenCode); err != nil {
		t.Fatalf("MarkConnected: %v", err)
	}
	at := ConnectedAt(airuntime.AgentOpenCode)
	if at.IsZero() || at.Before(before) || at.After(time.Now().UTC().Add(time.Second)) {
		t.Errorf("ConnectedAt = %v, want the moment it was marked", at)
	}
	// The other agent is untouched: one connection must not put a second agent in the interface.
	if other := ConnectedAt(airuntime.AgentClaude); !other.IsZero() {
		t.Errorf("marking one agent connected also connected %s (%v)", airuntime.AgentClaude, other)
	}

	if err := ClearConnected(airuntime.AgentOpenCode); err != nil {
		t.Fatalf("ClearConnected: %v", err)
	}
	if at := ConnectedAt(airuntime.AgentOpenCode); !at.IsZero() {
		t.Errorf("still connected at %v after a sign-out", at)
	}
	// Sign-out runs on an agent that was never connected, and at uninstall after the first one.
	if err := ClearConnected(airuntime.AgentOpenCode); err != nil {
		t.Errorf("second ClearConnected: %v", err)
	}
	if err := ClearConnected(airuntime.AgentClaude); err != nil {
		t.Errorf("ClearConnected for an agent that was never marked: %v", err)
	}
}

// Installing writes the config dir; reading that as a connection would offer an agent nobody chose.
func TestAnInstalledRuntimeIsNotAConnection(t *testing.T) {
	isolatedAppData(t)
	dir, err := airuntime.AgentConfigDir(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "cache", "opencode"), 0o700); err != nil {
		t.Fatal(err)
	}
	if at := ConnectedAt(airuntime.AgentOpenCode); !at.IsZero() {
		t.Errorf("ConnectedAt = %v for an agent that is only installed", at)
	}
}

// A half-written marker must read as "not connected" rather than take the agent down with it.
func TestAnUnreadableConnectionMarkerReadsAsNotConnected(t *testing.T) {
	isolatedAppData(t)
	path, err := connectedPath(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	for _, body := range []string{"", "{", `{"connectedAt":"not a date"}`, `{"other":1}`} {
		if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
			t.Fatal(err)
		}
		if at := ConnectedAt(airuntime.AgentOpenCode); !at.IsZero() {
			t.Errorf("marker %q read as connected at %v", body, at)
		}
	}
}

// Only the agent that measurably answers a turn with no credential may skip the connect screen.
func TestOnlyTheFreeAgentIsUsableWithoutACredential(t *testing.T) {
	if !UsableWithoutCredential(airuntime.AgentOpenCode) {
		t.Error("OpenCode is marked as needing a credential; its free models answer a turn without one")
	}
	if UsableWithoutCredential(airuntime.AgentClaude) {
		t.Error("Claude is marked as usable without a credential; every model it offers needs an account")
	}
	// An id no profile answers for must not inherit the free tier.
	if UsableWithoutCredential(airuntime.AgentID("some-future-agent")) {
		t.Error("an unregistered agent was reported as usable without a credential")
	}
}

// Every path here takes an agent id from the caller; an unknown one must fail, never fall through.
func TestTheCredentialPathsRefuseAnUnknownAgent(t *testing.T) {
	isolatedAppData(t)
	unknown := airuntime.AgentID("some-future-agent")

	if _, err := Providers(unknown); err == nil {
		t.Error("Providers answered for an unregistered agent")
	}
	if _, err := ReadSubscriptionAccount(unknown); err == nil {
		t.Error("ReadSubscriptionAccount answered for an unregistered agent")
	}
	if _, err := SubscriptionLoginArgs(unknown); err == nil {
		t.Error("SubscriptionLoginArgs answered for an unregistered agent")
	}
	if _, err := EngineConfigDir(unknown); err == nil {
		t.Error("EngineConfigDir answered for an unregistered agent")
	}
	if _, err := IsolatedEnv(unknown, Options{Method: None}); err == nil {
		t.Error("IsolatedEnv built an environment for an unregistered agent")
	}
}

// The engine reads its configuration from its own subdirectory, not from the agent's config root.
func TestEachEngineReadsItsOwnConfigDirectory(t *testing.T) {
	isolatedAppData(t)
	for _, id := range airuntime.SupportedAgents() {
		root, err := airuntime.AgentConfigDir(id)
		if err != nil {
			t.Fatal(err)
		}
		engine, err := EngineConfigDir(id)
		if err != nil {
			t.Errorf("%s: %v", id, err)
			continue
		}
		p, err := profileFor(id)
		if err != nil {
			t.Fatal(err)
		}
		want := root
		if p.configSubdir != "" {
			want = filepath.Join(root, p.configSubdir)
		}
		if engine != want {
			t.Errorf("%s: engine config dir = %q, want %q", id, engine, want)
		}
		// It must stay under the agent's own root, or one engine would read the other's files.
		if rel, err := filepath.Rel(root, engine); err != nil || rel == ".." || filepath.IsAbs(rel) {
			t.Errorf("%s: %q is not inside %q", id, engine, root)
		}
	}
}

// The id is joined into the path this file is written to, and every other entry point validates it.
func TestTheConnectionMarkerIsWrittenOnlyForARegisteredAgent(t *testing.T) {
	isolatedAppData(t)
	// Three levels up from <app-data>/arduino-app-lab/ai-runtime/<id>: still inside the test's own dir.
	const traversing = "../../../escaped-marker"

	// Where the id would land if nothing checked it: the runtime layout itself joins it as given.
	unchecked, err := airuntime.AgentConfigDir(airuntime.AgentID(traversing))
	if err != nil {
		t.Skipf("the runtime layout refuses the id before agentauth sees it: %v", err)
	}
	escaped := filepath.Join(unchecked, connectedFile)
	root, err := airuntime.AgentConfigDir(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	if strings.HasPrefix(escaped, filepath.Dir(filepath.Dir(root))) {
		t.Fatalf("%q resolves to %q, inside the runtime root: this test cannot show the escape", traversing, escaped)
	}

	if err := MarkConnected(airuntime.AgentID(traversing)); err == nil {
		t.Errorf("MarkConnected(%q) was accepted; it is not a registered agent", traversing)
	}
	if _, err := os.Stat(escaped); err == nil {
		t.Errorf("MarkConnected wrote %s: the id reached the path unvalidated", escaped)
	}
	if err := MarkConnected(airuntime.AgentID("some-future-agent")); err == nil {
		t.Error("MarkConnected recorded a connection for an agent that cannot be started")
	}
	// The same door in the other direction: sign-out must not delete a path an id walked to.
	if err := ClearConnected(airuntime.AgentID(traversing)); err == nil {
		t.Errorf("ClearConnected(%q) was accepted", traversing)
	}
}
