// Package hostread tracks which files on the machine running App Lab a session
// may read through the `file://` binding.
//
// The webview is the untrusted party: it can ask for any path, so the set is
// built only from intents the backend observes for itself - a file the user
// picked in an OS dialog, or a location a language server pointed at. A path
// the session never opened is refused.
package hostread

import (
	"net/url"
	"path/filepath"
	"strings"
	"sync"
)

const fileScheme = "file://"

// AllowSet is the set of host files a session has been given a reason to read.
// It is safe for concurrent use; a nil AllowSet allows nothing.
type AllowSet struct {
	mu    sync.RWMutex
	paths map[string]struct{}
}

func NewAllowSet() *AllowSet {
	return &AllowSet{paths: make(map[string]struct{})}
}

// Allow records references the session may read from now on. References are
// either `file://` URIs or plain paths - both are canonicalized, so callers can
// pass whichever form they already hold.
func (s *AllowSet) Allow(refs ...string) {
	if s == nil {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, ref := range refs {
		if canonical := canonicalize(ref); canonical != "" {
			s.paths[canonical] = struct{}{}
		}
	}
}

// Allows reports whether ref was recorded by an earlier Allow.
func (s *AllowSet) Allows(ref string) bool {
	if s == nil {
		return false
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	_, ok := s.paths[canonicalize(ref)]
	return ok
}

// canonicalize reduces a reference to the path both sides are compared on, so
// that the same file recorded as a URI and asked for as a path still matches.
// It deliberately mirrors the `file://` handling in internal/fs rather than
// sharing it: this side only ever produces map keys, never a path to open.
func canonicalize(ref string) string {
	p := strings.TrimPrefix(ref, fileScheme)
	if p == "" {
		return ""
	}

	if decoded, err := url.PathUnescape(p); err == nil {
		p = decoded
	}

	// Windows drive-letter URIs look like "/C:/Users/..." once the scheme is
	// gone; drop the leading slash so it becomes a valid absolute path.
	if len(p) >= 3 && p[0] == '/' && p[2] == ':' {
		p = p[1:]
	}

	return filepath.Clean(filepath.FromSlash(p))
}
