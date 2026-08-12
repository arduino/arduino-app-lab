package agent

import (
	"encoding/json"
	"io"
	"strings"
	"testing"

	acp "github.com/coder/acp-go-sdk"
)

// elicitParams is the request payload as it travels on the wire, carrying the sessionId the SDK's generated type drops.
func elicitParams(sessionID, message string) map[string]any {
	p := map[string]any{"mode": "form", "message": message, "requestedSchema": map[string]any{"properties": map[string]any{}}}
	if sessionID != "" {
		p["sessionId"] = sessionID
	}
	return p
}

// wireLine wraps params in the JSON-RPC line the agent sends.
func wireLine(t *testing.T, id int, params map[string]any) string {
	t.Helper()
	b, err := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": id, "method": acp.ClientMethodElicitationCreate, "params": params})
	if err != nil {
		t.Fatal(err)
	}
	return string(b) + "\n"
}

// decoded is the value the SDK hands the handler: the same params, unmarshalled. Going through a decode is what makes
// the digest agree on both sides — the schema type defaults `type` to "object" and `_meta` is kept, so a hand-built
// struct would not match. sessionId is absent from the decoded value either way: no generated field holds it.
func decoded(t *testing.T, params map[string]any) acp.UnstableCreateElicitationRequest {
	t.Helper()
	b, err := json.Marshal(params)
	if err != nil {
		t.Fatal(err)
	}
	var req acp.UnstableCreateElicitationRequest
	if err := json.Unmarshal(b, &req); err != nil {
		t.Fatal(err)
	}
	return req
}

// The point of the tagger: the session must come from the wire, since guessing puts the question in the wrong thread.
func TestElicitationTagsRecoversTheSession(t *testing.T) {
	tags := &elicitationTags{}
	params := elicitParams("sess-b", "pick a board")
	if _, err := io.WriteString(tags, wireLine(t, 1, params)); err != nil {
		t.Fatal(err)
	}
	if got := tags.take(decoded(t, params)); got != "sess-b" {
		t.Fatalf("take = %q, want sess-b", got)
	}
	if got := tags.take(decoded(t, params)); got != "" {
		t.Fatalf("a claimed tag must not be handed out twice, got %q", got)
	}
	if got := tags.take(decoded(t, elicitParams("sess-b", "some other question"))); got != "" {
		t.Fatalf("an unseen request has no tag, got %q", got)
	}
}

// The tee delivers arbitrary chunks, so a request split mid-line must still be recovered.
func TestElicitationTagsHandlesSplitAndBatchedLines(t *testing.T) {
	tags := &elicitationTags{}
	split := elicitParams("sess-a", "split me")
	line := wireLine(t, 1, split)
	half := len(line) / 2
	for _, chunk := range []string{line[:half], line[half:]} {
		if _, err := io.WriteString(tags, chunk); err != nil {
			t.Fatal(err)
		}
	}
	if got := tags.take(decoded(t, split)); got != "sess-a" {
		t.Fatalf("split line: take = %q, want sess-a", got)
	}

	// Several messages in one write, with unrelated traffic between them.
	batched := elicitParams("sess-c", "batched")
	batch := `{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"sess-x"}}` + "\n" +
		wireLine(t, 2, batched) +
		`{"not":"json-rpc"}` + "\n"
	if _, err := io.WriteString(tags, batch); err != nil {
		t.Fatal(err)
	}
	if got := tags.take(decoded(t, batched)); got != "sess-c" {
		t.Fatalf("batched line: take = %q, want sess-c", got)
	}
}

// Two sessions can ask an identical question at once, which collides on the digest; the tags must not overwrite
// one another, or the very multi-session case this fixes still answers the wrong thread.
func TestElicitationTagsQueuesIdenticalRequests(t *testing.T) {
	tags := &elicitationTags{}
	var params map[string]any
	for i, sid := range []string{"sess-a", "sess-b"} {
		params = elicitParams(sid, "same question") // identical but for the sessionId, which the decode drops
		if _, err := io.WriteString(tags, wireLine(t, i, params)); err != nil {
			t.Fatal(err)
		}
	}
	if got := tags.take(decoded(t, params)); got != "sess-a" {
		t.Fatalf("first take = %q, want sess-a (oldest first)", got)
	}
	if got := tags.take(decoded(t, params)); got != "sess-b" {
		t.Fatalf("second take = %q, want sess-b", got)
	}
}

// An adapter that puts the id under _meta instead of the spec's field must still be understood.
func TestElicitationTagsReadsMetaSessionID(t *testing.T) {
	tags := &elicitationTags{}
	params := elicitParams("", "meta question")
	params["_meta"] = map[string]any{"sessionId": "sess-meta"}
	if _, err := io.WriteString(tags, wireLine(t, 9, params)); err != nil {
		t.Fatal(err)
	}
	if got := tags.take(decoded(t, params)); got != "sess-meta" {
		t.Fatalf("take = %q, want sess-meta", got)
	}
}

// The tagger sits in the live connection's read path: it must never fail or grow without bound on junk input.
func TestElicitationTagsToleratesJunkAndOversizedLines(t *testing.T) {
	tags := &elicitationTags{}
	for _, junk := range []string{"", "\n", "not json\n", `{"method":"elicitation/create"}` + "\n", strings.Repeat("x", maxTagLine+1)} {
		if _, err := io.WriteString(tags, junk); err != nil {
			t.Fatalf("Write must never error, got %v", err)
		}
	}
	if len(tags.buf) > maxTagLine {
		t.Fatalf("oversized line was buffered: %d bytes", len(tags.buf))
	}
	if got := tags.take(decoded(t, elicitParams("", "anything"))); got != "" {
		t.Fatalf("junk produced a tag: %q", got)
	}
}

// A nil tagger is the no-tee path (fake connections in tests): it must be inert, not panic.
func TestElicitationTagsNilIsInert(t *testing.T) {
	var tags *elicitationTags
	if _, err := io.WriteString(tags, "anything\n"); err != nil {
		t.Fatal(err)
	}
	if got := tags.take(decoded(t, elicitParams("", "x"))); got != "" {
		t.Fatalf("nil tagger returned %q", got)
	}
}
