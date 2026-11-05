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
	"sync/atomic"
	"time"

	"app-lab-desktop/internal/agent"
	"app-lab-desktop/internal/agentauth"
	"app-lab-desktop/internal/airuntime"
	"app-lab-desktop/internal/appid"
	"app-lab-desktop/internal/arduinoapps"
	"app-lab-desktop/internal/boardmcp"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// runtimeLocator resolves the registry's launch spec against the airuntime layout for one agent.
type runtimeLocator struct{ agentID airuntime.AgentID }

func (l runtimeLocator) Command() (string, []string, error) {
	launch, err := airuntime.LaunchFor(l.agentID)
	if err != nil {
		return "", nil, err
	}
	rt, err := airuntime.RuntimeDir(l.agentID)
	if err != nil {
		return "", nil, err
	}
	entry := filepath.Join(append([]string{rt}, launch.Entry...)...)
	if !launch.ViaNode {
		return entry, launch.Args, nil
	}
	nodeDir, err := airuntime.NodeBinDir(l.agentID)
	if err != nil {
		return "", nil, err
	}
	return filepath.Join(nodeDir, nodeExe()), append([]string{entry}, launch.Args...), nil
}

func nodeExe() string {
	if stdruntime.GOOS == "windows" {
		return "node.exe"
	}
	return "node"
}

// emitEvent is the Wails event call, a variable so tests run without a webview.
var emitEvent = runtime.EventsEmit

// emit sends a Wails event to the webview, always bound to the app context.
func (a *App) emit(event string, data ...any) {
	emitEvent(a.ctx(), event, data...)
}

// stream is the one way agent updates reach the webview.
func (a *App) stream() *updateBatcher {
	a.streamOnce.Do(func() {
		a.updates = newUpdateBatcher(streamBatchWindow, func(sid agent.SessionID, u agent.Update) { a.emit("acp:update", sid, u) })
	})
	return a.updates
}

// --- Runtime (install / status) ---

// One manager per agent, kept: dropping another's would make the install it is running uncancellable.
func (a *App) runtime(id airuntime.AgentID) (*airuntime.Manager, error) {
	a.runtimeMu.Lock()
	defer a.runtimeMu.Unlock()
	if m, ok := a.runtimeMgrs[id]; ok {
		return m, nil
	}
	m, err := airuntime.New(id)
	if err != nil {
		return nil, err
	}
	a.runtimeMgrs[id] = m
	return m, nil
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
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}
	a.agentMu.Lock()
	if a.installing[id] {
		a.agentMu.Unlock()
		return errors.New("an AI runtime install is already in progress")
	}
	// Only this agent: the runtime dirs are per agent, and stopping the other killed its running turn.
	if a.agentMgr != nil && a.agentMgrID == id {
		a.stopAgentLocked()
	}
	a.setInstallingLocked(id, true)
	a.agentMu.Unlock()
	defer func() {
		a.agentMu.Lock()
		a.setInstallingLocked(id, false)
		a.agentMu.Unlock()
	}()

	if err := m.Install(a.ctx(), func(p airuntime.Progress) {
		a.emit("airuntime:progress", p)
	}); err != nil {
		return err
	}
	// Logged, not returned: the runtime is installed, and the list fills itself on the first launch.
	if err := a.warmProviderCatalog(m.Agent()); err != nil {
		slog.Warn("provider catalogue not fetched; it will fill on the first agent start", "err", err)
	}
	return nil
}

func (a *App) RuntimeUninstall(agentID string) error {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}
	a.stopProviderSignIn(id)
	a.agentMu.Lock()
	if a.installing[id] {
		a.agentMu.Unlock()
		return errors.New("another AI runtime operation is in progress; try again once it finishes")
	}
	// Only this agent: the user asked to remove this runtime, not to end the other one's turn.
	if a.agentMgr != nil && a.agentMgrID == id {
		a.stopAgentLocked()
	}
	// Flag and release, as RuntimeInstall does: the CLI logout and the dir removal below would otherwise freeze every agent binding for as long as they take.
	a.setInstallingLocked(id, true)
	a.agentMu.Unlock()
	defer func() {
		a.agentMu.Lock()
		a.setInstallingLocked(id, false)
		a.agentMu.Unlock()
	}()

	// Before SignOut, which removes the key file this reads to tell a key the keychain never held.
	if err := agentauth.DeleteAllProviderKeys(id); err != nil {
		slog.Warn("provider keys not fully cleared before uninstall", "agent", id, "err", err)
	}
	// Clear the credential while the CLI still exists to do it; best-effort, the user asked for it to go.
	if err := agentauth.SignOut(a.ctx(), id); err != nil {
		slog.Warn("agent credential not fully cleared before uninstall", "agent", id, "err", err)
	}
	// The keychain outlives the directory that indexes it: leftovers are unreachable but still "connected".
	a.agentMu.Lock()
	delete(a.agentAPIKeys, id)
	delete(a.agentAPIKeyAts, id)
	a.agentMu.Unlock()
	if err := agentauth.DeleteAPIKey(id); err != nil {
		slog.Warn("agent API key keychain delete failed", "agent", id, "err", err)
	}
	if err := agentauth.ClearConnected(id); err != nil {
		slog.Warn("connection marker not cleared before uninstall", "agent", id, "err", err)
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
	m := a.runtimeMgrs[id]
	a.runtimeMu.Unlock()
	if m != nil {
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
	if a.switching { // the mirror is about to be deleted; a process started now would be handed a dead cwd
		return errors.New("an agent switch is in progress")
	}
	if a.installing[id] { // node is being replaced under us; starting now would spawn from a half-written tree
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
	key, _ := a.cachedAPIKeyLocked(id) // agentMu is already held for the whole start
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
	if a.modelInstalls == nil { // outlives the agent: a download started before a restart must not be restarted by it
		a.modelInstalls = boardmcp.NewModelInstaller()
	}
	mcpSrv, err := boardmcp.Start(boardAccess{app: a}, a.modelInstalls)
	if err != nil {
		return fmt.Errorf("start board MCP: %w", err)
	}
	a.boardMCP = mcpSrv

	// Above board_exec's own limit, so the engine never abandons a board call that is still within it.
	callTimeout := boardExecTimeout + 2*time.Minute
	mcpServers := []agent.MCPServer{{URL: mcpSrv.URL(), Token: mcpSrv.Token(), ReadOnlyTools: mcpSrv.ReadOnlyToolNames(), CallTimeout: callTimeout}}
	dialect, err := agent.DialectFor(id)
	if err != nil {
		_ = mcpSrv.Stop()
		return err
	}
	// Policy read at startup, so the environment closes only once the board server's URL and bearer exist.
	if dialect.LaunchConfig != nil {
		cfg, cerr := dialect.LaunchConfig(agent.LaunchInput{BoardName: a.selectedBoardName(), MCPServers: mcpServers})
		if cerr != nil {
			_ = mcpSrv.Stop()
			return cerr
		}
		env = append(env, dialect.LaunchConfigEnv+"="+cfg)
	}
	// Rewritten every launch: the setting takes a path, and the board it describes may have changed.
	if dialect.LaunchInstructions != nil {
		if ierr := writeAgentInstructions(id, dialect, agent.LaunchInput{BoardName: a.selectedBoardName(), MCPServers: mcpServers}); ierr != nil {
			_ = mcpSrv.Stop()
			return ierr
		}
	}

	mgr := a.newAgentManager(id, env, mcpServers, dialect)
	ctx, cancel := context.WithTimeout(a.ctx(), agentStartTimeout)
	defer cancel()
	if err := mgr.Start(ctx); err != nil {
		_ = mcpSrv.Stop() // don't leak the board MCP server if the agent handshake fails
		a.boardMCP = nil
		return err
	}
	a.agentMgr = mgr
	a.agentMgrID = id
	// Read now, before this run can open a probe of its own: those are deleted by the run that opened them.
	if leftovers := a.storedProbes(id); len(leftovers) > 0 {
		go a.deleteLeftoverProbes(mgr, id, leftovers)
	}
	if pending := a.pendingSessionDeletes(id); len(pending) > 0 {
		go a.deletePendingChats(mgr, id, pending)
	}
	return nil
}

// newAgentManager builds the ACP manager for id and forwards its events to the webview.
func (a *App) newAgentManager(id airuntime.AgentID, env []string, mcp []agent.MCPServer, dialect agent.Dialect) *agent.Manager {
	var mgr *agent.Manager
	mgr = agent.NewManager(
		agent.New(agent.Config{Locator: runtimeLocator{agentID: id}, Env: env}),
		agent.DefaultConnFactory,
		agent.ManagerConfig{
			OnUpdate: a.stream().Push,
			OnPermission: func(req agent.PermissionRequest) {
				a.enrichPermissionAppName(req) // resolve the app id in the request to a readable name for the dialog
				a.stream().Flush(req.SessionID)
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
			MCPServers:   mcp,
			Dialect:      dialect,
			BoardName:    a.selectedBoardName(),
			Grants:       workspaceGrants{app: a},
			WorkspaceDir: a.workspaceMirrorDir,
			AppNameAt:    a.checkoutAppName,
			FreeModels:   func() map[string]bool { return agentauth.FreeModels(id) },
			SessionScope: func(sid agent.SessionID) (string, agent.SessionWorkspace, error) {
				cwd, err := a.sessionCwd()
				return cwd, a.sessionWorkspaceFor(string(sid)), err
			},
			Picks: agent.PickFileOf(id),
		},
	)
	return mgr
}

func writeAgentInstructions(id airuntime.AgentID, dialect agent.Dialect, in agent.LaunchInput) error {
	dir, err := agentauth.EngineConfigDir(id)
	if err != nil {
		return err
	}
	rel, data := dialect.LaunchInstructions(in)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("prepare agent config dir: %w", err)
	}
	path := filepath.Join(dir, rel)
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write agent instructions %s: %w", path, err)
	}
	return nil
}

// selectedBoardName returns the selected board's display name (same guard as boardAccess.SelectedBoard), or "" when none.
func (a *App) selectedBoardName() string {
	if sb := a.boardSnapshot(); sb.Info.Serial != "" {
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
	id := permissionAppID(input)
	if id == "" {
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

// permissionAppID reads the app a call names as the agent's toolCallAppID does, so the card names the app its grant and its outside-app check are about.
func permissionAppID(input map[string]any) string {
	for _, key := range []string{"appId", "appID", "id"} {
		if v, ok := input[key].(string); ok && appid.Canonical(v) != "" {
			return appid.Canonical(v)
		}
	}
	return ""
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
		a.stream().EndAll()
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
	// Resolved first: an agent with no browser sign-in must fail before this supersedes a running one.
	args, err := agentauth.SubscriptionLoginArgs(id)
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
	return agentauth.RunCLIStreaming(ctx, id, agentauth.Options{Method: agentauth.None}, onLine, login.setStdin, args...)
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

var (
	deviceURLRe  = regexp.MustCompile(`(?i)go to:\s*(https?://\S+)`)
	deviceCodeRe = regexp.MustCompile(`(?i)enter code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})`)
	cliProblemRe = regexp.MustCompile(`(?i)\b(fail|failed|error)\b`)
)

// A login that shows no code by then asks something new or words it differently: waiting on would spin until the code expires.
const providerSignInCodeTimeout = 45 * time.Second

// deviceLoginURL and deviceLoginCode read the engine's device login: "Go to: <url>", then "Enter code: <code>".
func deviceLoginURL(line string) string {
	if m := deviceURLRe.FindStringSubmatch(line); m != nil {
		return strings.TrimRight(m[1], ").,]}>")
	}
	return ""
}

func deviceLoginCode(line string) string {
	if m := deviceCodeRe.FindStringSubmatch(line); m != nil {
		return strings.ToUpper(m[1])
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

// Keyed by agent: the key belongs to the provider that issued it, so another agent's must never surface.
func (a *App) cachedAPIKey(id airuntime.AgentID) (string, time.Time) {
	a.agentMu.Lock()
	defer a.agentMu.Unlock()
	return a.cachedAPIKeyLocked(id)
}

// The same read for a caller already holding agentMu; sync.Mutex is not reentrant.
func (a *App) cachedAPIKeyLocked(id airuntime.AgentID) (string, time.Time) {
	return a.agentAPIKeys[id], a.agentAPIKeyAts[id]
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
	a.agentAPIKeys[id] = key
	a.agentAPIKeyAts[id] = time.Now()
	a.agentMu.Unlock()
	// Persist in the OS keychain so it survives a restart. A store failure (e.g. no Secret
	// Service on headless Linux) is not fatal: the in-memory key works for this run, matching
	// how the Arduino Cloud refresh token degrades.
	if err := agentauth.StoreAPIKey(id, key); err != nil {
		slog.Warn("agent API key not persisted; sign-in valid for this session only", "agent", id, "err", err)
	}
	return nil
}

// ProviderCredential is one configured provider as the settings list shows it: never the key itself.
type ProviderCredential struct {
	ProviderID string `json:"providerId"`
	Name       string `json:"name"`
	EnvVar     string `json:"envVar"`
	MaskedKey  string `json:"maskedKey"`
	AddedAt    string `json:"addedAt,omitempty"` // ISO 8601, so the settings row survives a restart
	// Connected by signing in on the provider's site: there is no key to mask.
	SignedIn bool `json:"signedIn,omitempty"`
}

// The part of the engine's catalogue the settings panel offers; empty for a single-key agent and before it has ever fetched it.
func (a *App) AgentProviders(agentID string) ([]agentauth.Provider, error) {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return nil, err
	}
	list, err := agentauth.OfferedProviders(id)
	if err != nil || len(list) > 0 || !a.runtimeInstalled(id) {
		return list, err
	}
	// An install whose warm-up failed has no catalogue until the engine first runs: fetch it now.
	if werr := a.warmProviderCatalog(id); werr != nil {
		slog.Warn("provider catalogue not fetched", "agent", id, "err", werr)
	}
	return agentauth.OfferedProviders(id)
}

// warmProviderCatalog runs one fetch per agent at a time: a caller arriving meanwhile waits for it instead of starting another CLI of up to a minute.
func (a *App) warmProviderCatalog(id airuntime.AgentID) error {
	a.runtimeMu.Lock()
	if running, ok := a.catalogFetches[id]; ok {
		a.runtimeMu.Unlock()
		select {
		case <-running:
		case <-a.ctx().Done():
		}
		return nil
	}
	done := make(chan struct{})
	if a.catalogFetches == nil {
		a.catalogFetches = map[airuntime.AgentID]chan struct{}{}
	}
	a.catalogFetches[id] = done
	a.runtimeMu.Unlock()
	defer func() {
		a.runtimeMu.Lock()
		delete(a.catalogFetches, id)
		a.runtimeMu.Unlock()
		close(done)
	}()
	return agentauth.WarmProviderCatalog(a.ctx(), id)
}

// AgentProviderCredentials reports which providers have a key, for the settings list and the connect card.
func (a *App) AgentProviderCredentials(agentID string) ([]ProviderCredential, error) {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return nil, err
	}
	return a.providerCredentials(id)
}

// providerKeyRefusal is a provider key App Lab did not keep, which the frontend words from these fields.
type providerKeyRefusal struct {
	Code        string `json:"code"`
	Message     string `json:"message"`
	Provider    string `json:"provider"`
	KeyProvider string `json:"keyProvider,omitempty"` // the provider the key's prefix belongs to
	Prefix      string `json:"prefix,omitempty"`      // how the provider's keys start
	Reason      string `json:"reason,omitempty"`      // the provider's own words for its refusal
}

func (e *providerKeyRefusal) Error() string     { return e.Message }
func (e *providerKeyRefusal) ErrorCode() string { return e.Code }

// keyShapeRefusal refuses, before any request, a mangled paste or a key of another provider.
func keyShapeRefusal(agentID airuntime.AgentID, provider agentauth.Provider, key string) *providerKeyRefusal {
	prefix := agentauth.KeyPrefix(agentID, provider.ID)
	refuse := func(code, message string) *providerKeyRefusal {
		return &providerKeyRefusal{Code: code, Message: message, Provider: provider.Name, Prefix: prefix}
	}
	if strings.ContainsAny(key, " \t\r\n") {
		return refuse("provider_key_has_spaces", "the key has a space or a line break inside")
	}
	ownerID, ownerName := agentauth.KeyOwner(agentID, key)
	if ownerID != "" && ownerID != provider.ID {
		refusal := refuse("provider_key_for_another_provider", fmt.Sprintf("that key is for %s, not %s", ownerName, provider.Name))
		refusal.KeyProvider = ownerName
		return refusal
	}
	if prefix == "" {
		return nil
	}
	// The prefix found further in means text before the key; a key with no prefix at all is left to the provider.
	if strings.Index(key, prefix) > 0 {
		return refuse("provider_key_text_before", "the pasted text has something before the key")
	}
	if ownerID == provider.ID && strings.Count(key, prefix) > 1 {
		return refuse("provider_key_repeated", "the pasted text holds the key more than once")
	}
	return nil
}

// Adds to the set: every provider with a key contributes its models. The bool is whether it was checked.
func (a *App) AgentSetProviderKey(agentID, providerID, apiKey string) (bool, error) {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return false, err
	}
	key := strings.TrimSpace(apiKey)
	if key == "" {
		return false, errors.New("API key is empty")
	}
	provider, err := agentauth.ProviderByID(id, providerID)
	if err != nil {
		return false, err
	}
	if agentauth.IsSignInProvider(id, providerID) {
		return false, fmt.Errorf("%s is connected by signing in, not with a key", provider.Name)
	}
	if refusal := keyShapeRefusal(id, provider, key); refusal != nil {
		return false, refusal
	}
	// Checked before it is kept; a provider we cannot ask is accepted rather than blamed on the key.
	verified := true
	switch err := agentauth.VerifyProviderKey(a.ctx(), provider, key); {
	case errors.Is(err, agentauth.ErrAPIKeyRejected):
		var rejection *agentauth.KeyRejection
		reason := ""
		if errors.As(err, &rejection) {
			reason = rejection.Reason
		}
		slog.Info("[agent] provider refused a key", "provider", provider.ID, "err", err)
		return false, &providerKeyRefusal{
			Code:     "provider_key_rejected",
			Message:  fmt.Sprintf("%s rejected that API key — check you copied it in full from its console", provider.Name),
			Provider: provider.Name,
			Reason:   reason,
		}
	case errors.Is(err, agentauth.ErrProviderUnverifiable):
		// Reported to the user too: a key nobody could check fails on the first message, not here.
		verified = false
		slog.Info("provider key stored unchecked", "provider", provider.ID, "why", err)
	case err != nil:
		return false, err
	}
	if err := agentauth.StoreProviderKey(id, providerID, key); err != nil {
		return false, err
	}
	dropFreeNewChatPick(id)
	a.agentMu.Lock()
	a.agentAPIKeyAts[id] = time.Now()
	a.agentMu.Unlock()
	return verified, nil
}

// The whole of connecting for an agent that asks for nothing, and what keeps installed from meaning in use.
func (a *App) AgentConnectWithoutCredential(agentID string) error {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}
	if !agentauth.UsableWithoutCredential(id) {
		return fmt.Errorf("%s needs a credential to connect", id)
	}
	if !a.runtimeInstalled(id) {
		return fmt.Errorf("%s is not installed", id)
	}
	return agentauth.MarkConnected(id)
}

// AgentDeleteProviderKey removes one provider's key, or signs out of a sign-in provider; the others stay.
func (a *App) AgentDeleteProviderKey(agentID, providerID string) error {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}
	if agentauth.IsSignInProvider(id, providerID) {
		return agentauth.SignOutProvider(id, providerID)
	}
	return agentauth.DeleteProviderKey(id, providerID)
}

// pendingProviderSignIn is the running provider sign-in; a pointer, so only its own run clears it.
type pendingProviderSignIn struct {
	agentID airuntime.AgentID
	cancel  context.CancelFunc
}

// ProviderSignInPrompt is what the user does on the provider's site to finish a provider sign-in.
type ProviderSignInPrompt struct {
	ProviderID string `json:"providerId"`
	URL        string `json:"url"`
	Code       string `json:"code"`
}

// AgentProviderSignIn runs the engine's own login for a sign-in provider, sends its code as "agent:provider-sign-in", and lists it once stored.
func (a *App) AgentProviderSignIn(agentID, providerID string) error {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}
	args, input, err := agentauth.ProviderSignIn(id, providerID)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithCancel(a.ctx())
	defer cancel()
	run := &pendingProviderSignIn{agentID: id, cancel: cancel}
	a.agentMu.Lock()
	prev := a.providerSignIn
	a.providerSignIn = run
	a.agentMu.Unlock()
	if prev != nil {
		prev.cancel()
	}
	defer func() {
		a.agentMu.Lock()
		if a.providerSignIn == run {
			a.providerSignIn = nil
		}
		a.agentMu.Unlock()
	}()

	var url, code, problem string
	var once sync.Once
	shown := make(chan struct{})
	onLine := func(line string) {
		clean := strings.TrimSpace(strings.TrimLeft(ansiEscapeRe.ReplaceAllString(line, ""), "│┌└◆◇●■▲◒◐◓◑ "))
		if cliProblemRe.MatchString(clean) {
			problem = clean
		}
		if u := deviceLoginURL(clean); u != "" {
			url = u
		}
		if c := deviceLoginCode(clean); c != "" {
			code = c
		}
		if url != "" && code != "" {
			once.Do(func() {
				close(shown)
				a.emit("agent:provider-sign-in", ProviderSignInPrompt{ProviderID: providerID, URL: url, Code: code})
			})
		}
	}
	var timedOut atomic.Bool
	go func() {
		select {
		case <-shown:
		case <-ctx.Done():
		case <-time.After(providerSignInCodeTimeout):
			timedOut.Store(true)
			cancel()
		}
	}()
	var answer func(io.WriteCloser)
	if input != "" {
		answer = func(w io.WriteCloser) { _, _ = io.WriteString(w, input) }
	}
	if err := agentauth.RunCLIStreaming(ctx, id, agentauth.Options{Method: agentauth.None}, onLine, answer, args...); err != nil {
		if timedOut.Load() {
			msg := "the sign-in showed no code, so the engine's login may have changed"
			if problem != "" {
				msg += ": " + problem
			}
			return errors.New(msg)
		}
		if problem != "" {
			return errors.New(problem) // "exit status 1" alone tells the user nothing
		}
		return err
	}
	// The CLI's exit status proves nothing: the credential the engine wrote does.
	stored, err := agentauth.EngineHasCredential(id, providerID)
	if err != nil {
		return err
	}
	if !stored {
		return errors.New("the sign-in did not finish; start it again")
	}
	if err := agentauth.RecordProviderSignIn(id, providerID); err != nil {
		return err
	}
	dropFreeNewChatPick(id)
	return nil
}

// A new provider means new chats start on its first model; a paid model the user chose stays.
func dropFreeNewChatPick(id airuntime.AgentID) {
	picks := agent.PickFileOf(id)
	if agentauth.FreeModels(id)[picks.Pick(agent.NewChatPick).Model] {
		picks.DropPick(agent.NewChatPick)
	}
}

// AgentCancelProviderSignIn stops the running provider sign-in; nothing is recorded for it.
func (a *App) AgentCancelProviderSignIn(agentID string) error {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}
	a.stopProviderSignIn(id)
	return nil
}

func (a *App) stopProviderSignIn(id airuntime.AgentID) {
	a.agentMu.Lock()
	run := a.providerSignIn
	a.agentMu.Unlock()
	if run != nil && run.agentID == id {
		run.cancel()
	}
}

// For a credential-free agent: there has to be something to run, and installing it is connecting it.
func (a *App) runtimeInstalled(id airuntime.AgentID) bool {
	m, err := a.runtime(id)
	if err != nil {
		return false
	}
	st, err := m.Status(a.ctx())
	return err == nil && st.Installed
}

// Keyed by agent, so installing one runtime no longer refuses to start the other. Caller holds agentMu.
func (a *App) setInstallingLocked(id airuntime.AgentID, installing bool) {
	if a.installing == nil {
		a.installing = map[airuntime.AgentID]bool{}
	}
	a.installing[id] = installing
}

func (a *App) providerCredentials(id airuntime.AgentID) ([]ProviderCredential, error) {
	configured, err := agentauth.ConfiguredProviders(id)
	if err != nil {
		return nil, err
	}
	catalogue, err := agentauth.Providers(id)
	if err != nil {
		return nil, err
	}
	known := make(map[string]agentauth.Provider, len(catalogue))
	for _, p := range catalogue {
		known[p.ID] = p
	}
	// The panel's names win: a key added as "Google Gemini" must not come back as "Google".
	offered, _ := agentauth.OfferedProviders(id)
	for _, p := range offered {
		known[p.ID] = p
	}
	out := make([]ProviderCredential, 0, len(configured))
	listed := make(map[string]bool, len(configured))
	for _, c := range configured {
		p, ok := known[c.ID]
		if !ok {
			continue // dropped from the catalogue since; nothing to show and nothing to inject
		}
		// A sign-in is what the engine holds, not what our list remembers.
		if held, _ := agentauth.EngineHasCredential(id, c.ID); p.SignIn && !held {
			continue
		}
		listed[c.ID] = true
		entry := ProviderCredential{ProviderID: c.ID, Name: p.Name, EnvVar: p.EnvVar, SignedIn: p.SignIn}
		if !p.SignIn {
			key, _ := agentauth.ReadProviderKey(id, c.ID)
			entry.MaskedKey = maskAPIKey(key)
		}
		if !c.AddedAt.IsZero() {
			entry.AddedAt = c.AddedAt.UTC().Format(time.RFC3339)
		}
		out = append(out, entry)
	}
	// Signed in without our list knowing, e.g. cancelled after the engine stored it: the engine uses it, so it shows.
	for _, p := range offered {
		if held, _ := agentauth.EngineHasCredential(id, p.ID); p.SignIn && !listed[p.ID] && held {
			out = append(out, ProviderCredential{ProviderID: p.ID, Name: p.Name, EnvVar: p.EnvVar, SignedIn: true})
		}
	}
	return out, nil
}

// AgentAuthStatus reports whether the agent can skip the connect screen (a persisted subscription login or an API key set this session), plus the details shown in the settings "Agent" section.
func (a *App) AgentAuthStatus(agentID string) (agent.AuthStatus, error) {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return agent.AuthStatus{}, err
	}
	apiKey, apiKeyAt := a.cachedAPIKey(id)

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

	// One key per provider: connected is at least one, and the account line names them, not a key.
	if creds, cerr := a.providerCredentials(id); cerr == nil && len(creds) > 0 {
		names := make([]string, 0, len(creds))
		for _, c := range creds {
			names = append(names, c.Name)
		}
		status.Method = "subscription"
		for _, c := range creds {
			if !c.SignedIn {
				status.Method = "api_key"
				break
			}
		}
		status.Account = strings.Join(names, ", ")
		if at := agentauth.FirstConfiguredAt(id); !at.IsZero() {
			status.ConnectedAt = at.UTC().Format(time.RFC3339)
		}
		return status, nil
	}

	acc, err := agentauth.ReadSubscriptionAccount(id)
	if err != nil {
		return agent.AuthStatus{}, err
	}
	if !acc.LoggedIn {
		// Connected once the user says so: an installed runtime is not a choice they made.
		if at := agentauth.ConnectedAt(id); !at.IsZero() && agentauth.UsableWithoutCredential(id) {
			status.ConnectedAt = at.UTC().Format(time.RFC3339)
			return status, nil
		}
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

// The agent in use: the one running, else the one a start would pick. One answer, so every surface agrees.
func (a *App) AgentCurrent() string {
	a.agentMu.Lock()
	running, live := a.agentMgrID, a.agentMgr != nil
	a.agentMu.Unlock()
	if live && running != "" {
		return string(running)
	}
	if stored := readDefaultAgent(); stored != "" {
		if id, err := airuntime.ParseAgent(stored); err == nil {
			return string(id)
		}
	}
	return string(airuntime.DefaultAgent)
}

func isDefaultAgent(id airuntime.AgentID) bool { return defaultAgentIs(readDefaultAgent(), id) }

// Falls back to the shipped agent: answering "yes, whichever you asked about" makes both claim default.
func defaultAgentIs(stored string, id airuntime.AgentID) bool {
	if stored != "" {
		return stored == string(id)
	}
	return id == airuntime.DefaultAgent
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

// One mirror serves whichever agent runs: push every edit → check it landed → stop → push again → only then delete; checked before the stop, so a refusal leaves the chats running.
func (a *App) AgentSwitch(agentID string) (err error) {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}
	a.agentMu.Lock()
	running := a.agentMgrID
	m := a.agentMgr
	if running == id {
		a.agentMu.Unlock()
		return nil // already there, running or merely stopped: AgentStop leaves the id set
	}
	// Claimed before releasing: the phases below relock, and an AgentStart between them would get a dead cwd.
	if a.switching {
		a.agentMu.Unlock()
		return errors.New("an agent switch is already in progress")
	}
	a.switching = true
	a.agentMu.Unlock()
	restartOld := false
	defer func() {
		a.agentMu.Lock()
		a.switching = false
		a.agentMu.Unlock()
		// After the reset: AgentStart refuses while a switch is in progress.
		if restartOld {
			serr := a.AgentStart(string(running))
			if serr != nil {
				slog.Warn("[agent] the agent a refused switch had stopped did not start again", "agent", running, "err", serr)
			}
			err = afterRestart(err, running, serr)
		}
	}()

	if err := a.refuseWhileATurnRuns(); err != nil {
		return err
	}
	if err := a.flushForSwitch(); err != nil {
		return err
	}
	if m != nil {
		// Again just before the stop: a prompt sent during the flush would be killed by it.
		if err := a.refuseWhileATurnRuns(); err != nil {
			return err
		}
		if err := a.AgentStop(); err != nil {
			restartOld = true
			return err
		}
		// Again: a turn may have edited between the first flush and the stop.
		if err := a.flushForSwitch(); err != nil {
			restartOld = true
			return err
		}
	}
	if err := a.clearAgentMirror(); err != nil {
		restartOld = m != nil
		return err
	}
	// The id follows the switch: leaving the old one made a switch back skip the flush as a no-op.
	a.agentMu.Lock()
	a.agentMgrID = id
	a.agentMu.Unlock()
	return nil
}

// refuseWhileATurnRuns counts a turn until its turn-end sync is over, which a streaming check misses, and not the auth probe, which is no chat.
func (a *App) refuseWhileATurnRuns() error {
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	for _, t := range a.turns {
		select {
		case <-t.done:
		default:
			return errors.New("cannot switch agent yet: a chat is still answering. Let it finish or stop it, then try again")
		}
	}
	return nil
}

// afterRestart says whether the agent in use, stopped by the switch, runs again; any error after the stop goes out coded, as only the fields tell the frontend.
func afterRestart(err error, id airuntime.AgentID, startErr error) error {
	var refusal *switchRefusal
	if !errors.As(err, &refusal) {
		refusal = &switchRefusal{Code: "agent_switch_failed", Message: err.Error()}
		err = refusal
	}
	refusal.Restarted, refusal.RestartFailed = startErr == nil, startErr != nil
	if startErr != nil {
		refusal.Message += fmt.Sprintf(". %s could not be started again: %v", id, startErr)
	}
	return err
}

// flushForSwitch refuses while an edit is not on the board; edits withheld from a read-only app can never land, so they stay in the set-aside workspace instead of blocking.
func (a *App) flushForSwitch() error {
	// force: the turn that made these edits is over, so the mtime gate has nothing left to protect.
	failed, conflicts, withheld, complete := a.syncCheckoutsComplete(time.Time{}, true)
	if len(failed) > 0 || len(conflicts) > 0 {
		return a.unsavedEditsRefusal(mergeSyncFailures(failed, conflicts), conflicts)
	}
	for appID := range withheld {
		slog.Info("[agent] switch: edits to a read-only app stay in the set-aside workspace", "app", appID)
	}
	// Empty means "nothing to push" only if the flush looked at everything; ghost mirrors it never sees.
	if !complete {
		return errors.New("cannot switch agent yet: the board changed while the workspace was being saved. Try again")
	}
	if stranded := a.strandedMirrors(); len(stranded) > 0 {
		return &switchRefusal{
			Code:    "agent_switch_stranded_edits",
			Message: fmt.Sprintf("cannot switch agent yet: %s hold edits that belong to no app on the board, so they cannot be saved. Move or delete them first", strings.Join(stranded, ", ")),
			Folders: stranded,
		}
	}
	return nil
}

// switchRefusal is a refused or failed agent switch the frontend words itself: from the apps or folders that hold it back, else from its message.
type switchRefusal struct {
	Code            string   `json:"code"`
	Message         string   `json:"message"`
	Apps            []string `json:"apps,omitempty"`
	ConflictingApps []string `json:"conflictingApps,omitempty"` // of Apps, those whose edits conflict with the board; the others' push failed
	Folders         []string `json:"folders,omitempty"`
	// Set when the refusal came after the stop: the agent in use was started again as a new process, or it could not be.
	Restarted     bool `json:"restarted,omitempty"`
	RestartFailed bool `json:"restartFailed,omitempty"`
}

func (e *switchRefusal) Error() string     { return e.Message }
func (e *switchRefusal) ErrorCode() string { return e.Code }

// unsavedEditsRefusal names the apps the user knows; a conflict has its own code, as only a new checkout of the app clears it.
func (a *App) unsavedEditsRefusal(byApp, conflicts map[string]error) error {
	var names, conflicted, failed []string
	askBoard := true // no more board calls after one fails: the board is the likely cause of the refusal
	for appID, err := range byApp {
		slog.Warn("[agent] switch refused: edits not on the board", "app", appID, "err", err)
		name, fromBoard := a.appDisplayName(appID, askBoard)
		askBoard = askBoard && fromBoard
		names = append(names, name)
		if conflicts[appID] != nil {
			conflicted = append(conflicted, name)
		} else {
			failed = append(failed, name)
		}
	}
	for _, list := range [][]string{names, conflicted, failed} {
		sort.Strings(list)
	}
	if len(conflicted) == 0 {
		return &switchRefusal{
			Code:    "agent_switch_unsaved_edits",
			Message: fmt.Sprintf("cannot switch agent yet: the edits to %s are not on the board, and switching empties the shared workspace", strings.Join(names, ", ")),
			Apps:    names,
		}
	}
	list := strings.Join(conflicted, ", ")
	message := fmt.Sprintf("cannot switch agent yet: the agent's edits to %s conflict with changes made on the board after its checkout, so they are not on the board. "+
		"Ask the agent to check out %s again: it gets the board's version, and can apply its edits again or drop them. Then switch", list, list)
	if len(failed) > 0 {
		message += fmt.Sprintf(". The edits to %s could not be saved to the board either: check the board connection", strings.Join(failed, ", "))
	}
	return &switchRefusal{Code: "agent_switch_conflicting_edits", Message: message, Apps: names, ConflictingApps: conflicted}
}

// appDisplayName is the name the user knows an app by: the board's when askBoard, else the one in its id; fromBoard says the board answered.
func (a *App) appDisplayName(appID string, askBoard bool) (name string, fromBoard bool) {
	if base, err := a.InferOrchestratorURL(); askBoard && err == nil && base != "" {
		if boardName, err := arduinoapps.AppName(a.ctx(), base, appID); err == nil && boardName != "" {
			return boardName, true
		}
	}
	if name := appIDName(appID); name != "" {
		return name, false
	}
	return appID, false
}

// Several outcomes, one message: elsewhere they call for different advice, here each means "not yet".
func mergeSyncFailures(sets ...map[string]error) map[string]error {
	out := map[string]error{}
	for _, set := range sets {
		for appID, err := range set {
			out[appID] = err
		}
	}
	return out
}

// Mirror dirs whose app is gone from the board: syncCheckouts walks checkedOut and never sees them.
func (a *App) strandedMirrors() []string {
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	out := make([]string, 0, len(a.ghostMirrors))
	for name := range a.ghostMirrors {
		out = append(out, name)
	}
	sort.Strings(out)
	return out
}

func (a *App) clearAgentMirror() error {
	root, err := airuntime.MirrorRootDir()
	if err != nil {
		return err
	}
	// Bumped BEFORE the move: an in-flight sync holding the old value would recreate the directories.
	a.checkoutMu.Lock()
	checkedOut, issues, ghosts := a.checkedOut, a.pendingSyncIssues, a.ghostMirrors
	a.checkedOut = map[string]checkedApp{}
	a.pendingSyncIssues = map[string]syncIssue{}
	a.ghostMirrors = map[string]bool{}
	a.boardGen++
	gen := a.boardGen
	a.checkoutMu.Unlock()

	if err := setAsideMirror(root); err != nil {
		// The workspace stayed in place, and the agent restarted on it needs the baselines to push its deletions.
		a.checkoutMu.Lock()
		// Unless the board changed meanwhile: its reset dropped these checkouts for good.
		if a.boardGen == gen {
			a.checkedOut, a.pendingSyncIssues, a.ghostMirrors = checkedOut, issues, ghosts
		}
		a.checkoutMu.Unlock()
		return fmt.Errorf("clear the agent workspace: %w", err)
	}
	return nil
}

// savedMirrorPrefix names a workspace a switch set aside; savedMirrorsKept bounds how many pile up.
const savedMirrorPrefix = "ai-mirror.saved-"
const savedMirrorsKept = 3

// renameMirror is os.Rename, a variable so tests can make the move fail.
var renameMirror = os.Rename

// setAsideMirror moves the workspace aside rather than deleting: it may hold the only copy of an edit.
func setAsideMirror(root string) error {
	entries, err := os.ReadDir(root)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if len(entries) == 0 {
		return os.Remove(root)
	}
	parent := filepath.Dir(root)
	stamp := time.Now().UTC().Format("20060102-150405")
	saved := filepath.Join(parent, savedMirrorPrefix+stamp)
	// Two switches in the same second would collide, and renaming onto a full directory fails.
	for n := 2; n < 100; n++ {
		if _, err := os.Lstat(saved); errors.Is(err, os.ErrNotExist) {
			break
		}
		saved = filepath.Join(parent, fmt.Sprintf("%s%s-%d", savedMirrorPrefix, stamp, n))
	}
	if err := renameMirror(root, saved); err != nil {
		return err
	}
	slog.Info("[mirror] agent workspace set aside rather than deleted", "path", saved)
	pruneSavedMirrors(parent)
	return nil
}

// pruneSavedMirrors keeps the newest few; their names carry the timestamp, so the tail is the oldest.
func pruneSavedMirrors(parent string) {
	entries, err := os.ReadDir(parent)
	if err != nil {
		return
	}
	saved := make([]string, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() && strings.HasPrefix(e.Name(), savedMirrorPrefix) {
			saved = append(saved, e.Name())
		}
	}
	if len(saved) <= savedMirrorsKept {
		return
	}
	sort.Sort(sort.Reverse(sort.StringSlice(saved)))
	for _, name := range saved[savedMirrorsKept:] {
		if err := os.RemoveAll(filepath.Join(parent, name)); err != nil {
			slog.Warn("[mirror] could not prune a saved workspace", "path", name, "err", err)
		}
	}
}

// AgentDisconnect signs the agent out: it stops any running process, drops the API key (in-memory + keychain), and removes the persisted subscription credential so AgentAuthStatus reports not-authenticated.
func (a *App) AgentDisconnect(agentID string) error {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}
	a.stopProviderSignIn(id)
	// Only if this agent is the one running: AgentStop takes no id and would stop whichever was live.
	a.agentMu.Lock()
	running := a.agentMgr != nil && a.agentMgrID == id
	a.agentMu.Unlock()
	if running {
		if err := a.AgentStop(); err != nil {
			return err
		}
	}
	a.agentMu.Lock()
	delete(a.agentAPIKeys, id)
	delete(a.agentAPIKeyAts, id)
	a.agentMu.Unlock()
	// Drop the persisted key too, else the next restart would sign back in with it. Without a
	// keychain nothing was persisted, so a delete failure must not block the sign-out.
	if err := agentauth.DeleteAPIKey(id); err != nil {
		slog.Warn("agent API key keychain delete failed", "agent", id, "err", err)
	}
	// Every step runs even when one fails: stopping halfway left it neither connected nor disconnected.
	var firstErr error
	keep := func(err error) {
		if err != nil && firstErr == nil {
			firstErr = err
		}
	}
	keep(agentauth.DeleteAllProviderKeys(id))
	keep(agentauth.ClearConnected(id))
	keep(agentauth.SignOut(a.ctx(), id))
	return firstErr
}

// AgentSetDefault records agentID as the default agent launched for new sessions.
func (a *App) AgentSetDefault(agentID string) error {
	id, err := airuntime.ParseAgent(agentID)
	if err != nil {
		return err
	}
	if err := writeDefaultAgent(string(id)); err != nil {
		return err
	}
	// Choosing it is connecting it, for an agent that needs no key: without the record, removing its keys later reads as never connected.
	if agentauth.UsableWithoutCredential(id) && agentauth.ConnectedAt(id).IsZero() && a.runtimeInstalled(id) {
		if err := agentauth.MarkConnected(id); err != nil {
			slog.Warn("connection marker not written; the default is set", "agent", id, "err", err) // the default already changed
		}
	}
	return nil
}

// validateAuthTimeout bounds the throwaway validation turn so a slow probe never blocks opening the chat.
const validateAuthTimeout = 30 * time.Second

// AgentValidateAuth runs a throwaway turn so an expired/revoked credential fails here (before the chat) rather than on the user's first real prompt. Requires a started agent (AgentStart); the probe session is deleted so it never pollutes the session list, and its opening state is returned: the pickers a new session starts with, which AgentNewSessionState reads without a turn.
func (a *App) AgentValidateAuth() (agent.SessionState, error) {
	m, err := a.agentManager()
	if err != nil {
		return agent.SessionState{}, err
	}
	ctx, cancel := context.WithTimeout(a.ctx(), validateAuthTimeout)
	defer cancel()
	sid, drop, err := a.openProbeSession(ctx, m)
	if err != nil {
		return agent.SessionState{}, err
	}
	defer drop()
	return probeOpening(m, sid), m.Prompt(ctx, sid, "ping", nil)
}

// AgentNewSessionState reports what a new session starts with, without a prompt: an empty chat on an engine that creates its session on the first prompt has no other way to fill its pickers.
func (a *App) AgentNewSessionState() (agent.SessionState, error) {
	m, err := a.agentManager()
	if err != nil {
		return agent.SessionState{}, err
	}
	ctx, cancel := context.WithTimeout(a.ctx(), validateAuthTimeout)
	defer cancel()
	sid, drop, err := a.openProbeSession(ctx, m)
	if err != nil {
		return agent.SessionState{}, err
	}
	defer drop()
	return probeOpening(m, sid), nil
}

// probeOpening is a probe's state with the model a new chat starts on, which the probe itself stays off.
func probeOpening(m *agent.Manager, sid agent.SessionID) agent.SessionState {
	st := m.GetSessionState(sid)
	st.ModelID = m.NewChatModel(st.Models, st.ModelID)
	return st
}

// openProbeSession opens a session the user never sees: every session list hides it, and drop deletes it.
func (a *App) openProbeSession(ctx context.Context, m *agent.Manager) (agent.SessionID, func(), error) {
	cwd, err := a.sessionCwd()
	if err != nil {
		return "", nil, err
	}
	creating := make(chan struct{})
	a.agentMu.Lock()
	if a.probesCreating == nil {
		a.probesCreating = map[chan struct{}]struct{}{}
	}
	a.probesCreating[creating] = struct{}{}
	a.agentMu.Unlock()
	sid, err := m.NewProbeSession(ctx, cwd)
	a.agentMu.Lock()
	running := a.agentMgrID
	if err == nil {
		// Every probe this run: an engine with no session/delete keeps each one listed until its CLI has removed it.
		if a.probeSessionID != "" {
			a.pastProbes = append(a.pastProbes, a.probeSessionID)
		}
		a.probeSessionID, a.probeSeen = string(sid), false
	}
	delete(a.probesCreating, creating)
	a.agentMu.Unlock()
	close(creating)
	if err != nil {
		return "", nil, err
	}
	a.rememberProbe(running, sid) // before its prompt: a quit from here on leaves it in the engine's store
	// Best-effort delete; the id keeps being filtered until AgentListSessions sees the probe actually gone (a nil
	// error here isn't proof — DeleteSession gives up after a few verify attempts and still reports success).
	// An engine that cannot delete still frees it, so it is not left loaded, and then deletes it through its own CLI.
	drop := func() {
		a.stream().End(sid)
		err := m.DeleteSession(a.ctx(), sid)
		if errors.Is(err, agent.ErrDeleteSessionUnsupported) {
			_ = m.CloseSession(a.ctx(), sid)
			go a.deleteProbeThroughCLI(m, running, sid)
			return
		}
		if listed, lerr := a.engineSessions(m); err == nil && lerr == nil && !listed[string(sid)] {
			a.forgetProbe(running, string(sid))
		}
	}
	return sid, drop, nil
}

// rememberProbe stores a probe's id, so the next run hides it and deletes it if this run cannot.
func (a *App) rememberProbe(id airuntime.AgentID, sid agent.SessionID) {
	dir, err := airuntime.AgentConfigDir(id)
	if err != nil {
		return
	}
	a.storeMu.Lock()
	defer a.storeMu.Unlock()
	_ = writeSessionProbes(dir, append(readSessionProbes(dir), string(sid)))
}

// forgetProbe drops a probe's id once its session is gone.
func (a *App) forgetProbe(id airuntime.AgentID, sid string) {
	dir, err := airuntime.AgentConfigDir(id)
	if err != nil {
		return
	}
	a.storeMu.Lock()
	defer a.storeMu.Unlock()
	ids := readSessionProbes(dir)
	kept := make([]string, 0, len(ids))
	for _, s := range ids {
		if s != sid {
			kept = append(kept, s)
		}
	}
	if len(kept) != len(ids) {
		_ = writeSessionProbes(dir, kept)
	}
	agent.DropSessionPick(dir, sid) // a probe deleted through the CLI keeps the pick its turn stored
}

// storedProbes lists the probe ids the agent's store holds, this run's and those an earlier run left.
func (a *App) storedProbes(id airuntime.AgentID) []string {
	dir, err := airuntime.AgentConfigDir(id)
	if err != nil {
		return nil
	}
	a.storeMu.Lock()
	defer a.storeMu.Unlock()
	return readSessionProbes(dir)
}

// deleteLeftoverProbes deletes the probes an earlier run left by quitting mid-check; an id is forgotten only once the engine's list no longer holds it.
func (a *App) deleteLeftoverProbes(m *agent.Manager, id airuntime.AgentID, sids []string) {
	for _, sid := range a.deleteListedSessions(m, id, sids) {
		a.forgetProbe(id, sid)
	}
}

// deleteListedSessions deletes the sessions the engine still lists and returns those its list no longer holds; none when the list cannot be read.
func (a *App) deleteListedSessions(m *agent.Manager, id airuntime.AgentID, sids []string) (gone []string) {
	cwd, err := a.sessionCwd()
	if err != nil {
		return nil
	}
	listed, err := a.listedSessions(m, cwd)
	if err != nil {
		return nil // what is gone cannot be told: the next start tries again
	}
	for _, sid := range sids {
		if !listed[sid] {
			continue
		}
		err := m.DeleteSession(a.ctx(), agent.SessionID(sid))
		if errors.Is(err, agent.ErrDeleteSessionUnsupported) {
			ctx, cancel := context.WithTimeout(a.ctx(), probeDeleteTimeout)
			err = deleteSessionCLI(ctx, id, sid)
			cancel()
		}
		if err != nil {
			slog.Warn("[agent] a chat an earlier run left to delete is still stored", "agent", id, "session", sid, "err", err)
		}
	}
	if listed, err = a.listedSessions(m, cwd); err != nil {
		return nil
	}
	for _, sid := range sids {
		if !listed[sid] {
			gone = append(gone, sid)
		}
	}
	return gone
}

func (a *App) listedSessions(m *agent.Manager, cwd string) (map[string]bool, error) {
	sessions, err := m.ListSessions(a.ctx(), cwd)
	if err != nil {
		return nil, err
	}
	listed := make(map[string]bool, len(sessions))
	for _, s := range sessions {
		listed[s.ID] = true
	}
	return listed, nil
}

// probeDeleteTimeout bounds the CLI that removes a probe; it runs after the validation has already returned.
const probeDeleteTimeout = 30 * time.Second

// deleteProbeThroughCLI removes a probe the engine could only close: closed, it stays in the engine's own list and shows again once a restart drops the filter.
func (a *App) deleteProbeThroughCLI(m *agent.Manager, id airuntime.AgentID, sid agent.SessionID) {
	ctx, cancel := context.WithTimeout(a.ctx(), probeDeleteTimeout)
	defer cancel()
	if err := deleteSessionCLI(ctx, id, string(sid)); err != nil {
		slog.Warn("[agent] could not delete the auth probe session", "agent", id, "session", sid, "err", err)
		return
	}
	if listed, err := a.engineSessions(m); err == nil && !listed[string(sid)] {
		a.forgetProbe(id, string(sid))
	}
}

// probeIDWait bounds how long a list waits for a probe's id, so a session/new that hangs cannot hold the sidebar back.
const probeIDWait = 5 * time.Second

// waitForProbeID holds a list that may already show a probe whose id is not known yet, so it cannot be filtered out.
func (a *App) waitForProbeID() {
	a.agentMu.Lock()
	creating := make([]chan struct{}, 0, len(a.probesCreating))
	for c := range a.probesCreating {
		creating = append(creating, c)
	}
	running := a.agentMgrID
	a.agentMu.Unlock()
	if len(creating) == 0 {
		return
	}
	if d, err := agent.DialectFor(running); err != nil || !d.ListsNewSessions {
		return
	}
	deadline := time.After(probeIDWait)
	for _, c := range creating {
		select {
		case <-c:
		case <-deadline:
			slog.Warn("[agent] a probe has no id yet; listing sessions without it", "agent", running)
			return
		case <-a.ctx().Done():
			return
		}
	}
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
func keepNonProbeSessions(sessions []agent.SessionSummary, probe string, past ...string) (kept []agent.SessionSummary, probeListed bool) {
	drop := make(map[string]bool, len(past)+1)
	for _, id := range past {
		drop[id] = true
	}
	if probe != "" {
		drop[probe] = true
	}
	if len(drop) == 0 {
		return sessions, false
	}
	kept = make([]agent.SessionSummary, 0, len(sessions))
	for _, s := range sessions {
		if drop[s.ID] {
			probeListed = probeListed || s.ID == probe
			continue
		}
		kept = append(kept, s)
	}
	return kept, probeListed
}

// sessionsOnBoard drops the sessions the store binds to another board: app ids repeat across boards, so listing them all would
// show folders for apps this board doesn't have. One with no entry, or an entry predating board scoping, is kept: hiding history is worse.
func sessionsOnBoard(sessions []agent.SessionSummary, workspaces map[string]sessionWorkspaceEntry, boardID string) []agent.SessionSummary {
	if boardID == "" {
		return sessions // no board connected: nothing to compare against
	}
	kept := make([]agent.SessionSummary, 0, len(sessions))
	for _, s := range sessions {
		if ws, ok := workspaces[s.ID]; ok && ws.BoardID != "" && ws.BoardID != boardID {
			continue
		}
		kept = append(kept, s)
	}
	return kept
}

// AgentListSessions lists the connected board's persisted sessions (newest first), overlaying client-side custom titles.
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
	// The list groups chats by app, so this is where a chat of an app deleted outside App Lab would show.
	a.sweepDeletedApps()
	a.waitForProbeID()
	a.agentMu.Lock()
	probe := a.probeSessionID
	past := append([]string(nil), a.pastProbes...)
	// Stamped here because here is where it is true: the list came from this engine's own store.
	running := a.agentMgrID
	a.agentMu.Unlock()
	past = append(past, a.storedProbes(running)...)
	past = append(past, a.pendingSessionDeletes(running)...) // chats of a deleted app, until this engine's next run deletes them
	for i := range sessions {
		sessions[i].AgentID = string(running)
	}
	sessions, probeListed := keepNonProbeSessions(sessions, probe, past...)
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
		boardID := a.selectedBoardID()
		a.storeMu.Lock()
		titles, _ := readSessionTitles(dir)
		statuses, _ := readSessionStatus(dir)
		pins, _ := readSessionPins(dir)
		workspaces, _ := readSessionWorkspaces(dir)
		stored, createdErr := readSessionCreated(dir)
		a.storeMu.Unlock()
		if createdErr == nil {
			created = stored
		}
		sessions = sessionsOnBoard(sessions, workspaces, boardID)
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
			if ws, scoped := workspaces[sessions[i].ID]; scoped {
				sessions[i].WorkspaceAppID, sessions[i].WorkspaceName = ws.AppID, ws.Name
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
		if missing && createdErr == nil { // a file it could not read is never replaced: the list orders by these times for now
			a.storeMu.Lock()
			_ = writeSessionCreated(dir, created)
			a.storeMu.Unlock()
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
	a.storeMu.Lock()
	defer a.storeMu.Unlock()
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
	a.storeMu.Lock()
	defer a.storeMu.Unlock()
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
	sid := agent.SessionID(sessionID)
	err = m.DeleteSession(a.ctx(), sid)
	if errors.Is(err, agent.ErrDeleteSessionUnsupported) {
		err = a.deleteSessionThroughCLI(m, sid)
	}
	if err != nil {
		return err
	}
	if dir, err := a.agentConfigDir(); err == nil {
		a.storeMu.Lock()
		dropSessionEntries(dir, sessionID)
		a.storeMu.Unlock()
	}
	a.forgetTurn(sessionID)
	m.DropNotes(sid)
	a.stream().End(sid)
	return nil
}

// forgetTurn drops a deleted chat's last turn once it is over.
func (a *App) forgetTurn(sessionID string) {
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	if t := a.turns[sessionID]; t != nil {
		select {
		case <-t.done:
			delete(a.turns, sessionID)
		default:
		}
	}
}

// deleteSessionCLI is the engine CLI's own delete, a variable so tests run without a runtime.
var deleteSessionCLI = agentauth.DeleteSessionCLI

// deleteTurnStopWait bounds how long a delete waits for the chat's stopped turn, its turn-end sync included, to end.
var deleteTurnStopWait = 15 * time.Second

// deleteSessionThroughCLI deletes a chat of an engine whose ACP cannot: its turn is stopped first, and the chat stays open if the CLI fails.
func (a *App) deleteSessionThroughCLI(m *agent.Manager, sid agent.SessionID) error {
	if a.turnOpen(string(sid)) || m.StreamingSessions()[string(sid)] {
		_ = m.Cancel(a.ctx(), sid)
		if !a.turnEnded(m, string(sid), deleteTurnStopWait) {
			return errors.New("this chat was stopped but has not finished yet, so it was not deleted; try again in a moment")
		}
	}
	a.agentMu.Lock()
	id := a.agentMgrID
	a.agentMu.Unlock()
	ctx, cancel := context.WithTimeout(a.ctx(), probeDeleteTimeout)
	defer cancel()
	if err := deleteSessionCLI(ctx, id, string(sid)); err != nil {
		return err
	}
	// Freed only once it is gone: the engine's copy, the live entry and any card it still had open.
	_ = m.CloseSession(a.ctx(), sid)
	// The engine held the session while its CLI deleted it, and closing it may store it again.
	if listed, err := a.engineSessions(m); err == nil && listed[string(sid)] {
		return deleteSessionCLI(ctx, id, string(sid))
	}
	return nil
}

// turnOpen reports whether the session's last turn, its turn-end sync included, has not ended.
func (a *App) turnOpen(sid string) bool {
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	t := a.turns[sid]
	if t == nil {
		return false
	}
	select {
	case <-t.done:
		return false
	default:
		return true
	}
}

// turnEnded waits, up to limit, for the session's turn to end, its turn-end sync included.
func (a *App) turnEnded(m *agent.Manager, sid string, limit time.Duration) bool {
	deadline := time.NewTimer(limit)
	defer deadline.Stop()
	a.checkoutMu.Lock()
	t := a.turns[sid]
	a.checkoutMu.Unlock()
	if t != nil {
		select {
		case <-t.done:
		case <-deadline.C:
			return false
		}
	}
	for m.StreamingSessions()[sid] { // a turn AgentPrompt did not start, as the auth probe's
		select {
		case <-deadline.C:
			return false
		case <-time.After(100 * time.Millisecond):
		}
	}
	return true
}

// engineSessions is the engine's own list of sessions, by id.
func (a *App) engineSessions(m *agent.Manager) (map[string]bool, error) {
	cwd, err := a.sessionCwd()
	if err != nil {
		return nil, err
	}
	return a.listedSessions(m, cwd)
}

// dropSessionEntries forgets one session in every client-side store; the caller holds the store lock.
func dropSessionEntries(dir, sessionID string) {
	if titles, err := readSessionTitles(dir); err == nil {
		delete(titles, sessionID)
		_ = writeSessionTitles(dir, titles)
	}
	if statuses, err := readSessionStatus(dir); err == nil {
		delete(statuses, sessionID)
		_ = writeSessionStatus(dir, statuses)
	}
	if workspaces, err := readSessionWorkspaces(dir); err == nil {
		delete(workspaces, sessionID)
		_ = writeSessionWorkspaces(dir, workspaces)
	}
	if pins, err := readSessionPins(dir); err == nil {
		delete(pins, sessionID)
		_ = writeSessionPins(dir, pins)
	}
	if created, err := readSessionCreated(dir); err == nil {
		if _, ok := created[sessionID]; ok {
			delete(created, sessionID)
			_ = writeSessionCreated(dir, created)
		}
	}
	agent.DropSessionPick(dir, sessionID) // takes only its own lock, never the store lock held here
}

// AgentMarkSessionRead records that the user has seen a session's failed turn, so the sidebar stops showing it; true when there was one.
func (a *App) AgentMarkSessionRead(sessionID string) (bool, error) {
	dir, err := a.agentConfigDir()
	if err != nil {
		return false, err
	}
	a.storeMu.Lock()
	defer a.storeMu.Unlock()
	statuses, err := readSessionStatus(dir)
	if err != nil {
		return false, err
	}
	if statuses[sessionID] != "error" {
		return false, nil
	}
	delete(statuses, sessionID)
	return true, writeSessionStatus(dir, statuses)
}

// setSessionStatus records a session's last-turn outcome for the sidebar and the replay ("cancelled", "error" until read, cleared on success); best-effort.
func (a *App) setSessionStatus(sessionID string, turnErr error, stopped bool) {
	dir, err := a.agentConfigDir()
	if err != nil {
		return
	}
	a.storeMu.Lock()
	defer a.storeMu.Unlock()
	statuses, err := readSessionStatus(dir)
	if err != nil {
		return
	}
	switch _, ok := statuses[sessionID]; {
	case stopped:
		statuses[sessionID] = "cancelled"
	case turnErr != nil:
		statuses[sessionID] = "error"
	case ok:
		delete(statuses, sessionID)
	default:
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
	err = m.LoadSession(a.ctx(), agent.SessionID(sessionID), cwd, a.sessionWorkspaceFor(sessionID))
	a.stream().End(agent.SessionID(sessionID)) // the webview treats the replay as complete once this returns
	return err
}

// AgentNewSession opens a session in the shared mirror root, scoped to appID when the user picked one: the cwd stays the root and the scope travels in the system prompt.
func (a *App) AgentNewSession(appID, appName string) (string, error) {
	m, err := a.agentManager()
	if err != nil {
		return "", err
	}
	cwd, err := a.sessionCwd()
	if err != nil {
		return "", err
	}
	ws := a.sessionWorkspace(appID, appName)
	sid, err := m.NewSession(a.ctx(), cwd, ws)
	if err != nil {
		return "", err
	}
	a.rememberSessionWorkspace(string(sid), ws)
	return string(sid), nil
}

// sessionWorkspace resolves the picked app for the system prompt: the caller passes the name it already has, and only a caller without one pays for the board lookup.
func (a *App) sessionWorkspace(appID, appName string) agent.SessionWorkspace {
	appID = strings.TrimSpace(appID)
	if appID == "" {
		return agent.SessionWorkspace{}
	}
	ws := agent.SessionWorkspace{AppID: appID, Name: strings.TrimSpace(appName)}
	if ws.Name != "" {
		return ws
	}
	if orchestratorURL, err := a.InferOrchestratorURL(); err == nil {
		if name, err := arduinoapps.AppName(a.ctx(), orchestratorURL, appID); err == nil {
			ws.Name = name
		}
	}
	return ws
}

// rememberSessionWorkspace persists the pick, name included, so a reopened session keeps its focus without asking the board again.
// A general session (no app) is recorded too: its entry carries the board alone, which is what scopes it to this board in the sidebar.
func (a *App) rememberSessionWorkspace(sessionID string, ws agent.SessionWorkspace) {
	dir, err := a.agentConfigDir()
	if err != nil {
		return
	}
	boardID := a.selectedBoardID()
	a.storeMu.Lock()
	defer a.storeMu.Unlock()
	if ws.AppID != "" {
		delete(a.retiredGrants, boardGrantKey(boardID, ws.AppID)) // a new chat on the id: an app of that name exists again, so its grants are kept
	}
	workspaces, err := readSessionWorkspaces(dir)
	if err != nil {
		return
	}
	workspaces[sessionID] = sessionWorkspaceEntry{AppID: ws.AppID, Name: ws.Name, BoardID: boardID}
	_ = writeSessionWorkspaces(dir, workspaces)
}

// forgetGeneralSessionWorkspace drops a closed general session's entry: a general one holds nothing but the board, and keeping it would leave a dead row per abandoned "New chat".
func (a *App) forgetGeneralSessionWorkspace(sessionID string) {
	dir, err := a.agentConfigDir()
	if err != nil {
		return
	}
	a.storeMu.Lock()
	defer a.storeMu.Unlock()
	dropGeneralSessionWorkspace(dir, sessionID)
}

// dropGeneralSessionWorkspace removes one general session's entry; the caller holds the store lock.
// An app-scoped entry stays put: it also names the app a reopen has to read back.
func dropGeneralSessionWorkspace(dir, sessionID string) {
	workspaces, err := readSessionWorkspaces(dir)
	if err != nil {
		return
	}
	if ws, ok := workspaces[sessionID]; !ok || ws.AppID != "" {
		return
	}
	delete(workspaces, sessionID)
	_ = writeSessionWorkspaces(dir, workspaces)
	agent.DropSessionPick(dir, sessionID) // a closed unused chat keeps no pick
}

// sessionWorkspaceFor reads a session's persisted workspace from the file alone: asking the orchestrator here would stall the reopen on a slow board.
func (a *App) sessionWorkspaceFor(sessionID string) agent.SessionWorkspace {
	dir, err := a.agentConfigDir()
	if err != nil {
		return agent.SessionWorkspace{}
	}
	boardID := a.selectedBoardID()
	a.storeMu.Lock()
	workspaces, err := readSessionWorkspaces(dir)
	a.storeMu.Unlock()
	if err != nil {
		return agent.SessionWorkspace{}
	}
	ws := workspaces[sessionID]
	// Another board's chat: ids repeat across boards, so its app id would load this board's app of that name, grants and checkout included.
	if ws.BoardID != "" && ws.BoardID != boardID {
		return agent.SessionWorkspace{}
	}
	return agent.SessionWorkspace{AppID: ws.AppID, Name: ws.Name}
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
	a.agentMu.Lock()
	id := a.agentMgrID
	a.agentMu.Unlock()
	if err := hardenAgentPolicyDir(ws, id); err != nil {
		return "", err
	}
	return ws, nil
}

// The project-level configuration one engine reads from the cwd, and what must never be inside it.
type agentPolicy struct {
	dir     string
	entries []string
	// rootEntries sit in the cwd itself, beside dir.
	rootEntries []string
}

// Keyed by agent: the directory belongs to the engine, and a hardcoded ".claude" leaves the other unswept.
var agentPolicies = map[airuntime.AgentID]agentPolicy{
	airuntime.AgentClaude: {dir: ".claude", entries: []string{"settings.json", "settings.local.json"}},
	// Plugins and tools run code, agents, commands and modes carry permissions; the launch environment closes all of them, this is the second lock.
	airuntime.AgentOpenCode: {
		dir: ".opencode",
		entries: []string{
			"opencode.json", "opencode.jsonc", "plugin", "plugins", "tool", "tools",
			"agent", "agents", "command", "commands", "mode", "modes",
		},
		rootEntries: []string{"opencode.json", "opencode.jsonc"},
	},
}

// hardenAgentPolicyDir keeps <cwd>/.claude App Lab-owned with no permission policy: the agent-writable cwd is attacker-reachable (prompt injection), so a settings*.json there could grant permissions/bypassPermissions inside the engine before App Lab sees the call — belt-and-braces even if the adapter regresses on settingSources.
func hardenAgentPolicyDir(cwd string, id airuntime.AgentID) error {
	policy, ok := agentPolicies[id]
	if !ok {
		// Refuse rather than hand a writable cwd to an engine whose config surface was never swept.
		return fmt.Errorf("no policy directory known for agent %q — add one to agentPolicies before starting it", id)
	}
	dir := filepath.Join(cwd, policy.dir)
	if _, err := realPolicyDir(dir); err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("prepare agent policy dir: %w", err)
	}
	// Every engine's directory: one written before a restart outlived the sweep while the other ran.
	for _, other := range agentPolicies {
		if err := stripPolicyEntries(cwd, other); err != nil {
			return err
		}
	}
	return nil
}

func stripPolicyEntries(cwd string, policy agentPolicy) error {
	paths := make([]string, 0, len(policy.entries)+len(policy.rootEntries))
	isDir, err := realPolicyDir(filepath.Join(cwd, policy.dir))
	if err != nil {
		return err
	}
	for _, name := range policy.entries {
		if isDir {
			paths = append(paths, filepath.Join(cwd, policy.dir, name))
		}
	}
	for _, name := range policy.rootEntries {
		paths = append(paths, filepath.Join(cwd, name))
	}
	for _, p := range paths {
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

// realPolicyDir removes a link or a file standing where a policy folder goes: a sweep through a link deletes outside the workspace.
func realPolicyDir(dir string) (isDir bool, err error) {
	info, err := os.Lstat(dir)
	switch {
	case errors.Is(err, os.ErrNotExist):
		return false, nil
	case err != nil:
		return false, fmt.Errorf("read agent policy dir %s: %w", dir, err)
	case info.IsDir():
		return true, nil
	}
	if err := os.Remove(dir); err != nil {
		return false, fmt.Errorf("agent workspace holds %s, which is not a folder and cannot be removed: %w", dir, err)
	}
	slog.Warn("removed a link or file standing where an agent policy folder goes", "path", dir)
	return false, nil
}

// AgentPrompt runs a turn; editor is the editor beside the chat, nil from Agent Mode.
func (a *App) AgentPrompt(sessionID, text string, editor *agent.EditorContext) error {
	sid := agent.SessionID(sessionID)
	m, hold, err := a.holdPrompt(sid)
	if err != nil {
		return err
	}
	defer hold.Release()
	promptHeld(sessionID)
	a.stream().End(sid)            // the webview opens a new reply for this turn
	turn := a.beginTurn(sessionID) // mid-turn ghost sweeps (pendingGhostEdits) only consider files edited since a running turn began
	var turnErr error
	// At turn-end: reattach any mirror edited this turn without a checkout, then sync (even on error/cancel) so edits aren't stranded.
	// The turn counts as over only after the sync, so a window awaiting it reads the board the sync left.
	defer func() {
		a.syncTurnEnd(m, sessionID, turn)
		awaited := turnErr
		if m.TurnStopped(sid) {
			awaited = nil // a stopped turn is no failure to a window that follows it
		}
		a.finishTurn(turn, awaited)
	}()
	turnErr = hold.Prompt(a.ctx(), text, editor)
	a.stream().End(sid) // text still waiting would land after the turn's end and open a new reply
	a.setSessionStatus(sessionID, turnErr, m.TurnStopped(sid))
	return turnErr
}

// promptHeld runs once AgentPrompt holds its prompt, before its own work; a test lands a Stop there.
var promptHeld = func(sessionID string) {}

// holdPrompt holds the chat's next prompt under agentMu, which a Stop also takes to find the manager: one sent after the prompt ends it unsent.
func (a *App) holdPrompt(sid agent.SessionID) (*agent.Manager, *agent.PromptHold, error) {
	a.agentMu.Lock()
	defer a.agentMu.Unlock()
	if a.agentMgr == nil {
		return nil, nil, errors.New("agent not started")
	}
	return a.agentMgr, a.agentMgr.HoldPrompt(sid), nil // HoldPrompt takes only the manager's lock, and the manager never waits on agentMu under it
}

// syncTurnEnd leaves an app only another running chat touched to that chat's turn end: pushing it here would push that chat's half-made edits.
func (a *App) syncTurnEnd(m *agent.Manager, sessionID string, turn *agentTurn) {
	a.releaseParked(turn)
	type record struct{ apps, paths, changed []string }
	records := map[string]record{}
	read := func(sid string) record {
		apps, paths := m.Touched(agent.SessionID(sid))
		return record{apps, paths, m.AppsChanged(agent.SessionID(sid))}
	}
	// Read before the reattach's board calls; this session is left out of the running ones, as its next prompt may have started.
	records[sessionID] = read(sessionID)
	for other := range m.StreamingSessions() {
		if other != sessionID {
			records[other] = read(other)
		}
	}
	a.reattachEditedMirrors(a.earliestTurnStart())
	touched := map[string]map[string]bool{}
	edited := map[string]map[string]bool{}
	others := map[string]bool{}
	for sid, r := range records {
		touched[sid] = a.appsOf(r.apps, r.paths) // after the reattach, so an adopted checkout counts
		edited[sid] = a.appsOf(r.changed, r.paths)
		if sid != sessionID {
			for app := range touched[sid] {
				others[app] = true
			}
		}
	}
	slog.Info("[sync] turn end", "session", sessionID, "touched", touched[sessionID], "runningChatsTouched", others)
	_, _, _, notes := a.syncCheckouts(turn.since, false, turnEndKeep(touched[sessionID], others))
	for appID, texts := range notes {
		for _, recipient := range noteRecipients(appID, sessionID, edited) {
			for _, text := range texts {
				m.Notify(agent.SessionID(recipient), text)
			}
		}
	}
}

// notifyChatsThatEdited hands each note to the running chats whose turn edited its app, except the caller still in the call to tool naming appID: the notes are in that tool's result.
func (a *App) notifyChatsThatEdited(notes map[string][]string, tool, appID string) {
	if len(notes) == 0 {
		return
	}
	m, err := a.agentManager()
	if err != nil {
		return
	}
	for id := range m.StreamingSessions() {
		sid := agent.SessionID(id)
		if m.CallRunning(sid, tool, appID) {
			continue
		}
		_, paths := m.Touched(sid)
		edited := a.appsOf(m.AppsChanged(sid), paths)
		for noted, texts := range notes {
			if !edited[noted] {
				continue
			}
			for _, text := range texts {
				m.Notify(sid, text)
			}
		}
	}
}

// AgentAwaitTurn lets a reloaded window follow a turn it did not start: it returns after the turn and its sync, with the turn's error (nil if stopped or none).
func (a *App) AgentAwaitTurn(sessionID string) error {
	a.checkoutMu.Lock()
	t := a.turns[sessionID]
	a.checkoutMu.Unlock()
	if t == nil {
		return nil
	}
	select {
	case <-t.done:
	case <-a.ctx().Done():
		return a.ctx().Err()
	}
	a.checkoutMu.Lock()
	defer a.checkoutMu.Unlock()
	return t.err
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
	if err := m.CloseSession(a.ctx(), agent.SessionID(sessionID)); err != nil {
		return err
	}
	a.stream().End(agent.SessionID(sessionID))
	a.forgetGeneralSessionWorkspace(sessionID)
	return nil
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
