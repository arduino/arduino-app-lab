package learn

import (
	"app-lab-desktop/internal/context"
	"io"
	"net/http"
	"path"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

type learnAssetMiddleware struct {
	ctxHolder *context.Holder
	svc       *Learn
}

var _ http.Handler = (*learnAssetMiddleware)(nil)

const pathPrefix = "/learn-assets/"

func (m *learnAssetMiddleware) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := m.ctxHolder.Get()

	// Expected path: /learn-assets/{resourceId}/{assetPath}
	parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, pathPrefix), "/", 2)
	if len(parts) != 2 {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	resourceId := parts[0]
	assetPath := parts[1]
	resource, err := m.svc.GetResource(ctx, LearnResourceID(resourceId))
	if err != nil || resource == nil {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	resourceDir := path.Dir(resource.Path)
	path := path.Join(resourceDir, assetPath)
	f, err := learnFS.Open(path)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	defer f.Close()

	_, err = io.Copy(w, f)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}

func AssetMiddleware(ctxHolder *context.Holder, svc *Learn) assetserver.Middleware {
	m := &learnAssetMiddleware{
		ctxHolder: ctxHolder,
		svc:       svc,
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
