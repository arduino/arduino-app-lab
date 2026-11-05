package app

import (
	"strings"
	"sync"
	"time"

	"app-lab-desktop/internal/agent"
)

// Each event costs the webview's main thread one script run, so a session's text deltas leave together.
const streamBatchWindow = 50 * time.Millisecond

// A delta at least this long that ends the run repeats it: shorter ones are too often a token that happens to match.
const minReSendLen = 16

// updateBatcher merges a session's consecutive text deltas into one update; any other update leaves after them, in order.
type updateBatcher struct {
	mu       sync.Mutex
	window   time.Duration
	emit     func(agent.SessionID, agent.Update)
	sessions map[agent.SessionID]*deltaRun
}

// deltaRun is the text one message part receives: the webview drops a delta equal to all of it, an adapter re-sending a block.
type deltaRun struct {
	kind     string
	text     strings.Builder
	pending  strings.Builder
	timer    *time.Timer
	tracking bool
}

func newUpdateBatcher(window time.Duration, emit func(agent.SessionID, agent.Update)) *updateBatcher {
	return &updateBatcher{window: window, emit: emit, sessions: map[agent.SessionID]*deltaRun{}}
}

func (b *updateBatcher) Push(sid agent.SessionID, u agent.Update) {
	b.mu.Lock()
	defer b.mu.Unlock()
	r := b.sessions[sid]
	if r == nil {
		r = &deltaRun{}
		b.sessions[sid] = r
	}
	if u.Type != "message_chunk" && u.Type != "thinking" {
		b.flushLocked(sid, r)
		r.kind = ""
		r.text.Reset()
		r.tracking = false
		b.emit(sid, u)
		return
	}
	if u.Type != r.kind {
		b.flushLocked(sid, r)
		r.kind = u.Type
		r.text.Reset()
	}
	if !r.tracking {
		// After another update or End the webview's last part is unknown here, and its re-send may be this delta.
		r.tracking = true
		r.text.WriteString(u.Delta)
		b.emit(sid, u)
		return
	}
	if run := r.text.String(); run != "" && (strings.HasSuffix(u.Delta, run) || (len(u.Delta) >= minReSendLen && strings.HasSuffix(run, u.Delta))) {
		b.flushLocked(sid, r)
		b.emit(sid, u) // alone, or the webview would no longer recognise the re-send and show the block twice
		return
	}
	r.text.WriteString(u.Delta)
	r.pending.WriteString(u.Delta)
	if r.timer == nil {
		r.timer = time.AfterFunc(b.window, func() { b.Flush(sid) })
	}
}

// Flush sends the session's waiting text now.
func (b *updateBatcher) Flush(sid agent.SessionID) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if r := b.sessions[sid]; r != nil {
		b.flushLocked(sid, r)
	}
}

// End flushes the session and forgets its run: called before a binding returns whose caller treats the turn or the replay as complete.
func (b *updateBatcher) End(sid agent.SessionID) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if r := b.sessions[sid]; r != nil {
		b.flushLocked(sid, r)
		delete(b.sessions, sid)
	}
}

// EndAll ends every session: called when the agent that owns them stops.
func (b *updateBatcher) EndAll() {
	b.mu.Lock()
	defer b.mu.Unlock()
	for sid, r := range b.sessions {
		b.flushLocked(sid, r)
	}
	clear(b.sessions)
}

func (b *updateBatcher) flushLocked(sid agent.SessionID, r *deltaRun) {
	if r.timer != nil {
		r.timer.Stop()
		r.timer = nil
	}
	if r.pending.Len() == 0 {
		return
	}
	b.emit(sid, agent.Update{Type: r.kind, Delta: r.pending.String()})
	r.pending.Reset()
}
