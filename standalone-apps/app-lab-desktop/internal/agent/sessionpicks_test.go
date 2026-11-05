package agent

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

// The file outlives the engine and App Lab: a pick made in one run is what the next run's load puts back.
func TestThePickFileKeepsEachChatsModelAndMode(t *testing.T) {
	dir := t.TempDir()
	store := pickFile{dir: func() (string, error) { return dir, nil }}

	store.SavePick("s1", SessionPick{Model: "haiku"})
	store.SavePick("s1", SessionPick{Mode: "plan"}) // a mode pick keeps the model
	store.SavePick("s2", SessionPick{Model: "opencode/big-pickle"})
	if got := store.Pick("s1"); got != (SessionPick{Model: "haiku", Mode: "plan"}) {
		t.Errorf("s1 = %+v, want haiku / plan", got)
	}

	store.DropPick("s1")
	DropSessionPick(dir, "s2")
	if got := (pickFile{dir: func() (string, error) { return dir, nil }}).Pick("s2"); got != (SessionPick{}) {
		t.Errorf("s2 = %+v after it was dropped", got)
	}
	if got := store.Pick("s1"); got != (SessionPick{}) {
		t.Errorf("s1 = %+v after it was dropped", got)
	}
}

// An unreadable file costs a pick, never a load: it reads as empty, like App Lab's other session stores.
func TestAnUnreadablePickFileReadsAsEmpty(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, sessionPicksFile), []byte("not json"), 0o600); err != nil {
		t.Fatal(err)
	}
	store := pickFile{dir: func() (string, error) { return dir, nil }}
	if got := store.Pick("s1"); got != (SessionPick{}) {
		t.Errorf("pick = %+v, want none", got)
	}
	store.SavePick("s1", SessionPick{Model: "haiku"})
	if got := store.Pick("s1"); got.Model != "haiku" {
		t.Errorf("pick = %+v, want the one saved over the unreadable file", got)
	}

	noDir := pickFile{dir: func() (string, error) { return "", errors.New("no config dir") }}
	noDir.SavePick("s1", SessionPick{Model: "haiku"})
	if got := noDir.Pick("s1"); got != (SessionPick{}) {
		t.Errorf("pick = %+v with no config dir, want none", got)
	}
}
