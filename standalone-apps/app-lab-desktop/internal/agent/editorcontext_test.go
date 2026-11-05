package agent

import (
	"context"
	"errors"
	"io"
	"sort"
	"strings"
	"testing"

	acp "github.com/coder/acp-go-sdk"
)

func inView(path, content string) *EditorContext {
	return &EditorContext{File: &EditorFile{Path: path, Content: content}}
}

// The file goes with its content once; after that the agent knows it, until it changes.
func TestEditorContextTextSendsTheFileOnlyWhenItIsNew(t *testing.T) {
	text, seen := editorContextText(editorSeen{}, inView("python/main.py", "import time\n"), false)
	if !strings.Contains(text, "The user is looking at python/main.py") || !strings.Contains(text, "<file path=\"python/main.py\">\nimport time\n") {
		t.Fatalf("first prompt = %q, want the file named and its content", text)
	}

	if again, _ := editorContextText(seen, inView("python/main.py", "import time\n"), false); again != "" {
		t.Fatalf("same file = %q, want nothing", again)
	}

	edited, _ := editorContextText(seen, inView("python/main.py", "import os\n"), false)
	if !strings.Contains(edited, "import os") {
		t.Fatalf("edited file = %q, want its new content", edited)
	}
}

// Back on a file it already has, the agent learns the switch, not the content again.
func TestEditorContextTextNamesAKnownFileByItsPath(t *testing.T) {
	_, seen := editorContextText(editorSeen{}, inView("python/main.py", "import time\n"), false)
	_, seen = editorContextText(seen, inView("sketch/sketch.ino", "void setup() {}\n"), false)

	text, _ := editorContextText(seen, inView("python/main.py", "import time\n"), false)
	if strings.Contains(text, "import time") || !strings.Contains(text, "python/main.py (unchanged since you last saw it)") {
		t.Fatalf("known file = %q, want its path alone", text)
	}
}

func TestEditorContextTextSendsTheSelectionOnce(t *testing.T) {
	ec := inView("python/main.py", "if a == True:\n    blink()\n")
	ec.Selection = &EditorSelection{Path: "python/main.py", StartLine: 1, EndLine: 1, Text: "if a == True:"}
	text, seen := editorContextText(editorSeen{}, ec, false)
	if !strings.Contains(text, "<selection path=\"python/main.py\" lines=\"1-1\">\nif a == True:\n</selection>") {
		t.Fatalf("selection = %q, want the selected lines", text)
	}
	if again, _ := editorContextText(seen, ec, false); again != "" {
		t.Fatalf("same selection = %q, want nothing", again)
	}
}

func TestEditorContextTextKeepsALargeFileToItsPath(t *testing.T) {
	big := strings.Repeat("a", maxEditorContent+1)
	text, seen := editorContextText(editorSeen{}, inView("data.csv", big), false)
	if strings.Contains(text, big) || !strings.Contains(text, "data.csv (too large to include; read it if you need it)") {
		t.Fatalf("large file = %d bytes, want its path alone", len(text))
	}
	if _, known := seen.files["data.csv"]; known {
		t.Fatal("a file the agent never got must not count as seen")
	}
}

func TestEditorContextTextSaysNothingWithoutAFile(t *testing.T) {
	if text, _ := editorContextText(editorSeen{}, &EditorContext{}, false); text != "" {
		t.Fatalf("no file = %q, want nothing", text)
	}
}

// The agent must not keep believing what changed: a save, a cleared selection, a file no longer in view.
func TestEditorContextTextAnnouncesWhatNoLongerHolds(t *testing.T) {
	unsaved := inView("python/main.py", "import time\n")
	unsaved.File.Unsaved = true
	unsaved.Selection = &EditorSelection{Path: "python/main.py", StartLine: 1, EndLine: 1, Text: "import time"}
	_, seen := editorContextText(editorSeen{}, unsaved, false)

	saved, seen := editorContextText(seen, inView("python/main.py", "import time\n"), false)
	if !strings.Contains(saved, "now saved to the board") || !strings.Contains(saved, "no longer has code selected") {
		t.Errorf("after the save and the deselection = %q, want both announced", saved)
	}

	if gone, _ := editorContextText(seen, &EditorContext{}, false); !strings.Contains(gone, "no text file in view") {
		t.Errorf("no file in view = %q, want it announced", gone)
	}
}

func TestEditorContextTextAnnouncesAKnownFileThatGrewTooLarge(t *testing.T) {
	_, seen := editorContextText(editorSeen{}, inView("data.csv", "a,b\n"), false)

	text, next := editorContextText(seen, inView("data.csv", strings.Repeat("a", maxEditorContent+1)), false)
	if !strings.Contains(text, "changed since you last saw it, and now too large") {
		t.Fatalf("grown file = %q, want the agent told its copy is stale", text)
	}
	if _, known := next.files["data.csv"]; known {
		t.Fatal("the stale copy must not count as seen")
	}
}

func TestSlashCommandMatchesWhatTheCLIRuns(t *testing.T) {
	for text, want := range map[string]string{"/review main.py": "review", "/compact": "compact", "/mcp:board:tool x": "mcp:board:tool"} {
		if got, ok := slashCommand(text); !ok || got != want {
			t.Errorf("slashCommand(%q) = %q, %v; want %q", text, got, ok, want)
		}
	}
	for _, text := range []string{"// does this loop block?", "/etc/hosts is a file", "what does /review do?", ""} {
		if _, ok := slashCommand(text); ok {
			t.Errorf("slashCommand(%q) = command, want a plain message", text)
		}
	}
}

// recordingConn keeps what each prompt carried ahead of its text.
type recordingConn struct {
	fakeConn
	befores [][]string
	err     error
	during  func() // runs while the turn is in flight
}

func (r *recordingConn) Prompt(_ context.Context, _ SessionID, _ string, before []string) (bool, error) {
	r.befores = append(r.befores, before)
	cancels := r.cancels.Load()
	if r.during != nil {
		r.during()
	}
	return r.cancels.Load() > cancels, r.err
}

// A new session's first prompt names the file without its text (the CLI titles the session from it); the next one brings the text.
func TestManagerSendsWhatTheAgentHasNotSeenOfTheEditor(t *testing.T) {
	m, conn, sid := startRecording(t)
	ctx := context.Background()
	ec := inView("python/main.py", "import time\n")

	conn.err = errors.New("overloaded")
	_ = m.Prompt(ctx, sid, "what does it do?", ec)
	conn.err = nil
	_ = m.Prompt(ctx, sid, "what does it do?", ec)
	_ = m.Prompt(ctx, sid, "and now?", ec)
	_ = m.Prompt(ctx, sid, "and again?", ec)
	_ = m.Prompt(ctx, sid, "/review", inView("python/main.py", "import os\n"))
	_ = m.Prompt(ctx, sid, "from Agent Mode", nil)

	if len(conn.befores) != 6 {
		t.Fatalf("got %d prompts, want 6", len(conn.befores))
	}
	if len(conn.befores[1]) != 1 || !strings.Contains(conn.befores[1][0], "its text is not included") {
		t.Errorf("first prompt after a failed one = %v, want the file named without its text", conn.befores[1])
	}
	if len(conn.befores[2]) != 1 || !strings.Contains(conn.befores[2][0], "<file path=\"python/main.py\">\nimport time\n") {
		t.Errorf("second prompt = %v, want the file's text", conn.befores[2])
	}
	for i, why := range map[int]string{3: "nothing new", 4: "a slash command", 5: "no editor"} {
		if conn.befores[i] != nil {
			t.Errorf("prompt %d (%s) carried %v, want nothing", i, why, conn.befores[i])
		}
	}
}

func TestToUpdateDropsTheEditorContextOfAReplayedPrompt(t *testing.T) {
	replayed := func(text string) acp.SessionUpdate {
		return acp.SessionUpdate{UserMessageChunk: &acp.SessionUpdateUserMessageChunk{Content: acp.TextBlock(text)}}
	}
	if _, ok := toUpdate(replayed("<editor-context>\nThe user is looking at python/main.py in the code editor beside this chat.\n</editor-context>")); ok {
		t.Error("the editor context must not come back as a user message")
	}
	if u, ok := toUpdate(replayed("what does this code do?")); !ok || u.Delta != "what does this code do?" {
		t.Errorf("user text = %+v, %v; want it kept", u, ok)
	}
	if u, ok := toUpdate(replayed("<editor-context>\nThe user is looking at a.py in the code editor beside this chat.\n</editor-context>\nwhat does this code do?")); !ok || u.Delta != "what does this code do?" {
		t.Errorf("joined chunk = %+v, %v; want the user text alone", u, ok)
	}
}

func startRecording(t *testing.T) (*Manager, *recordingConn, SessionID) {
	t.Helper()
	conn := &recordingConn{}
	m := NewManager(stayAlive(),
		func(_ io.Writer, _ io.Reader, h ClientHandler) (AgentConn, error) {
			conn.handler = h
			return conn, nil
		},
		ManagerConfig{})
	ctx := context.Background()
	if err := m.Start(ctx); err != nil {
		t.Fatalf("start: %v", err)
	}
	t.Cleanup(func() { _ = m.Stop() })
	sid, err := m.NewSession(ctx, "/tmp", SessionWorkspace{})
	if err != nil {
		t.Fatalf("new session: %v", err)
	}
	return m, conn, sid
}

// Stopped before the CLI took the prompt, the turn may have dropped it, so the agent never saw the file.
func TestManagerResendsTheEditorAfterAStoppedTurn(t *testing.T) {
	m, conn, sid := startRecording(t)
	ctx := context.Background()
	ec := inView("python/main.py", "import time\n")
	_ = m.Prompt(ctx, sid, "hello", nil) // the session's first prompt, which the CLI titles it from

	conn.during = func() { _ = m.Cancel(ctx, sid) }
	_ = m.Prompt(ctx, sid, "what does it do?", ec)
	conn.during = nil
	_ = m.Prompt(ctx, sid, "what does it do?", ec)

	if len(conn.befores[2]) != 1 {
		t.Fatalf("after a stopped turn = %v, want the context again", conn.befores[2])
	}
}

// Compaction or /clear leaves the agent without the file it was shown.
func TestManagerResendsTheEditorAfterTheContextShrinks(t *testing.T) {
	m, conn, sid := startRecording(t)
	ctx := context.Background()
	ec := inView("python/main.py", "import time\n")
	_ = m.Prompt(ctx, sid, "hello", nil) // the session's first prompt, which the CLI titles it from

	_ = m.Prompt(ctx, sid, "what does it do?", ec)
	m.HandleUpdate(sid, Update{Type: "usage", UsedTokens: 120000})
	m.HandleUpdate(sid, Update{Type: "usage", UsedTokens: 30000})
	_ = m.Prompt(ctx, sid, "and now?", ec)
	_ = m.Prompt(ctx, sid, "/clear", ec)
	_ = m.Prompt(ctx, sid, "and after clearing?", ec)

	if len(conn.befores[2]) != 1 {
		t.Errorf("after compaction = %v, want the context again", conn.befores[2])
	}
	if conn.befores[3] != nil || len(conn.befores[4]) != 1 {
		t.Errorf("around /clear = %v then %v, want nothing with the command and the context after it", conn.befores[3], conn.befores[4])
	}
}

// The turn-end sync pushes only what the finishing chat touched while other chats run; a miss here pushes another chat's half-made edits, or strands this one's.
func TestATurnRecordsWhatItTouched(t *testing.T) {
	m, conn, sid := startRecording(t)
	ctx := context.Background()
	engine := &sdkConn{dialect: openCodeDialect, handler: m}
	conn.during = func() {
		m.HandleUpdate(sid, Update{Type: "tool_call", ToolCall: &ToolCall{ID: "c1", Title: "arduino-board_apps_start", Kind: "other", Input: map[string]any{"id": "app-started"}}})
		m.HandleUpdate(sid, Update{Type: "tool_call", ToolCall: &ToolCall{ID: "c2", Title: "edit", Kind: "edit", Paths: []string{"board__app-a-111111/python/main.py"}}})
		m.HandleUpdate(sid, Update{Type: "tool_call", ToolCall: &ToolCall{ID: "c3", Title: "read", Kind: "read", Paths: []string{"/tmp/board__app-b-222222/python/main.py"}}})
		// Announced bare, as OpenCode does; its update names the app but not the tool, and reaches the record through the connection.
		m.HandleUpdate(sid, Update{Type: "tool_call", ToolCall: &ToolCall{ID: "c4", Title: "arduino-board_apps_checkout", Kind: "other"}})
		_ = engine.SessionUpdate(ctx, runningCall("c4", map[string]any{"id": "app-checked-out"}))
	}
	_ = m.Prompt(ctx, sid, "do it", nil)
	conn.during = nil

	apps, paths := m.Touched(sid)
	sort.Strings(apps)
	if strings.Join(apps, ",") != "app-checked-out,app-started" {
		t.Errorf("apps = %v, want the two the board tools named", apps)
	}
	if len(paths) != 1 || paths[0] != "/tmp/board__app-a-111111/python/main.py" {
		t.Errorf("paths = %v, want the edited file, resolved against the session cwd", paths)
	}

	m.HandleUpdate(sid, Update{Type: "tool_call", ToolCall: &ToolCall{ID: "c5", Title: "arduino-board_apps_stop", Input: map[string]any{"id": "late"}}})
	if apps, _ := m.Touched(sid); len(apps) != 2 {
		t.Errorf("an update outside a turn was recorded: %v", apps)
	}
	// A rename is told to every chat that used the app, not only to those opened on it.
	m.RebindWorkspace("app-checked-out", "app-renamed", "Renamed")
	if got := m.SessionsNamingApp("app-renamed"); len(got) != 1 || got[0] != sid {
		t.Errorf("chats naming the renamed app = %v, want the one that checked it out", got)
	}
	_ = m.Prompt(ctx, sid, "next", nil)
	if apps, paths := m.Touched(sid); len(apps)+len(paths) != 0 {
		t.Errorf("the next turn starts with %v / %v, want nothing", apps, paths)
	}
}

// A note goes once and first, never in a command or the message the engine titles the session from, and survives a failed or stopped turn.
func TestANoteGoesOnceWithTheNextRealMessage(t *testing.T) {
	m, conn, sid := startRecording(t)
	ctx := context.Background()
	m.Notify(sid, "the app was renamed")
	m.Notify(sid, "the app was renamed") // the same note twice is one note

	_ = m.Prompt(ctx, sid, "hello", nil) // the first message, which titles the session
	_ = m.Prompt(ctx, sid, "/compact", nil)
	conn.err = errors.New("overloaded")
	_ = m.Prompt(ctx, sid, "failed", nil)
	conn.err = nil
	conn.during = func() { _ = m.Cancel(ctx, sid) }
	_ = m.Prompt(ctx, sid, "stopped", nil)
	conn.during = nil
	_ = m.Prompt(ctx, sid, "delivered", inView("python/main.py", "import time\n"))
	_ = m.Prompt(ctx, sid, "after", nil)

	hasNote := func(before []string) bool {
		return len(before) > 0 && strings.HasPrefix(before[0], "<app-lab-note>") && strings.Count(before[0], "the app was renamed") == 1
	}
	for i, want := range []bool{false, false, true, true, true, false} {
		if got := hasNote(conn.befores[i]); got != want {
			t.Errorf("prompt %d carried the note = %v, want %v (%q)", i, got, want, conn.befores[i])
		}
	}
	if len(conn.befores[4]) != 2 || !strings.HasPrefix(conn.befores[4][1], "<editor-context>") {
		t.Errorf("the delivering prompt = %q, want the note, then the editor block", conn.befores[4])
	}
}

// The replay shows the user's own words: the note blocks, the editor block and the scope paragraph are App Lab's.
func TestTheReplayShowsOnlyWhatTheUserTyped(t *testing.T) {
	replayed := func(text string) (Update, bool) {
		return toUpdate(acp.SessionUpdate{UserMessageChunk: &acp.SessionUpdateUserMessageChunk{Content: acp.TextBlock(text)}})
	}
	note := appLabNoteText([]string{"the app was renamed"})
	if u, ok := replayed(note); ok {
		t.Errorf("a note sent as its own block came back as %q", u.Delta)
	}
	editor, _ := editorContextText(editorSeen{}, inView("a.py", "print(1)\n"), false)
	if u, ok := replayed(note + "\n" + note + "\n" + editor + "\nwhat now?"); !ok || u.Delta != "what now?" {
		t.Errorf("joined chunk = %q, %v; want the user's text alone", u.Delta, ok)
	}
	focus := workspaceFocus(SessionWorkspace{AppID: "dXNlcjpibGluaw", Name: "Blink"})
	if u, ok := replayed("list the files" + focus); !ok || u.Delta != "list the files" {
		t.Errorf("first prompt = %q, %v; want it without the scope paragraph", u.Delta, ok)
	}
	// Claude Code writes a stopped turn into the history as a user message: it is the turn's stopped mark, not a bubble.
	for _, mark := range []string{"[Request interrupted by user]", "[Request interrupted by user for tool use]"} {
		if u, ok := replayed(mark); !ok || u.Type != "turn_stopped" {
			t.Errorf("the engine's stop mark came back as %+v, want the stopped turn's mark", u)
		}
	}
}

// The block may hold a file that itself contains the closing tag.
func TestToUpdateStripsABlockWhoseFileHoldsTheClosingTag(t *testing.T) {
	text, _ := editorContextText(editorSeen{}, inView("a.py", "print('</editor-context>')\n"), false)
	replayed := acp.SessionUpdate{UserMessageChunk: &acp.SessionUpdateUserMessageChunk{Content: acp.TextBlock(text)}}
	if u, ok := toUpdate(replayed); ok {
		t.Fatalf("replayed block = %+v, want it dropped whole", u)
	}
}

func TestEditorContextTextNamesTheFileWithoutItsTextWhenAsked(t *testing.T) {
	text, seen := editorContextText(editorSeen{}, inView("python/main.py", "import time\n"), true)
	if strings.Contains(text, "import time") || !strings.Contains(text, "python/main.py (its text is not included here; read it if you need it)") {
		t.Fatalf("path only = %q, want the file named without its text", text)
	}
	if _, known := seen.files["python/main.py"]; known {
		t.Fatal("a text the agent never got must not count as seen")
	}
}

// A compaction during the turn may drop what the turn's own prompt showed, so the turn must not record it as seen.
func TestManagerKeepsAResetThatHappensDuringTheTurn(t *testing.T) {
	m, conn, sid := startRecording(t)
	ctx := context.Background()
	ec := inView("python/main.py", "import time\n")
	_ = m.Prompt(ctx, sid, "hello", nil) // the session's first prompt, which the CLI titles it from
	m.HandleUpdate(sid, Update{Type: "usage", UsedTokens: 120000})

	conn.during = func() { m.HandleUpdate(sid, Update{Type: "usage", UsedTokens: 30000}) }
	_ = m.Prompt(ctx, sid, "what does it do?", ec)
	conn.during = nil
	_ = m.Prompt(ctx, sid, "what does it do?", ec)

	if len(conn.befores[2]) != 1 || !strings.Contains(conn.befores[2][0], "import time") {
		t.Fatalf("after a compaction during the turn = %v, want the file's text again", conn.befores[2])
	}
}

// A first prompt stopped before the CLI took it gave the session no title, so the next one must still leave the text out.
func TestManagerKeepsTheFirstPromptLightAfterAStoppedOne(t *testing.T) {
	m, conn, sid := startRecording(t)
	ctx := context.Background()
	ec := inView("python/main.py", "import time\n")

	conn.during = func() { _ = m.Cancel(ctx, sid) }
	_ = m.Prompt(ctx, sid, "what does it do?", ec)
	conn.during = nil
	_ = m.Prompt(ctx, sid, "what does it do?", ec)

	if len(conn.befores[1]) != 1 || strings.Contains(conn.befores[1][0], "import time") {
		t.Fatalf("after a stopped first prompt = %v, want the file named without its text", conn.befores[1])
	}
}
