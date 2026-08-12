package watcher

import (
	"os"
	"path"
	"regexp"
	"sort"
	"strings"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

const (
	// maxRecursiveDirs bounds how many directories a single recursive watch will
	// register, guarding inotify watch limits on pathological trees.
	maxRecursiveDirs = 2048
	// maxWatchedFiles bounds how many files an app may contain before we decline
	// to watch it — keeps event volume (and the polling fallback's cost) sane on
	// the constrained board.
	maxWatchedFiles = 1000
)

// excludedDirs are directory names we never recurse into — heavy or irrelevant
// trees that would waste inotify watches / poll bandwidth.
var excludedDirs = map[string]bool{
	".git":         true,
	"node_modules": true,
	"__pycache__":  true,
	".cache":       true,
	".venv":        true,
}

func excluded(name string) bool { return excludedDirs[name] }

type fsEntry struct {
	name  string
	isDir bool
}

// dirLister lists a single directory's entries. Backed by os.ReadDir (local) or
// conn.List (remote), so limit checks work the same either way.
type dirLister func(dir string) ([]fsEntry, error)

func localLister(dir string) ([]fsEntry, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := make([]fsEntry, len(entries))
	for i, e := range entries {
		out[i] = fsEntry{name: e.Name(), isDir: e.IsDir()}
	}
	return out, nil
}

func remoteLister(conn remote.RemoteConn) dirLister {
	return func(dir string) ([]fsEntry, error) {
		entries, err := conn.List(dir)
		if err != nil {
			return nil, err
		}
		out := make([]fsEntry, 0, len(entries))
		for _, e := range entries {
			// A board-discovered name only ever reaches the shell through
			// conn.List (recursing) and conn.ReadFile (fingerprinting), and the
			// transports quote the path for both. So the strict shell rules do not
			// apply here: a space is fine, and "my notes.txt" is counted and
			// watched like any other file. Only what survives double quoting has
			// to go — see isQuotedSafeName.
			if !isQuotedSafeName(e.Name) {
				continue
			}
			out = append(out, fsEntry{name: e.Name, isDir: e.IsDir})
		}
		return out, nil
	}
}

// treeWithinLimits walks root (skipping excluded dirs) and reports whether it
// stays within maxWatchedFiles and maxRecursiveDirs. It short-circuits as soon
// as either cap is exceeded, so rejecting an over-large tree is cheap.
func treeWithinLimits(list dirLister, root string) bool {
	queue := []string{root}
	files, dirs := 0, 0
	for len(queue) > 0 {
		dir := queue[0]
		queue = queue[1:]
		dirs++
		if dirs > maxRecursiveDirs {
			return false
		}
		entries, err := list(dir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if e.isDir {
				if !excluded(e.name) {
					queue = append(queue, path.Join(dir, e.name))
				}
				continue
			}
			files++
			if files > maxWatchedFiles {
				return false
			}
		}
	}
	return true
}

// excludeInotifyRegex builds a POSIX extended regex matching any path that has
// an excluded directory as a component, e.g. "(^|/)(\.git|node_modules)(/|$)".
// inotifywait uses it (via --exclude) to skip those subtrees when watching an
// app recursively.
func excludeInotifyRegex() string {
	names := make([]string, 0, len(excludedDirs))
	for n := range excludedDirs {
		names = append(names, regexp.QuoteMeta(n))
	}
	sort.Strings(names) // deterministic output
	return "(^|/)(" + strings.Join(names, "|") + ")(/|$)"
}

// shellUnsafe: whitespace, shell metacharacters, control characters. Narrow
// remit — it gates only the *watch roots* handed to isShellSafePath, because the
// inotifywait argv in remote_inotify.go is the one path that still reaches the
// board shell entirely unquoted (SSH's GetCmd raw-joins args, and ADB's quotes
// only args that contain a space, so pre-quoting here would be double-quoted and
// break).
//
// In practice the roots are app directories, whose names the orchestrator
// derives with slug.Make, plus the apps root — so none of this set occurs there
// anyway. It stays strict as a backstop for a directory created outside App Lab.
//
// It says nothing about the files *inside* a watched app: those are covered by
// inotifywait's -r, never appear as an argument, and reach the shell only via
// quoted conn.List/conn.ReadFile. Do not use this set for file names — see
// isQuotedSafeName and IsCreatableName.
//
// No '/': it is the separator, so it is checked per component. Interpreted (not
// raw) string: the class contains a backtick, which a Go raw string literal
// cannot hold, and \x00 must reach the engine as an escape rather than as the
// literal characters \, x, 0, 0. \x00-\x1f rather than leaning on \s for the
// control range, because RE2's \s is [\t\n\f\r ] and omits \v; \s stays for the
// space itself (0x20).
var shellUnsafe = regexp.MustCompile("[\\s;|&$`()<>\\\\\"'*?~#!{}\\[\\]\\x00-\\x1f]")

// expansionUnsafe: the characters that survive the double quoting the transports
// apply to file operations. `cat "…$HOME…"` still expands and `cat "…`id`…"`
// still substitutes, so these two must never reach a board path — verified
// against a board: a name containing `echo INJECTED` in backticks executed it.
// Everything else in shellUnsafe — space, semicolon, ampersand, parentheses,
// single quote, tilde, hash, exclamation, braces, brackets — is inert inside
// double quotes and therefore allowed in a filename.
var expansionUnsafe = regexp.MustCompile("[$`]")

// Illegal in a name on a Windows host — InitLspWorkspace mirrors names there.
// '\\' joins them: it is that platform's separator and an escape character.
var windowsUnsafe = regexp.MustCompile(`[<>:"|?*\\]`)

// controlChars are rejected everywhere: unusable on the host filesystem and a
// reliable sign something has gone wrong upstream.
var controlChars = regexp.MustCompile("[\\x00-\\x1f]")

// trailingDotsOrSpaces matches trailing dots or spaces which are invalid on Windows.
var trailingDotsOrSpaces = regexp.MustCompile(`[. ]+$`)

// reservedNames matches Windows reserved device names (case-insensitive).
var reservedNames = regexp.MustCompile(`(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$`)

// isShellSafePath validates a full path (e.g. "/home/arduino/ArduinoApps").
// Every component must be shell-safe. Windows rules do NOT apply here,
// or legitimately-named existing board files stop being watched.
func isShellSafePath(p string) bool {
	for _, component := range strings.Split(p, "/") {
		if shellUnsafe.MatchString(component) {
			return false
		}
	}
	return true
}

// isQuotedSafeName validates an existing board file or directory name that we
// will only ever hand to a *quoted* conn call (conn.List, conn.ReadFile). That
// covers everything except the two characters double quoting does not stop, so
// spaces and ordinary punctuation are fine — a file called "my notes.txt" is
// counted and watched like any other.
//
// Windows rules deliberately do not apply: "log:2026.txt" already exists on the
// board and is perfectly watchable; those rules belong at create/mirror time
// (see IsCreatableName). '/' is rejected because a component containing one is
// not a component — it would silently change the path once path.Join folds it in.
func isQuotedSafeName(name string) bool {
	return !expansionUnsafe.MatchString(name) &&
		!controlChars.MatchString(name) &&
		!strings.Contains(name, "/")
}

// IsCreatableName validates a name we are about to create, rename to, or mirror
// onto the host. Deliberately much laxer than shellUnsafe: spaces and most
// metacharacters are fine because conn.ReadFile/WriteFile quote the path, so
// "my notes.txt" and "notes (draft).md" are ordinary, valid filenames.
//
// What must still go:
//   - '$' and '`', which expand even inside the transports' double quotes;
//   - the Windows-illegal set, trailing dots/spaces and reserved device names,
//     because InitLspWorkspace mirrors names onto the host filesystem;
//   - '/' and control characters, which are not usable in a name anywhere.
//
// Exported because it is the authoritative gate — the frontend performs the
// same check for immediate feedback, but that check is bypassable, so the API
// boundary in internal/app enforces this one.
func IsCreatableName(name string) bool {
	if name == "" {
		return false
	}
	if expansionUnsafe.MatchString(name) {
		return false
	}
	if controlChars.MatchString(name) {
		return false
	}
	if windowsUnsafe.MatchString(name) {
		return false
	}
	if trailingDotsOrSpaces.MatchString(name) {
		return false
	}
	if reservedNames.MatchString(name) {
		return false
	}
	if strings.Contains(name, "/") {
		return false
	}
	return true
}
