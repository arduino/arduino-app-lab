package agent

import (
	"context"
	"strconv"
	"sync"
	"sync/atomic"
	"time"
)

// Elicitations wait far longer than permissions: the user reads a question and picks, with no auto-deny rush.
const defaultElicitationTimeout = 10 * time.Minute

var choiceSeq atomic.Uint64

// newChoiceID mints a unique id to correlate a choice request with its UI reply.
func newChoiceID() string { return "choice-" + strconv.FormatUint(choiceSeq.Add(1), 10) }

// elicitationRegistry routes a UI choice reply back to the blocked ACP elicitation callback (timeout → skip).
type elicitationRegistry struct {
	mu      sync.Mutex
	pending map[string]*pendingChoice
}

// pendingChoice is one question waiting for its answer, with the session it was asked in.
type pendingChoice struct {
	session SessionID
	ch      chan ChoiceSubmission
}

func newElicitationRegistry() *elicitationRegistry {
	return &elicitationRegistry{pending: make(map[string]*pendingChoice)}
}

func (r *elicitationRegistry) register(id string, sid SessionID) chan ChoiceSubmission {
	ch := make(chan ChoiceSubmission, 1) // buffered so reply never blocks on the waiter
	r.mu.Lock()
	r.pending[id] = &pendingChoice{session: sid, ch: ch}
	r.mu.Unlock()
	return ch
}

func (r *elicitationRegistry) reply(id string, s ChoiceSubmission) {
	r.mu.Lock()
	p, ok := r.pending[id]
	delete(r.pending, id)
	r.mu.Unlock()
	if ok {
		p.ch <- s
	}
}

// cancelSession skips every question a session still has open, as a stopped or finished turn can no longer use the answer.
func (r *elicitationRegistry) cancelSession(sid SessionID) {
	r.mu.Lock()
	var chans []chan ChoiceSubmission
	for id, p := range r.pending {
		if p.session == sid {
			chans = append(chans, p.ch)
			delete(r.pending, id)
		}
	}
	r.mu.Unlock()
	for _, ch := range chans {
		ch <- ChoiceSubmission{Cancelled: true}
	}
}

func (r *elicitationRegistry) discard(id string) {
	r.mu.Lock()
	delete(r.pending, id)
	r.mu.Unlock()
}

// wait blocks for a reply, treating timeout or context cancel as a skip.
func (r *elicitationRegistry) wait(ctx context.Context, id string, ch chan ChoiceSubmission, timeout time.Duration) ChoiceSubmission {
	defer r.discard(id)
	if timeout <= 0 {
		timeout = defaultElicitationTimeout
	}
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case s := <-ch:
		return s
	case <-timer.C:
		return ChoiceSubmission{Cancelled: true}
	case <-ctx.Done():
		return ChoiceSubmission{Cancelled: true}
	}
}
