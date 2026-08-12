import { create } from 'zustand';

import {
  Checklist,
  ChoiceRequest,
  PermissionRequest,
  SessionSummary,
  ToolCall,
  ToolCallStatus,
} from '../services';

// A cross-tree request to switch the chat's active session. The side panel writes it; ChatPanel.logic
// (the single owner of the session lifecycle) reacts, runs reopen/newChat, then clears it. `nonce`
// makes each request distinct so re-clicking "New chat" (or reopening the same session) re-fires.
export type SessionRequest =
  | { type: 'open'; session: SessionSummary; nonce: number }
  | { type: 'new'; nonce: number };

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
}

// Per-session chat state: each session keeps its own thread so a turn that streams while another session is
// open (a background turn) keeps building correctly, and switching sessions just displays a different thread.
interface Thread {
  messages: ChatMessage[];
  streamingMessageId?: string; // assistant message currently being appended to (this session's live turn)
  pendingPermission?: PermissionRequest;
  resolvedChoiceIds?: string[]; // choice questions already answered/skipped/closed — hidden on redisplay so they don't re-prompt after a reopen
}

interface ChatStore {
  currentSessionId: string | null; // the session shown in the panel; the UI reads threads[currentSessionId]
  threads: Record<string, Thread>;
  // The session to reopen on the panel's next mount, so navigating away (e.g. to My Apps) and back
  // resumes it; its title rides along to restore the header.
  lastSessionId: string | null;
  lastSessionTitle?: string;
  // Per-session in-flight-turn flag; the UI's `isStreaming` is derived from the current session's entry.
  streamingSessions: Record<string, boolean>;
  // Sessions whose turn finished while the user was viewing another session — a reply is waiting
  // (the sidebar's "reply ready" dot). Cleared once the user opens the session.
  replyReadySessions: Record<string, boolean>;

  // Pending session switch requested from the side panel; consumed and cleared by ChatPanel.logic.
  sessionRequest?: SessionRequest;

  // A session created by "New Session" that hasn't received a prompt yet. The agent only lists a
  // session once it has content, so this one has no sidebar row of its own — the side panel keeps
  // the "New Session" entry selected instead, until the first prompt promotes it to a real row.
  draftSessionId: string | null;

  setCurrentSessionId: (sessionId: string | null) => void;
  setLastSession: (sessionId: string | null, title?: string) => void;
  // Mark the open session as an unused draft (on "New Session"), or clear it (on the first prompt).
  setDraftSessionId: (sessionId: string | null) => void;
  // Flag a session as having a reply ready (its background turn finished, unseen).
  markReplyReady: (sessionId: string) => void;
  // Ask the chat to open an existing session (from the side panel).
  requestOpenSession: (session: SessionSummary) => void;
  // Ask the chat to start a fresh session (from the side panel).
  requestNewSession: VoidFunction;
  // Consume the pending request (called by ChatPanel.logic after acting on it).
  clearSessionRequest: VoidFunction;
  addMessage: (sessionId: string, message: ChatMessage) => void;
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
  setSessionStreaming: (sessionId: string, streaming: boolean) => void;
  // Empty a session's thread (before a cold reload replays its history).
  resetThread: (sessionId: string) => void;
  // Drop a session entirely (on delete).
  discardThread: (sessionId: string) => void;
  // Wipe every session on sign-out: the next sign-in respawns the agent with none of them loaded, and
  // a leftover thread would make bootstrap skip the loadSession replay and prompt a dead session id.
  reset: VoidFunction;
  // Same hazard as `reset`, for a crashed-out agent: the replacement process has none of these sessions
  // loaded. Keeps the session to reopen so a reconnect lands back in the same chat, replayed from disk —
  // unless it was an unprompted draft, which the agent never persisted and so cannot replay.
  resetLoadedSessions: VoidFunction;
}

const emptyThread = (): Thread => ({ messages: [] });

// Every non-action field, so `reset` restores the just-loaded state in one spread.
const initialState = {
  currentSessionId: null,
  threads: {},
  streamingSessions: {},
  replyReadySessions: {},
  sessionRequest: undefined,
  draftSessionId: null,
  lastSessionId: null,
  lastSessionTitle: undefined,
};

const mapMessage = (
  messages: ChatMessage[],
  messageId: string,
  update: (message: ChatMessage) => ChatMessage,
): ChatMessage[] =>
  messages.map((message) =>
    message.id === messageId ? update(message) : message,
  );

export const useChatStore = create<ChatStore>((set) => {
  // Immutably update one session's thread (creating it if absent).
  const patchThread = (
    sessionId: string,
    fn: (thread: Thread) => Thread,
  ): void =>
    set((state) => ({
      threads: {
        ...state.threads,
        [sessionId]: fn(state.threads[sessionId] ?? emptyThread()),
      },
    }));
  const patchMessages = (
    sessionId: string,
    fn: (messages: ChatMessage[]) => ChatMessage[],
  ): void =>
    patchThread(sessionId, (t) => ({ ...t, messages: fn(t.messages) }));

  return {
    ...initialState,

    setDraftSessionId: (draftSessionId): void => set({ draftSessionId }),

    setLastSession: (lastSessionId, lastSessionTitle): void =>
      set({ lastSessionId, lastSessionTitle }),

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
    requestNewSession: (): void =>
      set((state) => ({
        sessionRequest: {
          type: 'new',
          nonce: (state.sessionRequest?.nonce ?? 0) + 1,
        },
      })),
    clearSessionRequest: (): void => set({ sessionRequest: undefined }),

    addMessage: (sessionId, message): void =>
      patchMessages(sessionId, (messages) => [...messages, message]),

    appendText: (sessionId, messageId, delta): void =>
      patchMessages(sessionId, (messages) =>
        mapMessage(messages, messageId, (message) => {
          const parts = [...message.parts];
          const last = parts[parts.length - 1];
          if (last && last.type === 'text') {
            // The Claude ACP adapter re-sends the whole text block as one consolidated chunk after the deltas; drop the repeat.
            if (delta === last.text) {
              return message;
            }
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
      ),

    addToolCall: (sessionId, messageId, toolCall): void =>
      patchMessages(sessionId, (messages) =>
        mapMessage(messages, messageId, (message) => ({
          ...message,
          parts: [...message.parts, { type: 'tool_call', toolCall }],
        })),
      ),

    appendThinking: (sessionId, messageId, delta): void =>
      patchMessages(sessionId, (messages) =>
        mapMessage(messages, messageId, (message) => {
          const parts = [...message.parts];
          const last = parts[parts.length - 1];
          const now = Date.now();
          if (last && last.type === 'thinking') {
            // Same consolidated-block re-send guard as appendText.
            if (delta === last.text) {
              return message;
            }
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
      ),

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
      patchMessages(sessionId, (messages) =>
        mapMessage(messages, messageId, (message) => ({
          ...message,
          parts: message.parts.map((part) =>
            part.type === 'tool_call' && part.toolCall.id === toolCallId
              ? { type: 'tool_call', toolCall: { ...part.toolCall, ...patch } }
              : part,
          ),
        })),
      ),

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

    setSessionStreaming: (sessionId, streaming): void =>
      set((state) => {
        const next = { ...state.streamingSessions };
        if (streaming) {
          next[sessionId] = true;
        } else {
          delete next[sessionId];
        }
        return { streamingSessions: next };
      }),

    resetThread: (sessionId): void =>
      set((state) => ({
        threads: { ...state.threads, [sessionId]: emptyThread() },
      })),

    discardThread: (sessionId): void =>
      set((state) => {
        const threads = { ...state.threads };
        delete threads[sessionId];
        const streamingSessions = { ...state.streamingSessions };
        delete streamingSessions[sessionId];
        const replyReadySessions = { ...state.replyReadySessions };
        delete replyReadySessions[sessionId];
        return { threads, streamingSessions, replyReadySessions };
      }),

    reset: (): void => set({ ...initialState }),

    resetLoadedSessions: (): void =>
      set((state) => {
        const wasDraft =
          !!state.lastSessionId && state.lastSessionId === state.draftSessionId;
        return {
          ...initialState,
          lastSessionId: wasDraft ? null : state.lastSessionId,
          lastSessionTitle: wasDraft ? undefined : state.lastSessionTitle,
        };
      }),
  };
});
