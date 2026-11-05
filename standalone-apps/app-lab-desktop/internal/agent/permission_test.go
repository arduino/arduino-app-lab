package agent

import (
	"errors"
	"testing"
)

// The option id reaches Go from the webview and originates with the agent, so a decision naming an option the request never offered (incl. one S1 dropped) must be refused, not forwarded.
func TestPermissionReplyRejectsAnUnofferedOption(t *testing.T) {
	r := newPermissionRegistry()

	for _, id := range []string{"allow_always", "", "made-up"} {
		ch := r.register("perm-"+id, "s1", []PermissionOption{{ID: "allow_once"}, {ID: "reject_once"}})
		if err := r.reply("perm-"+id, PermissionOutcome{OptionID: id}); !errors.Is(err, ErrOptionNotOffered) {
			t.Errorf("reply with %q: got %v, want ErrOptionNotOffered", id, err)
		}
		// Production sets no timeout, so a refused decision must still resolve the request — as a deny.
		if out := <-ch; !out.Cancelled || out.OptionID != "" {
			t.Errorf("reply with %q must be denied, got %+v", id, out)
		}
	}

	// A cancel needs no offered option: the user dismissing the dialog denies.
	ch := r.register("perm-2", "s1", []PermissionOption{{ID: "allow_once"}})
	if err := r.reply("perm-2", PermissionOutcome{Cancelled: true}); err != nil {
		t.Fatalf("cancel must always be accepted: %v", err)
	}
	if out := <-ch; !out.Cancelled {
		t.Fatalf("expected the cancel to be delivered, got %+v", out)
	}

	// An unknown request id is not an error: it may have timed out while the dialog was open.
	if err := r.reply("perm-gone", PermissionOutcome{OptionID: "allow_once"}); err != nil {
		t.Fatalf("replying to a vanished request must not error: %v", err)
	}
}

// The engine queues a session's requests and waits on the oldest with no timer: one left open blocks the session, and only that session's may be answered.
func TestCancelSessionAnswersOnlyThatSession(t *testing.T) {
	r := newPermissionRegistry()
	opts := []PermissionOption{{ID: "allow_once"}}
	first, second := r.register("p1", "s1", opts), r.register("p2", "s1", opts)
	other := r.register("p3", "s2", opts)

	r.cancelSession("s1")

	for name, ch := range map[string]chan PermissionOutcome{"p1": first, "p2": second} {
		select {
		case out := <-ch:
			if !out.Cancelled {
				t.Errorf("%s = %+v, want cancelled", name, out)
			}
		default:
			t.Errorf("%s was left waiting", name)
		}
	}
	// A reply that arrives late, from a card still on screen, must not fail or reach anything.
	if err := r.reply("p1", PermissionOutcome{OptionID: "allow_once"}); err != nil {
		t.Errorf("late reply: %v", err)
	}
	if err := r.reply("p3", PermissionOutcome{OptionID: "allow_once"}); err != nil {
		t.Fatalf("the other session's request was dropped: %v", err)
	}
	if out := <-other; out.OptionID != "allow_once" {
		t.Errorf("the other session got %+v, want its own answer", out)
	}
}

func TestPermissionReplyAcceptsAnOfferedOption(t *testing.T) {
	r := newPermissionRegistry()
	ch := r.register("perm-1", "s1", []PermissionOption{{ID: "allow_once"}})
	if err := r.reply("perm-1", PermissionOutcome{OptionID: "allow_once"}); err != nil {
		t.Fatalf("reply: %v", err)
	}
	if out := <-ch; out.OptionID != "allow_once" {
		t.Fatalf("expected the offered option to be delivered, got %+v", out)
	}
}
