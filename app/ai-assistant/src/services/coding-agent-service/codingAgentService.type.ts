import { Unsubscribe } from '../common';

export type AgentId = 'claude' | 'codex' | 'opencode';

export interface AgentDescriptor {
  id: AgentId;
  name: string;
  description: string;
  // Provider brand shown in the sign-in / API-key copy (e.g. "Anthropic").
  provider: string;
  // Expected API-key prefix, used for the field placeholder + format check.
  apiKeyPrefix: string;
  // Provider console URL where the user can find/create an API key (the
  // "Where do I find my … API key?" link). Absent → the hint is plain text.
  apiKeyUrl?: string;
  // Not yet available: the card shows a "coming soon" badge and a disabled action.
  comingSoon?: boolean;
  // Available but still maturing: the card shows a "preview" badge (action stays enabled).
  preview?: boolean;
}

// How an agent was authenticated: browser OAuth subscription vs a pasted API key.
export type AuthMethod = 'subscription' | 'api_key';

export type AuthStatus =
  | { authenticated: false }
  | {
      authenticated: true;
      agentId: AgentId;
      // Rich details for the Settings "Agent" section. Optional so a backend that
      // only knows "authenticated" (today's Go impl) stays valid; the UI shows a
      // dash for any field it doesn't get.
      method?: AuthMethod;
      account?: string; // email (subscription) or masked key (api_key)
      connectedAt?: string; // ISO 8601 timestamp of when the login was established
      isDefault?: boolean; // whether this agent is the default for new sessions
    };

export interface AuthResult {
  ok: boolean;
  error?: string;
}

export type SessionId = string;

export interface AgentModel {
  id: string;
  name: string;
  description?: string; // ACP option description; carries the resolved version (e.g. "Opus 4.8 with 1M context · …")
}

// An agent operating mode (ACP session mode, e.g. "Build" / "Plan"); the agent
// advertises the set per session and the picker switches it via setSessionMode.
export interface AgentMode {
  id: string;
  name: string;
  description?: string;
}

// Backend-reported session status: 'running' is a live in-flight turn (e.g. a session left running in the
// background after a switch); 'error' is the persisted last-turn outcome. Waiting/current are derived FE-side.
export type SessionStatus = 'error' | 'running';

// A persisted chat session as listed in the sidebar (from ACP SessionInfo).
export interface SessionSummary {
  id: SessionId;
  title?: string; // agent-generated summary
  updatedAt?: string; // ISO 8601 last-activity timestamp
  status?: SessionStatus; // backend status: running (live) or error (last turn); absent = idle/ok
  pinned?: boolean; // user pinned this session to the top of the sidebar
}

export type ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

// `kind` is the ACP tool category (read | edit | delete | move | search |
// execute | think | fetch | switch_mode | other), kept open as the SDK is pre-1.0.
export interface ToolCall {
  id: string;
  title: string;
  kind: string;
  status: ToolCallStatus;
  input?: unknown; // ACP rawInput — Go to forward (co-design TODO)
  output?: string; // Go forwards plain text today; rich content is GA-track
}

// A multi-step plan the agent surfaces as a static checklist (reuses the
// tool-call status vocabulary, minus the failed/expansion states).
export type ChecklistItemStatus = 'pending' | 'in_progress' | 'completed';

export interface ChecklistItem {
  label: string;
  status: ChecklistItemStatus;
}

// `id` is stable across the turn: re-emitting the same id replaces the card
// in place (ACP-style full-snapshot plan updates), it doesn't append a new one.
export interface Checklist {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface ChoiceOption {
  id: string;
  label: string;
  description?: string;
}

// A question the agent asks with selectable options. `multiple` allows several
// picks (checkbox) vs one (radio); `allowOther` adds a free-text answer. `id` is
// the request id: the reply (choicesReply) echoes it back, and re-emitting the
// same id updates the card in place, like a checklist.
export interface ChoiceRequest {
  id: string;
  title: string;
  options: ChoiceOption[];
  multiple?: boolean;
  allowOther?: boolean;
  // Questions of one AskUserQuestion share a batchId; total is the batch size, for a "1/N" pager.
  batchId?: string;
  total?: number;
}

// The user's answer to a ChoiceRequest: the picked option ids plus the free-text
// "Other" value when used. `cancelled` marks a skip (no answer given).
export interface ChoiceSubmission {
  selectedIds: string[];
  other?: string;
  cancelled?: boolean;
}

// Agent stream updates by origin: content = transcript parts (each from the ACP update named inline); signal = session-level; future = no ACP source, so nothing emits it today.
export type AgentUpdate =
  | { type: 'message_chunk'; delta: string } // content · ACP agent_message_chunk
  | { type: 'user_message'; delta: string } // content · ACP user_message_chunk (only during loadSession history replay)
  | { type: 'thinking'; delta: string } // content · ACP agent_thought_chunk (reasoning stream)
  | { type: 'tool_call'; toolCall: ToolCall } // content · ACP tool_call
  | {
      type: 'tool_call_update';
      id: string;
      status: ToolCallStatus;
      input?: unknown;
      output?: string;
    } // content · ACP tool_call_update
  | { type: 'checklist'; checklist: Checklist } // content · ACP plan (full snapshot)
  | { type: 'choices'; choices: ChoiceRequest } // content · ACP form elicitation (Claude's AskUserQuestion); the agent's turn stays blocked until choicesReply answers it
  | { type: 'model_change'; modelId?: string; models: AgentModel[] } // signal · ACP config_option_update (category model)
  | { type: 'mode_change'; modeId?: string } // signal · ACP current_mode_update (session mode)
  | { type: 'usage'; usedTokens: number; contextSize: number } // signal · ACP usage_update (live token count)
  | { type: 'message_status'; status: 'typing' | 'complete' } // future · no ACP origin; redundant with the prompt lifecycle
  | { type: 'message_error'; message: string }; // future · no ACP origin; errors surface via prompt() rejection today

// ACP permission-option kinds. The agent supplies the options per request; the
// reply echoes back the chosen option's id (see PermissionOutcome).
export type PermissionOptionKind =
  | 'allow_once'
  | 'allow_always'
  | 'reject_once'
  | 'reject_always';

export interface PermissionOption {
  id: string;
  label: string;
  kind: PermissionOptionKind;
}

// Reply to a PermissionRequest: pick an option by id, or cancel (→ deny).
export interface PermissionOutcome {
  optionId?: string;
  cancelled?: boolean;
}

export interface PermissionRequest {
  id: string;
  sessionId: SessionId;
  toolCall?: ToolCall;
  options: PermissionOption[];
  // ms before the request auto-denies; 0/absent → no timeout, the prompt waits for the user's answer
  timeoutMs?: number;
}

// An unexpected exit of the agent process and the auto-restart that followed it. `gaveUp` marks the
// restart budget as exhausted: the agent stays down and every call fails until the UI starts it again.
export interface AgentRestart {
  attempt: number;
  max: number;
  gaveUp: boolean;
  // Set when the host stopped the agent deliberately rather than after a crash (e.g. 'board-changed').
  reason?: string;
}

export type TurnStatus = 'idle' | 'streaming';

export interface SessionState {
  sessionId: SessionId;
  status: TurnStatus;
  modelId?: string;
  models?: AgentModel[]; // models the agent advertises for this session (picker source)
  modeId?: string;
  modes?: AgentMode[]; // operating modes the agent advertises for this session
  pendingPermission?: PermissionRequest;
}

// BE-facing ACP contract. The desktop app injects a Wails impl via
// setCodingAgentService.
export interface CodingAgentService {
  start: (agentId: AgentId) => Promise<void>;
  stop: () => Promise<void>;
  listAgents: () => AgentDescriptor[];
  getAuthStatus: () => Promise<AuthStatus>;
  // Runs a throwaway turn to confirm the stored credential still works; rejects on an auth error.
  validateAuth: () => Promise<void>;
  // Subscription sign-in (browser OAuth via the agent CLI).
  authenticate: (agentId: AgentId) => Promise<AuthResult>;
  // Direct API-key auth (provider key injected into the agent env).
  authenticateApiKey: (agentId: AgentId, apiKey: string) => Promise<AuthResult>;
  // Hands the browser flow's token/code to the sign-in still pending from
  // authenticate() (the agent CLI asks for it when it can't complete in the
  // browser). Rejects if the token can't be delivered (no pending sign-in); the
  // login's own outcome still resolves that authenticate() call.
  submitLoginToken: (agentId: AgentId, token: string) => Promise<void>;
  // Abort a sign-in the user walked away from; without it the login CLI runs on until the app quits.
  cancelLogin: (agentId: AgentId) => Promise<void>;
  // Sign out of an agent: clears its subscription login / in-memory API key.
  disconnect: (agentId: AgentId) => Promise<void>;
  // Mark an agent as the default used for new sessions.
  setDefaultAgent: (agentId: AgentId) => Promise<void>;
  newSession: (appId?: string) => Promise<SessionId>;
  // persisted sessions for the workspace, newest first (feeds the sessions sidebar)
  listSessions: () => Promise<SessionSummary[]>;
  // reopen a persisted session: replays its history via onUpdate so the thread can be rebuilt
  loadSession: (sessionId: SessionId) => Promise<void>;
  // set a client-side custom title for a session (ACP has no rename); blank clears it
  renameSession: (sessionId: SessionId, title: string) => Promise<void>;
  // pin/unpin a session (client-side), to group it at the top of the sidebar
  pinSession: (sessionId: SessionId, pinned: boolean) => Promise<void>;
  // permanently remove a persisted session
  deleteSession: (sessionId: SessionId) => Promise<void>;
  // status + pending permission, so the UI can rehydrate after a reload
  getSessionState: (sessionId: SessionId) => Promise<SessionState>;
  // resolves when the turn ends; updates stream via onUpdate
  prompt: (sessionId: SessionId, text: string) => Promise<void>;
  cancel: (sessionId: SessionId) => Promise<void>;
  // free the session on the agent (call when the chat unmounts) to avoid leaks
  closeSession: (sessionId: SessionId) => Promise<void>;
  listModels: () => Promise<AgentModel[]>;
  setSessionModel: (sessionId: SessionId, modelId: string) => Promise<void>;
  setSessionMode: (sessionId: SessionId, modeId: string) => Promise<void>;
  permissionReply: (requestId: string, outcome: PermissionOutcome) => void;
  // Answer a ChoiceRequest (requestId = the request's id); a cancelled submission skips it.
  choicesReply: (requestId: string, submission: ChoiceSubmission) => void;
  onUpdate: (
    handler: (sessionId: SessionId, update: AgentUpdate) => void,
  ) => Unsubscribe;
  onPermission: (handler: (request: PermissionRequest) => void) => Unsubscribe;
  // Fires on every auto-restart of the crashed agent process, and a last time with gaveUp once the
  // restart budget is spent — from then on nothing works until the UI calls start() again.
  onRestart: (handler: (restart: AgentRestart) => void) => Unsubscribe;
  // Emits the subscription sign-in URL the agent CLI prints, so the UI can offer a copyable link.
  onLoginUrl: (handler: (url: string) => void) => Unsubscribe;
  applyToEditor: (code: string, language?: string) => Promise<void>;
  // Open a file the agent read/wrote in App Lab's app editor; rejects if the path is no longer valid (e.g. the board changed).
  openAgentFile: (path: string) => Promise<void>;
}
