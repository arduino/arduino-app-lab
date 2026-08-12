package lsp

import (
	"strings"

	"app-lab-desktop/internal/hostread"
)

const fileURIScheme = "file://"

// uriFields are the response fields that name a file the editor may be asked to
// open next: `uri` covers Location and TextDocumentIdentifier, `targetUri`
// covers LocationLink (go-to-definition into a library or system header).
var uriFields = map[string]struct{}{
	"uri":       {},
	"targetUri": {},
}

// recordNavigableFiles allows every `file://` location a server message names.
// Response shapes vary too much to type each one (Location, LocationLink,
// WorkspaceEdit.changes keyed by document URI...), so the walk is generic: it
// looks for the URI-bearing field names anywhere in the message.
func recordNavigableFiles(message any, allow *hostread.AllowSet) {
	switch value := message.(type) {
	case map[string]any:
		for field, nested := range value {
			// WorkspaceEdit.changes is a map keyed by document URI.
			if strings.HasPrefix(field, fileURIScheme) {
				allow.Allow(field)
			}

			if uri, isString := nested.(string); isString {
				if _, namesAFile := uriFields[field]; namesAFile && strings.HasPrefix(uri, fileURIScheme) {
					allow.Allow(uri)
				}
				continue
			}

			recordNavigableFiles(nested, allow)
		}
	case []any:
		for _, nested := range value {
			recordNavigableFiles(nested, allow)
		}
	}
}
