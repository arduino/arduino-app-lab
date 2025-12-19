package emoji

import (
	"app-lab-desktop/internal/context"
	"errors"
	"net/http"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

type emojiAssetMiddleware struct {
	ctxHolder *context.Holder
}

var _ http.Handler = (*emojiAssetMiddleware)(nil)

const pathPrefix = "/emoji-assets/"

func (m *emojiAssetMiddleware) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Expected path: /emoji-assets/{assetPath}
	parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, pathPrefix), "/", 1)
	if len(parts) != 1 {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "image/svg+xml")
	assetPath := parts[0]
	err := pipeAsset(assetPath, w)
	if err != nil {
		w.Header().Del("Content-Type")
		if errors.Is(err, ErrNotFound) {
			w.WriteHeader(http.StatusNotFound)
		}
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}

func AssetMiddleware(ctxHolder *context.Holder) assetserver.Middleware {
	m := &emojiAssetMiddleware{
		ctxHolder: ctxHolder,
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, pathPrefix) {
				m.ServeHTTP(w, r)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
