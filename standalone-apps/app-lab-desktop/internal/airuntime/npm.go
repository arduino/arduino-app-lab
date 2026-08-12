// Runs `npm ci` against the materialised lockfile using the bundled Node.

package airuntime

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	paths "github.com/arduino/go-paths-helper"
)

// runNpmCI runs `npm ci` in runtimeDir using the bundled npm, streaming output lines.
// Spawned via go-paths-helper: no console window on Windows, and cancel kills the
// whole npm tree (cmd.exe → node), not just the shim.
func runNpmCI(ctx context.Context, runtimeDir string, onLine func(string)) error {
	nodeBinDir := nodeBinDirOf(runtimeDir)
	npmPath := filepath.Join(nodeBinDir, "npm")
	if runtime.GOOS == "windows" {
		npmPath = filepath.Join(nodeBinDir, "npm.cmd")
	}
	if _, err := os.Stat(npmPath); err != nil {
		return fmt.Errorf("npm not present at %s: %w", npmPath, err)
	}

	cmd, err := paths.NewProcess(nil, npmPath, "ci", "--no-audit", "--no-fund", "--no-progress")
	if err != nil {
		return err
	}
	cmd.SetDir(runtimeDir)
	cmd.SetEnvironment(npmEnv(nodeBinDir, npmCacheDirOf(runtimeDir)))

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start npm ci: %w", err)
	}

	// Kill on cancel, armed for the whole run: the pipes are drained before Wait,
	// so a cancel mid-stream must still tear the tree down to unblock them.
	watchDone := make(chan struct{})
	defer close(watchDone)
	go func() {
		select {
		case <-ctx.Done():
			_ = cmd.Kill()
		case <-watchDone:
		}
	}()

	// serialise onLine: stdout and stderr are pumped concurrently
	var lineMu sync.Mutex
	emit := func(line string) {
		if onLine == nil {
			return
		}
		lineMu.Lock()
		defer lineMu.Unlock()
		onLine(line)
	}

	var wg sync.WaitGroup
	wg.Add(2)
	go pumpLines(&wg, stdout, "", emit)
	go pumpLines(&wg, stderr, "stderr: ", emit)
	wg.Wait()

	if err := cmd.Wait(); err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return fmt.Errorf("npm ci failed: %w", err)
	}
	return nil
}

// pumpLines forwards each line read from r to onLine, prefixed.
func pumpLines(wg *sync.WaitGroup, r io.Reader, prefix string, onLine func(string)) {
	defer wg.Done()
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 64*1024), 1024*1024)
	for sc.Scan() {
		if onLine != nil {
			onLine(prefix + sc.Text())
		}
	}
}

// npmEnv sets PATH (bundled node first), a private npm cache, silences prompts, and maps
// OS proxy vars to npm's. The cache must not be the user's default (~/.npm): sudo-npm
// leftovers there are root-owned and fail `npm ci` with EACCES. Keeping it inside the
// runtime dir also means Uninstall removes it. The user's .npmrc still applies on purpose
// (corporate registry mirrors); the shipped lockfile's integrity hashes protect content.
func npmEnv(nodeBinDir, npmCacheDir string) []string {
	// Ambient copies of the keys set below are stripped: with duplicate env
	// entries the first match wins at getenv time, so an inherited
	// npm_config_cache (e.g. an XDG dotfile export) would defeat ours.
	overridden := map[string]bool{
		"path":                true,
		"npm_config_cache":    true,
		"npm_config_progress": true,
		"npm_config_audit":    true,
		"npm_config_fund":     true,
		"npm_config_loglevel": true,
	}
	base := os.Environ()
	env := make([]string, 0, len(base)+8)
	for _, kv := range base {
		if k, _, ok := strings.Cut(kv, "="); ok && overridden[strings.ToLower(k)] {
			continue
		}
		env = append(env, kv)
	}
	env = append(env,
		"PATH="+nodeBinDir+string(os.PathListSeparator)+os.Getenv("PATH"),
		"npm_config_cache="+npmCacheDir,
		"npm_config_progress=false",
		"npm_config_audit=false",
		"npm_config_fund=false",
		"npm_config_loglevel=info",
	)
	if v := firstNonEmpty(os.Getenv("HTTPS_PROXY"), os.Getenv("https_proxy")); v != "" {
		env = append(env, "npm_config_https_proxy="+v)
	}
	if v := firstNonEmpty(os.Getenv("HTTP_PROXY"), os.Getenv("http_proxy")); v != "" {
		env = append(env, "npm_config_proxy="+v)
	}
	if v := firstNonEmpty(os.Getenv("NO_PROXY"), os.Getenv("no_proxy")); v != "" {
		env = append(env, "npm_config_noproxy="+v)
	}
	return env
}

// firstNonEmpty returns the first non-empty string.
func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
