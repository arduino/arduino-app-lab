package appui

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"app-lab-desktop/internal/board"

	apiBoard "github.com/arduino/arduino-app-cli/pkg/board"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const uiOpeningTimeout = 300 * time.Second

func waitTCPPort(host string, port int, timeout, interval, perTry time.Duration) error {
	addr := net.JoinHostPort(host, fmt.Sprintf("%d", port))
	deadline := time.Now().Add(timeout)
	if perTry <= 0 {
		perTry = 500 * time.Millisecond
	}
	if interval <= 0 {
		interval = 200 * time.Millisecond
	}

	for {
		d := net.Dialer{Timeout: perTry}
		// tcp4 is used to ensure IPv4 is preferred
		conn, err := d.Dial("tcp4", addr)
		if err == nil {
			_ = conn.Close()
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("timeout waiting for %s: %w", addr, err)
		}
		time.Sleep(interval)
	}
}

func waitHTTPReady(host string, port int, timeout, interval, perTry time.Duration) (int, error) {
	url := fmt.Sprintf("http://%s:%d/", host, port)
	deadline := time.Now().Add(timeout)
	if perTry <= 0 {
		perTry = 700 * time.Millisecond
	}
	if interval <= 0 {
		interval = 200 * time.Millisecond
	}

	client := &http.Client{
		Timeout: perTry,
		Transport: &http.Transport{
			DisableKeepAlives: true,
		},
	}

	for {
		req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, url, nil)
		resp, err := client.Do(req)
		if err == nil {
			code := resp.StatusCode
			resp.Body.Close()
			return code, nil
		}
		if time.Now().After(deadline) {
			return 0, fmt.Errorf("timeout waiting for %s: %w", url, err)
		}
		time.Sleep(interval)
	}
}

func isHTMLContent(ct string, peek []byte) bool {
	ct = strings.ToLower(ct)
	if strings.Contains(ct, "text/html") || strings.Contains(ct, "application/xhtml+xml") {
		return true
	}
	s := strings.ToLower(string(peek))
	return strings.Contains(s, "<html") || strings.Contains(s, "<!doctype html")
}

func waitUntilHTML(host string, port int, timeout, interval, perTry time.Duration) error {
	url := fmt.Sprintf("http://%s:%d/", host, port)
	deadline := time.Now().Add(timeout)
	if perTry <= 0 {
		perTry = 700 * time.Millisecond
	}
	if interval <= 0 {
		interval = 200 * time.Millisecond
	}

	client := &http.Client{
		Timeout: perTry,
		Transport: &http.Transport{
			DisableKeepAlives: true,
		},
	}

	for {
		if time.Now().After(deadline) {
			return fmt.Errorf("timeout waiting for HTML from %s", url)
		}
		req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, url, nil)
		resp, err := client.Do(req)
		if err != nil {
			time.Sleep(interval)
			continue
		}
		peek, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		ct := resp.Header.Get("Content-Type")
		resp.Body.Close()

		if isHTMLContent(ct, peek) {
			return nil
		}
		time.Sleep(interval)
	}
}

func openUIWhenReady(ctx context.Context, host string, port int, timeout time.Duration) error {
	start := time.Now()
	// TCP up
	if err := waitTCPPort(host, port, timeout, 200*time.Millisecond, 400*time.Millisecond); err != nil {
		return fmt.Errorf("failed to wait for TCP port %d: %w", port, err)
	}

	// Wait for HTTP and status
	rest := timeout - time.Since(start)
	if rest < 1*time.Second {
		rest = 1 * time.Second
	}
	code, err := waitHTTPReady(host, port, rest, 150*time.Millisecond, 600*time.Millisecond)
	if err != nil {
		return fmt.Errorf("failed to get HTTP status from http://%s:%d/: %w", host, port, err)
	}
	if code < 200 || code >= 400 {
		return fmt.Errorf("bad HTTP status %d from http://%s:%d/", code, host, port)
	}

	// Wait for HTML
	rest = timeout - time.Since(start)
	if rest < 1*time.Second {
		rest = 1 * time.Second
	}
	err = waitUntilHTML(host, port, rest, 200*time.Millisecond, 700*time.Millisecond)
	if err != nil {
		return fmt.Errorf("failed to get HTML from http://%s:%d/: %w", host, port, err)
	}

	runtime.BrowserOpenURL(ctx, fmt.Sprintf("http://%s:%d/", host, port))
	return nil
}

func OpenUIWhenReady(ctx context.Context, board *board.Board, targetBoardPort int) error {
	host := "localhost"
	port := targetBoardPort

	if board.Info.Address != "" {
		// use the board address directly if available
		host = board.Info.Address
	} else if board.Info.Protocol != apiBoard.LocalProtocol {
		// otherwise, forward the port through the tunnel
		t, err := board.StartTunnel(ctx, board.Conn, strconv.Itoa(targetBoardPort), targetBoardPort)
		if err != nil {
			return fmt.Errorf("failed to forward port %d: %w", targetBoardPort, err)
		}
		p, err := t.Port()
		if err != nil {
			return fmt.Errorf("failed to get forwarded port for port %d: %w", targetBoardPort, err)
		}
		port = p
	}

	return openUIWhenReady(ctx, host, port, uiOpeningTimeout)
}
