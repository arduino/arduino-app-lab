package agent

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"
)

const (
	defaultMaxRestarts  = 3
	defaultRestartDelay = 500 * time.Millisecond
	// restartStabilityWindow: an agent that stays up this long counts as recovered, so a later crash starts a fresh restart budget.
	restartStabilityWindow = 60 * time.Second
	// resumeLoadTimeout bounds each LoadSession replay during auto-restart resume.
	resumeLoadTimeout = 30 * time.Second
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
	BoardName    string        // connected board's display name, stated in every session's system prompt
}

// RestartInfo tells the UI the agent went down. Usually that is an auto-restart after an unexpected exit, but the host
// also sends it (GaveUp, with a Reason) when it tears the agent down deliberately. The tags pin the wire shape; Err
// stays host-side — an error interface marshals to an empty object at best, and to a dropped event at worst.
type RestartInfo struct {
	Attempt int    `json:"attempt"`          // 1-based restart attempt (0 for a deliberate teardown)
	Max     int    `json:"max"`              // restart budget
	GaveUp  bool   `json:"gaveUp"`           // the agent stays down: budget exhausted, or the host stopped it on purpose
	Reason  string `json:"reason,omitempty"` // why it stays down, when it wasn't a crash (e.g. "board-changed")
	Err     error  `json:"-"`                // the crash cause, for host-side logging
}

// liveSession is the per-session state GetSessionState exposes for UI rehydration.
type liveSession struct {
	streaming bool
	modelID   string
	models    []AgentModel // models the agent advertised for this session
	modeID    string
	modes     []AgentMode // operating modes the agent advertised for this session
	cwd       string      // working dir, replayed to LoadSession on auto-restart
	pending   *PermissionRequest
}

// Manager runs the ACP conversation (sessions, prompts, permissions, auto-restart); a restart doesn't resume the chat yet.
type Manager struct {
	agent       *Agent
	connFactory ConnFactory
	cfg         ManagerConfig

	perms   *permissionRegistry
	elicits *elicitationRegistry
	mctx    context.Context // agent lifetime; cancelled by Stop (not by the caller's ctx)
	cancel  context.CancelFunc

	mu            sync.Mutex
	conn          AgentConn
	authMethods   []AuthMethod
	sessions      map[SessionID]*liveSession // per-session state for GetSessionState
	starting      bool                       // initial Start in progress (guards against concurrent/double Start)
	started       bool                       // first launch succeeded → auto-restart armed
	closed        bool
	restarts      int
	lastLaunch    time.Time // when the agent last came up; resets the restart budget after a stable run
	lastPromptSID SessionID // best-effort elicitation target (ACP v0.13.5 drops the sessionId from the request)
}

func NewManager(agent *Agent, factory ConnFactory, cfg ManagerConfig) *Manager {
	mctx, cancel := context.WithCancel(context.Background())
	m := &Manager{
		agent:       agent,
		connFactory: factory,
		cfg:         cfg,
		perms:       newPermissionRegistry(),
		elicits:     newElicitationRegistry(),
		sessions:    map[SessionID]*liveSession{},
		mctx:        mctx,
		cancel:      cancel,
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
	conn.SetMCPServers(m.cfg.MCPServers) // advertise board tools on every session (survives restart)
	conn.SetBoardName(m.cfg.BoardName)
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

// resumeSessions re-establishes prior sessions on a relaunched agent (best-effort; a session that can't reload is dropped).
func (m *Manager) resumeSessions() {
	m.mu.Lock()
	conn := m.conn
	closed := m.closed
	type sess struct {
		sid SessionID
		cwd string
		ptr *liveSession
	}
	list := make([]sess, 0, len(m.sessions))
	for sid, s := range m.sessions {
		list = append(list, sess{sid, s.cwd, s})
	}
	m.mu.Unlock()
	if conn == nil || closed {
		return
	}
	for _, s := range list {
		m.mu.Lock()
		stale := m.closed || m.sessions[s.sid] != s.ptr // skip sessions closed or recreated since the snapshot
		m.mu.Unlock()
		if stale {
			continue
		}
		ctx, cancel := context.WithTimeout(m.mctx, resumeLoadTimeout)
		_, err := conn.LoadSession(ctx, s.sid, s.cwd)
		cancel()
		if err != nil {
			m.mu.Lock()
			if m.sessions[s.sid] == s.ptr { // only drop the exact entry we failed to resume
				delete(m.sessions, s.sid)
			}
			m.mu.Unlock()
		}
	}
}

func (m *Manager) NewSession(ctx context.Context, cwd string) (SessionID, error) {
	conn, err := m.connection()
	if err != nil {
		return "", err
	}
	res, err := conn.NewSession(ctx, cwd)
	if err != nil {
		return "", err
	}
	m.mu.Lock()
	s := m.session(res.SessionID)
	s.cwd = cwd
	s.applyResult(res)
	m.mu.Unlock()
	return res.SessionID, nil
}

// applyResult copies a session's advertised models/modes (and current selections) into the live entry.
func (s *liveSession) applyResult(res NewSessionResult) {
	s.models = res.Models
	s.modes = res.Modes
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

// DeleteSession permanently removes a persisted session and drops its live entry.
func (m *Manager) DeleteSession(ctx context.Context, sid SessionID) error {
	conn, err := m.connection()
	if err != nil {
		return err
	}
	// claude-code-acp no-ops session/delete while the session is live and acks session/close before it releases it, so cancel any turn + close, then delete and retry until the session actually drops from the list.
	m.mu.Lock()
	s := m.sessions[sid]
	streaming := s != nil && s.streaming
	cwd := ""
	if s != nil {
		cwd = s.cwd
	}
	m.mu.Unlock()
	if streaming {
		_ = conn.Cancel(ctx, sid)
	}
	_ = conn.CloseSession(ctx, sid)
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
	m.mu.Unlock()
	return nil
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

// LoadSession re-establishes a persisted session (replaying its history via OnUpdate) and records its
// models/modes so GetSessionState/SetModel/SetMode work. Registers the session before the replay.
func (m *Manager) LoadSession(ctx context.Context, sid SessionID, cwd string) error {
	conn, err := m.connection()
	if err != nil {
		return err
	}
	m.mu.Lock()
	m.session(sid).cwd = cwd
	m.mu.Unlock()
	res, err := conn.LoadSession(ctx, sid, cwd)
	if err != nil {
		return err
	}
	m.mu.Lock()
	if s := m.sessions[sid]; s != nil { // don't resurrect a session deleted/closed during replay
		s.applyResult(res)
	}
	m.mu.Unlock()
	return nil
}

func (m *Manager) Prompt(ctx context.Context, sid SessionID, text string) error {
	conn, err := m.connection()
	if err != nil {
		return err
	}
	m.mu.Lock()
	m.lastPromptSID = sid // elicitations carry no sessionId; route them to whoever is prompting
	m.mu.Unlock()
	m.setStreaming(sid, true)
	defer m.setStreaming(sid, false)
	return conn.Prompt(ctx, sid, text)
}

func (m *Manager) Cancel(ctx context.Context, sid SessionID) error {
	conn, err := m.connection()
	if err != nil {
		return err
	}
	return conn.Cancel(ctx, sid)
}

// CloseSession frees a session's local state and tells the agent to drop it.
func (m *Manager) CloseSession(ctx context.Context, sid SessionID) error {
	m.mu.Lock()
	delete(m.sessions, sid)
	m.mu.Unlock()
	conn, err := m.connection()
	if err != nil {
		return err
	}
	return conn.CloseSession(ctx, sid)
}

func (m *Manager) SetModel(ctx context.Context, sid SessionID, modelID string) error {
	conn, err := m.connection()
	if err != nil {
		return err
	}
	if err := conn.SetModel(ctx, sid, modelID); err != nil {
		return err
	}
	m.mu.Lock()
	m.session(sid).modelID = modelID
	m.mu.Unlock()
	return nil
}

func (m *Manager) SetMode(ctx context.Context, sid SessionID, modeID string) error {
	conn, err := m.connection()
	if err != nil {
		return err
	}
	if err := conn.SetMode(ctx, sid, modeID); err != nil {
		return err
	}
	m.mu.Lock()
	m.session(sid).modeID = modeID
	m.mu.Unlock()
	return nil
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
	defer m.mu.Unlock()
	st := SessionState{SessionID: sid, Status: "idle"}
	s := m.sessions[sid]
	if s == nil {
		return st
	}
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
	return st
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
		chans[i] = m.elicits.register(questions[i].ID)
		if m.cfg.OnUpdate != nil {
			m.cfg.OnUpdate(sid, Update{Type: "choices", Choices: &questions[i]})
		}
	}
	subs := make([]ChoiceSubmission, len(questions))
	for i := range questions {
		subs[i] = m.elicits.wait(ctx, questions[i].ID, chans[i], defaultElicitationTimeout)
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
		m.mu.Lock()
		if s := m.sessions[sid]; s != nil { // don't resurrect a dropped session
			if u.ModelID != "" {
				s.modelID = u.ModelID
			}
			if len(u.Models) > 0 { // a value-only update echoes the selection without re-listing models
				s.models = u.Models
			}
		}
		m.mu.Unlock()
	}
	if u.Type == "mode_change" { // keep session state authoritative for GetSessionState
		m.mu.Lock()
		if s := m.sessions[sid]; s != nil && u.ModeID != "" {
			s.modeID = u.ModeID
		}
		m.mu.Unlock()
	}
	if m.cfg.OnUpdate != nil {
		m.cfg.OnUpdate(sid, u)
	}
}

// HandlePermission implements ClientHandler: notify the host, then block for a reply.
func (m *Manager) HandlePermission(ctx context.Context, req PermissionRequest) PermissionOutcome {
	ch := m.perms.register(req.ID, req.Options)
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
	}
	m.mu.Unlock()
	if !skip {
		m.restart(info)
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
		return             // back up; its supervise goroutine owns the next crash
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
