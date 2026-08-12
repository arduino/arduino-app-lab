package hostread

import "testing"

func TestAllowSetOnlyAllowsWhatWasRecorded(t *testing.T) {
	set := NewAllowSet()
	set.Allow("/Users/me/notes.md")

	if !set.Allows("/Users/me/notes.md") {
		t.Error("expected the recorded path to be allowed")
	}
	if set.Allows("/Users/me/.ssh/id_rsa") {
		t.Error("expected an unrecorded path to be denied")
	}
	if set.Allows("") {
		t.Error("expected an empty reference to be denied")
	}
}

func TestAllowSetMatchesAcrossReferenceForms(t *testing.T) {
	tests := []struct {
		name     string
		recorded string
		asked    string
	}{
		{
			name:     "uri recorded, path asked",
			recorded: "file:///Users/me/notes.md",
			asked:    "/Users/me/notes.md",
		},
		{
			name:     "path recorded, uri asked",
			recorded: "/Users/me/notes.md",
			asked:    "file:///Users/me/notes.md",
		},
		{
			name:     "percent-encoded uri",
			recorded: "file:///Users/me/my%20notes.md",
			asked:    "/Users/me/my notes.md",
		},
		{
			name:     "unclean path",
			recorded: "/Users/me/notes.md",
			asked:    "/Users/me/./sub/../notes.md",
		},
		{
			name:     "windows drive-letter uri",
			recorded: "file:///C:/Users/me/notes.md",
			asked:    "C:/Users/me/notes.md",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			set := NewAllowSet()
			set.Allow(tt.recorded)

			if !set.Allows(tt.asked) {
				t.Errorf("Allow(%q) then Allows(%q) = false, want true", tt.recorded, tt.asked)
			}
		})
	}
}

// A traversal must not be able to reach a sibling of an allowed file.
func TestAllowSetDeniesTraversalOutOfAnAllowedPath(t *testing.T) {
	set := NewAllowSet()
	set.Allow("/Users/me/project/notes.md")

	if set.Allows("/Users/me/project/notes.md/../../.ssh/id_rsa") {
		t.Error("expected a traversal off an allowed path to be denied")
	}
}

func TestNilAllowSetAllowsNothing(t *testing.T) {
	var set *AllowSet

	set.Allow("/Users/me/notes.md") // must not panic
	if set.Allows("/Users/me/notes.md") {
		t.Error("expected a nil AllowSet to allow nothing")
	}
}
