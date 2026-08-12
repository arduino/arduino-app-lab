package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	stdruntime "runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"app-lab-desktop/internal/agent"
	"app-lab-desktop/internal/agentauth"
	"app-lab-desktop/internal/airuntime"
	"app-lab-desktop/internal/arduinoapps"
	"app-lab-desktop/internal/boardmcp"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// adapterEntry is the ACP adapter's JS entry in the installed runtime, run with the pinned Node.
var adapterEntry = []string{"node_modules", "@agentclientprotocol", "claude-agent-acp", "dist", "index.js"}

// runtimeLocator maps the airuntime layout to agent.RuntimeLocator for one agent.
type runtimeLocator struct{ agentID airuntime.AgentID }

func (l runtimeLocator) Command() (string, []string, error) {
	nodeDir, err := airuntime.NodeBinDir(l.agentID)
	if err != nil {
		return "", nil, err
	}
	rt, err := airuntime.RuntimeDir(l.agentID)
	if err != nil {
		return "", nil, err
	}
	node := filepath.Join(nodeDir, nodeExe())
	entry := filepath.Join(append([]string{rt}, adapterEntry...)...)
	return node, []string{entry}, nil
}

func nodeExe() string {
	if stdruntime.GOOS == "windows" {
		return "node.exe"
	}
	return "node"
}

// emit sends a Wails event to the webview, always bound to the app context.
func (a *App) emit(event string, data ...any) {
	runtime.EventsEmit(a.ctx(), event, data...)
}

// --- Runtime (install / status) ---

// runtime returns id's manager, recreating it if the cached one is for another agent.
func (a *App) runtime(id airuntime.AgentID) (*airuntime.Manager, error) {
	a.runtimeMu.Lock()
	defer a.runtimeMu.Unlock()
	if a.runtimeMgr == nil || a.runtimeAgent != id {
		m, err := airuntime.New(id)
		if err != nil {
			return nil, err
		}
		a.runtimeMgr = m
		a.runtimeAgent = id
	}
	return a.runtimeMgr, nil
}

// runtimeFor validates the client agent id and returns its runtime manager.
func (a *App) runtimeFor(agentID string) (*airuntime.Manager, error) {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return nil, err
	}
	return a.runtime(id)
}

func (a *App) RuntimeStatus(agentID string) (airuntime.Status, error) {
	m, err := a.runtimeFor(agentID)
	if err != nil {
		return airuntime.Status{}, err
	}
	return m.Status(a.ctx())
}

// RuntimeCheckUpdate reports whether a runtime update is available (installed manifest vs the versions this app build pins).
func (a *App) RuntimeCheckUpdate(agentID string) (airuntime.UpdateCheck, error) {
	m, err := a.runtimeFor(agentID)
	if err != nil {
		return airuntime.UpdateCheck{}, err
	}
	return m.CheckUpdate(a.ctx())
}

// RuntimeInstall stops the agent first, as RuntimeUninstall does: installing re-extracts <runtime>/node, the binary a running agent executes. The flag spans the install rather than agentMu, which would block every other agent binding for minutes.
func (a *App) RuntimeInstall(agentID string) error {
	m, err := a.runtimeFor(agentID)
	if err != nil {
		return err
	}
	a.agentMu.Lock()
	if a.installing {
		a.agentMu.Unlock()
		return errors.New("an AI runtime install is already in progress")
	}
	a.stopAgentLocked()
	a.installing = true
	a.agentMu.Unlock()
	defer func() {
		a.agentMu.Lock()
		a.installing = false
		a.agentMu.Unlock()
	}()

	return m.Install(a.ctx(), func(p airuntime.Progress) {
		a.emit("airuntime:progress", p)
	})
}

func (a *App) RuntimeUninstall(agentID string) error {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}
	a.agentMu.Lock()
	if a.installing {
		a.agentMu.Unlock()
		return errors.New("another AI runtime operation is in progress; try again once it finishes")
	}
	// Uninstalling implies tearing the agent down, so stop it first rather than refusing — the user asked to remove the runtime.
	a.stopAgentLocked()
	// Flag and release, as RuntimeInstall does: the CLI logout and the dir removal below would otherwise freeze every agent binding for as long as they take.
	a.installing = true
	a.agentMu.Unlock()
	defer func() {
		a.agentMu.Lock()
		a.installing = false
		a.agentMu.Unlock()
	}()

	// Clear the credential while the CLI still exists to do it (the OS keychain survives an uninstall); best-effort, since the user asked for the runtime to go.
	if err := agentauth.SignOut(a.ctx(), id); err != nil {
		slog.Warn("agent credential not fully cleared before uninstall", "agent", id, "err", err)
	}
	m, err := a.runtime(id)
	if err != nil {
		return err
	}
	return m.Uninstall(a.ctx())
}

func (a *App) RuntimeCancelInstall(agentID string) {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return
	}
	a.runtimeMu.Lock()
	m := a.runtimeMgr
	sameAgent := a.runtimeAgent == id
	a.runtimeMu.Unlock()
	if m != nil && sameAgent {
		m.Cancel()
	}
}

// --- Agent (ACP conversation) ---

// agentStartTimeout bounds the spawn+initialize handshake so a wedged adapter can't hold agentMu.
const agentStartTimeout = 30 * time.Second

func (a *App) AgentStart(agentID string) error {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}

	// Hold agentMu across the whole start so the install check can't race a concurrent RuntimeUninstall.
	a.agentMu.Lock()
	defer a.agentMu.Unlock()
	if a.installing { // node is being replaced under us; starting now would spawn from a half-written tree
		return errors.New("the AI runtime is being installed; try again once it finishes")
	}
	if a.agentMgr != nil {
		if a.agentMgrID != id {
			return fmt.Errorf("agent %q is already running; stop it before starting %q", a.agentMgrID, id)
		}
		return nil // idempotent: the UI calls this on every open
	}

	m, err := a.runtime(id)
	if err != nil {
		return err
	}
	st, err := m.Status(a.ctx())
	if err != nil {
		return err
	}
	if !st.Installed {
		return errors.New("ai runtime not installed")
	}

	// Inject the API key if the user signed in with one; otherwise the adapter reads the subscription credential the login CLI wrote.
	// Fall back to the keychain so an API-key sign-in survives a restart (the in-memory copy is gone by then).
	authOpts := agentauth.Options{Method: agentauth.None}
	key := a.agentAPIKey
	if key == "" {
		if stored, rerr := agentauth.ReadAPIKey(id); rerr == nil {
			key = stored
		}
	}
	if key != "" {
		authOpts = agentauth.Options{Method: agentauth.APIKey, APIKey: key}
	}
	env, err := agentauth.IsolatedEnv(id, authOpts)
	if err != nil {
		return err
	}

	// Start the in-process board MCP server and advertise it on every session.
	mcpSrv, err := boardmcp.Start(boardAccess{app: a})
	if err != nil {
		return fmt.Errorf("start board MCP: %w", err)
	}
	a.boardMCP = mcpSrv

	mgr := a.newAgentManager(id, env, []agent.MCPServer{{URL: mcpSrv.URL(), Token: mcpSrv.Token(), ReadOnlyTools: mcpSrv.ReadOnlyToolNames()}})
	ctx, cancel := context.WithTimeout(a.ctx(), agentStartTimeout)
	defer cancel()
	if err := mgr.Start(ctx); err != nil {
		_ = mcpSrv.Stop() // don't leak the board MCP server if the agent handshake fails
		a.boardMCP = nil
		return err
	}
	a.agentMgr = mgr
	a.agentMgrID = id
	return nil
}

// newAgentManager builds the ACP manager for id and forwards its events to the webview.
func (a *App) newAgentManager(id airuntime.AgentID, env []string, mcp []agent.MCPServer) *agent.Manager {
	var mgr *agent.Manager
	mgr = agent.NewManager(
		agent.New(agent.Config{Locator: runtimeLocator{agentID: id}, Env: env}),
		agent.DefaultConnFactory,
		agent.ManagerConfig{
			OnUpdate: func(sid agent.SessionID, u agent.Update) { a.emit("acp:update", sid, u) },
			OnPermission: func(req agent.PermissionRequest) {
				a.enrichPermissionAppName(req) // resolve the app id in the request to a readable name for the dialog
				a.emit("acp:permission", req)
			},
			OnRestart: func(info agent.RestartInfo) {
				// Free the slot before the UI hears about it, so a reconnect can't race ahead and hit
				// AgentStart's idempotent early return — "succeeding" onto the manager being discarded.
				// Safe to do inline: the crashed process is already reaped (supervise cleared it before
				// calling us), so Stop() has nothing to wait on and can't block this goroutine.
				if info.GaveUp {
					a.clearAgent(mgr)
				}
				a.emit("acp:restart", info)
			},
			MCPServers: mcp,
			BoardName:  a.selectedBoardName(),
		},
	)
	return mgr
}

// selectedBoardName returns the selected board's display name (same guard as boardAccess.SelectedBoard), or "" when none.
func (a *App) selectedBoardName() string {
	if sb := a.selectedBoard; sb != nil && sb.Info.Serial != "" {
		return sb.Info.BoardName
	}
	return ""
}

// enrichPermissionAppName resolves the app id in a permission request to the app's display name and injects it
// into the tool input as `_targetName`, so the FE dialog reads "Start app: Blink Demo" instead of the opaque
// base64 id. Best-effort: on any miss (non-app tool, no board, lookup fails) the FE falls back to the id.
func (a *App) enrichPermissionAppName(req agent.PermissionRequest) {
	if req.ToolCall == nil {
		return
	}
	input, ok := req.ToolCall.Input.(map[string]any)
	if !ok {
		return
	}
	id, _ := input["id"].(string)
	if id == "" {
		id, _ = input["appID"].(string)
	}
	if strings.TrimSpace(id) == "" {
		return
	}
	base, err := a.InferOrchestratorURL()
	if err != nil || base == "" {
		return
	}
	if name, err := arduinoapps.AppName(a.ctx(), base, id); err == nil && name != "" {
		input["_targetName"] = name // mutates the shared input map, so the emitted request carries it
	}
}

// stopAgentLocked tears down the running agent and its board MCP server, with agentMu already held (AgentStop would re-lock it).
func (a *App) stopAgentLocked() {
	mgr, srv := a.agentMgr, a.boardMCP
	a.agentMgr, a.boardMCP = nil, nil
	if srv != nil {
		_ = srv.Stop()
	}
	if mgr != nil {
		_ = mgr.Stop()
	}
}

// clearAgent frees the manager slot (if it still holds mgr) and stops it + its board MCP server.
func (a *App) clearAgent(mgr *agent.Manager) {
	a.agentMu.Lock()
	var srv *boardmcp.Server
	if a.agentMgr == mgr {
		a.agentMgr = nil
		srv, a.boardMCP = a.boardMCP, nil
	}
	a.agentMu.Unlock()
	_ = mgr.Stop()
	if srv != nil {
		_ = srv.Stop()
	}
}

// pendingLogin is the running subscription sign-in, holding the login CLI's stdin so a pasted code can reach it.
type pendingLogin struct {
	agentID airuntime.AgentID
	cancel  context.CancelFunc
	exited  chan struct{}

	mu      sync.Mutex // not the App's: the CLI's output is scanned while a submission waits
	stdin   io.WriteCloser
	verdict chan error
}

func (p *pendingLogin) setStdin(w io.WriteCloser) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.stdin = w
}

// armVerdict returns the stdin to write a code to, plus the channel its verdict arrives on.
func (p *pendingLogin) armVerdict() (io.WriteCloser, chan error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.stdin == nil {
		return nil, nil
	}
	p.verdict = make(chan error, 1)
	return p.stdin, p.verdict
}

func (p *pendingLogin) reject(err error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	select {
	case p.verdict <- err:
	default: // nothing submitted, or already answered
	}
}

// AgentSignIn runs the subscription login (browser OAuth, credential to the keychain) and emits the CLI's auth URL via "agent:login-url".
// It finishes only once the code the user pastes reaches the CLI's stdin — see AgentSubmitLoginToken.
func (a *App) AgentSignIn(agentID string) error {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithCancel(a.ctx())
	defer cancel()
	login := &pendingLogin{agentID: id, cancel: cancel, exited: make(chan struct{})}
	// Supersede the running sign-in: the FE's cancel never reaches Go, so refusing would strand a retry.
	a.agentMu.Lock()
	prev := a.pendingLogin
	a.pendingLogin = login
	a.agentMu.Unlock()
	if prev != nil {
		prev.cancel()
	}
	defer func() {
		close(login.exited)
		a.agentMu.Lock()
		if a.pendingLogin == login { // a superseding sign-in may already own the slot
			a.pendingLogin = nil
		}
		a.agentMu.Unlock()
	}()

	var once sync.Once
	onLine := func(line string) {
		if u := loginURL(line); u != "" {
			once.Do(func() { a.emit("agent:login-url", u) })
			return
		}
		if loginCodeRejected(line) {
			login.reject(errors.New("that code was not accepted; copy the full code from the sign-in page"))
		}
	}
	// NOTE: login args are Claude-specific until agentauth owns per-agent login.
	return agentauth.RunCLIStreaming(ctx, id, agentauth.Options{Method: agentauth.None}, onLine, login.setStdin, "auth", "login", "--claudeai")
}

var (
	ansiEscapeRe = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`)
	urlRe        = regexp.MustCompile(`https?://[^\s'"]+`)
	// The CLI re-prompts after this, so nothing else signals the failure; a server-refused code exits instead.
	invalidCodeRe = regexp.MustCompile(`(?i)\binvalid code\b`)
)

// loginURL extracts the OAuth authorization URL from a CLI output line (ANSI-stripped), if present.
func loginURL(line string) string {
	clean := ansiEscapeRe.ReplaceAllString(line, "")
	for _, u := range urlRe.FindAllString(clean, -1) {
		u = strings.TrimRight(u, ").,]}>")
		if strings.Contains(u, "oauth") || strings.Contains(u, "claude.ai") || strings.Contains(u, "anthropic") {
			return u
		}
	}
	return ""
}

func loginCodeRejected(line string) bool {
	return invalidCodeRe.MatchString(ansiEscapeRe.ReplaceAllString(line, ""))
}

const codeVerdictTimeout = 30 * time.Second

// AgentSubmitLoginToken writes the pasted code to the pending sign-in's stdin, erroring if the CLI wants another.
func (a *App) AgentSubmitLoginToken(agentID, token string) error {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}
	code := strings.TrimSpace(token)
	if code == "" {
		return errors.New("login token is empty")
	}
	a.agentMu.Lock()
	login := a.pendingLogin
	a.agentMu.Unlock()
	if login == nil || login.agentID != id {
		return errors.New("no sign-in is waiting for a token")
	}
	stdin, verdict := login.armVerdict()
	if stdin == nil {
		return errors.New("the sign-in is still starting; paste the token again in a moment")
	}
	if _, err := stdin.Write([]byte(code + "\n")); err != nil {
		return fmt.Errorf("the sign-in is no longer accepting a token: %w", err)
	}
	select {
	case err := <-verdict:
		return err
	case <-login.exited: // took the code and finished; AgentSignIn reports how it went
		return nil
	case <-time.After(codeVerdictTimeout):
		return nil
	}
}

// AgentSignInApiKey caches an API key (in memory + the OS keychain) to inject as ANTHROPIC_API_KEY at the next AgentStart; persisting it keeps an API-key sign-in alive across restarts.
func (a *App) AgentSignInApiKey(agentID, apiKey string) error {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}
	key := strings.TrimSpace(apiKey)
	if key == "" {
		return errors.New("API key is empty")
	}
	// Verify BEFORE keeping or persisting anything: this used to accept any non-empty string, so a mistyped key was
	// stored in the keychain and reported as "Connected", and the failure only surfaced later on the first chat turn.
	if err := agentauth.VerifyAPIKey(a.ctx(), id, key); err != nil {
		if errors.Is(err, agentauth.ErrAPIKeyRejected) {
			return errors.New("that API key was rejected — check you copied it in full from the provider's console")
		}
		return err // couldn't reach the provider: the message says so, rather than blaming the key
	}
	a.agentMu.Lock()
	a.agentAPIKey = key
	a.agentAPIKeyAt = time.Now()
	a.agentMu.Unlock()
	// Persist in the OS keychain so it survives a restart. A store failure (e.g. no Secret
	// Service on headless Linux) is not fatal: the in-memory key works for this run, matching
	// how the Arduino Cloud refresh token degrades.
	if err := agentauth.StoreAPIKey(id, key); err != nil {
		slog.Warn("agent API key not persisted; sign-in valid for this session only", "agent", id, "err", err)
	}
	return nil
}

// AgentAuthStatus reports whether the agent can skip the connect screen (a persisted subscription login or an API key set this session), plus the details shown in the settings "Agent" section.
func (a *App) AgentAuthStatus(agentID string) (agent.AuthStatus, error) {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return agent.AuthStatus{}, err
	}
	a.agentMu.Lock()
	apiKey := a.agentAPIKey
	apiKeyAt := a.agentAPIKeyAt
	a.agentMu.Unlock()

	// After a restart the in-memory key is gone; read the persisted one so an API-key user still skips the connect screen (ConnectedAt is unknown then, so it's omitted).
	if apiKey == "" {
		if stored, rerr := agentauth.ReadAPIKey(id); rerr == nil {
			apiKey = stored
		}
	}

	status := agent.AuthStatus{Authenticated: true, AgentID: string(id), IsDefault: isDefaultAgent(id)}
	if apiKey != "" {
		status.Method = "api_key"
		status.Account = maskAPIKey(apiKey)
		if !apiKeyAt.IsZero() {
			status.ConnectedAt = apiKeyAt.UTC().Format(time.RFC3339)
		}
		return status, nil
	}

	acc, err := agentauth.ReadSubscriptionAccount(id)
	if err != nil {
		return agent.AuthStatus{}, err
	}
	if !acc.LoggedIn {
		return agent.AuthStatus{}, nil
	}
	status.Method = "subscription"
	status.Account = acc.Email
	status.ConnectedAt = acc.ConnectedAt
	return status, nil
}

// maskAPIKey renders a key for display as its provider prefix + bullets + last 4 chars (e.g. sk-ant-••••••••••••3f7a).
func maskAPIKey(key string) string {
	last4 := key
	if len(key) > 4 {
		last4 = key[len(key)-4:]
	}
	prefix := ""
	if strings.HasPrefix(key, "sk-ant-") {
		prefix = "sk-ant-"
	}
	return prefix + strings.Repeat("•", 12) + last4
}

// isDefaultAgent reports whether id is the default agent for new sessions; with none stored yet, a connected agent counts as the default.
func isDefaultAgent(id airuntime.AgentID) bool {
	def := readDefaultAgent()
	return def == "" || def == string(id)
}

// AgentCancelLogin aborts a sign-in the user walked away from; without it the login CLI runs until the app quits or the next attempt supersedes it, since abandoning the flow in the UI otherwise never reaches Go. Scoped to agentID so it can't cancel a sign-in for a different agent.
func (a *App) AgentCancelLogin(agentID string) error {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}
	a.agentMu.Lock()
	login := a.pendingLogin
	a.agentMu.Unlock()
	if login != nil && login.agentID == id {
		login.cancel()
	}
	return nil
}

// AgentDisconnect signs the agent out: it stops any running process, drops the API key (in-memory + keychain), and removes the persisted subscription credential so AgentAuthStatus reports not-authenticated.
func (a *App) AgentDisconnect(agentID string) error {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}
	if err := a.AgentStop(); err != nil {
		return err
	}
	a.agentMu.Lock()
	a.agentAPIKey = ""
	a.agentAPIKeyAt = time.Time{}
	a.agentMu.Unlock()
	// Drop the persisted key too, else the next restart would sign back in with it. Without a
	// keychain nothing was persisted, so a delete failure must not block the sign-out.
	if err := agentauth.DeleteAPIKey(id); err != nil {
		slog.Warn("agent API key keychain delete failed", "agent", id, "err", err)
	}
	return agentauth.SignOut(a.ctx(), id)
}

// AgentSetDefault records agentID as the default agent launched for new sessions.
func (a *App) AgentSetDefault(agentID string) error {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}
	return writeDefaultAgent(string(id))
}

// validateAuthTimeout bounds the throwaway validation turn so a slow probe never blocks opening the chat.
const validateAuthTimeout = 30 * time.Second

// AgentValidateAuth runs a throwaway turn so an expired/revoked credential fails here (before the chat) rather than on the user's first real prompt. Requires a started agent (AgentStart); the probe session is deleted so it never pollutes the session list.
func (a *App) AgentValidateAuth() error {
	m, err := a.agentManager()
	if err != nil {
		return err
	}
	cwd, err := a.sessionCwd()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(a.ctx(), validateAuthTimeout)
	defer cancel()
	sid, err := m.NewSession(ctx, cwd)
	if err != nil {
		return err
	}
	a.agentMu.Lock()
	a.probeSessionID, a.probeSeen = string(sid), false
	a.agentMu.Unlock()
	// Best-effort delete; the id keeps being filtered until AgentListSessions sees the probe actually gone (a nil
	// error here isn't proof — DeleteSession gives up after a few verify attempts and still reports success).
	defer func() { _ = m.DeleteSession(a.ctx(), sid) }()
	return m.Prompt(ctx, sid, "ping")
}

// probeWasSeen reports whether the current probe has ever shown up in the agent's session list.
func (a *App) probeWasSeen() bool {
	a.agentMu.Lock()
	defer a.agentMu.Unlock()
	return a.probeSeen
}

// keepNonProbeSessions drops the throwaway auth-probe session, matched by id ONLY, and reports whether it was listed.
// Matching its "ping" title too used to hide a real session the agent happened to title that — the user's own work,
// gone from the sidebar with no way to get it back. A probe whose delete truly failed being visible is the better trade.
func keepNonProbeSessions(sessions []agent.SessionSummary, probe string) (kept []agent.SessionSummary, probeListed bool) {
	if probe == "" {
		return sessions, false
	}
	kept = make([]agent.SessionSummary, 0, len(sessions))
	for _, s := range sessions {
		if s.ID == probe {
			probeListed = true
			continue
		}
		kept = append(kept, s)
	}
	return kept, probeListed
}

// AgentListSessions lists the workspace's persisted sessions (newest first), overlaying client-side custom titles.
func (a *App) AgentListSessions() ([]agent.SessionSummary, error) {
	m, err := a.agentManager()
	if err != nil {
		return nil, err
	}
	cwd, err := a.sessionCwd()
	if err != nil {
		return nil, err
	}
	sessions, err := m.ListSessions(a.ctx(), cwd)
	if err != nil {
		return nil, err
	}
	a.agentMu.Lock()
	probe := a.probeSessionID
	a.agentMu.Unlock()
	sessions, probeListed := keepNonProbeSessions(sessions, probe)
	if probe != "" && probeListed {
		a.agentMu.Lock()
		a.probeSeen = true // only a probe we have actually seen may later be forgotten for being absent
		a.agentMu.Unlock()
	}
	// Absent AND seen before: the delete took effect. Absent but never seen means the agent hasn't persisted it yet
	// (or the validate turn is still running), and forgetting it there would leave a failed delete visible forever.
	if probe != "" && !probeListed && a.probeWasSeen() {
		a.agentMu.Lock()
		if a.probeSessionID == probe { // not a newer probe started meanwhile
			a.probeSessionID, a.probeSeen = "", false
		}
		a.agentMu.Unlock()
	}
	created := map[string]string{}
	if dir, err := a.agentConfigDir(); err == nil {
		a.titleMu.Lock()
		titles, _ := readSessionTitles(dir)
		statuses, _ := readSessionStatus(dir)
		pins, _ := readSessionPins(dir)
		created, _ = readSessionCreated(dir)
		a.titleMu.Unlock()
		for i := range sessions {
			if t, ok := titles[sessions[i].ID]; ok {
				sessions[i].Title = t
			}
			if s, ok := statuses[sessions[i].ID]; ok {
				sessions[i].Status = s
			}
			if pins[sessions[i].ID] {
				sessions[i].Pinned = true
			}
		}
		// Record a stable creation time the first time we see a session (ACP gives only updatedAt), seeded from updatedAt so existing sessions keep their order, then frozen so activity never reshuffles the list.
		now := time.Now().UTC().Format(time.RFC3339)
		missing := false
		for i := range sessions {
			if _, ok := created[sessions[i].ID]; !ok {
				seed := sessions[i].UpdatedAt
				if seed == "" {
					seed = now
				}
				created[sessions[i].ID] = seed
				missing = true
			}
		}
		if missing {
			a.titleMu.Lock()
			_ = writeSessionCreated(dir, created)
			a.titleMu.Unlock()
		}
	}
	// A live in-flight turn overrides the persisted last-turn status (a session can run in the background after a switch).
	streaming := m.StreamingSessions()
	for i := range sessions {
		if streaming[sessions[i].ID] {
			sessions[i].Status = "running"
		}
	}
	// Newest first by stable creation time (see sessioncreated.go); tiebreak/fallback on updatedAt.
	sort.SliceStable(sessions, func(i, j int) bool {
		if ci, cj := created[sessions[i].ID], created[sessions[j].ID]; ci != cj {
			return ci > cj
		}
		return sessions[i].UpdatedAt > sessions[j].UpdatedAt
	})
	return sessions, nil
}

// AgentRenameSession sets (or clears, when title is blank) a client-side custom title for a session.
func (a *App) AgentRenameSession(sessionID, title string) error {
	dir, err := a.agentConfigDir()
	if err != nil {
		return err
	}
	a.titleMu.Lock()
	defer a.titleMu.Unlock()
	titles, err := readSessionTitles(dir)
	if err != nil {
		return err
	}
	if t := strings.TrimSpace(title); t == "" {
		delete(titles, sessionID)
	} else {
		titles[sessionID] = t
	}
	return writeSessionTitles(dir, titles)
}

// AgentPinSession pins or unpins a session (client-side), so the sidebar can group it in the pinned section.
func (a *App) AgentPinSession(sessionID string, pinned bool) error {
	dir, err := a.agentConfigDir()
	if err != nil {
		return err
	}
	a.titleMu.Lock()
	defer a.titleMu.Unlock()
	pins, err := readSessionPins(dir)
	if err != nil {
		return err
	}
	if pinned {
		pins[sessionID] = true
	} else {
		delete(pins, sessionID)
	}
	return writeSessionPins(dir, pins)
}

// AgentDeleteSession permanently removes a persisted session and drops its custom title.
func (a *App) AgentDeleteSession(sessionID string) error {
	m, err := a.agentManager()
	if err != nil {
		return err
	}
	if err := m.DeleteSession(a.ctx(), agent.SessionID(sessionID)); err != nil {
		return err
	}
	if dir, err := a.agentConfigDir(); err == nil {
		a.titleMu.Lock()
		if titles, err := readSessionTitles(dir); err == nil {
			delete(titles, sessionID)
			_ = writeSessionTitles(dir, titles)
		}
		if statuses, err := readSessionStatus(dir); err == nil {
			delete(statuses, sessionID)
			_ = writeSessionStatus(dir, statuses)
		}
		if pins, err := readSessionPins(dir); err == nil {
			delete(pins, sessionID)
			_ = writeSessionPins(dir, pins)
		}
		a.titleMu.Unlock()
	}
	return nil
}

// setSessionStatus records a session's last-turn outcome for the sidebar ("error" on failure, cleared on success); best-effort.
func (a *App) setSessionStatus(sessionID string, turnErr error) {
	dir, err := a.agentConfigDir()
	if err != nil {
		return
	}
	a.titleMu.Lock()
	defer a.titleMu.Unlock()
	statuses, err := readSessionStatus(dir)
	if err != nil {
		return
	}
	if turnErr != nil {
		statuses[sessionID] = "error"
	} else if _, ok := statuses[sessionID]; ok {
		delete(statuses, sessionID)
	} else {
		return // already clean: skip the disk write on the common success path
	}
	_ = writeSessionStatus(dir, statuses)
}

// agentConfigDir returns the running agent's isolated config dir (home of client-side session metadata).
func (a *App) agentConfigDir() (string, error) {
	a.agentMu.Lock()
	id, running := a.agentMgrID, a.agentMgr != nil
	a.agentMu.Unlock()
	if !running {
		return "", errors.New("agent not started")
	}
	return airuntime.AgentConfigDir(id)
}

// AgentLoadSession reopens a session: replays its history via acp:update and records its models/modes (FE resets its thread first).
func (a *App) AgentLoadSession(sessionID string) error {
	m, err := a.agentManager()
	if err != nil {
		return err
	}
	cwd, err := a.sessionCwd()
	if err != nil {
		return err
	}
	return m.LoadSession(a.ctx(), agent.SessionID(sessionID), cwd)
}

// AgentNewSession opens a session in the shared mirror-root workspace; app scoping is agent-driven via the apps_checkout tool (appID is reserved for a future default-app context).
func (a *App) AgentNewSession(appID string) (string, error) {
	_ = appID
	m, err := a.agentManager()
	if err != nil {
		return "", err
	}
	cwd, err := a.sessionCwd()
	if err != nil {
		return "", err
	}
	sid, err := m.NewSession(a.ctx(), cwd)
	return string(sid), err
}

// sessionCwd resolves the ACP cwd to the mirror root, so apps the agent checks out are subdirs of the cwd (native edits stay in-workspace).
func (a *App) sessionCwd() (string, error) {
	ws, err := airuntime.MirrorRootDir()
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(ws, 0o755); err != nil {
		return "", err
	}
	if err := hardenAgentPolicyDir(ws); err != nil {
		return "", err
	}
	return ws, nil
}

// agentPolicyDir is the settings dir an agent engine reads project-level permission policy from, relative to the cwd.
const agentPolicyDir = ".claude"

// agentPolicyFiles are the policy files that must never exist inside the agent's own cwd.
var agentPolicyFiles = []string{"settings.json", "settings.local.json"}

// hardenAgentPolicyDir keeps <cwd>/.claude App Lab-owned with no permission policy: the agent-writable cwd is attacker-reachable (prompt injection), so a settings*.json there could grant permissions/bypassPermissions inside the engine before App Lab sees the call — belt-and-braces even if the adapter regresses on settingSources.
func hardenAgentPolicyDir(cwd string) error {
	dir := filepath.Join(cwd, agentPolicyDir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("prepare agent policy dir: %w", err)
	}
	for _, name := range agentPolicyFiles {
		p := filepath.Join(dir, name)
		if _, err := os.Lstat(p); err != nil {
			continue // absent (or unreadable) — nothing to strip
		}
		if err := os.RemoveAll(p); err != nil {
			return fmt.Errorf("agent workspace holds a permission policy file we cannot remove (%s): %w", p, err)
		}
		slog.Warn("removed agent-written permission policy from the agent workspace", "path", p)
	}
	return nil
}

func (a *App) AgentPrompt(sessionID, text string) error {
	m, err := a.agentManager()
	if err != nil {
		return err
	}
	since := time.Now()
	// At turn-end: reattach any mirror edited this turn without a checkout, then sync (even on error/cancel) so edits aren't stranded.
	defer func() {
		a.reattachEditedMirrors(since)
		a.syncCheckouts(since, false)
	}()
	turnErr := m.Prompt(a.ctx(), agent.SessionID(sessionID), text)
	a.setSessionStatus(sessionID, turnErr) // persist "error" on a failed turn, clear on success (a cancel returns nil, so it isn't flagged)
	return turnErr
}

func (a *App) AgentCancel(sessionID string) error {
	m, err := a.agentManager()
	if err != nil {
		return err
	}
	return m.Cancel(a.ctx(), agent.SessionID(sessionID))
}

func (a *App) AgentCloseSession(sessionID string) error {
	m, err := a.agentManager()
	if err != nil {
		return err
	}
	return m.CloseSession(a.ctx(), agent.SessionID(sessionID))
}

// AgentFileLocation identifies an agent file for the editor: the app's orchestrator id + its app-relative path.
type AgentFileLocation struct {
	AppID string `json:"appId"`
	File  string `json:"file"`
}

// AgentResolveFile maps a path the agent read/wrote (under an app's mirror) to {appId, app-relative file} for opening in the editor; errors if it isn't part of a checked-out app or the app is no longer on the connected board (board changed).
func (a *App) AgentResolveFile(path string) (*AgentFileLocation, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, fmt.Errorf("no file path")
	}
	root, err := airuntime.MirrorRootDir()
	if err != nil {
		return nil, err
	}
	if !filepath.IsAbs(path) {
		path = filepath.Join(root, path)
	}
	// Mirror layout is <root>/<key>/<file> (key=mirrorKey(appID)); resolve from the path so it also works when the app was checked out in an earlier session (checkedOut is in-memory).
	rel, err := filepath.Rel(filepath.Clean(root), filepath.Clean(path))
	if err != nil || rel == "." || strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
		return nil, fmt.Errorf("this file isn't part of an app the agent opened")
	}
	parts := strings.SplitN(filepath.ToSlash(rel), "/", 2)
	if len(parts) < 2 || parts[1] == "" {
		return nil, fmt.Errorf("this file isn't part of an app the agent opened")
	}
	key, file := parts[0], parts[1]

	orchestratorURL, err := a.InferOrchestratorURL()
	if err != nil {
		return nil, fmt.Errorf("no board connected")
	}
	appID, ok, err := a.appIDForMirrorKey(orchestratorURL, key)
	if err != nil {
		return nil, fmt.Errorf("couldn't reach the board to resolve the file")
	}
	if !ok {
		return nil, fmt.Errorf("that app isn't on the connected board (the board may have changed)")
	}
	return &AgentFileLocation{AppID: appID, File: file}, nil
}

func (a *App) AgentSetSessionModel(sessionID, modelID string) error {
	m, err := a.agentManager()
	if err != nil {
		return err
	}
	return m.SetModel(a.ctx(), agent.SessionID(sessionID), modelID)
}

func (a *App) AgentSetSessionMode(sessionID, modeID string) error {
	m, err := a.agentManager()
	if err != nil {
		return err
	}
	return m.SetMode(a.ctx(), agent.SessionID(sessionID), modeID)
}

func (a *App) AgentPermissionReply(id string, outcome agent.PermissionOutcome) error {
	m, err := a.agentManager()
	if err != nil {
		return err
	}
	return m.ReplyPermission(id, outcome)
}

// AgentChoicesReply routes the user's answer to a Choices question back to the blocked elicitation.
func (a *App) AgentChoicesReply(id string, submission agent.ChoiceSubmission) error {
	m, err := a.agentManager()
	if err != nil {
		return err
	}
	m.ReplyChoices(id, submission)
	return nil
}

// AgentGetSessionState reports turn status, model and pending permission for UI rehydration.
func (a *App) AgentGetSessionState(sessionID string) (agent.SessionState, error) {
	m, err := a.agentManager()
	if err != nil {
		return agent.SessionState{}, err
	}
	return m.GetSessionState(agent.SessionID(sessionID)), nil
}

// AgentAuthMethods returns the login options the agent advertised at initialize.
func (a *App) AgentAuthMethods() ([]agent.AuthMethod, error) {
	m, err := a.agentManager()
	if err != nil {
		return nil, err
	}
	return m.AuthMethods(), nil
}

func (a *App) AgentAuthenticate(methodID string) error {
	m, err := a.agentManager()
	if err != nil {
		return err
	}
	return m.Authenticate(a.ctx(), methodID)
}

func (a *App) AgentStop() error {
	a.agentMu.Lock()
	m := a.agentMgr
	a.agentMgr = nil
	srv := a.boardMCP
	a.boardMCP = nil
	a.agentMu.Unlock()
	if srv != nil {
		_ = srv.Stop()
	}
	if m == nil {
		return nil
	}
	return m.Stop()
}

func (a *App) agentManager() (*agent.Manager, error) {
	a.agentMu.Lock()
	defer a.agentMu.Unlock()
	if a.agentMgr == nil {
		return nil, errors.New("agent not started")
	}
	return a.agentMgr, nil
}
