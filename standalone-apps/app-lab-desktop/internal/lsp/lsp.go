package lsp

import (
	ctxHolder "app-lab-desktop/internal/context"
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"app-lab-desktop/internal/board"
	"app-lab-desktop/internal/hostread"
	"app-lab-desktop/internal/lsp/artifacts"

	"github.com/arduino/go-paths-helper"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorBlue   = "\033[34m"
)

const maxRestartRetries = 5
const formatterSuffix = "-formatter"

// toolVerifyTimeout bounds the `--version` runnability probes — verifyNodeExecutable
// and verifyClangdExecutable. One knob for both: they are the same check on the
// same code path, and splitting it would let two values drift apart for no reason.
//
// Nothing waits this long in the normal case — it is a ceiling on a hang, not a
// delay. A warm probe answers in ~10ms. The slow case is the first run after an
// extraction, where the OS verifies a large freshly written binary before letting
// it execute: measured cold on an SSD, 1.1s for node (121MB) and 0.7s for clangd
// (54MB), and the Windows equivalent is an antivirus doing the same thing on a
// slower disk. The ceiling is an order of magnitude above that.
//
// The slowest hardware it has to hold for is a VENTUNO Q, the only board that runs
// these probes at all: on an SBC IsLspEnabled allowlists lspEnabledSbcFQBNs, so an
// UNO Q running App Lab on-device never starts a language server, never extracts
// the resources, and never reaches here. That headroom is extrapolated from the
// figures above rather than measured on the board — re-measure there before
// trusting it under a change.
//
// Erring long is the safe direction. Too short rejects a working install and
// leaves the user with no language server at all; too long only delays an error
// about an install that is broken either way. What stops it going higher is the
// spinner: on the initial Start this deadline is what the frontend's startLSP
// promise waits out before the failure can be reported, and that promise has no
// deadline of its own — which is what made an unbounded probe a spinner forever
// rather than a slow one.
//
// restartLSP retries Start up to maxRestartRetries times, so a hung binary costs
// that many deadlines before it gives up. Concurrent sends are not held up by it:
// waitForLSPReady caps them at its own 10s independently.
const toolVerifyTimeout = 10 * time.Second

// maxLSPMessageBytes caps how large a single LSP message may be, so a malformed
// or malicious Content-Length header cannot force an unbounded allocation.
const maxLSPMessageBytes = 50 * 1024 * 1024 // 50MB

// LSP method names
const (
	methodInitialize            = "initialize"
	methodInitialized           = "initialized"
	methodDidOpen               = "textDocument/didOpen"
	methodDidClose              = "textDocument/didClose"
	methodDidChange             = "textDocument/didChange"
	methodDidChangeWatchedFiles = "workspace/didChangeWatchedFiles"
	methodFormatting            = "textDocument/formatting"
	methodRangeFormatting       = "textDocument/rangeFormatting"
	methodDidChangeConfig       = "workspace/didChangeConfiguration"
	methodPublishDiagnostics    = "textDocument/publishDiagnostics"
)

const (
	LSP_Arduino    LspId = "arduino"
	LSP_Python     LspId = "python"
	LSP_TypeScript LspId = "typescript"
	LSP_HTML       LspId = "html"
	LSP_CSS        LspId = "css"
)

var LspWithSeparateFormatter = map[LspId]bool{
	LSP_Python: true,
}

// nodeBackedLSPs are the servers that are JavaScript running on our bundled
// node, reached through the one-line wrapper script each of them ships with.
// The arduino server is the only native one (ruff, its formatter, is native too).
var nodeBackedLSPs = map[LspId]bool{
	LSP_Python:     true,
	LSP_TypeScript: true,
	LSP_HTML:       true,
	LSP_CSS:        true,
}

var LspNeedsProvideFormatterInitOption = map[LspId]bool{
	LSP_HTML: true,
	LSP_CSS:  true,
}

var lspEnabledSbcFQBNs = []string{board.FQBNVentunoQ}

// arduinoSourceExts and sketchDirName define what counts as a sketch move-in for
// the restart trigger (isSketchMoveIn). Keep in sync with the TS-side gate in
// ui-components lsp-client-workspace.ts (SKETCH_DIR + the arduino entries of
// LSP_LANGS) so the proxy restart and the client re-lint agree on the same set.
var arduinoSourceExts = []string{".ino", ".c", ".cpp", ".h", ".hpp"}

const sketchDirName = "sketch"

type lspProcess struct {
	processId       ProcessId
	eventLspId      LspId
	process         *paths.Process
	stdin           io.WriteCloser
	stdout          io.ReadCloser
	intentionalExit bool
	sendMu          sync.Mutex
}

type LspId string
type ProcessId string

type LSPHandler struct {
	ctxHolder          *ctxHolder.Holder
	boardProvider      func() *board.Board
	hostReads          *hostread.AllowSet
	processes          map[ProcessId]*lspProcess
	activeLSPs         map[LspId]bool
	appDir             string
	initializeRequests map[LspId]any
	openFiles          map[LspId]map[string]any
	restartCounts      map[ProcessId]int
	restarting         map[LspId]bool
	restartPending     map[LspId]bool
	// formatterReady records that a formatter process has answered `initialize`,
	// and formatterQueue holds the state-sync notifications addressed to it until
	// then. See queueForFormatter.
	formatterReady         map[ProcessId]bool
	formatterQueue         map[ProcessId][]any
	stateMu                sync.RWMutex
	resourcesMu            sync.Mutex
	ensurePythonStubsMu    sync.Mutex
	initArduinoCliConfigMu sync.Mutex

	// sendMus serializes, per LSP, a message's [fold-into-recovery-snapshot +
	// write] against a restart's [start + state replay]. Without it a message
	// in flight across a restart can be folded into the snapshot BEFORE the
	// replay reads it and delivered AFTER the replayed didOpen — the change
	// then applies twice on the server: `god` + insert "o" replayed as "good",
	// the didChange lands again → "goood" in the Arduino LS's tracked doc and
	// the clangd background index built from it (phantom completions), while
	// diagnostics stay correct off clangd's unaffected open buffer.
	sendMus   map[LspId]*sync.Mutex
	sendMusMu sync.Mutex

	// debugLogging gates forwarding LSP logs to the frontend dev-tools console;
	// the frontend toggles it (see Initialize).
	debugLogging atomic.Bool
}

func NewLSPHandler(ctxHolder *ctxHolder.Holder, hostReads *hostread.AllowSet, boardProvider func() *board.Board) *LSPHandler {
	return &LSPHandler{
		ctxHolder:          ctxHolder,
		boardProvider:      boardProvider,
		hostReads:          hostReads,
		processes:          make(map[ProcessId]*lspProcess),
		activeLSPs:         make(map[LspId]bool),
		initializeRequests: make(map[LspId]any),
		openFiles:          make(map[LspId]map[string]any),
		restartCounts:      make(map[ProcessId]int),
		restarting:         make(map[LspId]bool),
		restartPending:     make(map[LspId]bool),
		formatterReady:     make(map[ProcessId]bool),
		formatterQueue:     make(map[ProcessId][]any),
		sendMus:            make(map[LspId]*sync.Mutex),
	}
}

// sendMuFor returns the per-LSP send/replay mutex (see the field docs).
func (h *LSPHandler) sendMuFor(lspId LspId) *sync.Mutex {
	h.sendMusMu.Lock()
	defer h.sendMusMu.Unlock()
	mu, ok := h.sendMus[lspId]
	if !ok {
		mu = &sync.Mutex{}
		h.sendMus[lspId] = mu
	}
	return mu
}

func (h *LSPHandler) isDevBuild() bool {
	return wailsRuntime.Environment(h.ctxHolder.Get()).BuildType != "production"
}

func (h *LSPHandler) IsLspEnabled() bool {
	if !board.IsSBC() {
		return true
	}
	b := h.boardProvider()
	return b != nil && slices.Contains(lspEnabledSbcFQBNs, b.Info.FQBN)
}

func (h *LSPHandler) OnBoardSelected() {
	if h.IsLspEnabled() && !board.IsSBC() {
		go func() {
			if err := h.InstallArduinoCliCore(); err != nil {
				slog.Error("failed to install LSP arduino-cli core", "error", err)
			}
		}()
	}
}

func (h *LSPHandler) Initialize() {
	h.StopAll()

	// The frontend toggles LSP log forwarding to the dev-tools console so field
	// issues on production builds (where slog only reaches log files) can be
	// diagnosed live. Registered here, before any process starts, so the toggle
	// is in place when the frontend enables it.
	wailsRuntime.EventsOn(h.ctxHolder.Get(), lspDebugToggleEvent, func(data ...any) {
		enabled := false
		if len(data) > 0 {
			enabled, _ = data[0].(bool)
		}
		h.debugLogging.Store(enabled)
		slog.Info("LSP frontend debug logging toggled", "enabled", enabled)
	})

	go func() {
		if h.IsLspEnabled() {
			if err := h.ensureResources(); err != nil {
				slog.Error("failed to ensure LSP resources", "error", err)
				return
			}
			if !board.IsSBC() {
				if err := h.initArduinoCliConfig(); err != nil {
					slog.Error("failed to initialize arduino-cli config", "error", err)
				}
			}
		}
	}()
}

func (h *LSPHandler) ensureResources() error {
	h.resourcesMu.Lock()
	defer h.resourcesMu.Unlock()

	if err := artifacts.CopyResources(getLspWorkspaceResourcesDir()); err != nil {
		return fmt.Errorf("failed to copy bundled resources: %w", err)
	}

	return nil
}

func (h *LSPHandler) Start(lspId LspId, workspaceDir string) (err error) {
	slog.Info("Start", "lspId", lspId, "workspaceDir", workspaceDir)

	h.stateMu.Lock()
	h.activeLSPs[lspId] = true
	// remember the app dir so crash-restarts can reuse it without the frontend
	h.appDir = workspaceDir
	h.stateMu.Unlock()

	if err := h.ensureResources(); err != nil {
		return err
	}

	// Checked once here rather than in each of their cases below, since a node
	// that cannot run fails every one of them the same way.
	if nodeBackedLSPs[lspId] {
		if err := verifyNodeExecutable(); err != nil {
			return err
		}
	}

	// start optional formatter LS
	if LspWithSeparateFormatter[lspId] {
		if err := h.startFormatter(lspId); err != nil {
			slog.Error("formatter failed to start", "lspId", lspId, "error", err)
		}
	}

	// start main LS
	switch lspId {
	case LSP_Arduino:
		if !board.IsSBC() {
			if err := h.InstallArduinoCliCore(); err != nil {
				return err
			}
			// Must come after the core install: ctags arrives with it, so there is
			// nothing to check or repair until then.
			if err := ensureCtagsExecutable(); err != nil {
				return err
			}
		}

		// Present-but-unrunnable is not something resourcesExist can see. Outside
		// the SBC branch above because an SBC runs the same bundled clangd we
		// extract everywhere else — it only brings its own arduino-cli and ctags.
		// While this sat inside it, a VENTUNO Q whose clangd had been truncated by
		// an interrupted extraction reported nothing beyond "Lost connection with
		// clangd!" in the language server's own log.
		if err := verifyClangdExecutable(); err != nil {
			return err
		}

		b := h.boardProvider()
		if b == nil {
			return fmt.Errorf("cannot start arduino LSP: no board selected")
		}

		args := []string{
			"-clangd",
			getClangdPath(),

			"-cli",
			getArduinoCliPath(),

			"-cli-config",
			getArduinoCliConfigPath(),

			"-fqbn",
			b.Info.FQBN,
		}
		if h.isDevBuild() {
			args = append(args, "-log", "-logpath", getLspTempWorkspaceLogsDir())
		}

		return h.start(startOptions{
			ProcessId: ProcessId(lspId),
			Dir:       workspaceDir,
			Command:   getResourcePath(filepath.Join("arduino", "arduino-language-server", "arduino-language-server")),
			Args:      args,
			// clangd, which this process spawns, probes the Apple toolchain via
			// xcrun at startup, and an arduino-cli platform recipe may shell out to
			// python3 — either one a developer-tools dialog on a Mac without the
			// Command Line Tools. See ensureCltStubDir.
			PathPrefix: cltStubDir(),
		})

	case LSP_Python:
		h.initPyrightConfig(workspaceDir, h.ensurePythonStubs())
		return h.start(startOptions{
			ProcessId: ProcessId(lspId),
			Dir:       workspaceDir,
			Command:   getResourcePath(filepath.Join("python", "pyright", "basedpyright-langserver")),
			Args:      []string{"--stdio"},
			// basedpyright probes for a host interpreter as soon as it analyses a
			// file — a developer-tools dialog on a Mac without the Command Line
			// Tools. See ensureCltStubDir.
			PathPrefix: cltStubDir(),
		})

	case LSP_TypeScript:
		return h.start(startOptions{
			ProcessId: ProcessId(lspId),
			Dir:       workspaceDir,
			Command:   getResourcePath(filepath.Join("typescript", "typescript-language-server")),
			Args:      []string{"--stdio"},
			// Neither the Node-based servers nor the formatter probes a Command Line
			// Tools shim today. They are shadowed anyway, so the guarantee is a
			// property of every server we spawn rather than of the two we happened to
			// catch probing one. See ensureCltStubDir.
			PathPrefix: cltStubDir(),
		})

	case LSP_HTML:
		return h.start(startOptions{
			ProcessId:  ProcessId(lspId),
			Dir:        workspaceDir,
			Command:    getResourcePath(filepath.Join("vscode-web", "vscode-html-language-server")),
			Args:       []string{"--stdio"},
			PathPrefix: cltStubDir(),
		})

	case LSP_CSS:
		return h.start(startOptions{
			ProcessId:  ProcessId(lspId),
			Dir:        workspaceDir,
			Command:    getResourcePath(filepath.Join("vscode-web", "vscode-css-language-server")),
			Args:       []string{"--stdio"},
			PathPrefix: cltStubDir(),
		})

	default:
		slog.Error("unsupported language", "lspId", lspId)
		return fmt.Errorf("unsupported language: %s", lspId)
	}
}

func (h *LSPHandler) startFormatter(lspId LspId) error {
	h.stateMu.RLock()
	wsPath := h.appDir
	h.stateMu.RUnlock()
	switch lspId {
	case LSP_Python:
		return h.start(startOptions{
			ProcessId:  getFormatterProcessId(lspId),
			EventLspId: lspId,
			Dir:        wsPath,
			Command:    getResourcePath(filepath.Join("python", "ruff", "ruff")),
			Args:       []string{"server"},
			PathPrefix: cltStubDir(),
		})
	default:
		return nil
	}
}

type startOptions struct {
	ProcessId  ProcessId
	EventLspId LspId
	Dir        string
	Command    string
	Args       []string
	// PathPrefix is prepended to PATH for this process and its children. Empty
	// means inherit our environment untouched.
	PathPrefix string
}

// prependToPath returns the PATH override to hand paths.NewProcess as extraEnv,
// with dir ahead of everything we inherited.
//
// PATH alone, because NewProcess builds the child's environment as os.Environ()
// plus what it is given: the rest of what a server depends on — TMPDIR in
// particular, which is where the whole workspace lives — is already there.
// Returning a full copy of os.Environ() with PATH rewritten also works, but only
// because exec deduplicates duplicate keys last-wins, and it doubles every variable
// in the child. TestSpawnedChildSeesTheStubDirFirst pins the composed behaviour,
// which is the level the guarantee actually lives at.
func prependToPath(dir string) []string {
	path := os.Getenv("PATH")
	if path == "" {
		return []string{"PATH=" + dir}
	}
	return []string{"PATH=" + dir + string(os.PathListSeparator) + path}
}

func (h *LSPHandler) start(opts startOptions) error {
	eventLspId := opts.EventLspId
	if eventLspId == "" {
		eventLspId = LspId(opts.ProcessId)
	}

	h.stateMu.Lock()
	defer h.stateMu.Unlock()

	if !h.activeLSPs[eventLspId] {
		slog.Info("LSP start aborted: LSP is not active", "lspId", eventLspId)
		return fmt.Errorf("LSP %s is not active", eventLspId)
	}

	if _, ok := h.processes[opts.ProcessId]; ok {
		slog.Info("LSP already started, skipping restart", "lsp", opts.ProcessId)
		return nil
	}

	var args []string
	if runtime.GOOS == "windows" && isBatchFile(opts.Command) {
		args = append([]string{"cmd", "/c", opts.Command}, opts.Args...)
	} else {
		args = append([]string{opts.Command}, opts.Args...)
	}

	// paths.NewProcess starts the child in its own process group (Unix) and
	// suppresses the console window that Windows would otherwise open for every
	// spawned process; its Kill tears down the whole tree together on shutdown.
	var env []string
	if opts.PathPrefix != "" {
		env = prependToPath(opts.PathPrefix)
	}
	if isFormatter(opts.ProcessId) {
		// A fresh formatter has not shaken hands yet, whatever the previous one
		// managed. Cleared inline because stateMu is already held here and it is
		// not reentrant (see resetFormatterHandshake for the off-lock version).
		delete(h.formatterReady, opts.ProcessId)
		delete(h.formatterQueue, opts.ProcessId)
	}

	process, err := paths.NewProcess(env, args...)
	if err != nil {
		slog.Error("failed to create process", "command", opts.Command, "lspId", opts.ProcessId, "error", err)
		return err
	}
	process.SetDir(opts.Dir)

	stdin, err := process.StdinPipe()
	if err != nil {
		slog.Error("failed to create stdin pipe", "lspId", opts.ProcessId, "error", err)
		return err
	}

	stdout, err := process.StdoutPipe()
	if err != nil {
		slog.Error("failed to create stdout pipe", "lspId", opts.ProcessId, "error", err)
		return err
	}

	stderr, err := process.StderrPipe()
	if err != nil {
		slog.Error("failed to create stderr pipe", "lspId", opts.ProcessId, "error", err)
		return err
	}

	go h.logProcessStderr(opts.ProcessId, stderr)

	if err := process.Start(); err != nil {
		slog.Error("failed to start process", "command", opts.Command, "lspId", opts.ProcessId, "error", err)
		return err
	}

	proc := &lspProcess{
		processId:  opts.ProcessId,
		eventLspId: eventLspId,
		process:    process,
		stdin:      stdin,
		stdout:     stdout,
	}
	h.processes[opts.ProcessId] = proc

	go h.readMessages(proc)

	return nil
}

func getNodePath() string {
	return getResourcePath(filepath.Join("node", "node"))
}

// verifyNodeExecutable checks that the bundled node can actually run, before
// handing one of the servers built on it to a launcher script.
//
// Four of the five language servers are JavaScript: python (basedpyright),
// typescript, html and css each reach node through a one-line wrapper script. A
// node that will not execute takes all four down at once, and does it silently —
// the wrapper exits, the server never answers initialize, and the only trace is
// a hundred "LSP not ready yet, waiting..." lines before the frontend gives up
// with nothing to explain it. That is how a truncated node presented on a
// VENTUNO Q whose extraction had been interrupted.
//
// The reasoning matches verifyClangdExecutable, including why a non-zero exit
// cannot be tolerated: a segfaulting or unloadable binary reports itself *as* an
// exit status, so accepting one would miss the case this exists for.
//
// Bounded by toolVerifyTimeout, because dying is not the only way a bundled binary
// fails to run: one stalled on a filesystem that never answers hangs instead, and
// an unbounded wait here is one the frontend cannot escape — startLSP carries no
// deadline of its own, so the editor sits at 0% indefinitely rather than reporting
// anything. RunAndCaptureCombinedOutput kills the child when the context expires,
// so the deadline ends the process rather than just abandoning the wait.
func verifyNodeExecutable() error {
	return verifyNodeExecutableAt(getNodePath(), toolVerifyTimeout)
}

// verifyNodeExecutableAt takes the binary and the deadline rather than deriving
// them, so a test can reach the hang branch without waiting toolVerifyTimeout and
// the others without a bundled node.
func verifyNodeExecutableAt(path string, timeout time.Duration) error {
	proc, err := paths.NewProcess(nil, path, "--version")
	if err != nil {
		slog.Error("could not build the node version process", "path", path, "error", err)
		return fmt.Errorf("advanced language support could not start node (%v)", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	out, err := proc.RunAndCaptureCombinedOutput(ctx)
	// Reported separately from the failure below because the kill was ours: the
	// process error is "signal: killed", which explains nothing to whoever reads
	// the log next. Both conditions are required — a deadline that expires in the
	// moment after a clean answer must not turn that answer into a failure.
	if err != nil && errors.Is(ctx.Err(), context.DeadlineExceeded) {
		slog.Error("bundled node did not answer --version in time", "path", path, "timeout", timeout, "output", strings.TrimSpace(string(out)))
		return fmt.Errorf("advanced language support timed out starting node at %s", path)
	}
	if err != nil {
		slog.Error("bundled node cannot be run", "path", path, "error", err, "output", strings.TrimSpace(string(out)))
		return fmt.Errorf("advanced language support could not start node (%v)", err)
	}
	if !strings.HasPrefix(strings.TrimSpace(string(out)), "v") {
		slog.Error("bundled node answered --version unexpectedly", "path", path, "output", strings.TrimSpace(string(out)))
		return fmt.Errorf("advanced language support could not verify node at %s", path)
	}
	return nil
}

func getResourcePath(resource string) string {
	resourceDir := getLspWorkspaceResourcesDir()
	basePath := filepath.Join(resourceDir, resource)

	if runtime.GOOS == "windows" {
		for _, ext := range []string{".exe", ".bat", ""} {
			p := basePath + ext
			if _, err := os.Stat(p); err == nil {
				return p
			}
		}
	} else {
		if _, err := os.Stat(basePath); err == nil {
			return basePath
		}
	}
	return resource
}

func isBatchFile(command string) bool {
	ext := strings.ToLower(filepath.Ext(command))
	return ext == ".bat"
}

func (h *LSPHandler) readMessages(proc *lspProcess) {
	defer h.handleProcessExit(proc)

	reader := bufio.NewReader(proc.stdout)
	firstMessage := true

	for {
		contentLength, err := readHeader(reader)
		if err != nil {
			if err != io.EOF {
				slog.Error("error reading message header", "lspId", proc.processId, "error", err)
			}
			return
		}

		// reset the restart count after the first successful message.
		if firstMessage {
			h.stateMu.Lock()
			h.restartCounts[proc.processId] = 0
			h.stateMu.Unlock()
			firstMessage = false
		}

		if contentLength > 0 {
			content := make([]byte, contentLength)
			if _, err := io.ReadFull(reader, content); err != nil {
				slog.Error("error reading message content", "lspId", proc.processId, "expectedLength", contentLength, "error", err)
				return
			}
			message, skip := h.processMessage(proc, content)
			if skip {
				continue
			}
			wailsRuntime.EventsEmit(h.ctxHolder.Get(), fmt.Sprintf("lsp-events-%s", proc.eventLspId), message)
		}
	}
}

func readHeader(reader *bufio.Reader) (int, error) {
	contentLength := -1
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return 0, err
		}
		line = strings.TrimSpace(line)
		if line == "" {
			break
		}
		if strings.HasPrefix(line, "Content-Length:") {
			parts := strings.SplitN(line, ":", 2)
			length, err := strconv.Atoi(strings.TrimSpace(parts[1]))
			if err != nil {
				return 0, fmt.Errorf("invalid Content-Length header %q: %w", line, err)
			}
			if length < 0 || length > maxLSPMessageBytes {
				return 0, fmt.Errorf("Content-Length %d out of bounds (max %d)", length, maxLSPMessageBytes)
			}
			contentLength = length
		}
	}
	if contentLength < 0 {
		return 0, fmt.Errorf("missing Content-Length header")
	}
	return contentLength, nil
}

func (h *LSPHandler) processMessage(proc *lspProcess, content []byte) (message any, skip bool) {
	if err := json.Unmarshal(content, &message); err != nil {
		slog.Error("failed to unmarshal message", "lspId", proc.processId, "error", err)
		return nil, true
	}

	msgMap, isMap := message.(map[string]interface{})
	if isMap {
		// Whatever the server points the editor at - a definition in a library
		// header, a reference in another file - becomes readable for this
		// session. The server, not the webview, is what makes the file
		// legitimate.
		//
		// Only `result` is walked, i.e. answers to requests the editor made.
		// Notifications like publishDiagnostics also carry a `uri`, and letting
		// those grow the set would mean any file the server happens to mention
		// becomes readable. Server-initiated edits (workspace/applyEdit) do not
		// need it either: those land on workspace files, which are already
		// allowed by their root, and the client refuses to write external ones.
		recordNavigableFiles(msgMap["result"], h.hostReads)

		// The formatter process is a formatting authority only, but it still
		// receives every didOpen/didChange (state sync it needs to format
		// correctly) and lints them: ruff publishes pyflakes diagnostics
		// (e.g. F405 "may be undefined, or defined from star imports") for
		// the same URIs basedpyright analyzes. The client stores diagnostics
		// per URI — last publisher wins — so the two processes would
		// non-deterministically clobber each other's squiggles (observed as
		// a yellow F405 vs red "not defined" flip-flop on the same symbol).
		// Drop diagnostics from formatter processes: the main LS is the
		// single diagnostics authority.
		if isFormatter(proc.processId) {
			if method, _ := msgMap["method"].(string); method == methodPublishDiagnostics {
				return nil, true
			}
		}

		_, hasId := msgMap["id"]
		_, hasMethod := msgMap["method"]
		isInitializeResponse := hasId && !hasMethod

		if isInitializeResponse {
			if result, ok := msgMap["result"].(map[string]interface{}); ok {
				if capabilities, hasCaps := result["capabilities"].(map[string]interface{}); hasCaps {
					formatterProcessId := getFormatterProcessId(proc.eventLspId)
					if proc.processId == formatterProcessId {
						// This is the only point at which the formatter's
						// handshake completion is observable: its response is
						// dropped rather than forwarded, so nothing downstream
						// could tell. Release the state sync held for it.
						h.markFormatterReady(proc)
						// ignore formatter capabilities response
						return nil, true
					}
					// inject fake capabilities into the main process response when a formatter exists
					h.stateMu.RLock()
					_, hasFormatter := h.processes[formatterProcessId]
					h.stateMu.RUnlock()

					if hasFormatter {
						capabilities["documentFormattingProvider"] = true
						capabilities["documentRangeFormattingProvider"] = true
					}
				}
			}
		}

	}

	return message, false
}

func (h *LSPHandler) Send(lspId LspId, message any) error {
	return h.send(lspId, message)
}

// vscode-langservers-extracted servers (html,css) only advertise their formatting capability
// when the client asks for it via initializationOptions.provideFormatter.
func injectProvideFormatterInitOption(lspId LspId, message any) {
	if !LspNeedsProvideFormatterInitOption[lspId] {
		return
	}
	msgMap, ok := message.(map[string]any)
	if !ok {
		return
	}
	if method, _ := msgMap["method"].(string); method != methodInitialize {
		return
	}
	params, ok := msgMap["params"].(map[string]any)
	if !ok {
		return
	}
	opts, ok := params["initializationOptions"].(map[string]any)
	if !ok {
		opts = make(map[string]any)
		params["initializationOptions"] = opts
	}
	opts["provideFormatter"] = true
}

// record state for auto-restart
func (h *LSPHandler) recordRecoveryState(lspId LspId, message any) {
	msgMap, ok := message.(map[string]any)
	if !ok {
		return
	}

	method, _ := msgMap["method"].(string)
	params, _ := msgMap["params"].(map[string]any)

	h.stateMu.Lock()
	defer h.stateMu.Unlock()

	switch method {
	case methodInitialize:
		h.initializeRequests[lspId] = message

	case methodDidOpen:
		if uri := getDocUri(params); uri != "" {
			if h.openFiles[lspId] == nil {
				h.openFiles[lspId] = make(map[string]any)
			}
			h.openFiles[lspId][uri] = message
		}

	case methodDidClose:
		if uri := getDocUri(params); uri != "" {
			if h.openFiles[lspId] != nil {
				delete(h.openFiles[lspId], uri)
			}
		}

	case methodDidChange:
		h.recordRecoveryStateFileChange(lspId, params)
	}
}

func getDocUri(params map[string]any) string {
	if doc, ok := params["textDocument"].(map[string]any); ok {
		if uri, ok := doc["uri"].(string); ok {
			return uri
		}
	}
	return ""
}

// recordRecoveryStateFileChange folds a didChange into the recovery snapshot's
// stored didOpen text, so a restart replays each document exactly as the
// client last sent it — replaying stale didOpen-era text would silently desync
// every subsequent incremental edit, and the client cannot repair it (a
// rangeless full-content reset didChange makes the Arduino LS panic:
// `panic("full-text change not implemented")` in its didChange handler).
// Changes apply sequentially, each against the result of the previous one, per
// LSP semantics: a change without a range replaces the whole text, a ranged
// change is applied at UTF-16 positions — the client computes ranges in UTF-16
// code units against exactly the text mirrored here, so offsets always line
// up. If a change fails to apply, the snapshot keeps its previous text (stale,
// but no worse than not folding at all).
func (h *LSPHandler) recordRecoveryStateFileChange(lspId LspId, params map[string]any) {
	uri := getDocUri(params)
	if uri == "" || h.openFiles[lspId] == nil {
		return
	}

	stored, exists := h.openFiles[lspId][uri]
	if !exists {
		return
	}

	contentChanges, ok := params["contentChanges"].([]any)
	if !ok || len(contentChanges) == 0 {
		return
	}

	storedMap, ok := stored.(map[string]any)
	if !ok {
		return
	}
	storedParams, ok := storedMap["params"].(map[string]any)
	if !ok {
		return
	}
	storedDoc, ok := storedParams["textDocument"].(map[string]any)
	if !ok {
		return
	}
	text, ok := storedDoc["text"].(string)
	if !ok {
		return
	}

	for _, rawChange := range contentChanges {
		change, ok := rawChange.(map[string]any)
		if !ok {
			return
		}
		newText, ok := change["text"].(string)
		if !ok {
			return
		}
		rng, hasRange := change["range"].(map[string]any)
		if !hasRange {
			// Rangeless: full-document replacement.
			text = newText
			continue
		}
		updated, err := applyRangedTextChange(text, rng, newText)
		if err != nil {
			slog.Warn("recovery snapshot: cannot fold ranged didChange", "uri", uri, "error", err)
			return
		}
		text = updated
	}

	storedDoc["text"] = text
}

// sendSerialized waits for the LSP, then performs the
// [fold-into-snapshot + write] pair under the per-LSP send mutex, re-checking
// that the resolved process is still current: a restart may have swapped it
// while we waited, and its replay already delivered our folded state — writing
// the message on top would apply it twice. The wait happens OUTSIDE the lock
// (a restart needs the lock to run its replay), so a swap triggers one
// re-resolve instead of a deadlock.
func (h *LSPHandler) sendSerialized(lspId LspId, message any) error {
	for attempt := 0; attempt < 2; attempt++ {
		mainProc, formatterProc, err := h.waitForLSPReady(lspId)
		if err != nil {
			return err
		}

		mu := h.sendMuFor(lspId)
		mu.Lock()
		h.stateMu.RLock()
		current := h.processes[ProcessId(lspId)] == mainProc
		h.stateMu.RUnlock()
		if !current {
			mu.Unlock()
			// Field-proven race (inols.log forensics, the `goood` phantom):
			// without this guard the message's snapshot fold is delivered by
			// the restart's replay AND the message itself lands on the fresh
			// process — applied twice. Log when the guard actually fires so
			// a recurrence is diagnosable at a glance.
			slog.Warn("LSP send raced a restart; re-resolving against the fresh process", "lspId", lspId)
			h.emitLogToFrontend("warn", "lifecycle", ProcessId(lspId), "send raced a restart; re-resolved to avoid double-apply")
			continue
		}
		err = h.deliver(lspId, mainProc, formatterProc, message)
		mu.Unlock()
		return err
	}
	return fmt.Errorf("LSP %s kept restarting while sending", lspId)
}

// deliver folds `message` into the recovery snapshot and writes it to the
// processes. The caller must hold the per-LSP send mutex (sendSerialized) or
// own it as part of a restart (replayStateAfterRestart), so the fold and the
// write can't straddle a concurrent restart's replay.
func (h *LSPHandler) deliver(lspId LspId, mainProc, formatterProc *lspProcess, message any) error {
	injectProvideFormatterInitOption(lspId, message)
	h.recordRecoveryState(lspId, message)

	// The Arduino LS does not implement workspace/didChangeWatchedFiles: its
	// handler is literally `Panic: unimplemented` (lsp_server_ide.go:310 in
	// 0.8.0-rc.1; over a thousand such panics on record in inols-err.log).
	// Every watched-files notification therefore crash-restarted it — and the
	// restart's replay racing in-flight didChanges is what corrupted
	// documents (the `goood` phantom-symbol forensics). Swallow the message;
	// the sketch reindex the panic-restart used to provide as a side effect
	// is triggered deliberately by the gate in h.send instead.
	if lspId == LSP_Arduino && isMethodMessage(message, methodDidChangeWatchedFiles) {
		slog.Info("suppressed didChangeWatchedFiles to arduino LS (unimplemented server-side)", "lspId", lspId)
		return nil
	}

	return h.sendToProcesses(lspId, mainProc, formatterProc, message)
}

// isMethodMessage reports whether `message` is a JSON-RPC message with the
// given method.
func isMethodMessage(message any, method string) bool {
	msgMap, ok := message.(map[string]any)
	if !ok {
		return false
	}
	m, _ := msgMap["method"].(string)
	return m == method
}

// sendDuringReplay is the replay's send path: identical to sendSerialized but
// without taking the send mutex, which the restart sequence already holds.
func (h *LSPHandler) sendDuringReplay(lspId LspId, message any) error {
	mainProc, formatterProc, err := h.waitForLSPReady(lspId)
	if err != nil {
		return err
	}
	return h.deliver(lspId, mainProc, formatterProc, message)
}

// applyRangedTextChange replaces the span of `text` covered by the LSP range
// `rng` (a decoded JSON {start: {line, character}, end: {...}}) with
// `newText`.
func applyRangedTextChange(text string, rng map[string]any, newText string) (string, error) {
	startLine, startChar, err := rangePosition(rng, "start")
	if err != nil {
		return "", err
	}
	endLine, endChar, err := rangePosition(rng, "end")
	if err != nil {
		return "", err
	}
	startOff, err := positionByteOffset(text, startLine, startChar)
	if err != nil {
		return "", err
	}
	endOff, err := positionByteOffset(text, endLine, endChar)
	if err != nil {
		return "", err
	}
	if endOff < startOff {
		return "", fmt.Errorf("range end %d:%d before start %d:%d", endLine, endChar, startLine, startChar)
	}
	return text[:startOff] + newText + text[endOff:], nil
}

func rangePosition(rng map[string]any, key string) (line, character int, err error) {
	pos, ok := rng[key].(map[string]any)
	if !ok {
		return 0, 0, fmt.Errorf("range has no %q position", key)
	}
	l, ok := pos["line"].(float64)
	if !ok {
		return 0, 0, fmt.Errorf("position %q has no line", key)
	}
	c, ok := pos["character"].(float64)
	if !ok {
		return 0, 0, fmt.Errorf("position %q has no character", key)
	}
	return int(l), int(c), nil
}

// positionByteOffset converts an LSP position (0-based line, character counted
// in UTF-16 code units) to a byte offset into the UTF-8 `text`. A character
// count past the end of the line clamps to the line end, matching the LSP
// convention for out-of-range characters.
func positionByteOffset(text string, line, character int) (int, error) {
	if line < 0 || character < 0 {
		return 0, fmt.Errorf("negative position %d:%d", line, character)
	}
	lineStart := 0
	for l := 0; l < line; l++ {
		next := strings.IndexByte(text[lineStart:], '\n')
		if next < 0 {
			return 0, fmt.Errorf("line %d out of range", line)
		}
		lineStart += next + 1
	}
	units := 0
	for i, r := range text[lineStart:] {
		if units >= character {
			return lineStart + i, nil
		}
		if r == '\n' {
			// Character past the line end: clamp to the newline.
			return lineStart + i, nil
		}
		if r >= 0x10000 {
			units += 2
		} else {
			units++
		}
	}
	return len(text), nil
}

func (h *LSPHandler) send(lspId LspId, message any) error {
	if err := h.sendSerialized(lspId, message); err != nil {
		return err
	}

	if lspId == LSP_Python {
		if isInitializedNotification(message) {
			h.sendPyrightConfigPath()
		}
	}

	// Structural/on-disk changes to the sketch (moves, creates, deletes,
	// external content changes to non-open sources) desync the Arduino LS's
	// in-memory build tracking, and it cannot be told about them: its
	// workspace/didChangeWatchedFiles handler panics (see deliver), so the
	// notification is suppressed and this deliberate restart is the ONLY
	// reindex mechanism. Historically the panic-restart itself provided the
	// reindex as an accidental side effect for every watched event; this gate
	// preserves that recovery for sketch-relevant changes while dropping the
	// pointless restarts for non-sketch ones (e.g. python files broadcast to
	// every workspace). didClose/didOpen already updated the recorded
	// recovery state (they arrive before this watched-files event), so
	// respawning the process and replaying that state is a clean reinit —
	// equivalent to reopening the app, without disturbing the client
	// connection.
	if lspId == LSP_Arduino && h.isSketchWatchedChange(message) {
		h.triggerSketchRestart(lspId)
	}

	return nil
}

// isSketchWatchedChange reports whether `message` is a
// workspace/didChangeWatchedFiles touching an Arduino source (ino/c/cpp/h/hpp)
// inside the app's top-level `sketch/` folder — the files whose on-disk state
// feeds the sketch build. Any such change (Created, Changed or Deleted) needs
// the deliberate restart, because the suppressed notification (see deliver)
// leaves the Arduino LS no other way to learn the disk changed.
func (h *LSPHandler) isSketchWatchedChange(message any) bool {
	msgMap, ok := message.(map[string]any)
	if !ok {
		return false
	}
	if method, _ := msgMap["method"].(string); method != methodDidChangeWatchedFiles {
		return false
	}
	params, ok := msgMap["params"].(map[string]any)
	if !ok {
		return false
	}
	changes, ok := params["changes"].([]any)
	if !ok {
		return false
	}

	h.stateMu.RLock()
	sketchDir := filepath.Join(h.appDir, sketchDirName)
	h.stateMu.RUnlock()

	for _, c := range changes {
		cm, ok := c.(map[string]any)
		if !ok {
			continue
		}
		uri, _ := cm["uri"].(string)
		if IsURIWithinDir(uri, sketchDir) && isArduinoSourceURI(uri) {
			return true
		}
	}
	return false
}

func isArduinoSourceURI(uri string) bool {
	for _, ext := range arduinoSourceExts {
		if strings.HasSuffix(uri, ext) {
			return true
		}
	}
	return false
}

// triggerSketchRestart restarts the given LSP off the caller's goroutine. If a
// restart is already in flight it records that another move-in arrived and runs
// one more restart afterwards (coalescing rapid successive moves), so the final
// replay always reflects the latest recorded state.
func (h *LSPHandler) triggerSketchRestart(lspId LspId) {
	h.stateMu.Lock()
	if h.restarting[lspId] {
		h.restartPending[lspId] = true
		h.stateMu.Unlock()
		return
	}
	h.restarting[lspId] = true
	h.stateMu.Unlock()

	go func() {
		for {
			h.restartLSP(lspId)

			h.stateMu.Lock()
			if h.restartPending[lspId] {
				h.restartPending[lspId] = false
				h.stateMu.Unlock()
				continue
			}
			h.restarting[lspId] = false
			h.stateMu.Unlock()
			return
		}
	}()
}

// restartLSP performs a deliberate stop + start of an LSP and replays its
// recorded initialize + open-file state to the fresh process. Unlike the crash
// auto-restart path it doesn't consume the retry budget, and because the
// recorded state already reflects any pending file move the reinit is
// equivalent to reopening the app.
func (h *LSPHandler) restartLSP(lspId LspId) {
	slog.Info("restartLSP: reinitializing after sketch structure change", "lspId", lspId)

	h.stateMu.RLock()
	dir := h.appDir
	h.stateMu.RUnlock()

	h.stop(lspId)

	h.stateMu.Lock()
	delete(h.restartCounts, ProcessId(lspId))
	delete(h.restartCounts, getFormatterProcessId(lspId))
	h.stateMu.Unlock()

	// Retry a failed start: the deliberate stop above disables the crash
	// auto-restart, so a single failed Start would otherwise leave the LSP dead
	// with no recovery until the app is reopened.
	//
	// [start + replay] runs under the send mutex so an in-flight message can't
	// straddle the replay and double-apply (see the sendMus field docs). The
	// lock is released between attempts: it must not be held across the sleep.
	var err error
	for attempt := 1; attempt <= maxRestartRetries; attempt++ {
		sendMu := h.sendMuFor(lspId)
		sendMu.Lock()
		if err = h.Start(lspId, dir); err == nil {
			h.replayStateAfterRestart(lspId)
			sendMu.Unlock()
			return
		}
		sendMu.Unlock()
		slog.Warn("restartLSP: start failed, retrying", "lspId", lspId, "attempt", attempt, "error", err)
		time.Sleep(500 * time.Millisecond)
	}
	slog.Error("restartLSP: gave up starting after retries", "lspId", lspId, "error", err)
}

// wait up to 10 seconds for the LSP to be successfully started and ready
func (h *LSPHandler) waitForLSPReady(lspId LspId) (mainProc *lspProcess, formatterProc *lspProcess, err error) {
	for i := 0; i < 100; i++ {
		h.stateMu.RLock()
		isActive := h.activeLSPs[lspId]
		mainProc = h.processes[ProcessId(lspId)]
		formatterProc = h.processes[getFormatterProcessId(lspId)]
		h.stateMu.RUnlock()

		if !isActive {
			return nil, nil, fmt.Errorf("LSP %s is not active", lspId)
		}

		if mainProc != nil && mainProc.stdin != nil {
			if LspWithSeparateFormatter[lspId] {
				if formatterProc != nil && formatterProc.stdin != nil {
					return mainProc, formatterProc, nil
				}
				// The formatter's process entry is removed when it exits (see
				// stopIfMatch) and stays absent once its crash-restart budget
				// is exhausted. It must not take the whole LS down with it:
				// blocking here would make EVERY send — didChange, didOpen,
				// feature requests — spin for the full timeout and fail,
				// silently freezing diagnostics while the editor keeps
				// working. sendToProcesses already degrades gracefully with a
				// missing formatter, and the recovery replay re-syncs it if
				// it comes back. Only keep waiting while a formatter process
				// exists and is still starting up.
				if formatterProc == nil {
					return mainProc, nil, nil
				}
			} else {
				return mainProc, nil, nil
			}
		}

		slog.Info("LSP not ready yet, waiting...", "lspId", lspId, "retry", i)
		time.Sleep(100 * time.Millisecond)
	}
	return nil, nil, fmt.Errorf("timed out waiting for LSP %s to start", lspId)
}

// stop deliberately stops a single LSP (and its formatter). intentionalExit
// prevents the crash auto-restart path from firing. Used by restartLSP.
func (h *LSPHandler) stop(lspId LspId) {
	slog.Info("Stop", "lspId", lspId)

	h.stateMu.Lock()
	defer h.stateMu.Unlock()

	if h.activeLSPs != nil {
		h.activeLSPs[lspId] = false
	}

	if proc, ok := h.processes[ProcessId(lspId)]; ok {
		proc.intentionalExit = true
	}
	if proc, ok := h.processes[getFormatterProcessId(lspId)]; ok {
		proc.intentionalExit = true
	}

	h.stopLocked(ProcessId(lspId))
	h.stopLocked(getFormatterProcessId(lspId))
}

func (h *LSPHandler) StopAll() {
	slog.Info("StopAll")

	h.stateMu.Lock()
	defer h.stateMu.Unlock()

	h.activeLSPs = make(map[LspId]bool)

	for _, proc := range h.processes {
		proc.intentionalExit = true
	}

	for lspId := range h.processes {
		h.stopLocked(lspId)
	}
}

func (h *LSPHandler) stopLocked(processId ProcessId) {
	slog.Info("stopLocked", "processId", processId)
	proc, ok := h.processes[processId]
	if !ok || proc == nil {
		return
	}
	delete(h.processes, processId)
	if proc.process == nil {
		return
	}
	// Kill tears down the whole process group (Unix) / process tree (Windows)
	// so the LSP server and any children exit together.
	if err := proc.process.Kill(); err != nil {
		// On Windows the tree walk kills descendants first and aborts on the
		// first one it can't open — routine when a child exits between the
		// process snapshot and the kill — leaving the LSP itself alive. Nothing
		// retries (we already dropped it from h.processes) and Wait() below
		// would block forever, so fall back to killing the LSP directly.
		slog.Warn("failed to kill LSP process tree, killing main process", "processId", processId, "error", err)
		if err := proc.process.Signal(os.Kill); err != nil {
			slog.Warn("failed to kill LSP process", "processId", processId, "error", err)
		}
	}
	// Reap off the lock: Wait() blocks until the already-killed process is
	// collected, and stopLocked runs under stateMu — waiting inline would stall
	// every other LSP state access for the kill duration. The process is already
	// removed from the map, so nothing else touches it.
	go func() {
		if err := proc.process.Wait(); err != nil {
			slog.Warn("LSP process exited with error", "processId", processId, "error", err)
		} else {
			slog.Info("LSP process exited cleanly", "processId", processId)
		}
	}()
}

func (h *LSPHandler) handleProcessExit(proc *lspProcess) {
	processId := proc.processId
	eventLspId := proc.eventLspId

	slog.Warn("readMessages exited", "processId", processId)
	h.stopIfMatch(proc)

	if isFormatter(processId) {
		// Anything still held for this process died with it. Clearing here also
		// bounds a formatter that exits without ever answering initialize: its
		// queue would otherwise sit full until the app closed. A restart re-holds
		// from scratch, and replayStateAfterRestart re-sends the state.
		h.resetFormatterHandshake(processId)
	}

	h.stateMu.Lock()
	if proc.intentionalExit {
		h.stateMu.Unlock()
		return
	}
	h.restartCounts[processId]++
	count := h.restartCounts[processId]
	h.stateMu.Unlock()

	if count > maxRestartRetries {
		slog.Error("LSP crashed too many times, giving up auto-restart", "lspId", processId, "count", count)
		h.emitLogToFrontend("error", "lifecycle", processId, fmt.Sprintf("crashed too many times (%d), giving up auto-restart", count))
		// A dead formatter is a degraded main LSP, not a failed one — the editor
		// keeps working without it, so don't report the base id as failed.
		if !isFormatter(processId) {
			h.emitFailureToFrontend(eventLspId, fmt.Sprintf("the language server stopped responding after %d restart attempts", maxRestartRetries))
		}
		return
	}

	slog.Info("LSP exited unexpectedly, restarting in 500ms...", "lspId", processId, "retry", count)
	h.emitLogToFrontend("warn", "lifecycle", processId, fmt.Sprintf("exited unexpectedly, restarting (retry %d)", count))
	time.Sleep(500 * time.Millisecond)

	h.stateMu.RLock()
	isActive := h.activeLSPs[eventLspId]
	h.stateMu.RUnlock()

	if !isActive {
		slog.Info("LSP auto-restart aborted: LSP is no longer active", "lspId", eventLspId)
		return
	}

	// Hold the send mutex across [start + replay]: without it, an in-flight
	// message can have its snapshot fold read by the replay AND its delivery
	// land after the replayed didOpen — applied twice on the fresh process
	// (see the sendMus field docs).
	sendMu := h.sendMuFor(eventLspId)
	sendMu.Lock()
	defer sendMu.Unlock()

	if isFormatter(processId) {
		baseLspId := getBaseLspId(processId)
		if err := h.startFormatter(baseLspId); err != nil {
			slog.Error("Failed to restart LSP formatter", "lspId", processId, "error", err)
			return
		}
	} else {
		h.stateMu.RLock()
		dir := h.appDir
		h.stateMu.RUnlock()
		if err := h.Start(eventLspId, dir); err != nil {
			slog.Error("Failed to restart LSP", "lspId", eventLspId, "error", err)
			// Start refuses for reasons a retry won't fix (no board selected, a
			// toolchain it cannot run), and the frontend's own start promise
			// already resolved on the first launch — so nothing else would ever
			// tell it this LSP is gone.
			h.emitFailureToFrontend(eventLspId, err.Error())
			return
		}
	}

	// replay previous state to the new process instance
	h.replayStateAfterRestart(eventLspId)
}

func (h *LSPHandler) replayStateAfterRestart(eventLspId LspId) {
	h.stateMu.RLock()
	initReq := h.initializeRequests[eventLspId]
	openFiles := h.openFiles[eventLspId]
	h.stateMu.RUnlock()

	if initReq != nil {
		slog.Info("replaying initialize request", "lspId", eventLspId)
		if err := h.sendDuringReplay(eventLspId, initReq); err != nil {
			slog.Error("failed to replay initialize request", "lspId", eventLspId, "error", err)
		}
		if err := h.sendDuringReplay(eventLspId, map[string]any{"method": methodInitialized, "params": map[string]any{}}); err != nil {
			slog.Error("failed to replay initialized notification", "lspId", eventLspId, "error", err)
		}
		// h.send()'s initialized post-step, replicated here because the replay
		// bypasses it: without the config path pyright falls back to defaults
		// (no stubs extraPaths, no suppressed-import rules) after a restart.
		if eventLspId == LSP_Python {
			h.sendPyrightConfigPath()
		}
	}

	if openFiles != nil {
		slog.Info("replaying didOpen notifications for all open files", "lspId", eventLspId, "count", len(openFiles))
		for uri, docMsg := range openFiles {
			if err := h.sendDuringReplay(eventLspId, docMsg); err != nil {
				slog.Error("failed to replay didOpen notification", "lspId", eventLspId, "uri", uri, "error", err)
			}
		}
	}
}

// maxStderrLogLineBytes caps how many bytes of a single stderr line are kept
// for logging. The rest of the line is still consumed so the pipe keeps
// draining (see readStderrLine).
const maxStderrLogLineBytes = 64 * 1024

// degradedCompileDBMarker is arduino-cli's warning that it could not produce a
// complete compilation database, reached here through the language server's
// forwarded stderr. clangd then resolves includes and symbols from partial
// flags, so the diagnostics it publishes may be wrong rather than merely
// missing — the Windows "undeclared identifier" reports looked just like this.
//
// Matching English text is only safe because arduino-cli's locale is pinned
// (see arduinoCliLocale in lsp_arduino.go). Without that pin this line arrives
// translated to the host language and never matches.
const degradedCompileDBMarker = "the compilation database may be incomplete or inaccurate"

func (h *LSPHandler) logProcessStderr(processId ProcessId, stderr io.ReadCloser) {
	reader := bufio.NewReader(stderr)
	// Scoped to this goroutine, which lives exactly as long as the process: the
	// language server repeats the warning on every rebuild, and one report per
	// session is enough to explain that session's diagnostics.
	compileDBWarned := false
	clangStartReported := false
	for {
		line, err := readStderrLine(reader)
		if len(line) > 0 {
			if !compileDBWarned && strings.Contains(line, degradedCompileDBMarker) {
				compileDBWarned = true
				h.reportDegradedCompileDB(processId, line)
			}
			if !clangStartReported && clangStartFailed(line) {
				clangStartReported = true
				// Off the read loop: the probe runs a whole compile, and blocking
				// here would stop draining stderr (see readStderrLine).
				go h.reportClangStartFailure(processId, line)
			}
			h.logStderrLine(processId, line)
		}
		if err != nil {
			if err != io.EOF {
				slog.Error("error reading LSP stderr", "processId", processId, "error", err)
			}
			return
		}
	}
}

// readStderrLine reads one '\n'-terminated line, always consuming the whole
// line from the pipe but retaining at most maxStderrLogLineBytes of it.
//
// The Arduino LS forwards clangd's stderr, and clangd runs with verbose
// logging: it prints whole LSP payloads on a single line (a full-document
// didChange carries the entire preprocessed sketch; a completion response
// carries a large JSON array), which routinely exceeds 64KB. A bufio.Scanner
// stops for good once a line passes its 64KB token limit, after which nothing
// drains stderr; the pipe then fills — its buffer is only a few KB on Windows
// versus 64KB on Linux/macOS — and clangd blocks on its next stderr write,
// wedging the language server and freezing whatever (often wrong, pre-build)
// diagnostics it had already published. Reading in bufio-buffer-sized chunks
// keeps memory bounded no matter how long the line is.
func readStderrLine(reader *bufio.Reader) (string, error) {
	var buf []byte
	for {
		chunk, err := reader.ReadSlice('\n')
		if room := maxStderrLogLineBytes - len(buf); room > 0 {
			if len(chunk) > room {
				buf = append(buf, chunk[:room]...)
			} else {
				buf = append(buf, chunk...)
			}
		}
		// ErrBufferFull means the line is longer than bufio's internal buffer:
		// keep reading (discarding past the cap) until the newline or EOF.
		if err == bufio.ErrBufferFull {
			continue
		}
		return strings.TrimRight(string(buf), "\r\n"), err
	}
}

// Frontend log-bridge event names. Keep in sync with the frontend
// (ui-components lsp-debug.ts / core-ui useLSP.ts): the frontend enables
// forwarding by emitting lspDebugToggleEvent and renders lines received on
// lspLogFrontendEvent.
const (
	lspLogFrontendEvent = "lsp-log"
	lspDebugToggleEvent = "lsp-set-debug-logging"
	lspFailedEvent      = "lsp-failed"
)

// lspFailure reports that an LSP is not coming back, so the editor can stop
// presenting it as still loading. Mirrored by LspFailure on the frontend.
type lspFailure struct {
	LspId  string `json:"lspId"`
	Reason string `json:"reason"`
}

// emitFailureToFrontend announces a terminal LSP failure.
//
// Deliberately NOT gated on debugLogging, unlike emitLogToFrontend: this is a
// state transition, not a log line. Before it existed, exhausting the restart
// budget was reported only as a debug-gated console message, so a dead language
// server kept rendering as a progress spinner frozen at 0% — with the debug flag
// off (the default) there was nothing to see at all.
func (h *LSPHandler) emitFailureToFrontend(lspId LspId, reason string) {
	slog.Error("reporting terminal LSP failure to the frontend", "lspId", lspId, "reason", reason)
	wailsRuntime.EventsEmit(h.ctxHolder.Get(), lspFailedEvent, lspFailure{
		LspId:  string(lspId),
		Reason: reason,
	})
}

// lspLogLine is one LSP log line forwarded to the frontend dev-tools console.
// Production builds send slog to log files the user can't easily reach, so
// clangd / language-server output is otherwise invisible when diagnosing field
// issues (e.g. the Windows "undeclared identifier" reports).
type lspLogLine struct {
	Level     string `json:"level"`
	Source    string `json:"source"`
	ProcessId string `json:"processId"`
	Msg       string `json:"msg"`
}

// emitLogToFrontend forwards one log line to the frontend console, but only
// when debug logging is enabled: clangd runs verbose, so unconditional
// forwarding would flood the webview bridge during normal operation.
func (h *LSPHandler) emitLogToFrontend(level, source string, processId ProcessId, msg string) {
	if !h.debugLogging.Load() {
		return
	}
	wailsRuntime.EventsEmit(h.ctxHolder.Get(), lspLogFrontendEvent, lspLogLine{
		Level:     level,
		Source:    source,
		ProcessId: string(processId),
		Msg:       msg,
	})
}

// reportDegradedCompileDB records, once per language-server session, that the
// compilation database is incomplete and the diagnostics built on it cannot be
// trusted. Without this the warning is just another stderr line among clangd's
// verbose output, so a report of phantom errors gives no hint that the build
// inputs were wrong.
//
// Diagnostics are deliberately still served. Dropping them would hide real
// errors in every session where the database is only partially degraded, and an
// unexplained empty problems list reads as "this code is fine". Turning this
// into a state the editor shows the user is the follow-up.
func (h *LSPHandler) reportDegradedCompileDB(processId ProcessId, line string) {
	const msg = "Incomplete compilation database: diagnostics for this session may be inaccurate."
	slog.Warn(colorYellow+"LSP DEGRADED"+colorReset, "processId", processId, "reason", msg, "detail", line)
	h.emitLogToFrontend("warn", "degraded", processId, msg)
}

// clangStartFailedMarker is the Arduino language server giving up on clangd
// because it could not build a compilation database. The line it logs ends in
// nothing more useful than "exit status 1" — arduino-cli's own output is
// swallowed — which is why a field report of this could not be diagnosed at all
// (it took a VM bisect to find that an x86_64-only ctags was the cause).
//
// Matching English text is safe for the same reason as degradedCompileDBMarker:
// arduino-cli's locale is pinned (see arduinoCliLocale).
var clangStartFailedMarkers = []string{
	// The compile that builds the compilation database failed.
	"error starting clang",
	// clangd started and then died — e.g. a missing MSVC runtime DLL on Windows,
	// which exits so fast the language server only notices the dropped pipe. This
	// shape reports a *successful* compile, so without it here nothing was probed
	// and nothing reached the UI.
	"Lost connection with clangd",
}

// clangStartFailed reports whether an ALS stderr line announces one of them.
func clangStartFailed(line string) bool {
	for _, marker := range clangStartFailedMarkers {
		if strings.Contains(line, marker) {
			return true
		}
	}
	return false
}

// clangProbeTimeout bounds the diagnostic compile. A cold compilation database
// legitimately takes tens of seconds; past this we would be holding a goroutine
// for a compile whose output nobody is waiting on.
const clangProbeTimeout = 3 * time.Minute

// reportClangStartFailure logs why the compilation database could not be built.
//
// The language server runs `arduino-cli compile --only-compilation-database` and
// reports only the exit status, so we re-run the equivalent command ourselves and
// log its combined output. Built from the inputs we already hand the language
// server rather than parsed out of its message, so there is no format to track.
//
// Once per process (the caller latches it): the language server retries on every
// didOpen, and each probe is a full compile.
func (h *LSPHandler) reportClangStartFailure(processId ProcessId, line string) {
	slog.Error(colorYellow+"LSP CLANGD START FAILED"+colorReset, "processId", processId, "detail", line)

	// Which half broke is the whole question, and the two shapes look identical
	// from here: a failed compile leaves clangd with nothing to load, while a
	// clangd that cannot execute reports a perfectly good compile. Probe both and
	// let the logs say which — the alternative is what this cost on Windows, where
	// the compile succeeded in 5s and clangd died in 25ms.
	if err := verifyClangdExecutable(); err != nil {
		slog.Error("clangd itself cannot run; the compilation database is not the problem",
			"processId", processId, "error", err)
		h.emitLogToFrontend("error", "clangd-probe", processId, err.Error())
	} else {
		slog.Info("clangd runs standalone, so the compilation database is the suspect", "processId", processId)
	}

	b := h.boardProvider()
	if b == nil || b.Info.FQBN == "" {
		slog.Warn("skipping compile probe: no board selected", "processId", processId)
		return
	}

	h.stateMu.RLock()
	appDir := h.appDir
	h.stateMu.RUnlock()
	if appDir == "" {
		slog.Warn("skipping compile probe: no app dir recorded", "processId", processId)
		return
	}

	buildPath, err := os.MkdirTemp("", "applab-compiledb-probe")
	if err != nil {
		slog.Warn("skipping compile probe: could not create a build path", "error", err)
		return
	}
	defer os.RemoveAll(buildPath)

	ctx, cancel := context.WithTimeout(h.ctxHolder.Get(), clangProbeTimeout)
	defer cancel()

	cmd, err := paths.NewProcess(nil, getArduinoCliPath(),
		"--config-file", getArduinoCliConfigPath(),
		"compile",
		"--fqbn", b.Info.FQBN,
		"--only-compilation-database",
		"--build-path", buildPath,
		filepath.Join(appDir, sketchDirName),
	)
	if err != nil {
		slog.Warn("could not build the compile probe process", "error", err)
		return
	}

	out, runErr := cmd.RunAndCaptureCombinedOutput(ctx)
	if runErr == nil {
		// The probe passing while the language server's own attempt failed is
		// itself the finding: something transient or environmental differs
		// between the two runs.
		slog.Warn("compile probe succeeded even though clangd startup failed", "processId", processId, "output", string(out))
		return
	}
	slog.Error("compile probe reproduced the failure", "processId", processId, "error", runErr, "output", string(out))
	h.emitLogToFrontend("error", "compile-probe", processId, string(out))
}

func (h *LSPHandler) logStderrLine(processId ProcessId, msg string) {
	var level string
	switch {
	case strings.Contains(msg, "INFO"):
		level = "info"
		slog.Info(colorBlue+"LSP STDERR"+colorReset, "processId", processId, "msg", msg)
	case strings.Contains(msg, "WARN"):
		level = "warn"
		slog.Warn(colorYellow+"LSP STDERR"+colorReset, "processId", processId, "msg", msg)
	default:
		level = "error"
		slog.Error(colorRed+"LSP STDERR"+colorReset, "processId", processId, "msg", msg)
	}
	h.emitLogToFrontend(level, "stderr", processId, msg)
}

// maxFormatterQueue bounds the pre-initialize hold. A formatter that never
// answers has usually died, and its exit clears the queue — this is only a
// backstop against one that lingers without ever initialising.
const maxFormatterQueue = 512

// queueForFormatter holds a state-sync notification until the formatter has
// answered `initialize`, reporting whether it took ownership of the message.
//
// Only the main language server's readiness gates the client. waitForLSPReady
// checks that the formatter's process and stdin exist — true almost immediately
// after spawn — and processMessage deliberately drops the formatter's own
// initialize response so its capabilities cannot clobber the main server's. So
// `initialized` and the first `didOpen` were fanned out to the formatter as soon
// as the *main* server was ready, with nothing waiting on the formatter itself.
//
// A server must ignore notifications that arrive before initialize completes, so
// ruff correctly dropped that didOpen and then rejected every later didChange for
// the file with "Received change text document command for closed file". The
// document was never registered, formatting stayed broken, and the client could
// not repair it: resyncStaleDocument answers a stale document with another
// didChange, which is exactly the message being rejected. Only a didClose/didOpen
// — the user switching tabs — recovered it.
//
// Holding rather than skipping is the point: dropping the didOpen is the bug. The
// queue replays in arrival order, which is already valid LSP order.
func (h *LSPHandler) queueForFormatter(proc *lspProcess, message any) bool {
	h.stateMu.Lock()
	defer h.stateMu.Unlock()

	if h.formatterReady[proc.processId] {
		return false
	}
	queued := h.formatterQueue[proc.processId]
	if len(queued) >= maxFormatterQueue {
		slog.Warn("formatter pre-initialize queue is full, dropping the oldest message",
			"processId", proc.processId, "limit", maxFormatterQueue)
		queued = queued[1:]
	}
	h.formatterQueue[proc.processId] = append(queued, message)
	return true
}

// markFormatterReady records that a formatter answered `initialize` and flushes
// everything held for it, in order.
func (h *LSPHandler) markFormatterReady(proc *lspProcess) {
	h.stateMu.Lock()
	if h.formatterReady[proc.processId] {
		h.stateMu.Unlock()
		return
	}
	h.formatterReady[proc.processId] = true
	queued := h.formatterQueue[proc.processId]
	delete(h.formatterQueue, proc.processId)
	h.stateMu.Unlock()

	if len(queued) == 0 {
		return
	}
	slog.Info("formatter initialized, flushing held state sync", "processId", proc.processId, "count", len(queued))
	for _, message := range queued {
		if err := sendToProc(proc, message); err != nil {
			slog.Warn("failed to flush held state sync to formatter", "processId", proc.processId, "error", err)
			return
		}
	}
}

// resetFormatterHandshake forgets a formatter's handshake state so a fresh process
// holds its state sync again instead of inheriting the previous one's readiness.
func (h *LSPHandler) resetFormatterHandshake(processId ProcessId) {
	h.stateMu.Lock()
	defer h.stateMu.Unlock()
	delete(h.formatterReady, processId)
	delete(h.formatterQueue, processId)
}

// distribute message to main and formatter processes
func (h *LSPHandler) sendToProcesses(lspId LspId, mainProc *lspProcess, formatterProc *lspProcess, message any) error {
	msgMap, _ := message.(map[string]any)
	method, hasMethod := msgMap["method"].(string)
	_, hasId := msgMap["id"]

	isInitializeRequest := hasId && hasMethod && method == methodInitialize
	isNotification := !hasId && hasMethod
	isFormattingRequest := hasId && hasMethod && (method == methodFormatting || method == methodRangeFormatting)

	// if the lsp has a separate formatter process
	if LspWithSeparateFormatter[lspId] {

		// send formatting request (returning error if it fails, cause request is sent only to formatter process)
		if isFormattingRequest {
			return sendToProc(formatterProc, message)
		}

		// send notifications and initialize request (failing silently if it fails, cause requests are also sent to main process)
		if isNotification || isInitializeRequest {
			// `initialize` itself must go straight through — it is what makes the
			// formatter ready. Everything else waits for its answer.
			if !isInitializeRequest && formatterProc != nil && h.queueForFormatter(formatterProc, message) {
				slog.Debug("holding state sync until the formatter initializes", "lsp", lspId, "method", method)
			} else if err := sendToProc(formatterProc, message); err != nil {
				slog.Warn("failed to send state sync to formatter process", "error", err, "lsp", lspId)
			}
		}
	}

	return sendToProc(mainProc, message)

}

func sendToProc(proc *lspProcess, message any) error {
	if proc == nil || proc.stdin == nil {
		return fmt.Errorf("LSP process not started")
	}

	content, err := json.Marshal(message)
	if err != nil {
		slog.Error("failed to marshal lsp message", "error", err)
		return err
	}

	header := fmt.Appendf(nil, "Content-Length: %d\r\n\r\n", len(content))

	proc.sendMu.Lock()
	defer proc.sendMu.Unlock()

	_, err = proc.stdin.Write(append(header, content...))
	if err != nil {
		slog.Error("failed to write message to lsp stdin", "error", err)
		return err
	}
	return nil
}

func (h *LSPHandler) stopIfMatch(proc *lspProcess) {
	slog.Info("stopIfMatch", "processId", proc.processId)

	h.stateMu.Lock()
	defer h.stateMu.Unlock()

	if current, ok := h.processes[proc.processId]; ok && current == proc {
		h.stopLocked(proc.processId)
	}
}

func getFormatterProcessId(lspId LspId) ProcessId {
	return ProcessId(string(lspId) + formatterSuffix)
}

func isFormatter(processId ProcessId) bool {
	return strings.HasSuffix(string(processId), formatterSuffix)
}

func getBaseLspId(processId ProcessId) LspId {
	return LspId(strings.TrimSuffix(string(processId), formatterSuffix))
}

func isInitializedNotification(message any) bool {
	msgMap, ok := message.(map[string]any)
	if !ok {
		return false
	}
	method, _ := msgMap["method"].(string)
	return method == methodInitialized
}
