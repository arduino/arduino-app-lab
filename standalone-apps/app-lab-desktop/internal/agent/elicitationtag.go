package agent

// Recovering the session id ACP sends with elicitation/create.
//
// The protocol ties an elicitation to a session, but acp-go-sdk v0.13.5 models the request's form variant with no
// sessionId field, so the id is dropped while unmarshalling and never reaches the handler. Routing then had to guess
// "whoever prompted last", which puts the question in the wrong thread as soon as two sessions stream at once — and
// because the reply is correlated by question id, answering it replies to the *other* session's question. Guessing
// can't be made correct: the id has to come from the wire.
//
// So the agent's output is tee'd through here on its way into the SDK. Two properties make it safe: the tee writes
// bytes before Read returns them, so a tag is always recorded before the SDK dispatches the request; and tags are
// keyed by a digest of the *decoded* request, so the handler recomputes the key from the value it is handed —
// neither the raw bytes nor the JSON-RPC id reach it.

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sync"

	acp "github.com/coder/acp-go-sdk"
)

const (
	// maxTagLine bounds the partial-line buffer, matching the SDK's own inbound cap: a longer line it wouldn't accept either.
	maxTagLine = 10 << 20
	// maxPendingTags bounds the map. A tag is normally claimed moments later; one the SDK rejected before dispatch would linger for the process's life.
	maxPendingTags = 64
)

// elicitationCreateMethod is matched as a raw substring to skip parsing the streaming traffic (thousands of lines a turn).
var elicitationCreateMethod = []byte(acp.ClientMethodElicitationCreate)

// elicitationTags records the session of each elicitation seen on the wire. It implements io.Writer, for io.TeeReader.
type elicitationTags struct {
	mu   sync.Mutex
	tags map[string][]SessionID // digest of the decoded request → sessions awaiting claim, oldest first
	buf  []byte                 // partial line carried between writes (the tee delivers arbitrary chunks)
}

// Write consumes a chunk of the agent's output. It never reports an error: this sits in the read path of the live
// connection, and failing here would tear the session down over a cosmetic feature.
func (t *elicitationTags) Write(p []byte) (int, error) {
	if t == nil {
		return len(p), nil
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	t.buf = append(t.buf, p...)
	for {
		i := bytes.IndexByte(t.buf, '\n')
		if i < 0 {
			if len(t.buf) > maxTagLine {
				t.buf = nil // oversized line: give up rather than grow without bound
			}
			return len(p), nil
		}
		t.observeLocked(t.buf[:i])
		t.buf = append(t.buf[:0], t.buf[i+1:]...)
	}
}

// observeLocked records the session of one JSON-RPC line, if it is an elicitation request that names one.
func (t *elicitationTags) observeLocked(line []byte) {
	if !bytes.Contains(line, elicitationCreateMethod) { // cheap gate: almost every line is a session update
		return
	}
	var msg struct {
		Method string          `json:"method"`
		Params json.RawMessage `json:"params"`
	}
	if json.Unmarshal(line, &msg) != nil || msg.Method != acp.ClientMethodElicitationCreate || len(msg.Params) == 0 {
		return
	}
	// sessionId is the spec's field, _meta where an adapter may put it instead; both are read from the raw params
	// because the SDK's generated type keeps neither.
	var params struct {
		SessionID string         `json:"sessionId"`
		Meta      map[string]any `json:"_meta"`
	}
	if json.Unmarshal(msg.Params, &params) != nil {
		return
	}
	sid := params.SessionID
	if sid == "" {
		sid, _ = params.Meta["sessionId"].(string)
	}
	if sid == "" {
		return
	}
	var req acp.UnstableCreateElicitationRequest
	if json.Unmarshal(msg.Params, &req) != nil {
		return
	}
	key := elicitationDigest(req)
	if key == "" {
		return
	}
	if t.tags == nil {
		t.tags = map[string][]SessionID{}
	}
	if len(t.tags) >= maxPendingTags {
		t.tags = map[string][]SessionID{} // unclaimed leftovers; routing falls back rather than growing forever
	}
	// A queue, not a single value: two sessions can ask an identical question at once, and that collides on the digest.
	t.tags[key] = append(t.tags[key], SessionID(sid))
}

// take returns (and forgets) the oldest session recorded for req, or "" when there is none.
func (t *elicitationTags) take(req acp.UnstableCreateElicitationRequest) SessionID {
	if t == nil {
		return ""
	}
	key := elicitationDigest(req)
	if key == "" {
		return ""
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	queue := t.tags[key]
	if len(queue) == 0 {
		return ""
	}
	sid := queue[0]
	if len(queue) == 1 {
		delete(t.tags, key)
	} else {
		t.tags[key] = queue[1:]
	}
	return sid
}

// elicitationDigest fingerprints a decoded elicitation request. Marshalling the decoded value (rather than hashing the
// raw bytes) is what lets the sniffer and the handler agree: both start from the same struct, and Go sorts map keys, so
// the bytes — and the digest — match.
func elicitationDigest(req acp.UnstableCreateElicitationRequest) string {
	b, err := json.Marshal(req)
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}
