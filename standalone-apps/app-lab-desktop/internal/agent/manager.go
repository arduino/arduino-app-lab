package agent

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"
)

const (
	defaultMaxRestarts  = 3
	defaultRestartDelay = 500 * time.Millisecond
	// restartStabilityWindow: an agent that stays up this long counts as recovered, so a later crash starts a fresh restart budget.
	restartStabilityWindow = 60 * time.Second
	// sessionLoadTimeout bounds each engine load of a session, a reopen's or the resume's after a restart: a hung one would hold every later reopen.
	sessionLoadTimeout = 30 * time.Second
	// restartWait bounds how long a prompt waits for the engine a crash restart brings back; a launch that hangs would hold it forever.
	restartWait = 30 * time.Second
	// A just-closed session lingers briefly on the agent (close is acked before it releases); retry delete until it drops.
	deleteVerifyRetries  = 8
	deleteVerifyInterval = 250 * time.Millisecond
)

// ManagerConfig surfaces the agent's stream and restart events to the host.
type ManagerConfig struct {
	OnUpdate     func(SessionID, Update)
	OnPermission func(PermissionRequest)
	OnRestart    func(RestartInfo) // optional: agent crashed and is being restarted

	MaxRestarts  int           // consecutive auto-restarts before giving up (0 → default)
	RestartDelay time.Duration // base backoff, doubled each attempt (0 → default)
	MCPServers   []MCPServer   // MCP servers advertised on every session (board tools)
	Dialect      Dialect       // the engine's session envelope and tool naming; from DialectFor(agentID)
	BoardName    string        // connected board's display name, stated in every session's system prompt
	Grants       GrantStore    // optional: where "Always allow" answers are kept between runs
	// WorkspaceDir maps a workspace app id to its mirror directory; optional, and without it nothing counts as outside the workspace.
	WorkspaceDir func(appID string) string
	// AppNameAt names the app whose checkout holds a path, for a call that lands outside the workspace; optional.
	AppNameAt func(path string) string
	// FreeModels lists the model ids that cost nothing, from the engine's catalogue; optional.
	FreeModels func() map[string]bool
	// SessionScope gives a session's cwd and workspace, to load one the running engine does not hold before prompting it; optional.
	SessionScope func(SessionID) (cwd string, ws SessionWorkspace, err error)
	// Picks keeps each chat's model and mode, for a load to put back; optional, and without it a load keeps what the engine chose.
	Picks PickStore
}

// workspaceRebinder is implemented by the real connection: a rename has to reach the sessions already open on the app.
type workspaceRebinder interface {
	RebindWorkspace(oldID, newID, newName string)
}

// RebindWorkspace moves the sessions open on a renamed app to its new id: otherwise a restart reloads them on the old one and their grants stop matching.
func (m *Manager) RebindWorkspace(oldID, newID, newName string) {
	m.mu.Lock()
	for _, s := range m.sessions {
		if s.workspace.AppID == oldID {
			s.workspace.AppID = newID
			if newName != "" {
				s.workspace.Name = newName
			}
		}
		moveKey(s.namedApps, oldID, newID)
		moveKey(s.turnApps, oldID, newID)
	}
	m.mu.Unlock()
	conn, err := m.connection()
	if err != nil {
		return
	}
	if r, ok := conn.(workspaceRebinder); ok {
		r.RebindWorkspace(oldID, newID, newName)
	}
}

func moveKey(set map[string]bool, from, to string) {
	if set[from] {
		delete(set, from)
		set[to] = true
	}
}

// grantStoreSetter is implemented by the real connection; optional, so ConnFactory keeps its shape and the manager's fakes need know nothing about grants.
type grantStoreSetter interface {
	attachGrants(GrantStore)
	attachWorkspaceDirs(func(appID string) string)
}

// RestartInfo tells the UI the agent went down. Usually that is an auto-restart after an unexpected exit, but the host
// also sends it (GaveUp, with a Reason) when it tears the agent down deliberately. The tags pin the wire shape; Err
// stays host-side — an error interface marshals to an empty object at best, and to a dropped event at worst.
type RestartInfo struct {
	Attempt int    `json:"attempt"`           // 1-based restart attempt (0 for a deliberate teardown)
	Max     int    `json:"max"`               // restart budget
	GaveUp  bool   `json:"gaveUp"`            // the agent stays down: budget exhausted, or the host stopped it on purpose
	Reason  string `json:"reason,omitempty"`  // why it stays down, when it wasn't a crash (e.g. "board-changed")
	Resumed bool   `json:"resumed,omitempty"` // the restarted agent has reloaded the open sessions: their states may have changed
	Err     error  `json:"-"`                 // the crash cause, for host-side logging
}

// liveSession is the per-session state GetSessionState exposes for UI rehydration.
type liveSession struct {
	streaming bool
	modelID   string
	models    []AgentModel // models the agent advertised for this session
	modeID    string
	modes     []AgentMode      // operating modes the agent advertised for this session
	cwd       string           // working dir, replayed to LoadSession on auto-restart
	workspace SessionWorkspace // the app this session was opened for, replayed with the cwd so a restart keeps its focus
	pending   *PermissionRequest
	editor    editorSeen // what the agent has been shown of the editor beside the chat
	cancelled bool       // Stop was pressed during the running turn, so its prompt may never have reached the model
	stopped   bool       // the last turn ended because of Stop, by the engine's own stop reason
	untitled  bool       // new and not prompted yet: the CLI titles the session from its first message
	tokens    int        // the context size last reported, to notice the CLI compacting it
	resets    int        // bumped when what the agent was shown is forgotten, so a turn that saw one does not undo it
	// Reloaded on a restarted engine: its replay is the history the UI already shows, so it is not forwarded.
	resuming bool
	// Loaded before a prompt: its replay goes to the log, emptied for it, and not to the UI, which shows that history already.
	muted bool
	// The running engine created, loaded or resumed it: prompted otherwise, the CLI answers "Session not found".
	loaded   bool
	runShown bool          // the running turn sent an update that only a run sends
	recancel bool          // a Stop that the engine may have dropped: it came before the turn showed it runs
	loadDone chan struct{} // set while the engine loads the session (a resume, a reopen or a prompt's), closed when the load ends
	// What the running turn touched, for the turn-end sync: the apps its board tools named and the files it edited.
	turnApps  map[string]bool
	turnPaths map[string]bool
	turnCalls map[string]turnCall // each call as announced: its updates may carry neither title nor kind
	namedApps map[string]bool     // every app a board tool named in this run, so a rename can tell the chats that used it
	// The history as this run streamed it, replayed on a reopen instead of the engine's, which loses a running turn's text.
	log         []Update
	run         strings.Builder // the text of the last entry while it grows, so a long reply is not copied on every chunk
	logBytes    int
	logging     bool // updates are being added: a new session, or an engine replay in progress
	logComplete bool // the log holds the whole history
}

// turnCall is one call of a turn as its updates described it so far: the app it names, and whether it still runs.
type turnCall struct {
	title, kind, app string
	running          bool
}

// maxLogBytes bounds the history kept per session; past it a reopen asks the engine again.
var maxLogBytes = 4 << 20

// Manager runs the ACP conversation (sessions, prompts, permissions, auto-restart and the reload of open sessions after it).
type Manager struct {
	agent       *Agent
	connFactory ConnFactory
	cfg         ManagerConfig

	perms    *permissionRegistry
	elicits  *elicitationRegistry
	mctx     context.Context // agent lifetime; cancelled by Stop (not by the caller's ctx)
	cancel   context.CancelFunc
	readOnly map[string]bool // the board tools that change nothing, by bare name

	// Held around log-and-forward and around a replay, so a live update lands after the replay, never before it or twice; taken before mu.
	emitMu sync.Mutex

	mu            sync.Mutex
	conn          AgentConn
	authMethods   []AuthMethod
	sessions      map[SessionID]*liveSession // per-session state for GetSessionState
	notes         map[SessionID][]string     // what App Lab tells a chat with its next prompt; apart from sessions, as a chat not loaded yet can receive one
	unsent        map[SessionID]*promptStop  // what ends each chat's prompts not sent yet; apart from sessions too, as a chat not loaded has no entry
	restarting    chan struct{}              // set from a crash until the relaunched engine is back or the restart gives up, then closed
	models        []AgentModel               // the lists the engine last advertised, for a chat it has not shown yet
	modes         []AgentMode
	defaultModel  string // the current model and mode those lists came with: what the engine opens or loads a chat on
	defaultMode   string
	starting      bool // initial Start in progress (guards against concurrent/double Start)
	started       bool // first launch succeeded → auto-restart armed
	closed        bool
	restarts      int
	lastLaunch    time.Time // when the agent last came up; resets the restart budget after a stable run
	lastPromptSID SessionID // best-effort elicitation target (ACP v0.13.5 drops the sessionId from the request)

	stubDelay time.Duration // deletedStubDelay; a field, so a test shortens it for its own manager only
}

func NewManager(agent *Agent, factory ConnFactory, cfg ManagerConfig) *Manager {
	mctx, cancel := context.WithCancel(context.Background())
	readOnly := map[string]bool{}
	for _, s := range cfg.MCPServers {
		for _, t := range s.ReadOnlyTools {
			readOnly[t] = true
		}
	}
	m := &Manager{
		agent:       agent,
		connFactory: factory,
		cfg:         cfg,
		perms:       newPermissionRegistry(),
		elicits:     newElicitationRegistry(),
		sessions:    map[SessionID]*liveSession{},
		notes:       map[SessionID][]string{},
		unsent:      map[SessionID]*promptStop{},
		mctx:        mctx,
		cancel:      cancel,
		readOnly:    readOnly,
		stubDelay:   deletedStubDelay,
	}
	agent.cfg.OnExit = m.onExit // the Manager owns crash handling (auto-restart)
	return m
}

// Start launches the agent; ctx bounds only the startup handshake, not the process lifetime.
func (m *Manager) Start(ctx context.Context) error {
	m.mu.Lock()
	switch {
	case m.closed:
		m.mu.Unlock()
		return errors.New("manager stopped")
	case m.starting || m.started:
		m.mu.Unlock()
		return errors.New("agent already started")
	}
	m.starting = true
	m.restarts = 0
	m.mu.Unlock()

	err := m.launch(ctx)

	m.mu.Lock()
	m.starting = false
	if err == nil {
		m.started = true
	}
	m.mu.Unlock()
	return err
}

// launch brings the agent up once (spawn → connect → initialize); initCtx bounds only the handshake.
func (m *Manager) launch(initCtx context.Context) error {
	stdin, stdout, err := m.agent.Start(m.mctx)
	if err != nil {
		return err
	}
	conn, err := m.connFactory(stdin, stdout, m)
	if err != nil {
		_ = m.agent.Stop()
		return err
	}
	conn.SetDialect(m.cfg.Dialect)       // before anything that depends on how this engine names or reads things
	conn.SetMCPServers(m.cfg.MCPServers) // advertise board tools on every session (survives restart)
	conn.SetBoardName(m.cfg.BoardName)
	if s, ok := conn.(grantStoreSetter); ok {
		s.attachGrants(m.cfg.Grants) // re-read on every (re)start, so a crash does not forget what the user allowed
		s.attachWorkspaceDirs(m.cfg.WorkspaceDir)
	}
	methods, err := conn.Initialize(initCtx)
	if err != nil {
		_ = m.agent.Stop()
		return err
	}
	m.mu.Lock()
	m.conn = conn
	m.authMethods = methods
	m.lastLaunch = time.Now()
	m.mu.Unlock()
	return nil
}

// resumeSessions reloads the open sessions on a relaunched agent, all marked first so a prompt or a reopen waits for its own load; one that cannot reload is dropped.
func (m *Manager) resumeSessions() {
	type sess struct {
		sid       SessionID
		cwd       string
		workspace SessionWorkspace
		ptr       *liveSession
		done      chan struct{}
	}
	m.mu.Lock()
	conn := m.conn
	closed := m.closed
	list := make([]sess, 0, len(m.sessions))
	for sid, s := range m.sessions {
		if s.loadDone != nil || s.cwd == "" {
			continue // a reopen is loading it on the old engine (it fails, and the next reopen loads it here), or nothing can load it
		}
		s.resuming, s.loadDone = true, make(chan struct{})
		list = append(list, sess{sid, s.cwd, s.workspace, s, s.loadDone})
	}
	m.engineBack() // a prompt held by the restart now waits for its own chat's load
	m.mu.Unlock()
	for _, s := range list {
		m.mu.Lock()
		stale := m.closed || m.sessions[s.sid] != s.ptr // skip sessions closed or recreated since the snapshot
		m.mu.Unlock()
		var err error
		switch {
		case conn == nil || closed:
			err = errors.New("agent not started")
		case !stale:
			// The SDK returns only once the notifications sent before the response are handled, so the replay falls inside the flag.
			ctx, cancel := context.WithTimeout(m.mctx, sessionLoadTimeout)
			var res NewSessionResult
			if res, err = conn.LoadSession(ctx, s.sid, s.cwd, s.workspace); err == nil {
				m.applyLoad(ctx, conn, s.sid, s.ptr, res)
			}
			cancel()
		}
		m.mu.Lock()
		s.ptr.resuming, s.ptr.loadDone = false, nil
		s.ptr.loaded = err == nil && !stale
		if err != nil && m.sessions[s.sid] == s.ptr { // only drop the exact entry we failed to resume
			delete(m.sessions, s.sid)
		}
		m.mu.Unlock()
		close(s.done)
		if err == nil && !stale {
			m.announcePick(s.sid)
		}
	}
}

// applyLoad takes in what a load reported and puts the chat back on its model and mode, while the load is marked: no prompt runs first.
func (m *Manager) applyLoad(ctx context.Context, conn AgentConn, sid SessionID, s *liveSession, res NewSessionResult) {
	m.markFree(res.Models)
	m.mu.Lock()
	if m.sessions[sid] == s {
		s.applyResult(res)
	}
	m.noteLists(res)
	m.mu.Unlock()
	m.restorePick(ctx, conn, sid, res)
}

// waitForLoad holds a caller while the engine loads the session: a reopen inside a load would log the history twice. A closed stop ends the wait, and reports it.
func (m *Manager) waitForLoad(ctx context.Context, sid SessionID, stop <-chan struct{}) (bool, error) {
	m.mu.Lock()
	var done chan struct{}
	if s := m.sessions[sid]; s != nil {
		done = s.loadDone
	}
	m.mu.Unlock()
	if done == nil {
		return false, nil
	}
	return waitFor(ctx, done, stop)
}

// waitFor waits for done, a closed stop or the end of ctx; a stop counts even when done closed in the same instant.
func waitFor(ctx context.Context, done, stop <-chan struct{}) (stopped bool, err error) {
	select {
	case <-done:
	case <-stop:
	case <-ctx.Done():
	}
	select {
	case <-stop:
		return true, nil
	default:
		return false, ctx.Err()
	}
}

// promptStop ends a chat's prompts not sent yet, which wait for a restart or a load with no turn to cancel; a Stop, a delete or a close closes it.
type promptStop struct {
	stop  chan struct{}
	gone  bool // set before stop closes, when the chat was deleted or closed: its prompts end without a trace
	count int  // the prompts holding it
}

// holdUnsent registers a prompt not sent yet; call under m.mu.
func (m *Manager) holdUnsent(sid SessionID) *promptStop {
	p := m.unsent[sid]
	if p == nil {
		p = &promptStop{stop: make(chan struct{})}
		m.unsent[sid] = p
	}
	p.count++
	return p
}

func (m *Manager) releaseUnsent(sid SessionID, p *promptStop) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if p.count--; p.count == 0 && m.unsent[sid] == p {
		delete(m.unsent, sid)
	}
}

// endUnsent ends the chat's prompts not sent yet, reporting whether there were any; gone when the chat was deleted or closed. Call under m.mu.
func (m *Manager) endUnsent(sid SessionID, gone bool) bool {
	p := m.unsent[sid]
	if p == nil {
		return false
	}
	p.gone = gone
	close(p.stop)
	delete(m.unsent, sid)
	return true
}

func (m *Manager) NewSession(ctx context.Context, cwd string, ws SessionWorkspace) (SessionID, error) {
	return m.newSession(ctx, cwd, ws, true)
}

// NewProbeSession opens a chat the user never sees on the engine's own model: its turn must not be billed to the model a new chat starts on.
func (m *Manager) NewProbeSession(ctx context.Context, cwd string) (SessionID, error) {
	return m.newSession(ctx, cwd, SessionWorkspace{}, false)
}

func (m *Manager) newSession(ctx context.Context, cwd string, ws SessionWorkspace, onNewChatModel bool) (SessionID, error) {
	conn, _, err := m.engine(ctx, nil) // a new chat's first prompt opens it, so it waits for a crash restart as a prompt does
	if err != nil {
		return "", err
	}
	res, err := conn.NewSession(ctx, cwd, ws)
	if err != nil {
		return "", err
	}
	m.markFree(res.Models)
	opened := res
	if model := m.newChatModel(res.Models, res.CurrentModelID); onNewChatModel && model != "" && model != res.CurrentModelID {
		if err := conn.SetModel(ctx, res.SessionID, model); err != nil {
			slog.Warn("[models] could not start a new chat on its model", "session", string(res.SessionID), "model", model, "err", err)
		} else {
			res.CurrentModelID = model
			m.savePick(res.SessionID, SessionPick{Model: model}) // a load opens the chat on the engine's model
		}
	}
	m.mu.Lock()
	s := m.session(res.SessionID)
	s.cwd, s.workspace = cwd, ws
	s.untitled, s.loaded = true, true
	s.logging, s.logComplete = true, true // nothing happened before this, so the log is whole from the start
	s.applyResult(res)
	m.noteLists(opened) // the engine's model, which a chat with no pick loads on
	m.mu.Unlock()
	return res.SessionID, nil
}

// NewChatModel is the model a new chat starts on, from the lists and the model a session opened with.
func (m *Manager) NewChatModel(models []AgentModel, current string) string {
	if model := m.newChatModel(models, current); model != "" {
		return model
	}
	return current
}

// newChatModel is the model the user last switched to, else the first paid one when the engine opened on a free model; "" keeps the engine's.
func (m *Manager) newChatModel(models []AgentModel, currentID string) string {
	if m.cfg.Picks != nil {
		if model := firstOffered(models, func(o AgentModel) string { return o.ID }, m.cfg.Picks.Pick(NewChatPick).Model); model != "" {
			return model
		}
	}
	current := slices.IndexFunc(models, func(o AgentModel) bool { return o.ID == currentID })
	if current < 0 || !models[current].Free {
		return ""
	}
	// The menu lists the providers' models first, in the engine's order.
	if paid := slices.IndexFunc(models, func(o AgentModel) bool { return !o.Free }); paid >= 0 {
		return models[paid].ID
	}
	return ""
}

// noteLists keeps the engine's latest model and mode lists; call under m.mu.
func (m *Manager) noteLists(res NewSessionResult) {
	if len(res.Models) > 0 {
		m.models, m.defaultModel = res.Models, res.CurrentModelID
	}
	if len(res.Modes) > 0 {
		m.modes, m.defaultMode = res.Modes, res.CurrentModeID
	}
}

// markFree flags the models the engine's catalogue prices at zero, so the menu need not guess from the id.
func (m *Manager) markFree(models []AgentModel) {
	if m.cfg.FreeModels == nil || len(models) == 0 {
		return
	}
	free := m.cfg.FreeModels()
	for i := range models {
		models[i].Free = free[models[i].ID]
	}
}

// applyResult copies a session's advertised models/modes (and current selections) into the live entry.
// A result that advertises none (session/load answers without the model selector) keeps what the session
// already had: overwriting empties GetSessionState, and the UI hides both pickers for that session.
func (s *liveSession) applyResult(res NewSessionResult) {
	if len(res.Models) > 0 {
		s.models = res.Models
	}
	if len(res.Modes) > 0 {
		s.modes = res.Modes
	}
	if res.CurrentModelID != "" {
		s.modelID = res.CurrentModelID
	}
	if res.CurrentModeID != "" {
		s.modeID = res.CurrentModeID
	}
}

// ListSessions returns the agent's persisted sessions for a workspace cwd.
func (m *Manager) ListSessions(ctx context.Context, cwd string) ([]SessionSummary, error) {
	conn, err := m.connection()
	if err != nil {
		return nil, err
	}
	return conn.ListSessions(ctx, cwd)
}

// sessionDeleter is implemented by the real connection; an engine without session/delete must be refused before the cancel and close below, which would end its turn and unload the chat for nothing.
type sessionDeleter interface {
	DeletesSessions() bool
}

// DeleteSession permanently removes a persisted session and drops its live entry.
func (m *Manager) DeleteSession(ctx context.Context, sid SessionID) error {
	conn, err := m.connection()
	if err != nil {
		return err
	}
	m.mu.Lock()
	m.endUnsent(sid, true) // its prompts still waiting to be sent never are
	m.mu.Unlock()
	// Before the refusal too: a load still running would make the engine hold the chat again after a delete here or by its CLI.
	if _, err := m.waitForLoad(ctx, sid, nil); err != nil {
		return err
	}
	if d, ok := conn.(sessionDeleter); ok && !d.DeletesSessions() {
		return ErrDeleteSessionUnsupported
	}
	// claude-code-acp no-ops session/delete while the session is live and acks session/close before it releases it, so cancel any turn + close, then delete and retry until the session actually drops from the list.
	m.mu.Lock()
	s := m.sessions[sid]
	streaming, held := s != nil && s.streaming, s != nil && s.loaded
	cwd := ""
	if s != nil {
		cwd = s.cwd
		s.cancelled = s.cancelled || streaming // a request the engine sends before the delete ends gets no card
	}
	m.mu.Unlock()
	if streaming {
		_ = conn.Cancel(ctx, sid)
	}
	_ = conn.CloseSession(ctx, sid)
	m.dropPending(sid)
	delErr := conn.DeleteSession(ctx, sid)
	deleted := cwd == "" || !m.sessionListed(ctx, cwd, sid)
	attempts := 0
	for delErr == nil && !deleted && attempts < deleteVerifyRetries {
		time.Sleep(deleteVerifyInterval)
		delErr = conn.DeleteSession(ctx, sid)
		deleted = !m.sessionListed(ctx, cwd, sid)
		attempts++
	}
	if delErr != nil {
		return delErr
	}
	m.mu.Lock()
	delete(m.sessions, sid)
	delete(m.notes, sid)
	m.mu.Unlock()
	if m.cfg.Picks != nil {
		m.cfg.Picks.DropPick(sid)
	}
	if held {
		go m.deleteStub(conn, sid, m.stubDelay)
	}
	return nil
}

// deletedStubDelay is how long after a delete the chat is deleted once more: the Claude CLI that held it can write one last line after the delete, a stub file.
const deletedStubDelay = 2 * time.Second

// deleteStub deletes the chat again, best-effort: the usual answer is that nothing is left to delete.
func (m *Manager) deleteStub(conn AgentConn, sid SessionID, delay time.Duration) {
	select {
	case <-time.After(delay):
	case <-m.mctx.Done():
		return
	}
	ctx, cancel := context.WithTimeout(m.mctx, sessionLoadTimeout)
	defer cancel()
	_ = conn.DeleteSession(ctx, sid)
}

// sessionListed reports whether sid still appears in the agent's persisted session list for cwd.
func (m *Manager) sessionListed(ctx context.Context, cwd string, sid SessionID) bool {
	conn, err := m.connection()
	if err != nil {
		return false
	}
	list, err := conn.ListSessions(ctx, cwd)
	if err != nil {
		return false
	}
	for _, ss := range list {
		if ss.ID == string(sid) {
			return true
		}
	}
	return false
}

// LoadSession replays a session this run holds whole from its log, with no engine call; any other is loaded from the engine, which fills the log.
func (m *Manager) LoadSession(ctx context.Context, sid SessionID, cwd string, ws SessionWorkspace) error {
	conn, _, err := m.engine(ctx, nil) // during a crash restart, waits for the engine as a prompt does
	if err != nil {
		return err
	}
	var live *liveSession
	done := make(chan struct{})
	for live == nil {
		if _, err := m.waitForLoad(ctx, sid, nil); err != nil {
			return err
		}
		if m.replayLog(sid) {
			return nil
		}
		m.mu.Lock()
		if s := m.session(sid); s.loadDone == nil { // one engine load per session: another caller waits, then replays the log
			live = s
			live.loadDone = done
			live.cwd, live.workspace = cwd, ws
			live.resetLog(true)
		}
		m.mu.Unlock()
	}
	loadCtx, cancel := context.WithTimeout(ctx, sessionLoadTimeout)
	defer cancel()
	res, err := conn.LoadSession(loadCtx, sid, cwd, ws)
	if err == nil {
		m.applyLoad(loadCtx, conn, sid, live, res)
	}
	m.mu.Lock()
	if m.sessions[sid] == live { // don't resurrect a session deleted/closed during replay
		live.loaded = err == nil
		if err != nil {
			live.resetLog(false)
		} else {
			live.logComplete = live.logging // still logging: the cap was not reached during the replay
		}
	}
	live.loadDone = nil
	m.mu.Unlock()
	close(done)
	return err
}

// readyToSend waits until the running engine holds the chat, through a crash restart, a load under way or a load of its own; a closed stop ends it.
func (m *Manager) readyToSend(ctx context.Context, sid SessionID, stop <-chan struct{}) (AgentConn, bool, error) {
	for {
		conn, stopped, err := m.engine(ctx, stop)
		if stopped || err != nil {
			return nil, stopped, err
		}
		m.mu.Lock()
		var loading chan struct{}
		loaded := false
		if s := m.sessions[sid]; s != nil {
			loading, loaded = s.loadDone, s.loaded
		}
		m.mu.Unlock()
		if loading != nil {
			// A resume, a reopen or another prompt is loading it; looked at again after, as that load can fail.
			if stopped, err := waitFor(ctx, loading, stop); stopped || err != nil {
				return nil, stopped, err
			}
			continue
		}
		if loaded {
			return conn, false, nil
		}
		tried, stopped, err := m.loadBeforePrompt(ctx, conn, sid, stop)
		if stopped || err != nil {
			return nil, stopped, err
		}
		if !tried {
			return conn, false, nil // nothing to load it with: prompted as it is
		}
	}
}

// engine waits, up to restartWait, for the engine a crash restart brings back, so a caller reaches it instead of failing; a closed stop ends the wait.
func (m *Manager) engine(ctx context.Context, stop <-chan struct{}) (AgentConn, bool, error) {
	m.mu.Lock()
	conn, back := m.conn, m.restarting
	m.mu.Unlock()
	if conn == nil && back != nil {
		timer := time.NewTimer(restartWait)
		defer timer.Stop()
		select {
		case <-back:
		case <-timer.C:
		case <-stop:
		case <-ctx.Done():
		}
		select {
		case <-stop:
			return nil, true, nil
		default:
		}
		if err := ctx.Err(); err != nil {
			return nil, false, err
		}
	}
	conn, err := m.connection()
	return conn, false, err
}

// loadBeforePrompt loads, muted, a chat the running engine does not hold (false: nothing can load it); a Stop leaves the load running, or its replay reaches the UI.
func (m *Manager) loadBeforePrompt(ctx context.Context, conn AgentConn, sid SessionID, stop <-chan struct{}) (bool, bool, error) {
	m.mu.Lock()
	var cwd string
	var ws SessionWorkspace
	if s := m.sessions[sid]; s != nil {
		cwd, ws = s.cwd, s.workspace
	}
	m.mu.Unlock()
	if cwd == "" && m.cfg.SessionScope != nil {
		var err error
		if cwd, ws, err = m.cfg.SessionScope(sid); err != nil {
			return false, false, err
		}
	}
	if cwd == "" {
		return false, false, nil
	}
	m.mu.Lock()
	select {
	case <-stop: // pressed while the scope was read: no load to start
		m.mu.Unlock()
		return true, true, nil
	default:
	}
	s, created := m.sessions[sid], false
	if s == nil {
		s, created = m.session(sid), true
	}
	if s.loadDone != nil || s.loaded {
		m.mu.Unlock()
		return true, false, nil // another caller loaded it meanwhile, or is loading it
	}
	done := make(chan struct{})
	s.loadDone, s.muted = done, true
	s.cwd, s.workspace = cwd, ws
	s.resetLog(true)
	m.mu.Unlock()

	var loadErr error
	go func() {
		loadCtx, cancel := context.WithTimeout(m.mctx, sessionLoadTimeout)
		defer cancel()
		res, err := conn.LoadSession(loadCtx, sid, cwd, ws)
		if err == nil {
			m.applyLoad(loadCtx, conn, sid, s, res)
		}
		m.mu.Lock()
		s.muted, s.loadDone = false, nil
		kept := m.sessions[sid] == s // not closed or deleted meanwhile
		switch {
		case !kept:
		case err == nil:
			s.loaded = true
			s.logComplete = s.logging // still logging: the cap was not reached during the replay
		case created:
			delete(m.sessions, sid) // a chat that cannot be loaded leaves no entry behind
		default:
			s.resetLog(false)
		}
		m.mu.Unlock()
		loadErr = err
		close(done)
		if kept && err == nil {
			m.announcePick(sid)
		}
	}()
	if stopped, err := waitFor(ctx, done, stop); stopped || err != nil {
		return true, stopped, err
	}
	if loadErr != nil {
		stopped, err := m.loadError(ctx, conn, sid, cwd, loadErr, stop)
		return true, stopped, err
	}
	return true, false, nil
}

// loadFailure is a failed load before a prompt as the JSON-RPC error the UI reads; errorKind tells a chat the engine lost from a load to retry.
type loadFailure struct {
	gone  bool
	cause error
}

func (e *loadFailure) Error() string {
	code, kind, message := -32603, "session_load_failed", "The agent could not reopen this chat. Try again."
	if e.gone {
		code, kind, message = -32002, "session_gone", "The agent no longer has this chat, so it cannot reopen it. Start a new chat."
	}
	b, _ := json.Marshal(map[string]any{"code": code, "message": message, "data": map[string]string{"errorKind": kind}})
	return string(b)
}

func (e *loadFailure) Unwrap() error { return e.cause }

// loadError is what a prompt returns for the load before it that failed: an auth refusal as the engine sent it, which the UI answers with a sign-in. A closed stop ends it as a Stop.
func (m *Manager) loadError(ctx context.Context, conn AgentConn, sid SessionID, cwd string, err error, stop <-chan struct{}) (bool, error) {
	outcome := loadRefusal(err)
	if outcome == authRefused {
		return false, err
	}
	gone, stopped := outcome == chatGone, false
	if outcome == chatMaybeGone {
		var listed bool
		listed, stopped = engineLists(ctx, conn, cwd, sid, stop)
		gone = !listed
	}
	slog.Warn("[session] the load before a prompt failed", "session", string(sid), "gone", gone, "stopped", stopped, "err", err)
	if stopped {
		return true, nil
	}
	return false, &loadFailure{gone: gone, cause: err}
}

// listCheckTimeout bounds the list that tells a lost chat from a failed load: an engine that failed the load may not answer.
const listCheckTimeout = 5 * time.Second

// engineLists reports whether the engine's own list holds the chat; true when the list cannot be read, which proves nothing. A closed stop ends the list.
func engineLists(ctx context.Context, conn AgentConn, cwd string, sid SessionID, stop <-chan struct{}) (listed, stopped bool) {
	ctx, cancel := context.WithTimeout(ctx, listCheckTimeout)
	defer cancel()
	go func() {
		select {
		case <-stop:
			cancel()
		case <-ctx.Done():
		}
	}()
	list, err := conn.ListSessions(ctx, cwd)
	select {
	case <-stop:
		return true, true
	default:
	}
	return err != nil || slices.ContainsFunc(list, func(s SessionSummary) bool { return s.ID == string(sid) }), false
}

// resetLog empties the log; logging says whether updates are added to it from now on.
func (s *liveSession) resetLog(logging bool) {
	s.log, s.logBytes, s.logging, s.logComplete = nil, 0, logging, false
	s.run.Reset()
}

// replayLog sends a reopened session its history from the log, after a replay_start that tells the UI to drop what it shows.
func (m *Manager) replayLog(sid SessionID) bool {
	m.emitMu.Lock()
	defer m.emitMu.Unlock()
	m.mu.Lock()
	s := m.sessions[sid]
	if s == nil || !s.logComplete {
		m.mu.Unlock()
		return false
	}
	history := s.logged()
	m.mu.Unlock()
	if m.cfg.OnUpdate != nil {
		m.cfg.OnUpdate(sid, Update{Type: "replay_start"})
		for _, u := range history {
			m.cfg.OnUpdate(sid, u)
		}
	}
	return true
}

// The updates only a turn the engine runs sends: a prompt it has not taken yet sends none.
var runUpdates = map[string]bool{"message_chunk": true, "thinking": true, "tool_call": true, "tool_call_update": true, "checklist": true}

// The updates a replay must repeat: what the thread shows. Model, mode and usage are state, read from GetSessionState.
var loggedUpdates = map[string]bool{
	"message_chunk": true, "thinking": true, "tool_call": true, "tool_call_update": true,
	"checklist": true, "choices": true, "user_message": true, "message_error": true, "turn_stopped": true,
}

// addToLog keeps a content update for the replay; size is updateSize(u), worked out before m.mu is taken. Call under m.mu.
func (s *liveSession) addToLog(u Update, size int) {
	if !s.logging || !loggedUpdates[u.Type] {
		return
	}
	u.Call = nil
	// One entry per run of text, as the UI keeps one part: a replay of a long reply is then one event, not one per streamed chunk.
	text := u.Type == "message_chunk" || u.Type == "thinking"
	if i := s.lastPart(); text && i >= 0 && s.log[i].Type == u.Type {
		if s.run.Len() == 0 {
			s.run.WriteString(s.log[i].Delta) // the run was closed by an entry removed since
		}
		if u.Delta == s.run.String() {
			return // a chunk repeating the text so far, which the UI drops too
		}
		s.run.WriteString(u.Delta)
	} else {
		if !s.inPlace(u, len(s.log)) {
			s.closeRun()
		}
		s.log = append(s.log, u)
		if text {
			s.run.WriteString(u.Delta)
		}
	}
	s.logBytes += size
	if s.logBytes > maxLogBytes {
		s.resetLog(false)
	}
}

// lastPart is the entry behind the UI's last part, -1 for none: an entry that changes a part in place adds none.
func (s *liveSession) lastPart() int {
	i := len(s.log) - 1
	for i >= 0 && s.inPlace(s.log[i], i) {
		i--
	}
	return i
}

// inPlace reports whether u, logged at index at, changes a part the UI already shows: a call's update, or a checklist or question shown earlier in the same reply.
func (s *liveSession) inPlace(u Update, at int) bool {
	switch u.Type {
	case "tool_call_update":
		return true
	case "checklist", "choices":
		id := partID(u)
		for j := at - 1; id != "" && j >= 0 && s.log[j].Type != "user_message"; j-- {
			if s.log[j].Type == u.Type && partID(s.log[j]) == id {
				return true
			}
		}
	}
	return false
}

func partID(u Update) string {
	switch {
	case u.Checklist != nil:
		return u.Checklist.ID
	case u.Choices != nil:
		return u.Choices.ID
	}
	return ""
}

// closeRun writes the text the open run grew into its entry.
func (s *liveSession) closeRun() {
	if i := s.lastPart(); i >= 0 && s.run.Len() > 0 {
		s.log[i].Delta = s.run.String()
	}
	s.run.Reset()
}

// logged is a copy of the log with the open run's text in place; call under m.mu.
func (s *liveSession) logged() []Update {
	history := append([]Update(nil), s.log...)
	if i := s.lastPart(); i >= 0 && s.run.Len() > 0 {
		history[i].Delta = s.run.String()
	}
	return history
}

// updateSize approximates what an update holds, for the log cap.
func updateSize(u Update) int {
	n := len(u.Delta) + len(u.Output) + len(u.ID)
	if u.ToolCall != nil {
		n += len(u.ToolCall.Title) + len(u.ToolCall.Output) + jsonSize(u.ToolCall.Input)
	}
	return n + jsonSize(u.Input)
}

func jsonSize(v any) int {
	if v == nil {
		return 0
	}
	b, err := json.Marshal(v)
	if err != nil {
		return 0
	}
	return len(b)
}

// dropLoggedChoice removes a question once it is answered: a replay would show it again, asking for nothing.
func (m *Manager) dropLoggedChoice(sid SessionID, id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.sessions[sid]
	if s == nil {
		return
	}
	for i, u := range s.log {
		if u.Type == "choices" && u.Choices != nil && u.Choices.ID == id {
			s.closeRun()
			s.log = append(s.log[:i], s.log[i+1:]...)
			return
		}
	}
}

// beforeTurnStarts runs between a prompt's last wait and the step that starts its turn; a test lands a Stop there.
var beforeTurnStarts = func() {}

// PromptHold is a prompt registered before it is sent: from HoldPrompt on, a Stop, a delete or a close ends it unsent.
type PromptHold struct {
	m        *Manager
	sid      SessionID
	unsent   *promptStop
	released sync.Once
}

// HoldPrompt registers the chat's next prompt for a caller with work of its own before it sends it with the hold's Prompt; Release the hold after.
func (m *Manager) HoldPrompt(sid SessionID) *PromptHold {
	m.mu.Lock()
	defer m.mu.Unlock()
	return &PromptHold{m: m, sid: sid, unsent: m.holdUnsent(sid)}
}

// Release ends the hold; a second call does nothing.
func (h *PromptHold) Release() {
	h.released.Do(func() { h.m.releaseUnsent(h.sid, h.unsent) })
}

// Prompt runs the held prompt's turn, as Manager.Prompt does.
func (h *PromptHold) Prompt(ctx context.Context, text string, editor *EditorContext) error {
	return h.m.prompt(ctx, h.sid, h.unsent, text, editor)
}

// Prompt runs a turn. editor is the editor beside the chat (nil without one); the agent gets what it has not seen of it yet.
func (m *Manager) Prompt(ctx context.Context, sid SessionID, text string, editor *EditorContext) error {
	h := m.HoldPrompt(sid)
	defer h.Release()
	return h.Prompt(ctx, text, editor)
}

func (m *Manager) prompt(ctx context.Context, sid SessionID, unsent *promptStop, text string, editor *EditorContext) error {
	m.mu.Lock()
	if s := m.sessions[sid]; s != nil { // a turn that never starts must not hand the last one's outcome or record to the host
		s.stopped = false
		s.turnApps, s.turnPaths, s.turnCalls = nil, nil, nil
	}
	m.mu.Unlock()
	conn, stopped, err := m.readyToSend(ctx, sid, unsent.stop)
	if err != nil {
		return err
	}
	beforeTurnStarts()
	var before, notes []string
	var seen editorSeen
	sentEditor := false
	command, isCommand := slashCommand(text)
	m.mu.Lock()
	// Checked in the step that marks the turn running: a delete from then on finds it so, and cancels it on the engine.
	select {
	case <-unsent.stop:
		stopped = true
	default:
	}
	if stopped {
		gone, loading := unsent.gone, false
		if s := m.sessions[sid]; s != nil {
			loading = s.loadDone != nil
		}
		if !gone {
			m.session(sid).stopped = true
		}
		m.mu.Unlock()
		if !gone && !loading { // a load still running is filling the log with the history before it
			m.logPrompt(sid, text) // the UI shows it, with the turn marked stopped
			m.logStopped(sid)
		}
		return nil
	}
	m.lastPromptSID = sid // elicitations carry no sessionId; route them to whoever is prompting
	s := m.session(sid)
	s.streaming = true
	s.cancelled, s.stopped, s.runShown, s.recancel = false, false, false, false
	s.turnApps, s.turnPaths, s.turnCalls = map[string]bool{}, map[string]bool{}, map[string]turnCall{}
	if contextResetCommands[command] {
		s.editor = editorSeen{} // the agent keeps no file content past these, so the next prompt sends it again
		s.resets++
	}
	resets := s.resets
	// No block with a command, which must stay first (the adapter reads prompt[0]); no note in an untitled session, titled from its first message.
	if pending := m.notes[sid]; len(pending) > 0 && !isCommand && !s.untitled {
		notes = append([]string(nil), pending...)
		before = append(before, appLabNoteText(notes))
	}
	if editor != nil && !isCommand {
		if block, next := editorContextText(s.editor, editor, s.untitled); block != "" {
			before, seen, sentEditor = append(before, block), next, true
		}
	}
	m.mu.Unlock()
	defer m.endTurn(sid)
	m.logPrompt(sid, text)
	engineCancelled, err := conn.Prompt(ctx, sid, text, before)
	completed := err == nil && !engineCancelled // a failed or stopped turn may never have reached the model
	m.mu.Lock()
	stopped = false
	if s := m.sessions[sid]; s != nil {
		stopped = s.cancelled && !completed // a Stop that lands after the engine finished changes nothing
		s.stopped = stopped
		if completed {
			if !isCommand {
				s.untitled = false
			}
			if sentEditor && s.resets == resets {
				s.editor = seen
			}
			m.takeNotes(sid, len(notes))
		}
	}
	m.mu.Unlock()
	switch {
	case stopped:
		m.logStopped(sid)
	case err != nil:
		m.logPromptError(sid, err)
	}
	return err
}

// logPrompt adds the typed text to the session's log: the UI showed it when it was sent, so it is not forwarded.
func (m *Manager) logPrompt(sid SessionID, text string) {
	m.emitMu.Lock()
	defer m.emitMu.Unlock()
	m.mu.Lock()
	defer m.mu.Unlock()
	if s := m.sessions[sid]; s != nil {
		s.addToLog(Update{Type: "user_message", Delta: text}, len(text))
	}
}

// logPromptError keeps a failed turn's error for the replay; live, the UI has it from the prompt call.
func (m *Manager) logPromptError(sid SessionID, err error) {
	m.emitMu.Lock()
	defer m.emitMu.Unlock()
	m.mu.Lock()
	defer m.mu.Unlock()
	if s := m.sessions[sid]; s != nil {
		s.addToLog(Update{Type: "message_error", Delta: err.Error()}, len(err.Error()))
	}
}

// logStopped keeps a stopped turn's mark for the replay, as the engine's own replay of a stopped Claude turn has one; live, the UI marks it itself.
func (m *Manager) logStopped(sid SessionID) {
	m.emitMu.Lock()
	defer m.emitMu.Unlock()
	m.mu.Lock()
	defer m.mu.Unlock()
	if s := m.sessions[sid]; s != nil {
		s.addToLog(Update{Type: "turn_stopped"}, 0)
	}
}

// Notify queues a note App Lab gives a chat with its next prompt, once: a sync it ran, or a rename it made.
func (m *Manager) Notify(sid SessionID, text string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, n := range m.notes[sid] {
		if n == text {
			return
		}
	}
	m.notes[sid] = append(m.notes[sid], text)
}

// takeNotes drops the first n notes, the ones a turn delivered; any queued during the turn stay. Call under m.mu.
func (m *Manager) takeNotes(sid SessionID, n int) {
	if n == 0 {
		return
	}
	if n > len(m.notes[sid]) {
		n = len(m.notes[sid])
	}
	if rest := m.notes[sid][n:]; len(rest) > 0 {
		m.notes[sid] = rest
	} else {
		delete(m.notes, sid)
	}
}

// The commands after which the agent no longer holds what it was shown of the editor.
var contextResetCommands = map[string]bool{"compact": true, "clear": true, "reset": true, "new": true}

// The Claude CLI runs a message as a command only when its first word is "/" and a name like this.
var commandName = regexp.MustCompile(`^[a-zA-Z0-9_][a-zA-Z0-9:_-]*$`)

// slashCommand returns the command a message runs, if it runs one; "// comment" or "/etc/hosts …" is a plain message.
func slashCommand(text string) (string, bool) {
	fields := strings.Fields(text)
	if len(fields) == 0 || !strings.HasPrefix(fields[0], "/") || !commandName.MatchString(fields[0][1:]) {
		return "", false
	}
	return fields[0][1:], true
}

func (m *Manager) Cancel(ctx context.Context, sid SessionID) error {
	m.mu.Lock()
	if s := m.sessions[sid]; s != nil && s.streaming {
		s.cancelled = true
		s.recancel = m.cfg.Dialect.DropsEarlyCancel && !s.runShown
	}
	unsent := m.endUnsent(sid, false)
	conn := m.conn
	m.mu.Unlock()
	if conn == nil {
		if unsent {
			return nil // a prompt waiting for the engine to come back was all there was to stop
		}
		return errors.New("agent not started")
	}
	err := conn.Cancel(ctx, sid)
	// After the cancel, as ACP orders it: answered first, the request reads as a reject, and a rejected doom_loop fails the turn.
	m.dropPending(sid)
	return err
}

// CloseSession frees a session's local state and tells the agent to drop it.
func (m *Manager) CloseSession(ctx context.Context, sid SessionID) error {
	m.mu.Lock()
	m.endUnsent(sid, true) // its prompts still waiting to be sent never are
	m.mu.Unlock()
	// A load still running keeps its replay muted while it lasts, and the engine would hold the chat again after the close.
	if _, err := m.waitForLoad(ctx, sid, nil); err != nil {
		return err
	}
	m.mu.Lock()
	delete(m.sessions, sid)
	m.mu.Unlock()
	m.dropPending(sid)
	conn, err := m.connection()
	if err != nil {
		return err
	}
	return conn.CloseSession(ctx, sid)
}

func (m *Manager) SetModel(ctx context.Context, sid SessionID, modelID string) error {
	conn, held, err := m.heldBy(ctx, sid)
	if err != nil {
		return err
	}
	m.mu.Lock()
	var was string
	if s := m.sessions[sid]; s != nil {
		was = s.modelID
	}
	m.mu.Unlock()
	if !held && m.cfg.Picks != nil {
		m.keepPick(sid, SessionPick{Model: modelID})
		m.noteNewChatPick(was, modelID)
		return nil
	}
	if err := conn.SetModel(ctx, sid, modelID); err != nil {
		return err
	}
	m.mu.Lock()
	m.session(sid).modelID = modelID
	m.mu.Unlock()
	m.savePick(sid, SessionPick{Model: modelID})
	m.noteNewChatPick(was, modelID)
	return nil
}

// noteNewChatPick keeps a switch for new chats; re-selecting the current model is how the UI refreshes the list, not a choice.
// With no known model a re-select cannot be told from a switch, so it is not kept.
func (m *Manager) noteNewChatPick(was, modelID string) {
	if was != "" && modelID != was {
		m.savePick(NewChatPick, SessionPick{Model: modelID})
	}
}

func (m *Manager) SetMode(ctx context.Context, sid SessionID, modeID string) error {
	conn, held, err := m.heldBy(ctx, sid)
	if err != nil {
		return err
	}
	if !held && m.cfg.Picks != nil {
		m.keepPick(sid, SessionPick{Mode: modeID})
		return nil
	}
	if err := conn.SetMode(ctx, sid, modeID); err != nil {
		return err
	}
	m.mu.Lock()
	m.session(sid).modeID = modeID
	m.mu.Unlock()
	m.savePick(sid, SessionPick{Mode: modeID})
	return nil
}

// heldBy returns the running engine and whether it holds the chat, once a crash restart or a load of the chat under way is over.
func (m *Manager) heldBy(ctx context.Context, sid SessionID) (AgentConn, bool, error) {
	conn, _, err := m.engine(ctx, nil)
	if err != nil {
		return nil, false, err
	}
	if _, err := m.waitForLoad(ctx, sid, nil); err != nil {
		return nil, false, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.sessions[sid]
	return conn, s != nil && s.loaded, nil
}

// keepPick takes a pick for a chat the engine does not hold, which it could not apply: the load before the chat's next prompt does.
func (m *Manager) keepPick(sid SessionID, pick SessionPick) {
	m.mu.Lock()
	if s := m.sessions[sid]; s != nil {
		if pick.Model != "" {
			s.modelID = pick.Model
		}
		if pick.Mode != "" {
			s.modeID = pick.Mode
		}
	}
	m.mu.Unlock()
	m.savePick(sid, pick)
}

// savePick keeps the model or the mode a chat runs on now, for a later load to put back.
func (m *Manager) savePick(sid SessionID, pick SessionPick) {
	if m.cfg.Picks != nil {
		m.cfg.Picks.SavePick(sid, pick)
	}
}

// restorePick puts a chat back on the model and mode it last ran on, when the load left it on others the engine still offers.
func (m *Manager) restorePick(ctx context.Context, conn AgentConn, sid SessionID, res NewSessionResult) {
	if m.cfg.Picks == nil {
		return
	}
	pick := m.cfg.Picks.Pick(sid)
	m.mu.Lock()
	var models []AgentModel
	var modes []AgentMode
	if s := m.sessions[sid]; s != nil {
		models, modes = s.models, s.modes
	}
	m.mu.Unlock()
	if pick.Model != "" && pick.Model != res.CurrentModelID && slices.ContainsFunc(models, func(o AgentModel) bool { return o.ID == pick.Model }) {
		if err := conn.SetModel(ctx, sid, pick.Model); err != nil {
			slog.Warn("[models] could not put a loaded chat back on its model", "session", string(sid), "model", pick.Model, "err", err)
		} else {
			m.mu.Lock()
			if s := m.sessions[sid]; s != nil {
				s.modelID = pick.Model
			}
			m.mu.Unlock()
		}
	}
	if pick.Mode != "" && pick.Mode != res.CurrentModeID && slices.ContainsFunc(modes, func(o AgentMode) bool { return o.ID == pick.Mode }) {
		if err := conn.SetMode(ctx, sid, pick.Mode); err != nil {
			slog.Warn("[models] could not put a loaded chat back in its mode", "session", string(sid), "mode", pick.Mode, "err", err)
		} else {
			m.mu.Lock()
			if s := m.sessions[sid]; s != nil {
				s.modeID = pick.Mode
			}
			m.mu.Unlock()
		}
	}
}

// announcePick tells the UI the model and mode a load left the chat on: a muted load and a resume forward none of their own.
func (m *Manager) announcePick(sid SessionID) {
	m.mu.Lock()
	s := m.sessions[sid]
	if s == nil {
		m.mu.Unlock()
		return
	}
	model := Update{Type: "model_change", ModelID: s.modelID, Models: append([]AgentModel(nil), s.models...)}
	mode := Update{Type: "mode_change", ModeID: s.modeID, Modes: append([]AgentMode(nil), s.modes...)}
	m.mu.Unlock()
	if model.ModelID != "" || len(model.Models) > 0 {
		m.forward(sid, model)
	}
	if mode.ModeID != "" || len(mode.Modes) > 0 {
		m.forward(sid, mode)
	}
}

// AuthMethods returns a defensive copy of the login options the agent advertised at initialize.
func (m *Manager) AuthMethods() []AuthMethod {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]AuthMethod(nil), m.authMethods...)
}

// Authenticate runs the agent's login for the chosen method.
func (m *Manager) Authenticate(ctx context.Context, methodID string) error {
	conn, err := m.connection()
	if err != nil {
		return err
	}
	return conn.Authenticate(ctx, methodID)
}

// GetSessionState reports turn status, model and pending permission so the UI can rehydrate.
func (m *Manager) GetSessionState(sid SessionID) SessionState {
	m.mu.Lock()
	st := SessionState{SessionID: sid, Status: "idle"}
	if s := m.sessions[sid]; s != nil {
		if s.streaming {
			st.Status = "streaming"
		}
		st.ModelID = s.modelID
		st.Models = append([]AgentModel(nil), s.models...)
		st.ModeID = s.modeID
		st.Modes = append([]AgentMode(nil), s.modes...)
		if s.pending != nil {
			p := *s.pending
			st.PendingPermission = &p
		}
	}
	// A chat the engine has not shown yet gets the engine's lists, which the UI would otherwise replace with empty ones.
	unseen := len(st.Models) == 0 && len(st.Modes) == 0
	defaultModel, defaultMode := m.defaultModel, m.defaultMode
	if unseen {
		st.Models, st.Modes = append([]AgentModel(nil), m.models...), append([]AgentMode(nil), m.modes...)
	}
	m.mu.Unlock()
	if unseen {
		var pick SessionPick
		if m.cfg.Picks != nil {
			pick = m.cfg.Picks.Pick(sid)
		}
		// What the load before its next prompt puts the chat on: its pick where the engine offers it, else the engine's default.
		if st.ModelID == "" {
			st.ModelID = firstOffered(st.Models, func(o AgentModel) string { return o.ID }, pick.Model, defaultModel)
		}
		if st.ModeID == "" {
			st.ModeID = firstOffered(st.Modes, func(o AgentMode) string { return o.ID }, pick.Mode, defaultMode)
		}
	}
	return st
}

// firstOffered returns the first of ids that list holds, "" for none.
func firstOffered[T any](list []T, idOf func(T) string, ids ...string) string {
	for _, id := range ids {
		if id != "" && slices.ContainsFunc(list, func(o T) bool { return idOf(o) == id }) {
			return id
		}
	}
	return ""
}

// session returns (creating if needed) the live state for sid; call under m.mu.
func (m *Manager) session(sid SessionID) *liveSession {
	s := m.sessions[sid]
	if s == nil {
		s = &liveSession{}
		m.sessions[sid] = s
	}
	return s
}

func (m *Manager) setStreaming(sid SessionID, v bool) {
	m.mu.Lock()
	m.session(sid).streaming = v
	m.mu.Unlock()
}

// endTurn marks the turn over, then answers what it left open: the engine keeps each request queued until it is answered.
func (m *Manager) endTurn(sid SessionID) {
	m.setStreaming(sid, false)
	m.dropPending(sid)
}

// dropPending answers every permission and question a session still waits on with a cancel.
func (m *Manager) dropPending(sid SessionID) {
	m.perms.cancelSession(sid)
	m.elicits.cancelSession(sid)
}

// turnRunning reports whether the session has a turn the user has not stopped; it creates no entry.
func (m *Manager) turnRunning(sid SessionID) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.sessions[sid]
	return s != nil && s.streaming && !s.cancelled
}

// StreamingSessions returns the ids of sessions with an in-flight turn, for the sidebar's live per-session status.
func (m *Manager) StreamingSessions() map[string]bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := map[string]bool{}
	for sid, s := range m.sessions {
		if s.streaming {
			out[string(sid)] = true
		}
	}
	return out
}

func (m *Manager) setPending(sid SessionID, req *PermissionRequest) {
	m.mu.Lock()
	m.session(sid).pending = req
	m.mu.Unlock()
}

// clearPending drops the pending request only if it's still req, so a newer one isn't wiped.
func (m *Manager) clearPending(sid SessionID, req *PermissionRequest) {
	m.mu.Lock()
	if s := m.sessions[sid]; s != nil && s.pending == req {
		s.pending = nil
	}
	m.mu.Unlock()
}

// ReplyPermission delivers the user's decision to the blocked ACP callback.
func (m *Manager) ReplyPermission(id string, o PermissionOutcome) error { return m.perms.reply(id, o) }

// ReplyChoices routes a UI choice reply to the blocked elicitation callback.
func (m *Manager) ReplyChoices(id string, s ChoiceSubmission) { m.elicits.reply(id, s) }

// HandleElicitation implements ClientHandler: surface each question as a choices update, then block for the replies.
// sid is the session ACP named on the wire; only when it couldn't be recovered do we fall back to guessing.
func (m *Manager) HandleElicitation(ctx context.Context, sid SessionID, questions []ChoiceRequest) []ChoiceSubmission {
	if len(questions) == 0 {
		return nil
	}
	if !m.knownSession(sid) { // unrecovered, or naming a session we no longer track: a card sent there would be invisible
		guess := m.elicitationSession()
		// Logged, because falling back silently is how a future SDK would quietly reintroduce the wrong-thread bug this routing fixes.
		slog.Warn("[elicitation] no session on the wire; falling back to the prompting session", "recovered", sid, "guess", guess)
		sid = guess
	}
	// One AskUserQuestion = one batch; tag every question so the UI can page through them ("1/N").
	batchID := questions[0].ID
	chans := make([]chan ChoiceSubmission, len(questions))
	for i := range questions {
		questions[i].BatchID = batchID
		questions[i].Total = len(questions)
		chans[i] = m.elicits.register(questions[i].ID, sid)
	}
	subs := make([]ChoiceSubmission, len(questions))
	if !m.turnRunning(sid) {
		for i := range questions {
			m.elicits.discard(questions[i].ID)
			subs[i] = ChoiceSubmission{Cancelled: true}
		}
		slog.Info("[elicitation] skipped a question whose turn had ended", "session", string(sid))
		return subs
	}
	for i := range questions {
		m.forward(sid, Update{Type: "choices", Choices: &questions[i]})
	}
	for i := range questions {
		subs[i] = m.elicits.wait(ctx, questions[i].ID, chans[i], defaultElicitationTimeout)
		m.dropLoggedChoice(sid, questions[i].ID)
	}
	return subs
}

// knownSession reports whether sid is a session the Manager is currently tracking.
func (m *Manager) knownSession(sid SessionID) bool {
	if sid == "" {
		return false
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.sessions[sid] != nil
}

// elicitationSession guesses the session an elicitation belongs to — the one currently prompting — for when the wire
// carried no id. It is wrong as soon as two sessions stream at once, which is why the id is sniffed (elicitationtag.go).
func (m *Manager) elicitationSession() SessionID {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s := m.sessions[m.lastPromptSID]; s != nil && s.streaming {
		return m.lastPromptSID
	}
	for sid, s := range m.sessions { // fallback: any session with an in-flight turn
		if s.streaming {
			return sid
		}
	}
	return m.lastPromptSID
}

// Stop closes the connection, stops auto-restart, and tears down the process tree.
func (m *Manager) Stop() error {
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return nil
	}
	m.closed = true
	conn := m.conn
	m.conn = nil
	m.engineBack() // no engine comes back now: a prompt waiting for one fails at once
	m.mu.Unlock()

	if conn != nil {
		_ = conn.Close()
	}
	err := m.agent.Stop() // graceful where possible; blocks until the tree is gone
	m.cancel()            // stop the restart loop and hard-kill any racing respawn
	return err
}

// HandleUpdate implements ClientHandler.
func (m *Manager) HandleUpdate(sid SessionID, u Update) {
	if u.Type == "model_change" { // keep session state authoritative for GetSessionState
		m.markFree(u.Models)
		m.mu.Lock()
		changed := false
		if s := m.sessions[sid]; s != nil { // don't resurrect a dropped session
			// Outside a load, a change is the model the chat runs on now, whether the user or the engine made it.
			changed = u.ModelID != "" && u.ModelID != s.modelID && s.loadDone == nil
			if u.ModelID != "" {
				s.modelID = u.ModelID
			}
			if len(u.Models) > 0 { // a value-only update echoes the selection without re-listing models
				s.models = u.Models
			}
		}
		if len(u.Models) > 0 {
			m.models = u.Models
		}
		m.mu.Unlock()
		if changed {
			m.savePick(sid, SessionPick{Model: u.ModelID})
		}
	}
	// The context only grows within a session; a sharp drop means the CLI compacted it and the agent lost the files it was shown.
	if u.Type == "usage" && u.UsedTokens > 0 {
		m.mu.Lock()
		if s := m.sessions[sid]; s != nil {
			if u.UsedTokens < s.tokens/2 {
				s.editor = editorSeen{}
				s.resets++
			}
			s.tokens = u.UsedTokens
		}
		m.mu.Unlock()
	}
	if u.Type == "mode_change" { // keep session state authoritative for GetSessionState
		m.mu.Lock()
		changed := false
		if s := m.sessions[sid]; s != nil && u.ModeID != "" {
			changed = u.ModeID != s.modeID && s.loadDone == nil // a plan approved, or a mode the engine switched to
			s.modeID = u.ModeID
		}
		m.mu.Unlock()
		if changed {
			m.savePick(sid, SessionPick{Mode: u.ModeID})
		}
	}
	m.mu.Lock()
	s := m.sessions[sid]
	resuming := s != nil && s.resuming
	cancelAgain := false
	if s != nil && s.streaming && s.loadDone == nil { // a load replays old calls, never this turn's
		s.record(u)
		if runUpdates[u.Type] && !s.runShown {
			s.runShown, cancelAgain, s.recancel = true, s.recancel, false
		}
	}
	m.mu.Unlock()
	if cancelAgain {
		conn, err := m.connection()
		if err == nil {
			err = conn.Cancel(m.mctx, sid)
		}
		slog.Info("[session] Stop sent again: it came before the engine ran the turn, and this engine drops such a Stop", "session", string(sid), "err", err)
	}
	// A restarted engine replays what the UI already shows; only the state it reports may have changed.
	if resuming && u.Type != "model_change" && u.Type != "mode_change" {
		return
	}
	switch u.Type {
	case "tool_call":
		if u.ToolCall != nil {
			u.ToolCall.OutsideApp = m.outsideApp(sid, u.ToolCall)
		}
	case "tool_call_update":
		if u.OutsideWorkspace {
			u.OutsideApp = m.outsideApp(sid, u.Call)
		}
	}
	m.forward(sid, u)
}

// forward adds the update to the session's log and sends it on, as one step under emitMu; a load before a prompt only logs it.
func (m *Manager) forward(sid SessionID, u Update) {
	size := 0
	if loggedUpdates[u.Type] {
		size = updateSize(u) // outside m.mu: it marshals the call's input, an edit's whole text
	}
	m.emitMu.Lock()
	defer m.emitMu.Unlock()
	m.mu.Lock()
	s := m.sessions[sid]
	if s != nil && !s.resuming {
		s.addToLog(u, size)
	}
	muted := s != nil && s.muted
	m.mu.Unlock()
	if !muted && m.cfg.OnUpdate != nil {
		m.cfg.OnUpdate(sid, u)
	}
}

// record notes what a running turn's call touched; call under m.mu.
func (s *liveSession) record(u Update) {
	tc := u.ToolCall
	if u.Type == "tool_call_update" {
		tc = u.Call
	}
	if tc == nil || (u.Type != "tool_call" && u.Type != "tool_call_update") || s.turnCalls == nil {
		return
	}
	call := *tc
	if u.Type == "tool_call_update" {
		call.Status = u.Status
	}
	known, seen := s.turnCalls[call.ID]
	if call.Title == "" {
		call.Title = known.title
	}
	if call.Kind == "" {
		call.Kind = known.kind
	}
	running := !seen || known.running
	if call.Status != "" {
		running = call.Status != "completed" && call.Status != "failed"
	}
	app, named := toolCallAppID(&call)
	if !named {
		app = known.app
	}
	s.turnCalls[call.ID] = turnCall{title: call.Title, kind: call.Kind, app: app, running: running}
	if named {
		s.turnApps[app] = true
		if s.namedApps == nil {
			s.namedApps = map[string]bool{}
		}
		s.namedApps[app] = true
		return
	}
	if kind := strings.ToLower(call.Kind); kind == "" || mutatingFileKinds[kind] {
		for _, p := range toolCallPaths(&call) {
			s.turnPaths[resolvePath(s.cwd, p)] = true
		}
	}
}

// Touched reports what the session's current or last turn touched: the apps its board tools named and the files it edited.
func (m *Manager) Touched(sid SessionID) (apps, paths []string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.sessions[sid]
	if s == nil {
		return nil, nil
	}
	for app := range s.turnApps {
		apps = append(apps, app)
	}
	for p := range s.turnPaths {
		paths = append(paths, p)
	}
	return apps, paths
}

// AppsChanged lists the apps the session's current or last turn named in a board call that is not read-only.
func (m *Manager) AppsChanged(sid SessionID) []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.sessions[sid]
	if s == nil {
		return nil
	}
	seen := map[string]bool{}
	var apps []string
	for _, c := range s.turnCalls {
		if c.app != "" && !seen[c.app] && !m.readOnly[bareToolName(c.title)] {
			seen[c.app] = true
			apps = append(apps, c.app)
		}
	}
	return apps
}

// CallRunning reports whether the session's turn has a board call still running that is not read-only, to tool and naming appID; either may be "" for any.
func (m *Manager) CallRunning(sid SessionID, tool, appID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.sessions[sid]
	if s == nil || !s.streaming {
		return false
	}
	for _, c := range s.turnCalls {
		name := bareToolName(c.title)
		if c.running && !m.readOnly[name] && (tool == "" || name == tool) && (appID == "" || c.app == appID) {
			return true
		}
	}
	return false
}

// SessionsNamingApp lists the live sessions whose board tools named the app in this run.
func (m *Manager) SessionsNamingApp(appID string) []SessionID {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []SessionID
	for sid, s := range m.sessions {
		if s.namedApps[appID] {
			out = append(out, sid)
		}
	}
	return out
}

// TurnStopped reports whether the session's last turn was stopped by the user.
func (m *Manager) TurnStopped(sid SessionID) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.sessions[sid]
	return s != nil && s.stopped
}

// DropNotes forgets the notes queued for a chat that no longer exists.
func (m *Manager) DropNotes(sid SessionID) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.notes, sid)
}

// outsideApp names the app a call that left the workspace lands in, so the card can say which; "" when no checkout holds it.
func (m *Manager) outsideApp(sid SessionID, tc *ToolCall) string {
	if tc == nil || !tc.OutsideWorkspace || m.cfg.AppNameAt == nil {
		return ""
	}
	m.mu.Lock()
	cwd, home := "", ""
	if s := m.sessions[sid]; s != nil {
		cwd, home = s.cwd, s.workspace.AppID
	}
	m.mu.Unlock()
	homeDir := ""
	if home != "" && m.cfg.WorkspaceDir != nil {
		homeDir = m.cfg.WorkspaceDir(home) // outside m.mu: the host's mapping takes locks of its own
	}
	for _, p := range toolCallPaths(tc) {
		abs := resolvePath(cwd, p)
		if homeDir != "" && withinDir(homeDir, abs) {
			continue
		}
		if name := m.cfg.AppNameAt(abs); name != "" {
			return name
		}
	}
	return ""
}

// HandlePermission implements ClientHandler: notify the host, then block for a reply.
func (m *Manager) HandlePermission(ctx context.Context, req PermissionRequest) PermissionOutcome {
	// Registered before the check, so a turn ending in between still finds the request to answer.
	ch := m.perms.register(req.ID, req.SessionID, req.Options)
	if !m.turnRunning(req.SessionID) {
		m.perms.discard(req.ID)
		slog.Info("[permission] answered a request whose turn had ended", "session", string(req.SessionID))
		return PermissionOutcome{Cancelled: true}
	}
	if req.ToolCall != nil {
		req.ToolCall.OutsideApp = m.outsideApp(req.SessionID, req.ToolCall)
	}
	// Enrich first, then publish only a deep copy: OnPermission mutates req.ToolCall.Input in place (board round-trip) while GetSessionState marshals the pending request on another goroutine — sharing that map is a fatal concurrent read+write.
	if m.cfg.OnPermission != nil {
		m.cfg.OnPermission(req)
	}
	pending := req.clone()
	m.setPending(req.SessionID, &pending)
	defer m.clearPending(req.SessionID, &pending)
	return m.perms.wait(ctx, req.ID, ch, time.Duration(req.TimeoutMs)*time.Millisecond)
}

// onExit is the Agent's crash hook: drive the restart loop unless starting or stopping.
func (m *Manager) onExit(info ExitInfo) {
	m.mu.Lock()
	skip := m.closed || !m.started
	if !skip {
		m.conn = nil
		if m.restarting == nil {
			m.restarting = make(chan struct{})
		}
		for _, s := range m.sessions {
			s.loaded = false // only the engine that exited held them
		}
	}
	m.mu.Unlock()
	if !skip {
		m.restart(info)
	}
}

// engineBack wakes the prompts waiting for a crash restart to bring an engine back; call under m.mu.
func (m *Manager) engineBack() {
	if m.restarting != nil {
		close(m.restarting)
		m.restarting = nil
	}
}

// restart relaunches with exponential backoff, giving up after the budget.
func (m *Manager) restart(info ExitInfo) {
	m.mu.Lock()
	if time.Since(m.lastLaunch) > restartStabilityWindow {
		m.restarts = 0 // ran stably before this crash — count it as a fresh episode, not a crash loop
	}
	m.mu.Unlock()
	for {
		m.mu.Lock()
		if m.closed {
			m.mu.Unlock()
			return
		}
		m.restarts++
		attempt := m.restarts
		m.mu.Unlock()

		max := m.maxRestarts()
		if attempt > max {
			m.notifyRestart(RestartInfo{Attempt: max, Max: max, GaveUp: true, Err: info.Err})
			m.mu.Lock()
			m.engineBack() // none comes back: a prompt waiting for it fails, as with no engine at all
			m.mu.Unlock()
			return
		}
		m.notifyRestart(RestartInfo{Attempt: attempt, Max: max, Err: info.Err})

		select {
		case <-time.After(m.backoff(attempt)):
		case <-m.mctx.Done():
			return
		}

		m.mu.Lock()
		stopped := m.closed
		m.mu.Unlock()
		if stopped {
			return // Stop happened during the backoff — don't respawn
		}

		if err := m.launch(m.mctx); err != nil {
			info = ExitInfo{Err: err} // couldn't come back up — retry
			continue
		}
		m.resumeSessions() // re-establish prior sessions so the chat survives the restart
		// The resume forwards no history, so this is how the UI learns the turns the crash ended are over.
		m.notifyRestart(RestartInfo{Attempt: attempt, Max: max, Resumed: true})
		return // back up; its supervise goroutine owns the next crash
	}
}

func (m *Manager) notifyRestart(info RestartInfo) {
	if m.cfg.OnRestart != nil {
		m.cfg.OnRestart(info)
	}
}

func (m *Manager) maxRestarts() int {
	if m.cfg.MaxRestarts > 0 {
		return m.cfg.MaxRestarts
	}
	return defaultMaxRestarts
}

func (m *Manager) backoff(attempt int) time.Duration {
	d := m.cfg.RestartDelay
	if d <= 0 {
		d = defaultRestartDelay
	}
	return d * time.Duration(1<<(attempt-1))
}

func (m *Manager) connection() (AgentConn, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.conn == nil {
		return nil, errors.New("agent not started")
	}
	return m.conn, nil
}
