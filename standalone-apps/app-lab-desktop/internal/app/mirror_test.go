package app

import (
	"strings"
	"testing"
	"time"
)

// The zero threshold hands the whole decision to the per-file content hashes, so it may only be returned when the
// mirror actually has them: dropping the mtime gate without a baseline is the B4 force-push that reverted the
// user's editor saves. The force callers already pass the zero time, so a missing guard here would be invisible.
func TestSyncThreshold(t *testing.T) {
	baseline := time.Now().Add(-time.Hour)
	earlier, later := baseline.Add(-30*time.Minute), baseline.Add(30*time.Minute)

	for name, tc := range map[string]struct {
		since time.Time
		app   checkedApp
		force bool
		want  time.Time
	}{
		"force on a baselined mirror lets the hashes decide": {
			time.Time{}, checkedApp{baseline: baseline, baselined: true}, true, time.Time{},
		},
		"a dirty baselined mirror re-pushes every edit": {
			later, checkedApp{baseline: baseline, baselined: true, dirty: true}, false, time.Time{},
		},
		"force on a reattached mirror still gates on mtime": { // no hashes to gate on: B4 would push the whole mirror
			time.Time{}, checkedApp{baseline: baseline}, true, baseline,
		},
		"a dirty reattached mirror also keeps the gate": {
			time.Time{}, checkedApp{baseline: baseline, dirty: true}, true, baseline,
		},
		"an older window falls back to the baseline": { // skips the initial Populate copy, whose mtime predates it
			earlier, checkedApp{baseline: baseline, baselined: true}, false, baseline,
		},
		"a later turn window wins over the baseline": {
			later, checkedApp{baseline: baseline, baselined: true}, false, later,
		},
	} {
		if got := syncThreshold(tc.since, tc.app, tc.force); !got.Equal(tc.want) {
			t.Errorf("%s: threshold = %v, want %v", name, got, tc.want)
		}
	}
}

// X2: app ids repeat across boards, so the mirror dir must not be shared between them — switching board would
// otherwise reuse board A's mirror for board B's app of the same name, and Populate would overwrite A's pending edits.
func TestMirrorKeyIsPerBoard(t *testing.T) {
	a := mirrorKey("AAAA1111", "user:blink")
	b := mirrorKey("BBBB2222", "user:blink")
	if a == b {
		t.Fatalf("same key for two boards: %q", a)
	}
	for _, key := range []string{a, b} {
		if strings.ContainsAny(key, `:/\`) {
			t.Errorf("key %q is not filesystem-safe", key)
		}
	}
	// A board with no identity (SBC/placeholder) keeps the historical layout, so existing mirrors stay reachable.
	if got := mirrorKey("", "user:blink"); got != "user-blink" {
		t.Errorf("unkeyed mirror = %q, want the legacy app-only name", got)
	}
}
