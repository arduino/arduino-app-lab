package agent

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"sync/atomic"
	"time"
)

var requestSeq atomic.Uint64

// newRequestID mints a unique id to correlate a permission request with its UI reply.
func newRequestID() string { return "perm-" + strconv.FormatUint(requestSeq.Add(1), 10) }

// ErrOptionNotOffered rejects a decision naming an option the request did not offer.
var ErrOptionNotOffered = errors.New("that permission option was not offered for this request")

// pendingPermission is one request waiting for a decision, with the exact post-filter option set it offered.
type pendingPermission struct {
	ch      chan PermissionOutcome
	offered map[string]bool // reject a decision naming anything else: the id arrives from the webview and originates with the agent
}

// permissionRegistry routes a UI reply back to the blocked ACP callback (timeout → deny).
type permissionRegistry struct {
	mu      sync.Mutex
	pending map[string]*pendingPermission
}

func newPermissionRegistry() *permissionRegistry {
	return &permissionRegistry{pending: make(map[string]*pendingPermission)}
}

// register arms a request for its decision, remembering the options it actually offered.
func (r *permissionRegistry) register(id string, options []PermissionOption) chan PermissionOutcome {
	ch := make(chan PermissionOutcome, 1) // buffered so reply never blocks on the waiter
	offered := make(map[string]bool, len(options))
	for _, o := range options {
		offered[o.ID] = true
	}
	r.mu.Lock()
	r.pending[id] = &pendingPermission{ch: ch, offered: offered}
	r.mu.Unlock()
	return ch
}

// reply delivers a decision; one naming an option the request never offered is denied rather than forwarded (a cancel is always accepted). It still resolves the request: production sets no timeout, so leaving it pending would hang the turn forever. An unknown id is not an error: the request may have timed out or been cancelled.
func (r *permissionRegistry) reply(id string, o PermissionOutcome) error {
	r.mu.Lock()
	p, ok := r.pending[id]
	delete(r.pending, id)
	r.mu.Unlock()
	var err error
	if ok && !o.Cancelled && !p.offered[o.OptionID] {
		err = fmt.Errorf("%w: %q", ErrOptionNotOffered, o.OptionID)
		o = PermissionOutcome{Cancelled: true} // deny: a permission must fail closed, never hang
	}
	if ok {
		p.ch <- o
	}
	return err
}

func (r *permissionRegistry) discard(id string) {
	r.mu.Lock()
	delete(r.pending, id)
	r.mu.Unlock()
}

// wait blocks until a reply or ctx cancel; a positive timeout also denies after it, a non-positive one waits indefinitely (production passes 0).
func (r *permissionRegistry) wait(ctx context.Context, id string, ch chan PermissionOutcome, timeout time.Duration) PermissionOutcome {
	defer r.discard(id)
	var timerC <-chan time.Time
	if timeout > 0 {
		timer := time.NewTimer(timeout)
		defer timer.Stop()
		timerC = timer.C
	}
	select {
	case o := <-ch:
		return o
	case <-timerC: // nil channel when timeout<=0 → never fires (waits indefinitely)
		return PermissionOutcome{Cancelled: true}
	case <-ctx.Done():
		return PermissionOutcome{Cancelled: true}
	}
}
