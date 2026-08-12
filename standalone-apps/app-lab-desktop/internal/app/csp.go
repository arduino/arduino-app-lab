package app

import (
	"net/http"

	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

// CSPMiddleware stamps a Content-Security-Policy on everything the asset server
// serves, the webview's backstop against content we render but do not author
// (app READMEs, Learn resources). It is a second line of defence only: the
// policy cannot restrict the Wails bindings, so reads exposed through those
// still have to be checked in Go.
//
// An empty policy installs no header, which is how dev builds opt out.
func CSPMiddleware(policy string) assetserver.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if policy != "" {
				w.Header().Set("Content-Security-Policy", policy)
			}
			next.ServeHTTP(w, r)
		})
	}
}
