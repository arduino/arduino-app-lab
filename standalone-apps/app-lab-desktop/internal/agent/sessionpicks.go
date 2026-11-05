package agent

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"app-lab-desktop/internal/airuntime"
)

// SessionPick is the model and mode a chat runs on; an empty field is not known.
type SessionPick struct {
	Model string `json:"model,omitempty"`
	Mode  string `json:"mode,omitempty"`
}

// PickStore keeps each chat's model and mode between runs for a load to put back: the Claude adapter loads a chat in its default mode.
type PickStore interface {
	Pick(sid SessionID) SessionPick
	SavePick(sid SessionID, pick SessionPick) // records the fields that are set, and keeps the others
	DropPick(sid SessionID)
}

const sessionPicksFile = "session-picks.json"

// NewChatPick is the entry for the model the user last switched to, which a new chat starts on; no engine names a session "".
const NewChatPick SessionID = ""

// One for the process: the manager of a restarted agent writes the same file as the one it replaced.
var pickFileMu sync.Mutex

// pickFile keeps the picks in session-picks.json, beside App Lab's other session-*.json stores.
type pickFile struct {
	dir func() (string, error)
}

// PickFileOf is the PickStore in agent's config dir.
func PickFileOf(agent airuntime.AgentID) PickStore {
	return pickFile{dir: func() (string, error) { return airuntime.AgentConfigDir(agent) }}
}

// DropSessionPick forgets a deleted chat's pick in an agent's config dir, with its entries in App Lab's other session-*.json stores.
func DropSessionPick(dir, sessionID string) {
	pickFile{dir: func() (string, error) { return dir, nil }}.DropPick(SessionID(sessionID))
}

func (p pickFile) Pick(sid SessionID) SessionPick {
	pickFileMu.Lock()
	defer pickFileMu.Unlock()
	picks, _ := p.read()
	return picks[string(sid)]
}

func (p pickFile) SavePick(sid SessionID, pick SessionPick) {
	pickFileMu.Lock()
	defer pickFileMu.Unlock()
	picks, path := p.read()
	was := picks[string(sid)]
	next := was
	if pick.Model != "" {
		next.Model = pick.Model
	}
	if pick.Mode != "" {
		next.Mode = pick.Mode
	}
	if next != was {
		picks[string(sid)] = next
		writePicks(path, picks)
	}
}

func (p pickFile) DropPick(sid SessionID) {
	pickFileMu.Lock()
	defer pickFileMu.Unlock()
	picks, path := p.read()
	if _, ok := picks[string(sid)]; ok {
		delete(picks, string(sid))
		writePicks(path, picks)
	}
}

// read loads the file and names it; a missing or unreadable one reads as empty, like App Lab's other session stores.
func (p pickFile) read() (map[string]SessionPick, string) {
	picks := map[string]SessionPick{}
	dir, err := p.dir()
	if err != nil {
		return picks, ""
	}
	path := filepath.Join(dir, sessionPicksFile)
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &picks)
	}
	if picks == nil { // the file held null
		picks = map[string]SessionPick{}
	}
	return picks, path
}

// writePicks persists the map atomically (temp file + rename) so an interrupted write can't corrupt it.
func writePicks(path string, picks map[string]SessionPick) {
	if path == "" {
		return
	}
	data, err := json.MarshalIndent(picks, "", "  ")
	if err != nil {
		return
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err == nil {
		_ = os.Rename(tmp, path)
	}
}
