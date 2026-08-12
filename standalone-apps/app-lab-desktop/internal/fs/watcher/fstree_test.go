package watcher

import (
	"testing"
)

func TestIsShellSafePath(t *testing.T) {
	tests := []struct {
		name string
		path string
		want bool
	}{
		{
			name: "valid absolute path",
			path: "/home/arduino/ArduinoApps",
			want: true,
		},
		{
			name: "valid absolute path with subdirectory",
			path: "/home/arduino/ArduinoApps/MyApp",
			want: true,
		},
		{
			name: "valid relative path",
			path: "ArduinoApps/MyApp",
			want: true,
		},
		{
			name: "path with space - unsafe (shell metacharacter)",
			path: "/home/arduino/Arduino Apps",
			want: false,
		},
		{
			name: "path with semicolon - unsafe (shell metacharacter)",
			path: "/home/arduino/ArduinoApps;rm",
			want: false,
		},
		{
			name: "path with backslash - unsafe",
			path: "/home/arduino/ArduinoApps\\rm",
			want: false,
		},
		{
			name: "path with null byte - unsafe",
			path: "/home/arduino/ArduinoApps\x00rm",
			want: false,
		},
		{
			name: "path with double dollar - unsafe",
			path: "/home/arduino/ArduinoApps$$",
			want: false,
		},
		{
			name: "simple valid path",
			path: "MyApp",
			want: true,
		},
		{
			name: "path with single dollar - unsafe (shell metacharacter)",
			path: "/home/arduino/ArduinoApps$rm",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isShellSafePath(tt.path); got != tt.want {
				t.Errorf("isShellSafePath(%q) = %v, want %v", tt.path, got, tt.want)
			}
		})
	}
}

func TestIsQuotedSafeName(t *testing.T) {
	// Names of existing board files, which only ever reach the shell through
	// quoted conn.List / conn.ReadFile calls. Almost everything is therefore
	// fine — including spaces, which inotifywait never sees because it watches
	// the app directory recursively.
	tests := []struct {
		name string
		path string
		want bool
	}{
		{name: "simple name", path: "ArduinoApps", want: true},
		{name: "underscore", path: "My_App", want: true},
		{name: "dash", path: "My-App", want: true},
		{name: "dot", path: "app.yaml", want: true},
		{name: "space", path: "my notes.txt", want: true},
		{name: "space in folder name", path: "Arduino Apps", want: true},
		{name: "parentheses and space", path: "notes (draft) v2.md", want: true},
		{name: "semicolon", path: "Arduino;rm", want: true},
		{name: "ampersand", path: "Arduino&rm", want: true},
		{name: "pipe", path: "Arduino|rm", want: true},
		{name: "asterisk", path: "Arduino*rm", want: true},
		{name: "single quote", path: "it's mine.txt", want: true},
		{name: "double quote", path: "Arduino\"rm", want: true},
		{name: "braces and brackets", path: "log{1}[2].txt", want: true},

		// Windows-illegal but perfectly watchable on the board's Debian FS.
		{name: "colon", path: "log:2026.txt", want: true},

		// Survive the double quoting the transports apply.
		{name: "dollar", path: "Arduino$rm", want: false},
		{name: "backtick", path: "Arduino`rm", want: false},

		// Not a single component / not usable.
		{name: "path separator", path: "Arduino/Apps", want: false},
		{name: "null byte", path: "Arduino\x00rm", want: false},
		{name: "control character", path: "Arduino\x07rm", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isQuotedSafeName(tt.path); got != tt.want {
				t.Errorf("isQuotedSafeName(%q) = %v, want %v", tt.path, got, tt.want)
			}
		})
	}
}

func TestIsCreatableName(t *testing.T) {
	tests := []struct {
		name string
		path string
		want bool
	}{
		// Ordinary names.
		{name: "simple name", path: "ArduinoApps", want: true},
		{name: "underscore", path: "My_App", want: true},
		{name: "dash", path: "My-App", want: true},
		{name: "internal dot", path: "app.yaml", want: true},
		{name: "internal dots", path: "Arduino.App", want: true},

		// Allowed because conn.ReadFile/WriteFile quote the path: these are
		// inert inside the double quotes the transports apply, and they are the
		// names users actually type.
		{name: "space", path: "my notes.txt", want: true},
		{name: "space in folder name", path: "Arduino Apps", want: true},
		{name: "parentheses and space", path: "notes (draft) v2.md", want: true},
		{name: "semicolon", path: "Arduino;rm", want: true},
		{name: "ampersand", path: "Arduino&rm", want: true},
		{name: "single quote", path: "it's mine.txt", want: true},
		{name: "tilde", path: "Arduino~rm", want: true},
		{name: "hash", path: "issue #12.md", want: true},
		{name: "exclamation", path: "Arduino!rm", want: true},
		{name: "braces", path: "Arduino{rm}", want: true},
		{name: "brackets", path: "Arduino[rm]", want: true},

		// Expand even inside double quotes, so these two must not reach a path.
		{name: "dollar - expands inside double quotes", path: "Arduino$rm", want: false},
		{name: "dollar sigil alone", path: "$HOME.txt", want: false},
		{name: "backtick - substitutes inside double quotes", path: "Arduino`rm", want: false},

		// Windows host rules: the LSP mirror writes these names to the host.
		{name: "angle bracket (Windows)", path: "Arduino<App", want: false},
		{name: "colon (Windows)", path: "Arduino:App", want: false},
		{name: "double quote (Windows)", path: "Arduino\"App", want: false},
		{name: "pipe (Windows)", path: "Arduino|rm", want: false},
		{name: "asterisk (Windows)", path: "Arduino*rm", want: false},
		{name: "question mark (Windows)", path: "Arduino?rm", want: false},
		{name: "backslash (Windows separator)", path: "Arduino\\rm", want: false},
		{name: "trailing dot (Windows)", path: "Arduino.", want: false},
		{name: "trailing space (Windows)", path: "Arduino ", want: false},
		{name: "trailing dot and space (Windows)", path: "Arduino. ", want: false},
		{name: "reserved con (Windows)", path: "con", want: false},
		{name: "reserved prn (Windows)", path: "prn", want: false},
		{name: "reserved aux (Windows)", path: "aux", want: false},
		{name: "reserved con with extension (Windows)", path: "con.txt", want: false},
		{name: "reserved CON uppercase (Windows)", path: "CON", want: false},

		// Not usable as a name anywhere.
		{name: "path separator", path: "Arduino/Apps", want: false},
		{name: "null byte", path: "Arduino\x00rm", want: false},
		{name: "control character", path: "Arduino\x07rm", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsCreatableName(tt.path); got != tt.want {
				t.Errorf("IsCreatableName(%q) = %v, want %v", tt.path, got, tt.want)
			}
		})
	}
}

func TestShellUnsafeCharacterClass(t *testing.T) {
	// isShellSafePath is shellUnsafe's only consumer; on a single component it
	// exercises the character class directly.
	mustBeSafe := []string{"index.py", "log0.txt", "max.py", "x", "0", "main.py", "app.yaml"}
	for _, name := range mustBeSafe {
		if !isShellSafePath(name) {
			t.Errorf("isShellSafePath(%q) = false, want true (character class over-matches)", name)
		}
	}

	mustBeUnsafe := []string{
		" ", "\t", "\n", ";", "|", "&", "$", "`", "(", ")", "<", ">",
		"\\", "\"", "'", "*", "?", "~", "#", "!", "{", "}", "[", "]", "\x00",
	}
	for _, ch := range mustBeUnsafe {
		if isShellSafePath("a" + ch + "b") {
			t.Errorf("isShellSafePath(%q) = true, want false (character class under-matches)", "a"+ch+"b")
		}
	}
}

func TestIsCreatableNameRejectsEmpty(t *testing.T) {
	if IsCreatableName("") {
		t.Error(`IsCreatableName("") = true, want false`)
	}
}
