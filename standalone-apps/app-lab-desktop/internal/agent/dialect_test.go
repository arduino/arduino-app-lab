package agent

import (
	"app-lab-desktop/internal/airuntime"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

// Auto-approval matches the exact name, so the wrong engine's naming prompts for everything, silently.
func TestDialectQualifiesToolsPerEngine(t *testing.T) {
	if got, want := claudeDialect.QualifyTool("arduino-board", "apps_list"), "mcp__arduino-board__apps_list"; got != want {
		t.Errorf("claude QualifyTool = %q, want %q", got, want)
	}
	if got, want := openCodeDialect.QualifyTool("arduino-board", "apps_list"), "arduino-board_apps_list"; got != want {
		t.Errorf("opencode QualifyTool = %q, want %q", got, want)
	}
}

// An engine that ignores _meta must be sent none, so the omission is visible rather than assumed.
func TestOpenCodeDialectSendsNoSessionEnvelope(t *testing.T) {
	if openCodeDialect.SessionMeta != nil {
		t.Error("openCodeDialect must not build a session envelope: OpenCode discards _meta without an error")
	}
	if claudeDialect.SessionMeta == nil {
		t.Error("claudeDialect must build a session envelope: it is the only channel the adapter reads")
	}
}

// Turns "registered an agent, forgot its dialect" into a failure here rather than at first launch.
func TestEveryRegisteredAgentHasADialect(t *testing.T) {
	for _, id := range airuntime.SupportedAgents() {
		d, err := DialectFor(id)
		if err != nil {
			t.Errorf("%s: %v", id, err)
			continue
		}
		if d.QualifyTool == nil {
			t.Errorf("%s: no QualifyTool, so no MCP tool can be auto-approved", id)
		}
		if d.SessionMeta == nil && d.LaunchConfig == nil {
			t.Errorf("%s: neither a session envelope nor a launch config, so its policy reaches nothing", id)
		}
		if d.MCPInLaunchConfig && d.LaunchConfig == nil {
			t.Errorf("%s: sends no MCP server in its sessions and has no launch config to carry one, so it has no board tools", id)
		}
	}
}

// OpenCode rebuilds the MCP client every session shares when a session request names a server: a board call running in another chat dies.
func TestOpenCodeSessionsResendNoMCPServer(t *testing.T) {
	servers := []MCPServer{{URL: "http://127.0.0.1:1/mcp", Token: "t"}}
	for name, c := range map[string]struct {
		dialect Dialect
		want    int
	}{"opencode": {openCodeDialect, 0}, "claude": {claudeDialect, 1}} {
		conn := &sdkConn{dialect: c.dialect}
		conn.SetMCPServers(servers)
		if got := len(conn.acpMcpServers()); got != c.want {
			t.Errorf("%s: session requests carry %d MCP servers, want %d", name, got, c.want)
		}
	}
}

// Another engine's dialect would drop auto-approval and our policy without a word.
func TestDialectForRefusesAnUnknownAgent(t *testing.T) {
	if _, err := DialectFor("some-future-agent"); err == nil {
		t.Error("DialectFor accepted an agent with no registered dialect")
	}
}

// The only channel OpenCode has for a tool policy, so its names must match what the engine reports.
func TestOpenCodeLaunchConfigGatesTheTools(t *testing.T) {
	raw, err := openCodeLaunchConfig(LaunchInput{
		BoardName:  "Arduino VentunoQ",
		MCPServers: []MCPServer{{URL: "http://127.0.0.1:1/mcp", Token: "t", ReadOnlyTools: []string{"apps_list", "board_exec"}, CallTimeout: 12 * time.Minute}},
	})
	if err != nil {
		t.Fatalf("openCodeLaunchConfig: %v", err)
	}
	var cfg struct {
		Permission map[string]any `json:"permission"`
		MCP        map[string]struct {
			Type    string            `json:"type"`
			URL     string            `json:"url"`
			Headers map[string]string `json:"headers"`
			Timeout int64             `json:"timeout"`
		} `json:"mcp"`
		Server                  map[string]any `json:"server"`
		DisableClaudeCodePrompt bool           `json:"disableClaudeCodePrompt"`
		Agent                   map[string]struct {
			Permission map[string]any `json:"permission"`
		} `json:"agent"`
		Formatter any `json:"formatter"`
		LSP       any `json:"lsp"`
	}
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		t.Fatalf("not valid JSON: %v", err)
	}

	if got := cfg.Agent["build"].Permission["edit"]; got != "ask" {
		t.Errorf("build agent edit = %v, want ask: a file change is the user's to approve", got)
	}
	// The engine merges the global rules after plan's own "edit: deny", so a global one would let plan mode write.
	if got, ok := cfg.Permission["edit"]; ok {
		t.Errorf("global edit = %v, want none", got)
	}
	if _, ok := cfg.Agent["plan"]; ok {
		t.Error("plan agent overridden: its own rules deny edits")
	}

	// Named the way OpenCode will report them — a single underscore, not Claude's double.
	if got := cfg.Permission["arduino-board_apps_list"]; got != "allow" {
		t.Errorf("read-only board tool = %v, want allow", got)
	}
	if got := cfg.Permission["arduino-board_*"]; got != "ask" {
		t.Errorf("board tools default = %v, want ask", got)
	}
	// board_exec is read-only in no sense that matters: it must never be pre-approved, whatever the list says.
	if _, ok := cfg.Permission["arduino-board_board_exec"]; ok {
		t.Error("board_exec must not get its own permission entry: the wildcard has to keep asking")
	}
	// Only the bare string removes the tool; a pattern map keeps it, and a command the engine cannot parse skips every pattern.
	if cfg.Permission["bash"] != "deny" {
		t.Errorf("bash = %v, want deny: the engine's own shell runs on the host", cfg.Permission["bash"])
	}
	if !cfg.DisableClaudeCodePrompt {
		t.Error("the user's ~/.claude/CLAUDE.md must not be read into the prompt")
	}
	// An explicit false, not an absent key: the launch config is merged last, so only a value beats a config that turns them on.
	if cfg.Formatter != false || cfg.LSP != false {
		t.Errorf("formatter = %v, lsp = %v, want both false: they run host processes outside the permission rules", cfg.Formatter, cfg.LSP)
	}
	if cfg.Server["hostname"] != "127.0.0.1" || cfg.Server["mdns"] != false {
		t.Errorf("server block = %v, want loopback and no mDNS", cfg.Server)
	}
	board := cfg.MCP["arduino-board"]
	if board.Type != "remote" || board.URL != "http://127.0.0.1:1/mcp" || board.Headers["Authorization"] != "Bearer t" {
		t.Errorf("board MCP server = %+v, want a remote server carrying the bearer", board)
	}
	// The engine's own limit is 60 s, so a 90 s wait or a long board_exec would fail while still running.
	if board.Timeout != 720000 {
		t.Errorf("board MCP timeout = %d ms, want 720000", board.Timeout)
	}
}

// With no session envelope the paragraph rides the prompt, once: from then on it is in the transcript.
func TestFocusRidesTheFirstPromptOnceOnly(t *testing.T) {
	c := &sdkConn{dialect: openCodeDialect}
	ws := SessionWorkspace{AppID: "user:blink", Name: "Blink"}

	c.armFocus("s1", ws)
	first := c.takeFocus("s1")
	if first == "" || !strings.Contains(first, "Blink") {
		t.Fatalf("first prompt carried %q, want the scope paragraph naming the app", first)
	}
	if again := c.takeFocus("s1"); again != "" {
		t.Errorf("second prompt carried %q, want nothing", again)
	}
}

// The engine runs a command instead of sending its text, so a /compact as the first message would lose the paragraph.
func TestACommandLeavesTheFocusForTheNextMessage(t *testing.T) {
	c := &sdkConn{dialect: openCodeDialect}
	c.armFocus("s1", SessionWorkspace{AppID: "user:blink", Name: "Blink"})
	if got := c.focusFor("s1", "/compact"); got != "" {
		t.Errorf("a command carried %q", got)
	}
	if got := c.focusFor("s1", "what does it do?"); !strings.Contains(got, "Blink") {
		t.Errorf("the first message after the command carried %q, want the paragraph", got)
	}
}

// A general session is scoped to the whole board, which the rest of the prompt already describes.
func TestNoFocusForAGeneralSession(t *testing.T) {
	c := &sdkConn{dialect: openCodeDialect}
	c.armFocus("s1", SessionWorkspace{})
	if got := c.takeFocus("s1"); got != "" {
		t.Errorf("general session carried %q, want nothing", got)
	}
}

// Claude reads the paragraph from the session envelope, so putting it in the prompt too would send it twice.
func TestClaudeCarriesNoPromptFocus(t *testing.T) {
	if claudeDialect.PromptFocus != nil {
		t.Error("claudeDialect must leave the focus to its session envelope")
	}
	c := &sdkConn{dialect: claudeDialect}
	c.armFocus("s1", SessionWorkspace{AppID: "user:blink", Name: "Blink"})
	if got := c.takeFocus("s1"); got != "" {
		t.Errorf("claude session carried %q in the prompt, want nothing", got)
	}
}

// The instructions setting takes a path, so the prompt reaches the engine only as a file.
func TestOpenCodeInstructionsCarryTheBoardButNotTheSession(t *testing.T) {
	rel, data := openCodeInstructions(LaunchInput{BoardName: "Arduino VentunoQ"})
	if rel != "AGENTS.md" {
		t.Errorf("instruction file = %q, want AGENTS.md: it is the first one the engine looks for", rel)
	}
	body := string(data)
	if !strings.Contains(body, "Arduino VentunoQ") {
		t.Error("instructions must describe the connected board")
	}
	// The session focus names an app; a file written once per launch cannot know which.
	if strings.Contains(body, "Workspace. The user opened this session") {
		t.Error("the per-session focus must not be in a per-launch file")
	}
}

// The policy of an engine that ignores _meta travels in one variable, so it must name it.
func TestAnEngineWithoutASessionEnvelopeNamesItsConfigVariable(t *testing.T) {
	for _, id := range airuntime.SupportedAgents() {
		d, err := DialectFor(id)
		if err != nil {
			t.Errorf("%s: %v", id, err)
			continue
		}
		switch {
		case d.LaunchConfig != nil && d.LaunchConfigEnv == "":
			t.Errorf("%s: builds a launch config with no variable to carry it, so the policy reaches nothing", id)
		case d.LaunchConfig == nil && d.LaunchConfigEnv != "":
			t.Errorf("%s: names %q but builds nothing to put in it", id, d.LaunchConfigEnv)
		}
	}
	if openCodeDialect.LaunchConfigEnv != "OPENCODE_CONFIG_CONTENT" {
		t.Errorf("opencode config variable = %q; the engine reads its policy from that name alone", openCodeDialect.LaunchConfigEnv)
	}
	// Claude's options are read from the session envelope, so a second channel would be two policies.
	if claudeDialect.LaunchConfig != nil || claudeDialect.LaunchConfigEnv != "" {
		t.Error("claudeDialect carries a launch config as well as its session envelope")
	}
}

// Both engines must be told the same two things; one delivery losing one of them is silent.
func TestBothEnginesAreToldTheOutputStyleAndTheBoard(t *testing.T) {
	const board = "Arduino VentunoQ"
	meta := claudeSessionMeta(nil, board, SessionWorkspace{AppID: "user:blink", Name: "Blink"})
	prompt, ok := meta["systemPrompt"].(map[string]any)
	if !ok {
		t.Fatal("claude meta carries no systemPrompt")
	}
	claudeText := asString(prompt["append"])
	_, data := openCodeInstructions(LaunchInput{BoardName: board})
	openCodeText := string(data)

	for name, text := range map[string]string{"claude": claudeText, "opencode": openCodeText} {
		if !strings.Contains(text, "Output style for the Arduino App Lab assistant UI") {
			t.Errorf("%s: the chat output style is missing, so it would narrate every step", name)
		}
		if !strings.Contains(text, board) {
			t.Errorf("%s: the connected board is not named", name)
		}
		if !strings.Contains(text, "never a shell") {
			t.Errorf("%s: the board operating rules are missing", name)
		}
	}
	// Claude has no instruction file, so its own session envelope is the only place the focus fits.
	if !strings.Contains(claudeText, "Workspace. The user opened this session") {
		t.Error("claude's envelope must carry the session's workspace focus: it has no other channel")
	}
	if claudeDialect.LaunchInstructions != nil {
		t.Error("claudeDialect writes an instruction file; the adapter reads its prompt from _meta")
	}
}

// A board MCP server whose start failed leaves none: the config must still deny the engine's own tools.
func TestOpenCodeLaunchConfigDeniesTheEngineToolsWithNoBoardServer(t *testing.T) {
	raw, err := openCodeLaunchConfig(LaunchInput{BoardName: "Arduino UNO Q"})
	if err != nil {
		t.Fatalf("openCodeLaunchConfig: %v", err)
	}
	var cfg struct {
		Permission map[string]any `json:"permission"`
		MCP        map[string]any `json:"mcp"`
	}
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		t.Fatalf("not valid JSON: %v", err)
	}
	for _, tool := range []string{"bash", "task", "webfetch", "websearch"} {
		if cfg.Permission[tool] != "deny" {
			t.Errorf("%s = %v, want deny", tool, cfg.Permission[tool])
		}
	}
	if dir, ok := cfg.Permission["external_directory"].(map[string]any); !ok || dir["*"] != "deny" {
		t.Errorf("external_directory = %v, want denied: the engine must stay in the mirror", cfg.Permission["external_directory"])
	}
	// No server, so no board entry and no board permissions to restate.
	if len(cfg.MCP) != 0 {
		t.Errorf("mcp = %v, want nothing declared", cfg.MCP)
	}
	if _, ok := cfg.Permission[openCodeToolName(boardMCPServerName, "*")]; ok {
		t.Error("board tools were gated for a board server that does not exist")
	}
}

// The focus is per session, so two sessions must not drain each other's, and a closed one leaves none.
func TestFocusIsHeldPerSession(t *testing.T) {
	c := &sdkConn{dialect: openCodeDialect}
	c.armFocus("s1", SessionWorkspace{AppID: "user:blink", Name: "Blink"})
	c.armFocus("s2", SessionWorkspace{AppID: "user:other", Name: "Other"})

	if got := c.takeFocus("s1"); !strings.Contains(got, "Blink") {
		t.Errorf("s1 carried %q, want its own app", got)
	}
	if got := c.peekFocus("s2"); !strings.Contains(got, "Other") {
		t.Errorf("s2 lost its focus to s1: %q", got)
	}
	c.forgetSession("s2")
	if got := c.takeFocus("s2"); got != "" {
		t.Errorf("a closed session still holds %q", got)
	}
	// An unknown session is not an error: a prompt for one carries nothing rather than another's.
	if got := c.takeFocus("never-opened"); got != "" {
		t.Errorf("an unopened session carried %q", got)
	}
}
