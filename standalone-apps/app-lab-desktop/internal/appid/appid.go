// Package appid reads app ids as the orchestrator gives them out: unpadded base64url of "<kind>:<path>" or an absolute path.
package appid

import (
	"encoding/base64"
	"strings"
	"unicode"
)

var kinds = []string{"user:", "examples:", "release:"}

// Canonical gives a decoded (user:blink), padded or standard-alphabet id in the board's spelling; any other id loses only its spaces and padding.
func Canonical(id string) string {
	id = strings.TrimSpace(id)
	if hasKind(id) {
		return base64.RawURLEncoding.EncodeToString([]byte(id))
	}
	// Spaces and padding in any order, so that a second pass changes nothing.
	unpadded := strings.TrimRightFunc(id, func(r rune) bool { return r == '=' || unicode.IsSpace(r) })
	if raw := strings.NewReplacer("+", "-", "/", "_").Replace(unpadded); Valid(raw) {
		return raw
	}
	return unpadded
}

// Valid reports an id in the orchestrator's own spelling.
func Valid(id string) bool {
	decoded, err := base64.RawURLEncoding.DecodeString(id)
	return err == nil && (hasKind(string(decoded)) || strings.HasPrefix(string(decoded), "/"))
}

// hasKind reads a decoded id; a decoded path is left out, as the board would take it for a second id of a user app.
func hasKind(decoded string) bool {
	for _, kind := range kinds {
		if strings.HasPrefix(decoded, kind) {
			return true
		}
	}
	return false
}
