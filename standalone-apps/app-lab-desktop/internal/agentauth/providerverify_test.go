package agentauth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// A rejected key must be refused before it is stored; any other answer says nothing about the key.
func TestOnlyARefusalRejectsTheKey(t *testing.T) {
	for _, tc := range []struct {
		status int
		want   error
	}{
		{http.StatusOK, nil},
		{http.StatusUnauthorized, ErrAPIKeyRejected},
		{http.StatusForbidden, ErrAPIKeyRejected},
		{http.StatusBadRequest, ErrProviderUnverifiable}, // a provider with no words for a bad key in a 400
		{http.StatusNotFound, ErrProviderUnverifiable},   // no /models route here
		{http.StatusTooManyRequests, ErrProviderUnverifiable},
		{http.StatusBadGateway, ErrProviderUnverifiable},
	} {
		// Turns away a request with no key, which is what makes its 200 mean the key was accepted.
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") == "" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.WriteHeader(tc.status)
		}))
		err := VerifyProviderKey(context.Background(), Provider{ID: "x", Name: "X", API: srv.URL}, "k")
		srv.Close()
		if tc.want == nil && err != nil {
			t.Errorf("status %d: got %v, want accepted", tc.status, err)
		}
		if tc.want != nil && !errors.Is(err, tc.want) {
			t.Errorf("status %d: got %v, want %v", tc.status, err, tc.want)
		}
	}
}

// Google and xAI answer a bad key with 400: their own words for it refuse the key, any other 400 says nothing.
func TestA400RefusesTheKeyOnlyInTheProvidersWords(t *testing.T) {
	answer := ""
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, answer, http.StatusBadRequest)
	}))
	defer srv.Close()
	providerChecks["fake-400"] = providerCheck{url: srv.URL, badKeyText: "API_KEY_INVALID"}
	t.Cleanup(func() { delete(providerChecks, "fake-400") })
	p := Provider{ID: "fake-400", Name: "Fake 400"}

	// Google's answer to a made-up key.
	answer = `{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}`
	err := VerifyProviderKey(context.Background(), p, "k")
	var rejection *KeyRejection
	if !errors.Is(err, ErrAPIKeyRejected) || !errors.As(err, &rejection) {
		t.Fatalf("400 naming a bad key: got %v, want rejected", err)
	}
	if rejection.Reason != "API key not valid. Please pass a valid API key." {
		t.Errorf("reason = %q, want Google's own words", rejection.Reason)
	}
	answer = `{"error":{"code":400,"message":"Request contains an invalid argument.","status":"INVALID_ARGUMENT"}}`
	if err := VerifyProviderKey(context.Background(), p, "k"); !errors.Is(err, ErrProviderUnverifiable) {
		t.Errorf("400 for another reason: got %v, want unverifiable", err)
	}
	for _, id := range []string{"google", "xai"} {
		if providerChecks[id].badKeyText == "" {
			t.Errorf("%s answers a bad key with 400, so its check needs the words it uses", id)
		}
	}
}

// What a provider says when it refuses a key is shown to the user, so it must never hold the key.
func TestARefusalCarriesTheProvidersOwnWords(t *testing.T) {
	const key = "sk-not-a-real-key-SECRETPART"
	for body, want := range map[string]string{
		`{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}`: "invalid x-api-key",           // Anthropic
		`{"error":{"message":"Invalid API Key","type":"invalid_request_error"}}`:                 "Invalid API Key",             // OpenAI, Groq
		`{"code":"invalid-argument","error":"Incorrect API key provided."}`:                      "Incorrect API key provided.", // xAI
		`{"detail":"Invalid API Key"}`:                                   "Invalid API Key", // Mistral
		`{"error":{"message":"Your api key:\n ` + key + ` is invalid"}}`: "Your api key: … is invalid",
		`<html><body>401 Unauthorized</body></html>`:                     "",
		``: "",
	} {
		if got := refusalReason([]byte(body), key); got != want {
			t.Errorf("%s: got %q, want %q", body, got, want)
		}
	}
}

// The catalogue carries no address for most big providers, so those need an entry of our own.
func TestAProviderWithNoAddressCannotBeChecked(t *testing.T) {
	err := VerifyProviderKey(context.Background(), Provider{ID: "nowhere", Name: "Nowhere"}, "k")
	if !errors.Is(err, ErrProviderUnverifiable) {
		t.Errorf("got %v, want unverifiable", err)
	}
	for _, id := range []string{"anthropic", "openai", "google", "groq", "mistral", "xai", "deepseek"} {
		if _, ok := providerChecks[id]; !ok {
			t.Errorf("%s has no address of its own, so its keys would go unchecked", id)
		}
	}
}

// The key is carried the way each provider expects; sending it the wrong way reads as a bad key.
func TestTheKeyIsCarriedTheProvidersOwnWay(t *testing.T) {
	seen := make(chan string, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth == "" { // the keyless probe that tells a real check from a route that ignores keys
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		select {
		case seen <- auth:
		default:
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	if err := VerifyProviderKey(context.Background(), Provider{ID: "x", Name: "X", API: srv.URL}, "k"); err != nil {
		t.Fatalf("verify: %v", err)
	}
	if got := <-seen; got != "Bearer k" {
		t.Errorf("Authorization = %q, want the OpenAI-compatible bearer", got)
	}
	// Anthropic does not use that header at all, and Google puts the key in the query string.
	req, _ := http.NewRequest(http.MethodGet, "https://example.test/v1/models", nil)
	providerChecks["anthropic"].auth(req, "k")
	if req.Header.Get("x-api-key") != "k" || req.Header.Get("anthropic-version") == "" {
		t.Error("anthropic: the key and the version must both be headers")
	}
	req2, _ := http.NewRequest(http.MethodGet, "https://example.test/v1beta/models", nil)
	providerChecks["google"].auth(req2, "k")
	if req2.URL.Query().Get("key") != "k" {
		t.Error("google: the key rides the query string")
	}
}

// A fake provider, so no test ever calls a real one: only an id outside providerChecks reaches p.API.
func fakeProvider(api string) Provider {
	return Provider{ID: "fake-provider", Name: "Fake Provider", EnvVar: "FAKE_API_KEY", API: api}
}

// Not being able to ask says nothing about the key, so none of these may reject it.
func TestNoTransportFailureRejectsTheKey(t *testing.T) {
	const key = "sk-test-not-a-real-key-0123456789abcdef"

	refused := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	refusedURL := refused.URL
	refused.Close() // nothing listening on that port now

	tls := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer tls.Close()

	slow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(500 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer slow.Close()

	serverError := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer serverError.Close()

	cases := map[string]struct {
		api string
		ctx func() (context.Context, context.CancelFunc)
	}{
		"connection refused": {api: refusedURL},
		// Its certificate is signed by nobody the host trusts, which is what a MITM looks like.
		"tls failure": {api: tls.URL},
		"a timeout": {api: slow.URL, ctx: func() (context.Context, context.CancelFunc) {
			return context.WithTimeout(context.Background(), 50*time.Millisecond)
		}},
		"the provider is down": {api: serverError.URL},
		"a cancelled caller": {api: slow.URL, ctx: func() (context.Context, context.CancelFunc) {
			ctx, cancel := context.WithCancel(context.Background())
			cancel()
			return ctx, func() {}
		}},
		"an address that is not a URL": {api: "not a url at all"},
	}
	for name, c := range cases {
		ctx, cancel := context.Background(), context.CancelFunc(func() {})
		if c.ctx != nil {
			ctx, cancel = c.ctx()
		}
		err := VerifyProviderKey(ctx, fakeProvider(c.api), key)
		cancel()
		if !errors.Is(err, ErrProviderUnverifiable) {
			t.Errorf("%s: got %v, want unverifiable", name, err)
		}
		if errors.Is(err, ErrAPIKeyRejected) {
			t.Errorf("%s: a key we could not check was rejected", name)
		}
		// The error reaches a log and, for some paths, the user: the key must be in neither.
		if err != nil && strings.Contains(err.Error(), key) {
			t.Errorf("%s: the key is in the error text: %v", name, err)
		}
		if err != nil && !strings.Contains(err.Error(), "Fake Provider") {
			t.Errorf("%s: error %q does not name the provider, so the user cannot act on it", name, err)
		}
	}
}

// Every failure path renders an error somewhere; a key in one of them outlives the request.
func TestTheKeyIsNeverInAnErrorOrAStatus(t *testing.T) {
	const key = "sk-test-not-a-real-key-SECRETPART-9999"
	for status, wantErr := range map[int]error{
		http.StatusUnauthorized:        ErrAPIKeyRejected,
		http.StatusForbidden:           ErrAPIKeyRejected,
		http.StatusNotFound:            ErrProviderUnverifiable,
		http.StatusTooManyRequests:     ErrProviderUnverifiable,
		http.StatusInternalServerError: ErrProviderUnverifiable,
	} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			// The provider's own body often echoes the key back; nothing here may carry it onward.
			http.Error(w, "invalid key "+key, status)
		}))
		err := VerifyProviderKey(context.Background(), fakeProvider(srv.URL), key)
		srv.Close()
		if !errors.Is(err, wantErr) {
			t.Errorf("status %d: got %v, want %v", status, err, wantErr)
		}
		if err != nil && strings.Contains(err.Error(), "SECRETPART") {
			t.Errorf("status %d: the key reached the error text: %v", status, err)
		}
	}
}

// The key is carried exactly as it was typed: a mangled one reads as a bad key with nothing to see.
func TestTheKeyReachesTheProviderUnchanged(t *testing.T) {
	long := "sk-test-" + strings.Repeat("a", 8000)
	for name, key := range map[string]string{
		"an ordinary key":  "sk-test-not-a-real-key",
		"a very long key":  long,
		"a non-ASCII key":  "sk-test-ключ-ключ",
		"spaces inside it": "sk-test not a real key",
	} {
		seen := make(chan string, 1)
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth := r.Header.Get("Authorization")
			if auth == "" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			select {
			case seen <- auth:
			default:
			}
			w.WriteHeader(http.StatusOK)
		}))
		err := VerifyProviderKey(context.Background(), fakeProvider(srv.URL), key)
		if err != nil {
			t.Errorf("%s: %v", name, err)
			srv.Close()
			continue
		}
		if got := <-seen; got != "Bearer "+key {
			t.Errorf("%s: Authorization = %q, want the key as typed", name, got)
		}
		srv.Close()
	}
}

// A key a header cannot carry must come back unverifiable, not rejected, and without the key in it.
func TestAKeyWithALineBreakIsUnverifiableNotRejected(t *testing.T) {
	const key = "sk-test-not-a-real-key\nX-Injected: 1"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	err := VerifyProviderKey(context.Background(), fakeProvider(srv.URL), key)
	if !errors.Is(err, ErrProviderUnverifiable) {
		t.Errorf("got %v, want unverifiable: the request never left the host", err)
	}
	if err != nil && strings.Contains(err.Error(), "X-Injected") {
		t.Errorf("the key is in the error text: %v", err)
	}
}

// above.dev answered 2xx to an invented key and the user was told it had been checked.
func TestARouteThatIgnoresTheKeyCannotVouchForIt(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	err := VerifyProviderKey(context.Background(), fakeProvider(srv.URL), "sk-test-not-a-real-key")
	if !errors.Is(err, ErrProviderUnverifiable) {
		t.Errorf("got %v, want unverifiable: the route never looked at the key", err)
	}
	if errors.Is(err, ErrAPIKeyRejected) {
		t.Error("a key nobody checked was rejected")
	}
}

// The base comes from the catalogue, with or without its trailing slash; /models must not double up.
func TestTheFallbackAsksTheCataloguesOwnAddress(t *testing.T) {
	for _, base := range []string{"/v1", "/v1/"} {
		seen := make(chan string, 1)
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") == "" { // the keyless probe
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			select {
			case seen <- r.URL.Path:
			default:
			}
			w.WriteHeader(http.StatusOK)
		}))
		if err := VerifyProviderKey(context.Background(), fakeProvider(srv.URL+base), "sk-test-not-a-real-key"); err != nil {
			t.Errorf("base %q: %v", base, err)
		}
		if got := <-seen; got != "/v1/models" {
			t.Errorf("base %q asked %q, want /v1/models", base, got)
		}
		srv.Close()
	}
}

// Each provider's own shape, asserted on the request alone: a real one is never called from a test.
func TestEachKnownProvidersRequestShape(t *testing.T) {
	// Anthropic refuses the bearer header outright, and the version header is not optional.
	req, err := http.NewRequest(http.MethodGet, providerChecks["anthropic"].url, nil)
	if err != nil {
		t.Fatal(err)
	}
	providerChecks["anthropic"].auth(req, "sk-test-not-a-real-key")
	if req.Header.Get("x-api-key") != "sk-test-not-a-real-key" {
		t.Errorf("anthropic x-api-key = %q", req.Header.Get("x-api-key"))
	}
	if req.Header.Get("anthropic-version") == "" {
		t.Error("anthropic: the version header is required, and its absence reads as a bad key")
	}
	if req.Header.Get("Authorization") != "" {
		t.Error("anthropic: the bearer header must not be set as well")
	}

	// Google reads the key from the query string, and the address already carries no other parameter.
	greq, err := http.NewRequest(http.MethodGet, providerChecks["google"].url+"?pageSize=1", nil)
	if err != nil {
		t.Fatal(err)
	}
	providerChecks["google"].auth(greq, "sk-test-not-a-real-key")
	if greq.URL.Query().Get("key") != "sk-test-not-a-real-key" {
		t.Errorf("google key = %q, want it in the query string", greq.URL.Query().Get("key"))
	}
	if greq.URL.Query().Get("pageSize") != "1" {
		t.Error("google: the address' own parameters were dropped")
	}
	if greq.Header.Get("Authorization") != "" {
		t.Error("google: the key must not also be a header")
	}

	// The rest are OpenAI-compatible, so they carry no auth of their own and take the bearer default.
	for id, check := range providerChecks {
		if check.url == "" {
			t.Errorf("%s: no address, so its keys would be stored unchecked", id)
			continue
		}
		// A key must never travel in the clear, whichever part of the request carries it.
		if !strings.HasPrefix(check.url, "https://") {
			t.Errorf("%s: %q is not https", id, check.url)
		}
		if id == "anthropic" || id == "google" {
			continue
		}
		if check.auth != nil {
			t.Errorf("%s: has an auth shape of its own but is listed as bearer-only", id)
		}
	}
}

// The key rides a header here, so the address must be https, or loopback: a local model server.
func TestOnlyTLSOrALoopbackAddressMayCarryAKey(t *testing.T) {
	cases := map[string]bool{
		"https://api.openai.com/v1/models": true,
		"https://127.0.0.1:8443/v1/models": true,
		"HTTPS://api.openai.com/v1/models": true,
		"http://localhost:4000/v1/models":  true,
		"http://127.0.0.1:1234/v1/models":  true,
		"http://[::1]:1234/v1/models":      true,
		"http://api.openai.com/v1/models":  false,
		// A host that merely starts with the loopback name is somebody else's machine.
		"http://localhost.evil.test/v1/models": false,
		// The host here is evil.test; "localhost" is the userinfo in front of the @.
		"http://localhost@evil.test/v1/models": false,
		"http://127.0.0.1@evil.test/v1/models": false,
		// https in the path or the query says nothing about the hop that carries the key.
		"http://evil.test/https://127.0.0.1/v1/models": false,
		"http://evil.test/v1/models?to=https://x":      false,
		"//api.openai.com/v1/models":                   false,
		"not a url at all":                             false,
		"":                                             false,
	}
	for raw, want := range cases {
		if got := isTLSOrLoopback(raw); got != want {
			t.Errorf("isTLSOrLoopback(%q) = %v, want %v", raw, got, want)
		}
	}
}

// Which refusal comes back is the evidence: the guard's own message means the request never left.
func TestAPlainHTTPProviderIsRefusedBeforeTheKeyIsSent(t *testing.T) {
	const key = "sk-test-not-a-real-key-SECRETPART"
	asked := make(chan string, 4)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth == "" { // the keyless probe
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		select {
		case asked <- auth:
		default:
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	// Control: the same server over plain http on loopback is asked, so the allowance is not dead code.
	if err := VerifyProviderKey(context.Background(), fakeProvider(srv.URL+"/v1"), key); err != nil {
		t.Fatalf("a loopback model server was not asked: %v", err)
	}
	if got := <-asked; got != "Bearer "+key {
		t.Errorf("Authorization = %q, want the key", got)
	}

	// The same address under a name that is not loopback: nothing may go out.
	plain := strings.Replace(srv.URL, "127.0.0.1", "provider.invalid", 1) + "/v1"
	err := VerifyProviderKey(context.Background(), fakeProvider(plain), key)
	if !errors.Is(err, ErrProviderUnverifiable) {
		t.Fatalf("got %v, want unverifiable", err)
	}
	// "could not reach" would mean the request was attempted with the key in it.
	if !strings.Contains(err.Error(), "no https address") {
		t.Errorf("error %q is not the address refusal, so the key was sent before it was checked", err)
	}
	if !strings.Contains(err.Error(), "Fake Provider") {
		t.Errorf("error %q does not name the provider", err)
	}
	if strings.Contains(err.Error(), "SECRETPART") {
		t.Errorf("the key is in the error text: %v", err)
	}
	if len(asked) != 0 {
		t.Errorf("the server was asked %d more times", len(asked))
	}
}
