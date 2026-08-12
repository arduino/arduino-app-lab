// Node.js download (resume + retry), checksum verification, and extraction.

package airuntime

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/codeclysm/extract/v4"
	"go.bug.st/downloader/v3"
)

// defaultNodeVersion is the pinned Node release (>= v20.10 for the ACP adapter).
const defaultNodeVersion = "v22.16.0"

// defaultNodeBaseURL is the Node.js distribution CDN.
const defaultNodeBaseURL = "https://nodejs.org/dist"

// downloadInactivityTimeout aborts a stalled download so the retry loop runs.
const downloadInactivityTimeout = 60 * time.Second

// defaultMaxRetries is the number of download attempts before giving up.
const defaultMaxRetries = 3

// defaultHTTPClient returns a proxy-aware HTTP client (honours HTTPS_PROXY etc.).
func defaultHTTPClient() *http.Client {
	return &http.Client{Transport: &http.Transport{Proxy: http.ProxyFromEnvironment}}
}

// ErrChecksumMismatch is returned when the Node archive fails verification.
var ErrChecksumMismatch = errors.New("airuntime: node archive checksum mismatch")

// nodeInstall bundles the inputs for installNodeRuntime.
type nodeInstall struct {
	runtimeDir string
	version    string
	baseURL    string
	httpClient *http.Client
	maxRetries int
}

// installNodeRuntime downloads, verifies and extracts the pinned Node into <runtime>/node.
func installNodeRuntime(ctx context.Context, n nodeInstall, emit ProgressFunc) error {
	filename, _, ext, err := NodeArchive(n.version)
	if err != nil {
		return err
	}
	archiveURL := fmt.Sprintf("%s/%s/%s", n.baseURL, n.version, filename)
	shaURL := fmt.Sprintf("%s/%s/SHASUMS256.txt", n.baseURL, n.version)

	emit(Progress{Phase: PhaseDownload, Message: "Downloading Node " + n.version})
	expected, err := fetchExpectedSHA(ctx, n.httpClient, shaURL, filename)
	if err != nil {
		return fmt.Errorf("fetch checksums: %w", err)
	}

	dlPath := filepath.Join(n.runtimeDir, "node-download."+ext)
	if err := downloadAndVerifyNode(ctx, n, archiveURL, dlPath, expected, emit); err != nil {
		return err
	}

	emit(Progress{Phase: PhaseExtract, Message: "Extracting Node " + n.version, Pct: pctOf(pctExtract)})
	if err := extractNode(ctx, dlPath, ext, nodeDirOf(n.runtimeDir)); err != nil {
		return fmt.Errorf("extract node: %w", err)
	}
	if _, err := os.Stat(nodeBinExe(n.runtimeDir)); err != nil {
		return fmt.Errorf("node binary missing after extract: %w", err)
	}
	_ = os.Remove(dlPath)
	return nil
}

// fetchExpectedSHA downloads SHASUMS256.txt and returns the sha for filename.
func fetchExpectedSHA(ctx context.Context, client *http.Client, shaURL, filename string) (string, error) {
	if client == nil {
		client = http.DefaultClient
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, shaURL, nil)
	if err != nil {
		return "", err
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("http %s", resp.Status)
	}
	sc := bufio.NewScanner(resp.Body)
	for sc.Scan() {
		if fields := strings.Fields(sc.Text()); len(fields) == 2 && fields[1] == filename {
			return fields[0], nil
		}
	}
	if err := sc.Err(); err != nil {
		return "", err
	}
	return "", fmt.Errorf("no checksum for %s", filename)
}

// downloadAndVerifyNode downloads url to dlPath (resuming, retrying transient errors) then verifies its sha.
func downloadAndVerifyNode(ctx context.Context, n nodeInstall, url, dlPath, expectedSHA string, emit ProgressFunc) error {
	var lastErr error
	for attempt := 0; attempt <= n.maxRetries; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff(attempt)):
			}
		}
		if err := downloadNode(ctx, n, url, dlPath, emit); err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) || isDiskFull(err) {
				return err
			}
			lastErr = err
			continue
		}
		emit(Progress{Phase: PhaseVerify, Message: "Verifying checksum", Pct: pctOf(pctVerify)})
		if err := verifySHA256(dlPath, expectedSHA); err != nil {
			_ = os.Remove(dlPath)
			return fmt.Errorf("%w: %v", ErrChecksumMismatch, err)
		}
		return nil
	}
	return fmt.Errorf("download failed after %d attempts: %w", n.maxRetries+1, lastErr)
}

// downloadNode fetches url into dlPath via the resumable downloader, emitting progress.
func downloadNode(ctx context.Context, n nodeInstall, url, dlPath string, emit ProgressFunc) error {
	client := http.Client{}
	if n.httpClient != nil {
		client = *n.httpClient
	}
	cfg := downloader.Config{
		HttpClient:        client,
		InactivityTimeout: downloadInactivityTimeout,
		PollFunction: func(current, size int64) {
			p := Progress{Phase: PhaseDownload, Message: "Downloading Node " + n.version}
			if size > 0 {
				p.Pct = pctOf(float64(current) / float64(size) * pctDownloadMax)
			}
			emit(p)
		},
	}
	return downloader.DownloadWithConfig(ctx, dlPath, url, cfg)
}

// backoff returns an exponential delay (1s, 2s, 4s…) capped at 8s.
func backoff(attempt int) time.Duration {
	d := time.Duration(1<<(attempt-1)) * time.Second
	if d > 8*time.Second {
		d = 8 * time.Second
	}
	return d
}

// verifySHA256 checks that the file at path matches the expected hex sha256.
func verifySHA256(path, expected string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return err
	}
	if got := hex.EncodeToString(h.Sum(nil)); got != expected {
		return fmt.Errorf("got %s, expected %s", got, expected)
	}
	return nil
}

// extractNode extracts the archive into dst, stripping Node's top-level wrapper dir.
func extractNode(ctx context.Context, src, ext, dst string) error {
	if err := os.RemoveAll(dst); err != nil {
		return fmt.Errorf("clean node dir: %w", err)
	}
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return err
	}
	f, err := os.Open(src)
	if err != nil {
		return err
	}
	defer f.Close()
	switch ext {
	case "tar.xz":
		return extract.Xz(ctx, f, dst, stripTopDir)
	case "zip":
		return extract.Zip(ctx, f, dst, stripTopDir)
	default:
		return fmt.Errorf("unsupported archive extension %q", ext)
	}
}

// stripTopDir drops the leading "node-vX.Y.Z-…/" segment (renamer for extract).
func stripTopDir(name string) string {
	name = strings.TrimPrefix(name, "/")
	idx := strings.IndexByte(name, '/')
	if idx < 0 {
		return ""
	}
	return name[idx+1:]
}
