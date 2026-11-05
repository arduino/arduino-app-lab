// Checking a provider key before we accept it, so a typo is caught here and not on the first turn.

package agentauth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	neturl "net/url"
	"strings"
)

// ErrProviderUnverifiable means we had no way to ask this provider, not that the key is wrong.
var ErrProviderUnverifiable = errors.New("this provider offers no way to check a key")

// providerCheck is how one provider is asked whether a key is real; most answer GET <base>/models.
type providerCheck struct {
	url string // absolute, when the catalogue has no api base for it
	// auth applies the key the way this provider expects; nil means Authorization: Bearer.
	auth func(r *http.Request, key string)
	// badKeyText in a 400 answer refuses the key, for a provider that answers a bad key with 400 instead of 401.
	badKeyText string
}

func bearer(r *http.Request, key string) {
	r.Header.Set("Authorization", "Bearer "+key)
}

var providerChecks = map[string]providerCheck{
	"anthropic": {url: "https://api.anthropic.com/v1/models?limit=1", auth: func(r *http.Request, key string) {
		r.Header.Set("x-api-key", key)
		r.Header.Set("anthropic-version", "2023-06-01")
	}},
	"openai":   {url: "https://api.openai.com/v1/models"},
	"groq":     {url: "https://api.groq.com/openai/v1/models"},
	"mistral":  {url: "https://api.mistral.ai/v1/models"},
	"xai":      {url: "https://api.x.ai/v1/models", badKeyText: "Incorrect API key"},
	"deepseek": {url: "https://api.deepseek.com/models"},
	// The key rides the query string here, which is why it needs an entry of its own.
	"google": {url: "https://generativelanguage.googleapis.com/v1beta/models", auth: func(r *http.Request, key string) {
		q := r.URL.Query()
		q.Set("key", key)
		r.URL.RawQuery = q.Encode()
	}, badKeyText: "API_KEY_INVALID"},
}

// VerifyProviderKey asks the provider whether the key works; only an explicit refusal rejects it.
func VerifyProviderKey(ctx context.Context, p Provider, key string) error {
	check, known := providerChecks[p.ID]
	url := check.url
	if url == "" {
		if p.API == "" {
			return ErrProviderUnverifiable
		}
		url = strings.TrimSuffix(p.API, "/") + "/models"
	}
	// The catalogue gives the address and the key rides a header; only a loopback one may be plaintext.
	if !isTLSOrLoopback(url) {
		return fmt.Errorf("%w: %s has no https address", ErrProviderUnverifiable, p.Name)
	}
	ctx, cancel := context.WithTimeout(ctx, verifyTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return ErrProviderUnverifiable
	}
	if known && check.auth != nil {
		check.auth(req, key)
	} else {
		bearer(req, key)
	}
	resp, err := (&http.Client{Timeout: verifyTimeout}).Do(req)
	if err != nil {
		return fmt.Errorf("%w: could not reach %s", ErrProviderUnverifiable, p.Name)
	}
	defer resp.Body.Close()
	var body []byte
	if resp.StatusCode >= 400 && resp.StatusCode < 500 {
		body, _ = io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	}
	switch {
	case resp.StatusCode == http.StatusUnauthorized, resp.StatusCode == http.StatusForbidden,
		resp.StatusCode == http.StatusBadRequest && check.badKeyText != "" && bytes.Contains(body, []byte(check.badKeyText)):
		return &KeyRejection{Status: resp.StatusCode, Reason: refusalReason(body, key)}
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		// above.dev accepted an invented key, so ask again with none: a route that lets that through checked nothing.
		if !known && !refusesWithoutAKey(ctx, url) {
			return fmt.Errorf("%w: %s answered without checking the key", ErrProviderUnverifiable, p.Name)
		}
		return nil
	default:
		// 404 on a provider with no /models route, 429, 5xx: all say nothing about the key.
		return fmt.Errorf("%w: %s answered %d", ErrProviderUnverifiable, p.Name, resp.StatusCode)
	}
}

// KeyRejection is a provider's refusal of a key; it is ErrAPIKeyRejected, with the provider's own words when it gave any.
type KeyRejection struct {
	Status int
	Reason string // never holds the key
}

func (e *KeyRejection) Error() string {
	if e.Reason == "" {
		return ErrAPIKeyRejected.Error()
	}
	return ErrAPIKeyRejected.Error() + ": " + e.Reason
}

func (e *KeyRejection) Is(target error) bool { return target == ErrAPIKeyRejected }

// refusalReason is the message of a JSON error answer, in the shapes the providers use, without the key and cut to one sentence's length.
func refusalReason(body []byte, key string) string {
	var answer struct {
		Error   json.RawMessage `json:"error"`
		Message string          `json:"message"`
		Detail  string          `json:"detail"`
	}
	if json.Unmarshal(body, &answer) != nil {
		return "" // an HTML page or plain text says nothing worth showing
	}
	var nested struct {
		Message string `json:"message"`
	}
	var flat string
	reason := answer.Message
	switch {
	case json.Unmarshal(answer.Error, &nested) == nil && nested.Message != "":
		reason = nested.Message
	case json.Unmarshal(answer.Error, &flat) == nil && flat != "":
		reason = flat
	case reason == "":
		reason = answer.Detail
	}
	// A few characters are no secret, and replacing them would cut letters out of the provider's words.
	if len(key) >= 8 {
		reason = strings.ReplaceAll(reason, key, "…")
	}
	reason = strings.Join(strings.Fields(reason), " ")
	if r := []rune(reason); len(r) > 200 {
		reason = string(r[:200]) + "…"
	}
	return reason
}

// refusesWithoutAKey reports whether the address turns away a request carrying no credential at all.
func refusesWithoutAKey(ctx context.Context, url string) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return false
	}
	resp, err := (&http.Client{Timeout: verifyTimeout}).Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden
}

// isTLSOrLoopback reports whether sending a key to this address keeps it off the network in the clear.
func isTLSOrLoopback(raw string) bool {
	u, err := neturl.Parse(raw)
	if err != nil {
		return false
	}
	if u.Scheme == "https" {
		return true
	}
	host := u.Hostname()
	return host == "localhost" || net.ParseIP(host).IsLoopback()
}
