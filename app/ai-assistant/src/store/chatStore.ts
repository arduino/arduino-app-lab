import { create } from 'zustand';

import {
  AgentMode,
  AgentModel,
  AgentUpdate,
  Checklist,
  ChoiceRequest,
  getAgent,
  isAuthError,
  isNetworkError,
  markSessionRead,
  onPermission,
  onRestart,
  onUpdate,
  onWorkspaceAppForgotten,
  onWorkspaceAppRenamed,
  parseAgentError,
  PermissionRequest,
  SessionStatus,
  SessionSummary,
  ToolCall,
  ToolCallStatus,
  Unsubscribe,
} from '../services';
import { type CachedPickers, useAiAssistantStore } from './aiAssistantStore';

export interface NewSessionPicks {
  modelId?: string;
  modeId?: string;
}

// A cross-tree request to switch the chat's active session. The side panel writes it; ChatPanel.logic
// (the single owner of the session lifecycle) reacts, runs reopen/newChat, then clears it. `nonce`
// makes each request distinct so re-clicking "New chat" (or reopening the same session) re-fires.
export type SessionRequest =
  | { type: 'open'; session: SessionSummary; nonce: number }
  // `workspace` moves the panel as it opens the chat — the host sends it when the app it was on is gone.
  | { type: 'new'; workspace?: { id: string; name?: string }; nonce: number };

// Rendered projection of content AgentUpdates: text/thinking accumulate deltas, tool_call/checklist/choices hold a snapshot; inline markdown (code/table/diff) lives inside `text`, not here.
export type MessagePart =
  | { type: 'text'; id: string; text: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | {
      type: 'thinking';
      id: string;
      text: string;
      startedAt?: number; // epoch ms of the first delta, for the "Thought for Xs" duration
      endedAt?: number; // epoch ms of the last delta
    }
  | { type: 'checklist'; id: string; checklist: Checklist }
  | { type: 'choices'; id: string; choices: ChoiceRequest }
  | {
      type: 'choice-answer';
      id: string;
      question: string;
      answer: string;
      skipped?: boolean;
    };

export interface ChoiceEcho {
  question: string;
  answer: string;
  skipped?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  status?: 'typing' | 'complete' | 'error';
  error?: string;
  errorKind?: string; // ACP errorKind (e.g. rate_limit) — lets the error UI differentiate
  cancelled?: boolean; // the user stopped this turn
}

interface ToolCallPatch {
  status: ToolCallStatus;
  input?: unknown;
  output?: string;
  outsideWorkspace?: boolean; // the enriched call turned out to act on another app
  outsideApp?: string;
}

// A prompt waiting for the session's turn to end; the id is what the panel's remove button targets.
export interface QueuedPrompt {
  id: string;
  text: string;
}

// Per-session chat state: each session keeps its own thread so a turn that streams while another session is
// open (a background turn) keeps building correctly, and switching sessions just displays a different thread.
interface Thread {
  messages: ChatMessage[];
  streamingMessageId?: string; // assistant message currently being appended to (this session's live turn)
  pendingPermission?: PermissionRequest;
  resolvedChoiceIds?: string[]; // choice questions already answered/skipped/closed — hidden on redisplay so they don't re-prompt after a reopen
  // Models/modes the agent advertised for THIS session, and the current picks. Undefined until the
  // session reports them, so the toolbar can fall back to the previous session's cache meanwhile.
  pickers?: CachedPickers;
  // Characters written this turn, for the estimate; beginTurn resets it, so it measures one question.
  turnOutChars?: number;
  turnStartedAt?: number; // epoch ms the turn started, for the elapsed-time counter
}

interface ChatStore {
  currentSessionId: string | null; // the session shown in the panel; the UI reads threads[currentSessionId]
  threads: Record<string, Thread>;
  // The session to reopen on the panel's next mount, so navigating away (e.g. to My Apps) and back
  // resumes it; its title rides along to restore the header.
  lastSessionId: string | null;
  lastSessionTitle?: string;
  // Its workspace rides along too: a remount resumes through bootstrap, which has no session summary to read it from.
  lastSessionWorkspaceId?: string;
  lastSessionWorkspaceName?: string;
  // How its last turn ended, kept by a reset that drops its thread, so the replay after it shows the failure or the stop again.
  lastSessionStatus?: SessionStatus;
  // Per workspace, the session that was open in it, so switching away and back lands where the user left off; forgotten on restart like every field here.
  lastSessionByWorkspace: Record<string, { id: string; title?: string }>;
  // Per-session in-flight-turn flag; the UI's `isStreaming` is derived from the current session's entry.
  streamingSessions: Record<string, boolean>;
  // Prompts typed while a session's turn was running, oldest first: one is sent each time its turn ends.
  queuedPrompts: Record<string, QueuedPrompt[]>;
  // Sessions whose turn finished while the user was viewing another session — a reply is waiting
  // (the sidebar's "reply ready" dot). Cleared once the user opens the session.
  replyReadySessions: Record<string, boolean>;

  // Pending session switch requested from the side panel; consumed and cleared by ChatPanel.logic.
  sessionRequest?: SessionRequest;

  // A session created by "New Session" that hasn't received a prompt yet. The agent only lists a
  // session once it has content, so this one has no sidebar row of its own — the side panel keeps
  // the "New Session" entry selected instead, until the first prompt promotes it to a real row.
  draftSessionId: string | null;
  // What a new session starts with, read from a hidden session or the last one a first prompt created: an empty chat shows it.
  newSessionPicks?: NewSessionPicks;

  // Which mounted ChatPanel arbitrates the session lifecycle: two can be mounted at once, and only one
  // may rebind its workspace, resume a session or consume a sessionRequest. The stream is not theirs —
  // subscribeAgentStream owns it.
  chatOwners: ChatOwner[];
  claimChat: (ownerId: string, onScreen: boolean) => void;
  releaseChat: (ownerId: string) => void;
  // App Lab hides the surface it is not showing instead of unmounting it, so each panel needs telling.
  agentModeActive: boolean;
  setAgentModeActive: (active: boolean) => void;

  setCurrentSessionId: (sessionId: string | null) => void;
  setLastSession: (
    sessionId: string | null,
    title?: string,
    workspace?: { id: string; name?: string },
  ) => void;
  // Mark the open session as an unused draft or clear it, and drop a workspace's remembered session once it turns out not to be loadable.
  forgetWorkspaceSession: (workspaceId: string) => void;
  // Drop a deleted session from every workspace that remembered it — the sidebar can delete another workspace's.
  forgetSession: (sessionId: string) => void;
  // Move what remembers a workspace onto the id a rename gave its app.
  rebindWorkspace: (oldId: string, newId: string, newName: string) => void;
  // A title the engine gave after the session was remembered, so reopening it shows the name.
  rememberSessionTitle: (sessionId: string, title: string) => void;
  // A title the user set or cleared: what remembers the session and any header showing it follow; undefined is no name.
  retitleSession: (sessionId: string, title?: string) => void;
  // The last of those, for the panel showing that session; the nonce makes a repeat distinct.
  retitled?: { sessionId: string; title?: string; nonce: number };
  setDraftSessionId: (sessionId: string | null) => void;
  setNewSessionPicks: (picks: NewSessionPicks) => void;
  // Flag a session as having a reply ready (its background turn finished, unseen).
  markReplyReady: (sessionId: string) => void;
  // Ask the chat to open an existing session (from the side panel).
  requestOpenSession: (session: SessionSummary) => void;
  // Ask the chat to start a fresh session (from the side panel).
  requestNewSession: (workspace?: { id: string; name?: string }) => void;
  // Consume the pending request (called by ChatPanel.logic after acting on it).
  clearSessionRequest: VoidFunction;
  addMessage: (sessionId: string, message: ChatMessage) => void;
  // The user's own turn: a prompt from the composer, or one replayed by loadSession.
  addUserText: (sessionId: string, text: string) => void;
  // An answered choice question, echoed as a user turn so the thread reads question → answer → reply.
  addChoiceAnswer: (sessionId: string, echo: ChoiceEcho) => void;
  // Open the assistant message the new turn streams into and start its meters; returns its id.
  beginTurn: (sessionId: string) => string;
  // The same for a turn sent before a reload, in the reply the replay rebuilt; '' when a reset took the thread, which a reopen must replay.
  resumeTurn: (sessionId: string) => string;
  // A reopened chat whose last turn failed or was stopped: a replay carries neither, so its last reply gets the mark again.
  markReplayedTurn: (sessionId: string, outcome: 'error' | 'cancelled') => void;
  // The turn ended (finished, stopped or failed): clear what it set. An ended turn can't answer a
  // permission prompt either, so any left pending goes with it.
  endTurn: (sessionId: string) => void;
  appendText: (sessionId: string, messageId: string, delta: string) => void;
  addToolCall: (
    sessionId: string,
    messageId: string,
    toolCall: ToolCall,
  ) => void;
  upsertChecklist: (
    sessionId: string,
    messageId: string,
    checklist: Checklist,
  ) => void;
  upsertChoices: (
    sessionId: string,
    messageId: string,
    choices: ChoiceRequest,
  ) => void;
  appendThinking: (sessionId: string, messageId: string, delta: string) => void;
  updateToolCall: (
    sessionId: string,
    messageId: string,
    toolCallId: string,
    patch: ToolCallPatch,
  ) => void;
  setMessageStatus: (
    sessionId: string,
    messageId: string,
    status: 'typing' | 'complete',
  ) => void;
  setMessageError: (
    sessionId: string,
    messageId: string,
    error: string,
    kind?: string,
  ) => void;
  setMessageCancelled: (sessionId: string, messageId: string) => void;
  removeMessage: (sessionId: string, messageId: string) => void;
  setStreamingMessageId: (
    sessionId: string,
    messageId: string | undefined,
  ) => void;
  setPendingPermission: (
    sessionId: string,
    request?: PermissionRequest,
  ) => void;
  // Mark a choice question resolved (answered/skipped/closed) so it stops rendering as an active prompt.
  resolveChoice: (sessionId: string, choiceId: string) => void;
  // Per-session toolbar state. The agent advertises models/modes per session and reports usage per
  // turn, so both live on the thread: each panel then shows the state of the session it displays.
  // Hydrating from getSessionState: the models list merges (grow-only), the modes list and both picks
  // replace. `model_change`/`mode_change` also carry a pick, and `mode_change` the modes list after a load.
  setSessionPickers: (sessionId: string, pickers: CachedPickers) => void;
  // A re-advertise only adds: known models keep their place, new ones are appended, none is removed.
  mergeSessionModels: (sessionId: string, models: AgentModel[]) => void;
  setSessionModelId: (sessionId: string, modelId?: string) => void;
  setSessionModeId: (sessionId: string, modeId?: string) => void;
  setSessionModes: (sessionId: string, modes: AgentMode[]) => void;
  // Hold a prompt until the session's turn ends; ignored when the text is blank.
  enqueuePrompt: (sessionId: string, id: string, text: string) => void;
  // Take the oldest queued prompt off the session's queue, or undefined when it is empty.
  dequeuePrompt: (sessionId: string) => QueuedPrompt | undefined;
  // Drop one queued prompt before it is ever sent (the panel's remove button).
  removeQueuedPrompt: (sessionId: string, id: string) => void;
  // Drop every prompt a session still has queued (the panel's Clear all).
  clearQueuedPrompts: (sessionId: string) => void;
  // Empty a session's thread (before a cold reload replays its history).
  resetThread: (sessionId: string) => void;
  // The host is about to replay the whole history: drop the messages, keep the pickers and a pending card.
  clearTranscript: (sessionId: string) => void;
  // Drop a session entirely (on delete).
  discardThread: (sessionId: string) => void;
  // Wipe every session on sign-out: the next sign-in respawns the agent with none of them loaded, and
  // a leftover thread would make bootstrap skip the loadSession replay and prompt a dead session id.
  reset: VoidFunction;
  // Bumped by both resets: the chat panel only hides, so this is its one signal to reopen a session.
  sessionGeneration: number;
  // Bumped when a session's title turns up after its turn ended: the side panel refetches its rows on it.
  sessionListVersion: number;
  touchSessionList: VoidFunction;
  // Same hazard as `reset`, for a crashed-out agent: the replacement process has none of these sessions
  // loaded. Keeps the session to reopen so a reconnect lands back in the same chat, replayed from disk —
  // unless it was an unprompted draft, which the agent never persisted and so cannot replay.
  resetLoadedSessions: VoidFunction;
}

const emptyThread = (): Thread => ({ messages: [] });

// Measured against the engines' own output accounting: 9398 characters written billed as 2960 tokens.
const CHARS_PER_TOKEN = 3.2;

// What the agent wrote, not what the turn cost: the engines report the whole context, file reads included.
export const estimateOutputTokens = (writtenChars: number): number =>
  Math.round(writtenChars / CHARS_PER_TOKEN);

// Tool arguments are written by the model too: on an edit, the file's new content is most of its output.
const writtenLength = (input: unknown): number =>
  input === undefined || input === null ? 0 : JSON.stringify(input).length;

// How much of a refined tool call is new, read inside the message being patched: ids can repeat.
const argumentGrowth = (
  thread: Thread,
  messageId: string,
  toolCallId: string,
  patch: ToolCallPatch,
): number => {
  if (patch.input === undefined) {
    return 0;
  }
  const known = thread.messages
    .find((m) => m.id === messageId)
    ?.parts.find(
      (part) => part.type === 'tool_call' && part.toolCall.id === toolCallId,
    );
  const before =
    known?.type === 'tool_call' ? writtenLength(known.toolCall.input) : 0;
  return Math.max(0, writtenLength(patch.input) - before);
};

const hasEnded = (status: ToolCallStatus): boolean =>
  status === 'completed' || status === 'failed';

// A call that ended stays ended: an update with no status reads as pending, and the dev bridge can deliver an older one late.
const patchedToolCall = (call: ToolCall, patch: ToolCallPatch): ToolCall => ({
  ...call,
  ...patch,
  status:
    hasEnded(call.status) && !hasEnded(patch.status)
      ? call.status
      : patch.status,
});

// Rendered message ids are minted here: the store is the only writer of a thread, panels only read.
let idCounter = 0;
const nextMessageId = (): string => `msg-${(idCounter += 1)}`;

// Grow-only merge: refresh known models' metadata, append new ones, never remove — a cold/transient
// re-advertise only ADDS, so an already-shown model (e.g. Fable 5) can't disappear.
const mergeModels = (prev: AgentModel[], next: AgentModel[]): AgentModel[] => {
  const byId = new Map(next.map((m) => [m.id, m]));
  const seen = new Set(prev.map((m) => m.id));
  const merged = prev.map((m) => byId.get(m.id) ?? m);
  for (const m of next) {
    if (!seen.has(m.id)) {
      merged.push(m);
    }
  }
  return merged;
};

const threadPickers = (thread: Thread): CachedPickers =>
  thread.pickers ?? { models: [], modes: [] };

// Every non-action field, so `reset` restores the just-loaded state in one spread.
const initialState = {
  currentSessionId: null,
  threads: {},
  streamingSessions: {},
  queuedPrompts: {},
  replyReadySessions: {},
  sessionRequest: undefined,
  draftSessionId: null,
  newSessionPicks: undefined,
  lastSessionId: null,
  lastSessionTitle: undefined,
  lastSessionWorkspaceId: undefined,
  lastSessionWorkspaceName: undefined,
  lastSessionStatus: undefined,
  lastSessionByWorkspace: {},
  retitled: undefined,
};

interface ChatOwner {
  id: string;
  onScreen: boolean;
}

// Only the latest turn counts: an error the user has since moved past must not keep the dot red.
export const lastTurnFailed = (messages: ChatMessage[] = []): boolean =>
  messages[messages.length - 1]?.status === 'error';

// How a thread's last turn ended, when it failed or was stopped.
const turnOutcome = (
  messages: ChatMessage[] = [],
): 'error' | 'cancelled' | undefined => {
  const last = messages[messages.length - 1];
  if (last?.status === 'error') {
    return 'error';
  }
  return last?.cancelled ? 'cancelled' : undefined;
};

// The panel on screen drives the session lifecycle; with none on screen the last mounted one keeps it, so recency only breaks ties and a hidden remount can't take over.
export const chatDriver = (owners: ChatOwner[]): string | undefined => {
  const onScreen = owners.filter((owner) => owner.onScreen);
  const pool = onScreen.length > 0 ? onScreen : owners;
  return pool[pool.length - 1]?.id;
};

// The adapter re-sends a finished block as one chunk: a delta equal to the last part is that re-send.
const isReSend = (
  messages: ChatMessage[],
  messageId: string,
  type: 'text' | 'thinking',
  delta: string,
): boolean => {
  const parts = messages.find((m) => m.id === messageId)?.parts ?? [];
  const last = parts[parts.length - 1];
  return last?.type === type && last.text === delta;
};

// Nothing is counted for a message that is not there: a chunk arriving after a reset renders nowhere.
const countable = (messages: ChatMessage[], messageId: string): boolean =>
  messages.some((m) => m.id === messageId);

const mapMessage = (
  messages: ChatMessage[],
  messageId: string,
  update: (message: ChatMessage) => ChatMessage,
): ChatMessage[] =>
  messages.map((message) =>
    message.id === messageId ? update(message) : message,
  );

// The resume pointers of a session, retitled.
const withSessionTitle = (
  state: ChatStore,
  sessionId: string,
  title?: string,
): Pick<ChatStore, 'lastSessionTitle' | 'lastSessionByWorkspace'> => ({
  lastSessionTitle:
    state.lastSessionId === sessionId ? title : state.lastSessionTitle,
  lastSessionByWorkspace: Object.fromEntries(
    Object.entries(state.lastSessionByWorkspace).map(([workspace, last]) => [
      workspace,
      last.id === sessionId ? { ...last, title } : last,
    ]),
  ),
});

export const useChatStore = create<ChatStore>((set, get) => {
  // Immutably update one session's thread, but never create it: a thread means a session somebody
  // opened, and a turn settling after resetLoadedSessions (its Go epilogue outlives the teardown) would
  // otherwise leave one behind for a session the replacement agent never loaded. Five actions create
  // a thread: addMessage, addUserText, addChoiceAnswer, beginTurn add a message; resetThread empties one.
  const patchThread = (
    sessionId: string,
    fn: (thread: Thread) => Thread,
  ): void =>
    set((state) => {
      const thread = state.threads[sessionId];
      return thread
        ? { threads: { ...state.threads, [sessionId]: fn(thread) } }
        : state;
    });
  const patchMessages = (
    sessionId: string,
    fn: (messages: ChatMessage[]) => ChatMessage[],
  ): void =>
    patchThread(sessionId, (t) => ({ ...t, messages: fn(t.messages) }));

  return {
    ...initialState,

    // Outside initialState, like chatOwners: a reset must raise it, not restore it.
    sessionGeneration: 0,
    sessionListVersion: 0,
    touchSessionList: (): void =>
      set((state) => ({ sessionListVersion: state.sessionListVersion + 1 })),

    chatOwners: [],
    claimChat: (ownerId, onScreen): void =>
      set((state) => ({
        chatOwners: [
          ...state.chatOwners.filter((o) => o.id !== ownerId),
          { id: ownerId, onScreen },
        ],
      })),
    releaseChat: (ownerId): void =>
      set((state) => ({
        chatOwners: state.chatOwners.filter((o) => o.id !== ownerId),
      })),

    agentModeActive: false,
    setAgentModeActive: (agentModeActive): void => set({ agentModeActive }),

    setDraftSessionId: (draftSessionId): void => set({ draftSessionId }),
    setNewSessionPicks: (newSessionPicks): void => set({ newSessionPicks }),

    setLastSession: (lastSessionId, lastSessionTitle, workspace): void =>
      set((state) => ({
        lastSessionId,
        lastSessionTitle,
        lastSessionWorkspaceId: workspace?.id,
        lastSessionWorkspaceName: workspace?.name,
        lastSessionStatus: undefined,
        // The overall last session drives a remount; this map drives a workspace switch, which must not resurrect a chat open elsewhere.
        lastSessionByWorkspace:
          workspace && lastSessionId
            ? {
                ...state.lastSessionByWorkspace,
                [workspace.id]: { id: lastSessionId, title: lastSessionTitle },
              }
            : state.lastSessionByWorkspace,
      })),

    forgetWorkspaceSession: (workspaceId): void =>
      set((state) => {
        const next = { ...state.lastSessionByWorkspace };
        delete next[workspaceId];
        return { lastSessionByWorkspace: next };
      }),

    rebindWorkspace: (oldId, newId, newName): void =>
      set((state) => {
        const { [oldId]: remembered, ...others } = state.lastSessionByWorkspace;
        const lastSessionByWorkspace = remembered
          ? { ...others, [newId]: remembered }
          : state.lastSessionByWorkspace;
        return state.lastSessionWorkspaceId === oldId
          ? {
              lastSessionByWorkspace,
              lastSessionWorkspaceId: newId,
              lastSessionWorkspaceName:
                newName || state.lastSessionWorkspaceName,
            }
          : { lastSessionByWorkspace };
      }),
    rememberSessionTitle: (sessionId, title): void =>
      set((state) => withSessionTitle(state, sessionId, title)),

    retitleSession: (sessionId, title): void =>
      set((state) => ({
        ...withSessionTitle(state, sessionId, title),
        retitled: {
          sessionId,
          title,
          nonce: (state.retitled?.nonce ?? 0) + 1,
        },
      })),

    forgetSession: (sessionId): void =>
      set((state) => ({
        lastSessionByWorkspace: Object.fromEntries(
          Object.entries(state.lastSessionByWorkspace).filter(
            ([, last]) => last.id !== sessionId,
          ),
        ),
      })),

    setCurrentSessionId: (currentSessionId): void =>
      // Opening a session clears its "reply ready" dot — the user is now looking at it.
      set((state) => {
        if (!currentSessionId || !state.replyReadySessions[currentSessionId]) {
          return { currentSessionId };
        }
        const replyReadySessions = { ...state.replyReadySessions };
        delete replyReadySessions[currentSessionId];
        return { currentSessionId, replyReadySessions };
      }),

    markReplyReady: (sessionId): void =>
      set((state) =>
        state.replyReadySessions[sessionId]
          ? state
          : {
              replyReadySessions: {
                ...state.replyReadySessions,
                [sessionId]: true,
              },
            },
      ),

    requestOpenSession: (session): void =>
      set((state) => ({
        sessionRequest: {
          type: 'open',
          session,
          nonce: (state.sessionRequest?.nonce ?? 0) + 1,
        },
      })),
    requestNewSession: (workspace): void =>
      set((state) => ({
        sessionRequest: {
          type: 'new',
          workspace,
          nonce: (state.sessionRequest?.nonce ?? 0) + 1,
        },
      })),
    clearSessionRequest: (): void => set({ sessionRequest: undefined }),

    // Adding a message is what starts a thread (the first prompt of a session, or its replay), here and
    // in addUserText / addChoiceAnswer / beginTurn. Every other action patches an existing one.
    addMessage: (sessionId, message): void =>
      set((state) => {
        const thread = state.threads[sessionId] ?? emptyThread();
        return {
          threads: {
            ...state.threads,
            [sessionId]: { ...thread, messages: [...thread.messages, message] },
          },
        };
      }),

    addUserText: (sessionId, text): void => {
      const id = nextMessageId();
      set((state) => {
        const thread = state.threads[sessionId] ?? emptyThread();
        return {
          threads: {
            ...state.threads,
            [sessionId]: {
              ...thread,
              messages: [
                ...thread.messages,
                {
                  id,
                  role: 'user',
                  parts: [{ type: 'text', id: `${id}-t0`, text }],
                },
              ],
              // The user's turn closes the assistant message before it, so agent content opens a new one.
              streamingMessageId: undefined,
            },
          },
        };
      });
    },

    addChoiceAnswer: (sessionId, echo): void => {
      const id = nextMessageId();
      set((state) => {
        const thread = state.threads[sessionId] ?? emptyThread();
        return {
          threads: {
            ...state.threads,
            [sessionId]: {
              ...thread,
              messages: [
                ...thread.messages,
                {
                  id,
                  role: 'user',
                  parts: [
                    {
                      type: 'choice-answer',
                      id: `${id}-a0`,
                      question: echo.question,
                      answer: echo.answer,
                      ...(echo.skipped ? { skipped: true } : {}),
                    },
                  ],
                },
              ],
              streamingMessageId: undefined,
            },
          },
        };
      });
    },

    beginTurn: (sessionId): string => {
      const id = nextMessageId();
      set((state) => {
        const thread = state.threads[sessionId] ?? emptyThread();
        return {
          threads: {
            ...state.threads,
            [sessionId]: {
              ...thread,
              messages: [
                ...thread.messages,
                { id, role: 'assistant', parts: [] },
              ],
              streamingMessageId: id,
              turnStartedAt: Date.now(),
              turnOutChars: 0,
            },
          },
          // Per-session flag, so switching session doesn't lose track of this turn.
          streamingSessions: { ...state.streamingSessions, [sessionId]: true },
        };
      });
      return id;
    },

    resumeTurn: (sessionId): string => {
      const fresh = nextMessageId();
      let id = '';
      set((state) => {
        const thread = state.threads[sessionId];
        if (!thread) {
          return state;
        }
        const last = thread.messages[thread.messages.length - 1];
        id = last?.role === 'assistant' ? last.id : fresh;
        return {
          threads: {
            ...state.threads,
            [sessionId]: {
              ...thread,
              messages:
                id === fresh
                  ? [...thread.messages, { id, role: 'assistant', parts: [] }]
                  : thread.messages,
              streamingMessageId: id,
              turnStartedAt: Date.now(),
              turnOutChars: 0,
            },
          },
          streamingSessions: { ...state.streamingSessions, [sessionId]: true },
        };
      });
      return id;
    },

    markReplayedTurn: (sessionId, outcome): void =>
      patchThread(sessionId, (t) => {
        const last = t.messages[t.messages.length - 1];
        if (!last || (last.role === 'assistant' && last.status === 'error')) {
          return t;
        }
        const mark: Partial<ChatMessage> =
          outcome === 'error'
            ? { status: 'error', error: '', errorKind: 'replayed' }
            : { cancelled: true };
        return {
          ...t,
          messages:
            last.role === 'assistant'
              ? mapMessage(t.messages, last.id, (m) => ({ ...m, ...mark }))
              : [
                  ...t.messages,
                  {
                    id: nextMessageId(),
                    role: 'assistant',
                    parts: [],
                    ...mark,
                  },
                ],
        };
      }),

    endTurn: (sessionId): void =>
      set((state) => {
        const streamingSessions = { ...state.streamingSessions };
        delete streamingSessions[sessionId];
        const thread = state.threads[sessionId];
        if (!thread) {
          return { streamingSessions };
        }
        return {
          streamingSessions,
          threads: {
            ...state.threads,
            [sessionId]: {
              ...thread,
              streamingMessageId: undefined,
              pendingPermission: undefined,
            },
          },
        };
      }),

    appendText: (sessionId, messageId, delta): void =>
      patchThread(sessionId, (t) => {
        const reSend = isReSend(t.messages, messageId, 'text', delta);
        const counted =
          reSend || !countable(t.messages, messageId) ? 0 : delta.length;
        return {
          ...t,
          // Counted where the text is kept, so the estimate cannot drift from what is on screen.
          turnOutChars: (t.turnOutChars ?? 0) + counted,
          messages: mapMessage(t.messages, messageId, (message) => {
            if (reSend) {
              return message;
            }
            const parts = [...message.parts];
            const last = parts[parts.length - 1];
            if (last && last.type === 'text') {
              parts[parts.length - 1] = { ...last, text: last.text + delta };
            } else {
              parts.push({
                type: 'text',
                id: `${messageId}-t${parts.length}`,
                text: delta,
              });
            }
            return { ...message, parts };
          }),
        };
      }),

    addToolCall: (sessionId, messageId, toolCall): void =>
      patchThread(sessionId, (t) => ({
        ...t,
        turnOutChars:
          (t.turnOutChars ?? 0) +
          (countable(t.messages, messageId)
            ? writtenLength(toolCall.input)
            : 0),
        messages: mapMessage(t.messages, messageId, (message) => ({
          ...message,
          parts: [...message.parts, { type: 'tool_call', toolCall }],
        })),
      })),

    appendThinking: (sessionId, messageId, delta): void =>
      patchThread(sessionId, (t) => {
        const reSend = isReSend(t.messages, messageId, 'thinking', delta);
        const counted =
          reSend || !countable(t.messages, messageId) ? 0 : delta.length;
        return {
          ...t,
          // Thinking is generated text too, and the models that report it bill it.
          turnOutChars: (t.turnOutChars ?? 0) + counted,
          messages: mapMessage(t.messages, messageId, (message) => {
            if (reSend) {
              return message;
            }
            const parts = [...message.parts];
            const last = parts[parts.length - 1];
            const now = Date.now();
            if (last && last.type === 'thinking') {
              parts[parts.length - 1] = {
                ...last,
                text: last.text + delta,
                endedAt: now,
              };
            } else {
              parts.push({
                type: 'thinking',
                id: `${messageId}-th${parts.length}`,
                text: delta,
                startedAt: now,
                endedAt: now,
              });
            }
            return { ...message, parts };
          }),
        };
      }),

    upsertChecklist: (sessionId, messageId, checklist): void =>
      patchMessages(sessionId, (messages) =>
        mapMessage(messages, messageId, (message) => {
          const partId = `${messageId}-cl-${checklist.id}`;
          const exists = message.parts.some(
            (part) => part.type === 'checklist' && part.id === partId,
          );
          if (exists) {
            return {
              ...message,
              parts: message.parts.map((part) =>
                part.type === 'checklist' && part.id === partId
                  ? { type: 'checklist', id: partId, checklist }
                  : part,
              ),
            };
          }
          return {
            ...message,
            parts: [
              ...message.parts,
              { type: 'checklist', id: partId, checklist },
            ],
          };
        }),
      ),

    upsertChoices: (sessionId, messageId, choices): void =>
      patchMessages(sessionId, (messages) =>
        mapMessage(messages, messageId, (message) => {
          const partId = `${messageId}-ch-${choices.id}`;
          const exists = message.parts.some(
            (part) => part.type === 'choices' && part.id === partId,
          );
          if (exists) {
            return {
              ...message,
              parts: message.parts.map((part) =>
                part.type === 'choices' && part.id === partId
                  ? { type: 'choices', id: partId, choices }
                  : part,
              ),
            };
          }
          return {
            ...message,
            parts: [...message.parts, { type: 'choices', id: partId, choices }],
          };
        }),
      ),

    updateToolCall: (sessionId, messageId, toolCallId, patch): void =>
      patchThread(sessionId, (t) => ({
        ...t,
        // The engine refines the arguments as the model writes them, so only the growth is new output.
        turnOutChars:
          (t.turnOutChars ?? 0) +
          argumentGrowth(t, messageId, toolCallId, patch),
        messages: mapMessage(t.messages, messageId, (message) => ({
          ...message,
          parts: message.parts.map((part) =>
            part.type === 'tool_call' && part.toolCall.id === toolCallId
              ? {
                  type: 'tool_call',
                  toolCall: patchedToolCall(part.toolCall, patch),
                }
              : part,
          ),
        })),
      })),

    setMessageStatus: (sessionId, messageId, status): void =>
      patchMessages(sessionId, (messages) =>
        mapMessage(messages, messageId, (message) => ({ ...message, status })),
      ),

    setMessageError: (sessionId, messageId, error, kind): void =>
      patchMessages(sessionId, (messages) =>
        mapMessage(messages, messageId, (message) => ({
          ...message,
          status: 'error',
          error,
          errorKind: kind,
        })),
      ),

    setMessageCancelled: (sessionId, messageId): void =>
      patchMessages(sessionId, (messages) =>
        mapMessage(messages, messageId, (message) => ({
          ...message,
          cancelled: true,
        })),
      ),

    removeMessage: (sessionId, messageId): void =>
      patchMessages(sessionId, (messages) =>
        messages.filter((m) => m.id !== messageId),
      ),

    setStreamingMessageId: (sessionId, streamingMessageId): void =>
      patchThread(sessionId, (t) => ({ ...t, streamingMessageId })),

    setPendingPermission: (sessionId, pendingPermission): void =>
      patchThread(sessionId, (t) => ({ ...t, pendingPermission })),

    resolveChoice: (sessionId, choiceId): void =>
      patchThread(sessionId, (t) => ({
        ...t,
        resolvedChoiceIds: t.resolvedChoiceIds?.includes(choiceId)
          ? t.resolvedChoiceIds
          : [...(t.resolvedChoiceIds ?? []), choiceId],
      })),

    setSessionPickers: (sessionId, pickers): void =>
      patchThread(sessionId, (t) => ({
        ...t,
        pickers: {
          ...pickers,
          // Grow-only, like every other write of this list: a model_change can land while the read
          // is in flight, and a cold catalog coming back must not drop what it added.
          models: mergeModels(threadPickers(t).models, pickers.models),
        },
      })),

    mergeSessionModels: (sessionId, models): void =>
      patchThread(sessionId, (t) => ({
        ...t,
        pickers: {
          ...threadPickers(t),
          models: mergeModels(threadPickers(t).models, models),
        },
      })),

    setSessionModelId: (sessionId, currentModelId): void =>
      patchThread(sessionId, (t) => ({
        ...t,
        pickers: { ...threadPickers(t), currentModelId },
      })),

    setSessionModeId: (sessionId, currentModeId): void =>
      patchThread(sessionId, (t) => ({
        ...t,
        pickers: { ...threadPickers(t), currentModeId },
      })),

    setSessionModes: (sessionId, modes): void =>
      patchThread(sessionId, (t) => ({
        ...t,
        pickers: { ...threadPickers(t), modes },
      })),

    enqueuePrompt: (sessionId, id, text): void =>
      set((state) => {
        const trimmed = text.trim();
        if (!trimmed) {
          return {};
        }
        const queued = state.queuedPrompts[sessionId] ?? [];
        return {
          queuedPrompts: {
            ...state.queuedPrompts,
            [sessionId]: [...queued, { id, text: trimmed }],
          },
        };
      }),

    dequeuePrompt: (sessionId): QueuedPrompt | undefined => {
      const queued = get().queuedPrompts[sessionId] ?? [];
      const [next, ...rest] = queued;
      if (!next) {
        return undefined;
      }
      set((state) => {
        const queuedPrompts = { ...state.queuedPrompts };
        if (rest.length) {
          queuedPrompts[sessionId] = rest;
        } else {
          delete queuedPrompts[sessionId];
        }
        return { queuedPrompts };
      });
      return next;
    },

    removeQueuedPrompt: (sessionId, id): void =>
      set((state) => {
        const rest = (state.queuedPrompts[sessionId] ?? []).filter(
          (p) => p.id !== id,
        );
        const queuedPrompts = { ...state.queuedPrompts };
        if (rest.length) {
          queuedPrompts[sessionId] = rest;
        } else {
          delete queuedPrompts[sessionId];
        }
        return { queuedPrompts };
      }),

    clearQueuedPrompts: (sessionId): void =>
      set((state) => {
        if (!state.queuedPrompts[sessionId]) {
          return state;
        }
        const queuedPrompts = { ...state.queuedPrompts };
        delete queuedPrompts[sessionId];
        return { queuedPrompts };
      }),

    resetThread: (sessionId): void =>
      set((state) => ({
        threads: { ...state.threads, [sessionId]: emptyThread() },
      })),

    clearTranscript: (sessionId): void =>
      patchThread(sessionId, (t) => ({
        ...t,
        messages: [],
        streamingMessageId: undefined,
        turnOutChars: 0,
      })),

    discardThread: (sessionId): void =>
      set((state) => {
        const threads = { ...state.threads };
        delete threads[sessionId];
        const streamingSessions = { ...state.streamingSessions };
        delete streamingSessions[sessionId];
        const replyReadySessions = { ...state.replyReadySessions };
        delete replyReadySessions[sessionId];
        const queuedPrompts = { ...state.queuedPrompts };
        delete queuedPrompts[sessionId];
        return {
          threads,
          streamingSessions,
          queuedPrompts,
          replyReadySessions,
        };
      }),

    reset: (): void =>
      set((state) => ({
        ...initialState,
        sessionGeneration: state.sessionGeneration + 1,
      })),

    resetLoadedSessions: (): void =>
      set((state) => {
        const sessionGeneration = state.sessionGeneration + 1;
        const wasDraft =
          !!state.lastSessionId && state.lastSessionId === state.draftSessionId;
        return {
          ...initialState,
          sessionGeneration,
          lastSessionId: wasDraft ? null : state.lastSessionId,
          lastSessionTitle: wasDraft ? undefined : state.lastSessionTitle,
          lastSessionWorkspaceId: wasDraft
            ? undefined
            : state.lastSessionWorkspaceId,
          lastSessionWorkspaceName: wasDraft
            ? undefined
            : state.lastSessionWorkspaceName,
          lastSessionStatus: wasDraft
            ? undefined
            : turnOutcome(state.threads[state.lastSessionId ?? '']?.messages),
          // The surviving session keeps its place in the per-workspace map too, or that workspace opens an empty chat after an agent restart.
          lastSessionByWorkspace:
            wasDraft || !state.lastSessionId
              ? {}
              : {
                  [state.lastSessionWorkspaceId ?? '']: {
                    id: state.lastSessionId,
                    title: state.lastSessionTitle,
                  },
                },
        };
      }),
  };
});

// Whether any session has a turn in flight, across every session (not just the one on screen). The host reads it
// before actions that would kill that turn — switching board tears the agent down — to warn first.
export const agentIsBusy = (): boolean =>
  Object.values(useChatStore.getState().streamingSessions).some(Boolean);

// The assistant message the session is streaming into, created on the first agent content of a turn.
// Each session keeps its own, so a background turn and the one on screen never share one.
const ensureAssistant = (sessionId: string): string => {
  const store = useChatStore.getState();
  const existing = store.threads[sessionId]?.streamingMessageId;
  if (existing) {
    return existing;
  }
  const id = nextMessageId();
  store.addMessage(sessionId, { id, role: 'assistant', parts: [] });
  store.setStreamingMessageId(sessionId, id);
  return id;
};

const applyUpdate = (sessionId: string, update: AgentUpdate): void => {
  const store = useChatStore.getState();
  // A session nobody opened has no thread, and this must not start one: a thread created here would
  // outlive resetLoadedSessions and cost the reopened session its history replay. A turn running in
  // the background still lands — that session was opened, so its thread is there.
  if (!store.threads[sessionId]) {
    return;
  }
  // Session-level signals go to the session's own thread, like content: each panel reads the toolbar
  // state of what it displays, so switching mid-turn keeps the model, mode and token count right.
  switch (update.type) {
    case 'model_change':
      if (update.models.length > 0) {
        store.mergeSessionModels(sessionId, update.models);
      }
      if (update.modelId) {
        store.setSessionModelId(sessionId, update.modelId);
      }
      return;
    case 'mode_change':
      if (update.modes?.length) {
        store.setSessionModes(sessionId, update.modes);
      }
      if (update.modeId) {
        store.setSessionModeId(sessionId, update.modeId);
      }
      return;
    case 'usage':
      // Ignored: it measures the whole context, and the counter shows what the agent wrote.
      return;
    case 'user_message':
      store.addUserText(sessionId, update.delta);
      return;
    case 'replay_start':
      // A live update that landed before the replay is in the replay too.
      store.clearTranscript(sessionId);
      return;
    case 'message_error': {
      // A turn this page sent has its failure from the prompt's own rejection: a copy after its end must not add a reply.
      const { messages, streamingMessageId } = store.threads[sessionId];
      const last = messages[messages.length - 1];
      if (
        streamingMessageId ||
        last?.role !== 'assistant' ||
        last.status !== 'error'
      ) {
        // The host logs the error as the engine returned it, so it is read like a prompt's rejection.
        const { message, cause, kind, code } = parseAgentError(update.message);
        const running = useAiAssistantStore.getState().selectedAgentId;
        const providerRefused =
          isAuthError(message, code) && !!getAgent(running)?.perProviderKeys;
        store.setMessageError(
          sessionId,
          ensureAssistant(sessionId),
          cause ?? message,
          providerRefused ? 'auth' : isNetworkError(message) ? 'network' : kind,
        );
      }
      return;
    }
    // no default
  }
  const assistantId = ensureAssistant(sessionId);
  switch (update.type) {
    case 'message_chunk':
      store.appendText(sessionId, assistantId, update.delta);
      break;
    case 'message_status':
      store.setMessageStatus(sessionId, assistantId, update.status);
      break;
    case 'tool_call':
      store.addToolCall(sessionId, assistantId, update.toolCall);
      break;
    case 'thinking':
      store.appendThinking(sessionId, assistantId, update.delta);
      break;
    case 'tool_call_update':
      store.updateToolCall(sessionId, assistantId, update.id, {
        status: update.status,
        ...(update.output !== undefined ? { output: update.output } : {}),
        ...(update.input !== undefined ? { input: update.input } : {}),
        ...(update.outsideWorkspace ? { outsideWorkspace: true } : {}),
        ...(update.outsideApp ? { outsideApp: update.outsideApp } : {}),
      });
      break;
    case 'checklist':
      store.upsertChecklist(sessionId, assistantId, update.checklist);
      break;
    case 'choices':
      store.upsertChoices(sessionId, assistantId, update.choices);
      break;
    case 'turn_stopped':
      store.setMessageCancelled(sessionId, assistantId);
      // The mark ends the stopped reply: what the replay sends after it is not part of it.
      store.setStreamingMessageId(sessionId, undefined);
      break;
    default: {
      // Exhaustiveness: a new content AgentUpdate must get a case here, or this fails to compile.
      const unhandled: never = update;
      return unhandled;
    }
  }
};

let stopStream: VoidFunction | undefined;
let streamHolders = 0;

// The one subscription to the agent stream, started once at startup right after the service is bound.
// Two ChatPanels can be mounted at once (the editor's docked panel and full-screen Agent Mode); each
// subscribing from its own hook meant both received every update, so one had to be gated out at event
// time. The store subscribes instead, and the panels only read.
// Calling it again while it runs registers no second handler: it is the single writer of every thread,
// and a second one would double every update. injectDependencies() calls this from a module body, so
// an HMR reload of that module in dev reaches it twice. Each caller gets its own release, and the
// handlers go only once the last holder has released — one caller's release can't cut the others off.
export const subscribeAgentStream = (): Unsubscribe => {
  streamHolders += 1;
  if (!stopStream) {
    const unsubscribeUpdate = onUpdate(applyUpdate);
    // The request goes on its own session's thread; a panel displays the current thread's pendingPermission.
    const unsubscribePermission = onPermission((request) =>
      useChatStore.getState().setPendingPermission(request.sessionId, request),
    );
    // Lists read while the engine restarted failed, and a row they left on its typing dot stays there until read again.
    const unsubscribeRestart = onRestart((restart) => {
      if (restart.resumed) {
        useChatStore.getState().touchSessionList();
      }
    });
    stopStream = (): void => {
      unsubscribeUpdate();
      unsubscribePermission();
      unsubscribeRestart();
    };
  }
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    streamHolders -= 1;
    if (streamHolders === 0) {
      stopStream?.();
      stopStream = undefined;
    }
  };
};

// An app is gone: its chats went with it, so the workspace must stop offering one and any panel there has to move off.
const forgetWorkspaceApp = (appId: string): void => {
  const store = useChatStore.getState();
  store.forgetWorkspaceSession(appId);
  if (store.lastSessionWorkspaceId !== appId) {
    return;
  }
  const { lastSessionId, lastSessionTitle } = store;
  // The host keeps a chat whose turn runs (the one that deleted the app) and unbinds it: it stays open, on the whole board.
  if (lastSessionId && store.streamingSessions[lastSessionId]) {
    store.setLastSession(lastSessionId, lastSessionTitle, { id: '' });
    store.requestOpenSession({ id: lastSessionId, title: lastSessionTitle });
    return;
  }
  store.setLastSession(null); // a panel opened later must not resume a chat the app took with it
  store.requestNewSession({ id: '' }); // and one already open moves back to the whole board
};

// Watches the host for deleted apps. Started once at startup, right after the service is bound, rather than
// from a panel: the pointer to a deleted app's chat has to be dropped whether or not any chat UI is mounted.
export const subscribeWorkspaceAppForgotten = (): Unsubscribe =>
  onWorkspaceAppForgotten(forgetWorkspaceApp);

// Watches for apps the agent renamed, from startup for the same reason: when the editor cannot follow a rename in place, its side panel remounts on the new id and resumes the chat only if the pointers name it.
export const subscribeWorkspaceAppRenamed = (): Unsubscribe =>
  onWorkspaceAppRenamed(useChatStore.getState().rebindWorkspace);
// Leaving a session is when its failed turn counts as read: from then on the host stops reporting it, after a restart too.
export const subscribeSessionReads = (): Unsubscribe =>
  useChatStore.subscribe((state, previous) => {
    const left = previous.currentSessionId;
    // A reset leaves the session without the user reading it, and after a switch the running engine has no record of it.
    if (
      !left ||
      left === state.currentSessionId ||
      state.sessionGeneration !== previous.sessionGeneration
    ) {
      return;
    }
    markSessionRead(left)
      .then((cleared) => {
        if (cleared) {
          useChatStore.getState().touchSessionList(); // the list read on the switch may predate the clear
        }
      })
      .catch(() => {
        // Best effort: the dot stays red until a later turn in that session succeeds.
      });
  });

// The session on screen counts as read once left, and a switch leaves it: call this before the engine that holds its failure stops.
export const readOpenSession = async (): Promise<void> => {
  const open = useChatStore.getState().currentSessionId;
  if (!open) {
    return;
  }
  const cleared = await markSessionRead(open).catch(() => false);
  if (cleared) {
    useChatStore.getState().touchSessionList();
  }
};

// Runs when a session's turn ends, however it ended, for whoever shows what the agent may have changed.
export const onTurnEnded = (
  handler: (sessionId: string) => void,
): Unsubscribe =>
  useChatStore.subscribe((state, previous) => {
    Object.keys(previous.streamingSessions)
      .filter((id) => !state.streamingSessions[id])
      .forEach(handler);
  });
