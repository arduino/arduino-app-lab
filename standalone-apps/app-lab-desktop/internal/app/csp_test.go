package app

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func serveThroughCSP(t *testing.T, policy string) *http.Response {
	t.Helper()

	handler := CSPMiddleware(policy)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/index.html", nil))
	return rec.Result()
}

func TestCSPMiddlewareSetsThePolicy(t *testing.T) {
	res := serveThroughCSP(t, "frame-src 'none'")

	if got := res.Header.Get("Content-Security-Policy"); got != "frame-src 'none'" {
		t.Errorf("Content-Security-Policy = %q, want %q", got, "frame-src 'none'")
	}
}

func TestCSPMiddlewareWithoutAPolicySetsNoHeader(t *testing.T) {
	res := serveThroughCSP(t, "")

	if _, ok := res.Header["Content-Security-Policy"]; ok {
		t.Error("expected no Content-Security-Policy header when the policy is empty")
	}
}
