package httpclient

import (
	"bytes"
	"cmp"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type Response struct {
	StatusCode int               `json:"statusCode"`
	Body       string            `json:"body"`
	Headers    map[string]string `json:"headers"`
}

const maxLoggedBodyLength = 2048

var allowlist = "api2.arduino.cc"

func DoRequest(
	ctx context.Context,
	method string,
	url string,
	token string,
	headers map[string]string,
	body string,
) (*Response, error) {
	httpMethod := cmp.Or(strings.ToUpper(method), http.MethodGet)

	req, err := http.NewRequest(httpMethod, url, bytes.NewBufferString(body))
	if err != nil {
		return nil, err
	}

	allowed := false
	for _, host := range strings.Split(allowlist, ",") {
		if strings.TrimSpace(host) == req.Host {
			allowed = true
			break
		}
	}

	if !allowed {
		return nil, fmt.Errorf("request to %s is not allowed", req.Host)
	}

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	if token != "" && req.Header.Get("Authorization") == "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	}

	if body != "" && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	runtime.LogInfof(ctx, "backend HTTP request | method=%s url=%s headers=%v body=%s", req.Method, req.URL.String(), sanitizeHeaders(req.Header), body)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		runtime.LogErrorf(ctx, "backend HTTP request failed | %v", err)
		return nil, err
	}
	defer resp.Body.Close()

	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		runtime.LogErrorf(ctx, "backend HTTP response read failed | %v", err)
		return nil, err
	}

	runtime.LogInfof(ctx, "backend HTTP response | statusCode=%d body=%s", resp.StatusCode, string(rawBody))

	responseHeaders := make(map[string]string, len(resp.Header))
	for key := range resp.Header {
		responseHeaders[key] = resp.Header.Get(key)
	}

	return &Response{
		StatusCode: resp.StatusCode,
		Body:       string(rawBody),
		Headers:    responseHeaders,
	}, nil
}

func sanitizeHeaders(header http.Header) map[string]string {
	headers := make(map[string]string, len(header))
	for key, values := range header {
		if strings.EqualFold(key, "Authorization") {
			headers[key] = "Bearer [redacted]"
			continue
		}
		headers[key] = strings.Join(values, ", ")
	}

	return headers
}
