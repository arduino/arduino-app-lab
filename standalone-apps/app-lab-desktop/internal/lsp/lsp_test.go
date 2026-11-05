package lsp

import (
	"bufio"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
	"time"
)

// readStderrLine must keep draining clangd's stderr no matter how long a single
// line is: a line over bufio.Scanner's 64KB token limit used to stop the reader
// for good, after which the stderr pipe filled and clangd blocked on its next
// write, wedging the language server. These cases pin the drain-always behavior.
func TestReadStderrLine(t *testing.T) {
	// A single line far larger than the retain cap, with no interior newline.
	huge := strings.Repeat("x", maxStderrLogLineBytes*3)
	input := "first INFO line\r\n" + huge + "\n" + "after huge WARN\n" + "no newline tail"
	reader := bufio.NewReader(strings.NewReader(input))

	// Line 1: a normal line, CRLF trimmed like bufio.Scanner did.
	line, err := readStderrLine(reader)
	if err != nil {
		t.Fatalf("line 1: unexpected error %v", err)
	}
	if line != "first INFO line" {
		t.Fatalf("line 1 = %q, want %q", line, "first INFO line")
	}

	// Line 2: the oversized line is retained only up to the cap, but is fully
	// consumed so reading can continue. This is the deadlock regression guard.
	line, err = readStderrLine(reader)
	if err != nil {
		t.Fatalf("oversized line: unexpected error %v", err)
	}
	if len(line) != maxStderrLogLineBytes {
		t.Fatalf("oversized line kept %d bytes, want cap %d", len(line), maxStderrLogLineBytes)
	}

	// Line 3: proves the reader recovered past the oversized line.
	line, err = readStderrLine(reader)
	if err != nil {
		t.Fatalf("line 3: unexpected error %v", err)
	}
	if line != "after huge WARN" {
		t.Fatalf("line 3 = %q, want %q", line, "after huge WARN")
	}

	// Line 4: a final line without a trailing newline is returned with io.EOF.
	line, err = readStderrLine(reader)
	if err != io.EOF {
		t.Fatalf("tail line: err = %v, want io.EOF", err)
	}
	if line != "no newline tail" {
		t.Fatalf("tail line = %q, want %q", line, "no newline tail")
	}

	// End of stream: no data, io.EOF.
	line, err = readStderrLine(reader)
	if line != "" || err != io.EOF {
		t.Fatalf("end of stream = (%q, %v), want (\"\", io.EOF)", line, err)
	}
}

// The recovery snapshot must track every didChange the client sends, or a
// crash/sketch restart replays didOpen-era text and silently desyncs all
// subsequent incremental edits. The client can't repair a stale replay itself:
// a rangeless full-content reset didChange panics the Arduino LS. These cases
// pin the folding: sequential application, ranged edits at UTF-16 positions,
// rangeless full replacement, and keep-previous-text on a bad range.
func TestRecordRecoveryStateFileChange(t *testing.T) {
	const lspId = LspId("python")
	const uri = "file:///ws/main.py"

	makeHandler := func(text string) (*LSPHandler, map[string]any) {
		storedDoc := map[string]any{"uri": uri, "text": text}
		h := &LSPHandler{
			openFiles: map[LspId]map[string]any{
				lspId: {
					uri: map[string]any{
						"method": methodDidOpen,
						"params": map[string]any{"textDocument": storedDoc},
					},
				},
			},
		}
		return h, storedDoc
	}

	position := func(line, character int) map[string]any {
		return map[string]any{"line": float64(line), "character": float64(character)}
	}
	ranged := func(startLine, startChar, endLine, endChar int, text string) map[string]any {
		return map[string]any{
			"range": map[string]any{
				"start": position(startLine, startChar),
				"end":   position(endLine, endChar),
			},
			"text": text,
		}
	}
	didChangeParams := func(changes ...any) map[string]any {
		return map[string]any{
			"textDocument":   map[string]any{"uri": uri},
			"contentChanges": changes,
		}
	}

	t.Run("folds a ranged single-line edit", func(t *testing.T) {
		h, doc := makeHandler("abc\ndef")
		h.recordRecoveryStateFileChange(lspId, didChangeParams(ranged(1, 1, 1, 2, "X")))
		if got := doc["text"]; got != "abc\ndXf" {
			t.Fatalf("text = %q, want %q", got, "abc\ndXf")
		}
	})

	t.Run("folds a multi-line replacement", func(t *testing.T) {
		h, doc := makeHandler("one\ntwo\nthree")
		h.recordRecoveryStateFileChange(lspId, didChangeParams(ranged(0, 2, 2, 3, "X")))
		if got := doc["text"]; got != "onXee" {
			t.Fatalf("text = %q, want %q", got, "onXee")
		}
	})

	t.Run("applies several changes sequentially, as sent (descending order)", func(t *testing.T) {
		// The client sends multiple changes with descending positions so each
		// applies against the doc produced by the previous one.
		h, doc := makeHandler("aa bb cc")
		h.recordRecoveryStateFileChange(lspId, didChangeParams(
			ranged(0, 6, 0, 8, "CC"),
			ranged(0, 0, 0, 2, "AA"),
		))
		if got := doc["text"]; got != "AA bb CC" {
			t.Fatalf("text = %q, want %q", got, "AA bb CC")
		}
	})

	t.Run("counts characters in UTF-16 code units", func(t *testing.T) {
		// 😀 is one rune but two UTF-16 units: "a😀b" has 'b' at units 3..4.
		h, doc := makeHandler("a\U0001F600b")
		h.recordRecoveryStateFileChange(lspId, didChangeParams(ranged(0, 3, 0, 4, "X")))
		if got := doc["text"]; got != "a\U0001F600X" {
			t.Fatalf("text = %q, want %q", got, "a\U0001F600X")
		}
	})

	t.Run("folds a rangeless full-document replacement", func(t *testing.T) {
		h, doc := makeHandler("old")
		h.recordRecoveryStateFileChange(lspId, didChangeParams(map[string]any{"text": "new full text"}))
		if got := doc["text"]; got != "new full text" {
			t.Fatalf("text = %q, want %q", got, "new full text")
		}
	})

	t.Run("keeps the previous text when a range is out of bounds", func(t *testing.T) {
		h, doc := makeHandler("short")
		h.recordRecoveryStateFileChange(lspId, didChangeParams(ranged(5, 0, 5, 1, "X")))
		if got := doc["text"]; got != "short" {
			t.Fatalf("text = %q, want %q", got, "short")
		}
	})

	t.Run("accumulates across successive didChanges", func(t *testing.T) {
		h, doc := makeHandler("v1")
		h.recordRecoveryStateFileChange(lspId, didChangeParams(ranged(0, 1, 0, 2, "2")))
		h.recordRecoveryStateFileChange(lspId, didChangeParams(ranged(0, 0, 0, 1, "V")))
		if got := doc["text"]; got != "V2" {
			t.Fatalf("text = %q, want %q", got, "V2")
		}
	})

	t.Run("clamps a character past the line end", func(t *testing.T) {
		h, doc := makeHandler("ab\ncd")
		// end character 99 on line 0 clamps to the line end (before the \n).
		h.recordRecoveryStateFileChange(lspId, didChangeParams(ranged(0, 1, 0, 99, "X")))
		if got := doc["text"]; got != "aX\ncd" {
			t.Fatalf("text = %q, want %q", got, "aX\ncd")
		}
	})
}

// The formatter process (ruff for python) receives the didOpen/didChange state
// sync it needs to format, but lints it too and publishes its own diagnostics
// for the same URIs the main LS analyzes. The client keeps diagnostics per URI
// (last publisher wins), so forwarding both sources makes them clobber each
// other non-deterministically — seen as ruff's yellow F405 ("may be undefined,
// or defined from star imports") flip-flopping with basedpyright's red
// ("is not defined") on the same symbol. Only the main process's diagnostics
// may reach the frontend.
func TestProcessMessageDropsFormatterDiagnostics(t *testing.T) {
	h := &LSPHandler{}
	payload := []byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///ws/main.py","diagnostics":[]}}`)

	formatterProc := &lspProcess{
		processId:  getFormatterProcessId(LSP_Python),
		eventLspId: LSP_Python,
	}
	if _, skip := h.processMessage(formatterProc, payload); !skip {
		t.Fatalf("formatter publishDiagnostics must be dropped")
	}

	mainProc := &lspProcess{
		processId:  ProcessId(LSP_Python),
		eventLspId: LSP_Python,
	}
	if msg, skip := h.processMessage(mainProc, payload); skip || msg == nil {
		t.Fatalf("main-process publishDiagnostics must be forwarded, got skip=%v msg=%v", skip, msg)
	}

	// Formatting responses (the formatter's whole purpose) still pass through.
	formatResponse := []byte(`{"jsonrpc":"2.0","id":7,"result":[]}`)
	if _, skip := h.processMessage(formatterProc, formatResponse); skip {
		t.Fatalf("formatter formatting response must be forwarded")
	}
}

// A dead formatter (crashed and out of restart budget — its process entry is
// removed and stays absent) must not block the main LS: waitForLSPReady used
// to require BOTH processes, so every send spun for the full timeout and
// failed, silently freezing diagnostics until app restart. Only an existing,
// still-starting formatter is worth waiting for.
func TestWaitForLSPReadyToleratesDeadFormatter(t *testing.T) {
	_, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer w.Close()

	h := &LSPHandler{
		activeLSPs: map[LspId]bool{LSP_Python: true},
		processes: map[ProcessId]*lspProcess{
			ProcessId(LSP_Python): {processId: ProcessId(LSP_Python), stdin: w},
			// no formatter entry: it crashed and gave up restarting
		},
	}

	mainProc, formatterProc, err := h.waitForLSPReady(LSP_Python)
	if err != nil {
		t.Fatalf("send path must survive a dead formatter, got error: %v", err)
	}
	if mainProc == nil || formatterProc != nil {
		t.Fatalf("want main only, got main=%v formatter=%v", mainProc, formatterProc)
	}
}

func TestWaitForLSPReadyWaitsThroughSketchRestart(t *testing.T) {
	_, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer w.Close()

	// Between restartLSP's stop and its start: inactive, no process.
	h := NewLSPHandler(nil, nil, nil)
	h.restarting[LSP_Arduino] = true

	go func() {
		time.Sleep(200 * time.Millisecond)
		h.stateMu.Lock()
		h.activeLSPs[LSP_Arduino] = true
		h.processes[ProcessId(LSP_Arduino)] = &lspProcess{processId: ProcessId(LSP_Arduino), stdin: w}
		h.stateMu.Unlock()
	}()

	mainProc, _, err := h.waitForLSPReady(LSP_Arduino)
	if err != nil {
		t.Fatalf("a send during a sketch restart must wait for the new process, got %v", err)
	}
	if mainProc == nil {
		t.Fatal("want the restarted process")
	}
}

func TestWaitForLSPReadyStopsWaitingAtStopAll(t *testing.T) {
	h := NewLSPHandler(nil, nil, nil)
	h.restarting[LSP_Arduino] = true

	go func() {
		time.Sleep(200 * time.Millisecond)
		h.StopAll()
	}()

	start := time.Now()
	if _, _, err := h.waitForLSPReady(LSP_Arduino); err == nil {
		t.Fatal("want an error once StopAll ran")
	}
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Fatalf("want the wait to end at StopAll, it took %v", elapsed)
	}
}

// readFramed reads one Content-Length framed message body from r.
func readFramed(t *testing.T, r *bufio.Reader) map[string]any {
	t.Helper()
	length, err := readHeader(r)
	if err != nil {
		t.Fatalf("read header: %v", err)
	}
	body := make([]byte, length)
	if _, err := io.ReadFull(r, body); err != nil {
		t.Fatalf("read body: %v", err)
	}
	var msg map[string]any
	if err := json.Unmarshal(body, &msg); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	return msg
}

// The formatter's readiness gates nothing on its own: waitForLSPReady is happy as
// soon as its process and stdin exist, and processMessage drops its initialize
// response so nothing downstream can tell it apart. Sending `initialized` and the
// first didOpen straight through meant ruff — which must ignore notifications that
// arrive before initialize completes — never registered the document, and rejected
// every later didChange with "Received change text document command for closed
// file". Formatting then stayed broken until a tab switch, because the client's
// only repair (resyncStaleDocument) is itself a didChange.
func TestFormatterStateSyncIsHeldUntilInitialize(t *testing.T) {
	mainR, mainW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer mainW.Close()
	fmtR, fmtW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer fmtW.Close()

	formatterId := getFormatterProcessId(LSP_Python)
	formatterProc := &lspProcess{processId: formatterId, eventLspId: LSP_Python, stdin: fmtW}
	mainProc := &lspProcess{processId: ProcessId(LSP_Python), stdin: mainW}

	h := &LSPHandler{
		activeLSPs:     map[LspId]bool{LSP_Python: true},
		processes:      map[ProcessId]*lspProcess{ProcessId(LSP_Python): mainProc, formatterId: formatterProc},
		formatterReady: map[ProcessId]bool{},
		formatterQueue: map[ProcessId][]any{},
	}

	didOpen := map[string]any{"method": "textDocument/didOpen", "params": map[string]any{"uri": "file:///ws/main.py"}}
	if err := h.sendToProcesses(LSP_Python, mainProc, formatterProc, didOpen); err != nil {
		t.Fatalf("sendToProcesses: %v", err)
	}

	// The main server gets it immediately — the hold must never delay the LS the
	// editor actually depends on.
	if got := readFramed(t, bufio.NewReader(mainR)); got["method"] != "textDocument/didOpen" {
		t.Fatalf("main process got %v, want didOpen", got["method"])
	}

	// The formatter is holding it, not dropping it.
	h.stateMu.RLock()
	held := len(h.formatterQueue[formatterId])
	h.stateMu.RUnlock()
	if held != 1 {
		t.Fatalf("formatter queue holds %d messages, want 1", held)
	}

	// Its initialize answer releases the queue, in order.
	h.markFormatterReady(formatterProc)

	fmtReader := bufio.NewReader(fmtR)
	if got := readFramed(t, fmtReader); got["method"] != methodInitialized {
		t.Fatalf("formatter got %v after initialize, want initialized", got["method"])
	}
	if got := readFramed(t, fmtReader); got["method"] != "textDocument/didOpen" {
		t.Fatalf("formatter got %v after initialized, want the held didOpen", got["method"])
	}
	h.stateMu.RLock()
	remaining := len(h.formatterQueue[formatterId])
	ready := h.formatterReady[formatterId]
	h.stateMu.RUnlock()
	if remaining != 0 || !ready {
		t.Fatalf("after flush: queued=%d ready=%v, want 0/true", remaining, ready)
	}
}

// The held didOpen is the recovery snapshot's own map, and every later didChange
// is folded into that map. If the queue held the map, the formatter would get
// the folded text and then the same didChange again.
func TestHeldDidOpenKeepsItsTextWhenLaterChangesAreFolded(t *testing.T) {
	mainR, mainW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer mainW.Close()
	defer mainR.Close()
	fmtR, fmtW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer fmtW.Close()

	formatterId := getFormatterProcessId(LSP_Python)
	formatterProc := &lspProcess{processId: formatterId, eventLspId: LSP_Python, stdin: fmtW}
	mainProc := &lspProcess{processId: ProcessId(LSP_Python), stdin: mainW}

	h := &LSPHandler{
		activeLSPs:         map[LspId]bool{LSP_Python: true},
		processes:          map[ProcessId]*lspProcess{ProcessId(LSP_Python): mainProc, formatterId: formatterProc},
		formatterReady:     map[ProcessId]bool{},
		formatterQueue:     map[ProcessId][]any{},
		openFiles:          map[LspId]map[string]any{},
		initializeRequests: map[LspId]any{},
	}

	const uri = "file:///ws/main.py"
	didOpen := map[string]any{"method": methodDidOpen, "params": map[string]any{
		"textDocument": map[string]any{"uri": uri, "version": float64(1), "text": "a = 1\n"},
	}}
	zero := map[string]any{"line": float64(0), "character": float64(0)}
	didChange := map[string]any{"method": "textDocument/didChange", "params": map[string]any{
		"textDocument":   map[string]any{"uri": uri, "version": float64(2)},
		"contentChanges": []any{map[string]any{"range": map[string]any{"start": zero, "end": zero}, "text": "x=1\n"}},
	}}
	for _, msg := range []any{didOpen, didChange} {
		if err := h.deliver(LSP_Python, mainProc, formatterProc, msg); err != nil {
			t.Fatalf("deliver: %v", err)
		}
	}

	h.markFormatterReady(formatterProc)

	fmtReader := bufio.NewReader(fmtR)
	readFramed(t, fmtReader) // initialized
	held := readFramed(t, fmtReader)
	text := held["params"].(map[string]any)["textDocument"].(map[string]any)["text"]
	if text != "a = 1\n" {
		t.Fatalf("held didOpen text = %q, want the text it was sent with", text)
	}
}

// A crash restarts one process. The other one already has this state, and a
// second initialize and didOpen make the client drop its diagnostics.
func TestCrashReplayReachesOnlyTheRestartedProcess(t *testing.T) {
	formatterId := getFormatterProcessId(LSP_Python)
	for _, tc := range []struct {
		target        ProcessId
		wantMain      []string
		wantFormatter []string
		wantHeld      int
	}{
		{target: formatterId, wantFormatter: []string{methodInitialize}, wantHeld: 1},
		{target: ProcessId(LSP_Python), wantMain: []string{methodInitialize, methodInitialized, methodDidChangeConfig, methodDidOpen}},
	} {
		t.Run(string(tc.target), func(t *testing.T) {
			mainR, mainW, err := os.Pipe()
			if err != nil {
				t.Fatal(err)
			}
			fmtR, fmtW, err := os.Pipe()
			if err != nil {
				t.Fatal(err)
			}
			h := &LSPHandler{
				activeLSPs: map[LspId]bool{LSP_Python: true},
				processes: map[ProcessId]*lspProcess{
					ProcessId(LSP_Python): {processId: ProcessId(LSP_Python), stdin: mainW},
					formatterId:           {processId: formatterId, eventLspId: LSP_Python, stdin: fmtW},
				},
				formatterReady:     map[ProcessId]bool{},
				formatterQueue:     map[ProcessId][]any{},
				initializeRequests: map[LspId]any{LSP_Python: map[string]any{"id": float64(1), "method": methodInitialize}},
				openFiles: map[LspId]map[string]any{LSP_Python: {
					"file:///ws/main.py": map[string]any{"method": methodDidOpen, "params": map[string]any{}},
				}},
			}

			h.replayStateAfterRestart(LSP_Python, tc.target)

			if got := readMethods(t, mainW, mainR); !slices.Equal(got, tc.wantMain) {
				t.Errorf("main process got %v, want %v", got, tc.wantMain)
			}
			if got := readMethods(t, fmtW, fmtR); !slices.Equal(got, tc.wantFormatter) {
				t.Errorf("formatter got %v, want %v", got, tc.wantFormatter)
			}
			if held := len(h.formatterQueue[formatterId]); held != tc.wantHeld {
				t.Errorf("formatter holds %d messages, want %d", held, tc.wantHeld)
			}
		})
	}
}

// readMethods closes w and returns the method of every framed message left in r.
func readMethods(t *testing.T, w *os.File, r *os.File) []string {
	t.Helper()
	w.Close()
	reader := bufio.NewReader(r)
	var methods []string
	for {
		if _, err := reader.Peek(1); err == io.EOF {
			return methods
		}
		method, _ := readFramed(t, reader)["method"].(string)
		methods = append(methods, method)
	}
}

// ruff accepts nothing but `initialized` right after its initialize answer, and
// exits on anything else ("expected initialized notification, got: ...
// textDocument/didOpen"). The client sends `initialized` and its didOpens in the
// same tick, and Wails runs each binding call on its own goroutine, so they can
// reach sendToProcesses in either order, before or after the formatter answers.
func TestFormatterGetsInitializedFirstInAnyClientOrder(t *testing.T) {
	formatterId := getFormatterProcessId(LSP_Python)
	didOpen := map[string]any{"method": methodDidOpen, "params": map[string]any{"uri": "file:///ws/main.py"}}
	initialized := map[string]any{"method": methodInitialized, "params": map[string]any{}}

	setup := func(t *testing.T) (h *LSPHandler, mainProc, formatterProc *lspProcess, fmtR, fmtW *os.File) {
		_, mainW, err := os.Pipe()
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { mainW.Close() })
		fmtR, fmtW, err = os.Pipe()
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { fmtR.Close() })
		formatterProc = &lspProcess{processId: formatterId, eventLspId: LSP_Python, stdin: fmtW}
		mainProc = &lspProcess{processId: ProcessId(LSP_Python), stdin: mainW}
		h = &LSPHandler{
			activeLSPs:     map[LspId]bool{LSP_Python: true},
			processes:      map[ProcessId]*lspProcess{ProcessId(LSP_Python): mainProc, formatterId: formatterProc},
			formatterReady: map[ProcessId]bool{},
			formatterQueue: map[ProcessId][]any{},
		}
		return h, mainProc, formatterProc, fmtR, fmtW
	}

	t.Run("didOpen arrives first, formatter answers after both", func(t *testing.T) {
		h, mainProc, formatterProc, fmtR, fmtW := setup(t)
		for _, msg := range []any{didOpen, initialized} {
			if err := h.sendToProcesses(LSP_Python, mainProc, formatterProc, msg); err != nil {
				t.Fatalf("sendToProcesses: %v", err)
			}
		}
		h.markFormatterReady(formatterProc)

		got := readMethods(t, fmtW, fmtR)
		if want := []string{methodInitialized, methodDidOpen}; !slices.Equal(got, want) {
			t.Fatalf("formatter got %v, want %v", got, want)
		}
	})

	t.Run("formatter answers before the client sends anything", func(t *testing.T) {
		h, mainProc, formatterProc, fmtR, fmtW := setup(t)
		h.markFormatterReady(formatterProc)
		for _, msg := range []any{didOpen, initialized} {
			if err := h.sendToProcesses(LSP_Python, mainProc, formatterProc, msg); err != nil {
				t.Fatalf("sendToProcesses: %v", err)
			}
		}

		got := readMethods(t, fmtW, fmtR)
		if want := []string{methodInitialized, methodDidOpen}; !slices.Equal(got, want) {
			t.Fatalf("formatter got %v, want %v", got, want)
		}
	})
}

// Once the handshake is done, nothing is held — a formatter that has to wait for
// every message would lag the document it formats.
func TestFormatterStateSyncPassesThroughAfterInitialize(t *testing.T) {
	fmtR, fmtW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer fmtW.Close()
	_, mainW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer mainW.Close()

	formatterId := getFormatterProcessId(LSP_Python)
	formatterProc := &lspProcess{processId: formatterId, eventLspId: LSP_Python, stdin: fmtW}
	mainProc := &lspProcess{processId: ProcessId(LSP_Python), stdin: mainW}

	h := &LSPHandler{
		activeLSPs:     map[LspId]bool{LSP_Python: true},
		processes:      map[ProcessId]*lspProcess{ProcessId(LSP_Python): mainProc, formatterId: formatterProc},
		formatterReady: map[ProcessId]bool{formatterId: true},
		formatterQueue: map[ProcessId][]any{},
	}

	change := map[string]any{"method": "textDocument/didChange", "params": map[string]any{}}
	if err := h.sendToProcesses(LSP_Python, mainProc, formatterProc, change); err != nil {
		t.Fatalf("sendToProcesses: %v", err)
	}

	if got := readFramed(t, bufio.NewReader(fmtR)); got["method"] != "textDocument/didChange" {
		t.Fatalf("formatter got %v, want didChange delivered straight through", got["method"])
	}
	h.stateMu.RLock()
	held := len(h.formatterQueue[formatterId])
	h.stateMu.RUnlock()
	if held != 0 {
		t.Fatalf("queued %d messages after initialize, want 0", held)
	}
}

// A formatter that exits without initialising must not leave its hold behind: the
// queue would sit full until the app closed.
func TestFormatterHandshakeResetOnExit(t *testing.T) {
	formatterId := getFormatterProcessId(LSP_Python)
	h := &LSPHandler{
		formatterReady: map[ProcessId]bool{formatterId: true},
		formatterQueue: map[ProcessId][]any{formatterId: {map[string]any{"method": "textDocument/didOpen"}}},
	}

	h.resetFormatterHandshake(formatterId)

	if len(h.formatterQueue[formatterId]) != 0 || h.formatterReady[formatterId] {
		t.Fatalf("handshake state survived the exit: queued=%d ready=%v",
			len(h.formatterQueue[formatterId]), h.formatterReady[formatterId])
	}
}

// Both shapes of clangd failure have to be recognised, or the probe never runs and
// nothing reaches the UI. "error starting clang" is a failed compile; "Lost
// connection with clangd!" is a clangd that started and died — which on Windows is
// a missing MSVC runtime DLL, and reports a perfectly successful compile.
func TestClangStartFailedRecognisesBothShapes(t *testing.T) {
	failing := []string{
		`16:47:12 INIT --- : error starting clang: running --config-file ... compile ...: exit status 1`,
		`01:08:13.202574 INIT --- : Lost connection with clangd!`,
	}
	for _, line := range failing {
		if !clangStartFailed(line) {
			t.Errorf("clangStartFailed(%q) = false, want true", line)
		}
	}

	// Ordinary traffic must not trigger a full diagnostic compile on every line.
	healthy := []string{
		`01:08:13.177960 INIT --- :     Starting clangd: C:\...\clangd.exe -log=verbose`,
		`01:05:43.723116 INIT --- : arduino-cli output: {`,
		`textDocument/didOpen: (throttled: waiting for clangd)`,
		`IDE     LS --> Clangd REQU initialize 1`,
	}
	for _, line := range healthy {
		if clangStartFailed(line) {
			t.Errorf("clangStartFailed(%q) = true, want false", line)
		}
	}
}

// writeFakeTool plants a stand-in for one of the bundled binaries at a temp path.
func writeFakeTool(t *testing.T, name, script string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

// The check must pass anything that answers like node, or it would take the four
// JavaScript language servers down over a healthy install.
func TestVerifyNodeExecutableAcceptsAWorkingNode(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the stand-in is a /bin/sh script")
	}

	node := writeFakeTool(t, "node", "#!/bin/sh\necho v24.18.0\n")

	if err := verifyNodeExecutableAt(node, toolVerifyTimeout); err != nil {
		t.Fatalf("verifyNodeExecutableAt() = %v, want nil", err)
	}
}

// Dying is not the only way a bundled binary fails to run. One that hangs — an
// antivirus holding it, a filesystem that never answers — used to park Start
// forever on a context.Background() wait, and Start is called from restartLSP
// while the send mutex is held, so the hang reached the editor.
func TestVerifyNodeExecutableTimesOutOnAHangingNode(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the stand-in is a /bin/sh script")
	}

	// Touches a file only if it outlives the deadline, which is how the child
	// being killed rather than merely abandoned is observable from here.
	survived := filepath.Join(t.TempDir(), "survived")
	node := writeFakeTool(t, "node", "#!/bin/sh\nsleep 10\ntouch "+survived+"\n")

	start := time.Now()
	err := verifyNodeExecutableAt(node, 300*time.Millisecond)
	elapsed := time.Since(start)

	if err == nil {
		t.Fatal("verifyNodeExecutableAt() = nil, want a timeout")
	}
	if elapsed > 5*time.Second {
		t.Errorf("waited %s: the deadline was not enforced", elapsed)
	}
	// "signal: killed" is what the process reports; the message has to say what
	// actually happened, since this is all a support log will have.
	if !strings.Contains(err.Error(), "timed out") {
		t.Errorf("error does not report a timeout: %v", err)
	}
	if !strings.Contains(err.Error(), node) {
		t.Errorf("error %q does not name the binary %q", err, node)
	}

	time.Sleep(600 * time.Millisecond)
	if _, statErr := os.Stat(survived); statErr == nil {
		t.Error("the hanging child kept running after the deadline")
	}
}

// A node that runs but answers with something else is not a node we can hand a
// language server to.
func TestVerifyNodeExecutableRejectsAnUnexpectedAnswer(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the stand-in is a /bin/sh script")
	}

	node := writeFakeTool(t, "node", "#!/bin/sh\necho not a version\n")

	if err := verifyNodeExecutableAt(node, toolVerifyTimeout); err == nil {
		t.Fatal("verifyNodeExecutableAt() = nil, want an error")
	}
}

func TestStopAllDropsTheRecoverySnapshot(t *testing.T) {
	h := NewLSPHandler(nil, nil, nil)
	h.initializeRequests[LSP_Arduino] = map[string]any{"method": methodInitialize}
	h.openFiles[LSP_Arduino] = map[string]any{"file:///ws/app/sketch/helper.h": map[string]any{}}

	h.StopAll()

	if len(h.initializeRequests) != 0 || len(h.openFiles) != 0 {
		t.Errorf("want the snapshot gone after StopAll, got %v / %v", h.initializeRequests, h.openFiles)
	}
}

func TestRestartStartedBeforeStopAllDoesNotStartAgain(t *testing.T) {
	h := NewLSPHandler(nil, nil, nil)
	gen := h.stopGen

	h.StopAll()

	if err := h.startIfCurrent(LSP_Arduino, "/ws/app", gen); !errors.Is(err, errStoppedMeanwhile) {
		t.Fatalf("got %v, want errStoppedMeanwhile", err)
	}
	if h.activeLSPs[LSP_Arduino] {
		t.Error("want the LSP left inactive")
	}
}

func TestSketchWatchedChangeCountsDeletedFolders(t *testing.T) {
	h := &LSPHandler{appDir: filepath.FromSlash("/home/me/ws")}
	message := func(rel string, changeType float64) map[string]any {
		return map[string]any{
			"method": methodDidChangeWatchedFiles,
			"params": map[string]any{"changes": []any{map[string]any{
				"uri":  "file:///home/me/ws/" + rel,
				"type": changeType,
			}}},
		}
	}
	const created, deleted = float64(1), float64(3)

	for _, tt := range []struct {
		rel        string
		changeType float64
		want       bool
	}{
		{"sketch/src", deleted, true},
		{"sketch/src/x.h", deleted, true},
		{"sketch/src/x.h", created, true},
		// The client announces a created folder's sources itself, which
		// restarts once; the folder event must not restart a second time.
		{"sketch/src", created, false},
		{"sketch/notes.txt", deleted, false},
		{"python/pkg", deleted, false},
	} {
		if got := h.isSketchWatchedChange(message(tt.rel, tt.changeType)); got != tt.want {
			t.Errorf("%s (type %v): got %v, want %v", tt.rel, tt.changeType, got, tt.want)
		}
	}
}

func TestPendingSketchRestartAfterStopAllDoesNothing(t *testing.T) {
	h := NewLSPHandler(nil, nil, nil)
	gen := h.stopGen
	h.restartPending[LSP_Arduino] = true

	h.StopAll()
	h.restartLSP(LSP_Arduino, gen)

	if h.restartPending[LSP_Arduino] {
		t.Error("want StopAll to drop the pending restart")
	}
	if h.activeLSPs[LSP_Arduino] {
		t.Error("want the LSP left inactive")
	}
}

func TestSendsToADeadLSPFailAtOnce(t *testing.T) {
	// Start set it active, and then its process died for good.
	h := NewLSPHandler(nil, nil, nil)
	h.activeLSPs[LSP_Arduino] = true

	h.deactivateIfDead(LSP_Arduino, h.stopGen)

	start := time.Now()
	if _, _, err := h.waitForLSPReady(LSP_Arduino); err == nil {
		t.Fatal("want an error for a dead LSP")
	}
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("want the send to fail at once, it waited %v", elapsed)
	}
}

func TestDeactivateIfDeadKeepsALiveLSP(t *testing.T) {
	_, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer w.Close()

	t.Run("its process runs", func(t *testing.T) {
		h := NewLSPHandler(nil, nil, nil)
		h.activeLSPs[LSP_Arduino] = true
		h.processes[ProcessId(LSP_Arduino)] = &lspProcess{processId: ProcessId(LSP_Arduino), stdin: w}

		h.deactivateIfDead(LSP_Arduino, h.stopGen)

		if !h.activeLSPs[LSP_Arduino] {
			t.Error("want a running LSP left active")
		}
	})

	t.Run("it belongs to the next app", func(t *testing.T) {
		h := NewLSPHandler(nil, nil, nil)
		gen := h.stopGen
		h.StopAll()
		h.activeLSPs[LSP_Arduino] = true

		h.deactivateIfDead(LSP_Arduino, gen)

		if !h.activeLSPs[LSP_Arduino] {
			t.Error("want the next app's LSP left active")
		}
	})
}
