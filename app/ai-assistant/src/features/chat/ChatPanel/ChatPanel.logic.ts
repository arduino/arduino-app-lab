import type { AgentEditorContext } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessageDescriptor } from 'react-intl';

import { messages } from '../../../messages';
import {
  AgentMode,
  AgentModel,
  choicesReply,
  ChoiceSubmission,
  openAgentFile,
  parseAgentError,
  PermissionOutcome,
  permissionReply,
  SessionId,
  SessionSummary,
} from '../../../services';
import {
  ChatMessage,
  ChoiceEcho,
  QueuedPrompt,
  SessionActionError,
  useAiAssistantStore,
  useChatStore,
} from '../../../store';
import { type PermissionView, permissionView } from './utils/permissionView';
import { useChatOwnership } from './utils/useChatOwnership';
import { useSessionBootstrap } from './utils/useSessionBootstrap';
import { useSessionToolbar } from './utils/useSessionToolbar';
import { useTurn } from './utils/useTurn';

// Stable empty array, so a session with no thread doesn't hand the view a new reference every render.
const EMPTY_MESSAGES: ChatMessage[] = [];

// The failure of the last turn, shown in the composer next to the permission and choices cards
// rather than in the thread: it asks the user for a decision (retry, or move on) about what to do
// next, which is the composer's job, and it isn't part of the transcript.
export interface RequestErrorView {
  messageId: string;
  // The agent's own words. Absent when the failure happened before it was reached at all (offline),
  // where `kind` is what the view speaks from.
  message?: string;
  // 'network' when the request never reached the provider, so the view explains it in its own
  // (localized) words instead of showing a raw transport error.
  kind?: string;
}

export interface ChatPanelLogic {
  messages: ChatMessage[];
  isStreaming: boolean;
  // Our estimate of what the agent has written this turn; no engine reports its output live.
  turnTokens: number;
  turnStartedAt?: number; // epoch ms the current turn started, for the elapsed-time counter
  permission?: PermissionView; // the permission/plan approval the turn is waiting on, ready to render
  requestError?: RequestErrorView; // the last turn's failure, ready to render
  // Why the session couldn't be opened (agent down, ACP handshake refused, a session the agent no
  // longer has…). Without it a failed bootstrap leaves an empty thread and no session id — which
  // renders as a fresh install, composer included.
  bootstrapError?: string;
  retryBootstrap: VoidFunction;
  models: AgentModel[];
  currentModelId?: string;
  setModel: (modelId: string) => Promise<void>;
  modes: AgentMode[];
  currentModeId?: string;
  setMode: (modeId: string) => Promise<void>;
  // The session could not report its model: the model menu stays open to a pick, with none shown as current.
  modelUnreadable: boolean;
  // The agent refused the model the user picked; the toast says so until dismissed or the next pick.
  modelPickFailed: boolean;
  dismissModelPickFailed: VoidFunction;
  // Prompts waiting for the running turn to end, oldest first, with the gestures the panel offers.
  queuedPrompts: QueuedPrompt[];
  enqueue: (text: string) => void;
  removeQueued: (id: string) => void;
  clearQueued: VoidFunction;
  stop: () => Promise<void>;
  retry: (assistantMessageId: string) => Promise<void>;
  respondPermission: (outcome: PermissionOutcome) => void;
  respondChoices: (
    requestId: string,
    submission: ChoiceSubmission,
    echo?: ChoiceEcho,
  ) => void;
  sessionTitle?: string;
  isLoadingSession: boolean;
  // No messages and nothing loading: the panel shows the centred empty state.
  isNewSession: boolean;
  // The workspace the next session opens in ('' = general), and the picker's action.
  workspaceId: string;
  // Set only when the current session's app is missing from the picker's list, so it can still be named.
  workspaceName?: string;
  selectWorkspace: (id: string, name?: string) => void;
  reopen: (session: SessionSummary) => void;
  newChat: VoidFunction;
  currentSessionId: SessionId | null;
  // Whether a prompt can be sent: a session is open, or an empty chat will create one.
  canCompose: boolean;
  restoredDraft?: { text: string };
  // Open a file the agent touched; rejects (→ fileError) when the path is stale, e.g. board changed.
  openFile: (path: string) => void;
  fileError?: string;
  dismissFileError: VoidFunction;
  // A session rename/pin/delete the side panel couldn't apply; reported here, as the sidebar has no
  // toast layer of its own.
  sessionActionError?: MessageDescriptor;
  dismissSessionActionError: VoidFunction;
}

const actionErrorMessages: Record<SessionActionError, MessageDescriptor> = {
  rename: messages.sessionsRenameFailed,
  pin: messages.sessionsPinFailed,
  delete: messages.sessionsDeleteFailed,
};

// lockedWorkspaceId binds the panel to one app (the editor's side panel): no picking, no resuming from elsewhere. onScreen says whether it is the panel being shown — see chatDriver.
export const useChatLogic = (
  lockedWorkspaceId?: string,
  lockedWorkspaceName?: string,
  onScreen = true,
  getEditorContext?: () => AgentEditorContext,
): ChatPanelLogic => {
  const isActive = useChatOwnership(onScreen);
  const addChoiceAnswer = useChatStore((s) => s.addChoiceAnswer);
  const setPendingPermission = useChatStore((s) => s.setPendingPermission);
  const clearSessionRequest = useChatStore((s) => s.clearSessionRequest);
  // Set by the side panel when a session mutation is rejected; shown in this panel's toast area.
  const sessionActionError = useAiAssistantStore((s) => s.sessionActionError);
  const setSessionActionError = useAiAssistantStore(
    (s) => s.setSessionActionError,
  );
  // A prompt sent while the agent restarts with a new key reaches no engine, and the reset after it drops the prompt.
  const restarting = useAiAssistantStore(
    (s) => s.credentialRestart?.phase === 'restarting',
  );

  // The panel displays its OWN session: until it adopts one the shared pointer still names the chat
  // shown before, and that thread would appear here.
  const [ownSessionId, setOwnSessionId] = useState<SessionId | null>(null);
  const [fileError, setFileError] = useState<string>();
  // Refs, not state: read at event time, or by callbacks that must not be re-created when they change.
  const sessionIdRef = useRef<SessionId | null>(null);
  // Bumped on every (re)bootstrap so an in-flight new/load bails if superseded or unmounted.
  const bootstrapToken = useRef(0);
  const adoptTurnRef = useRef<((id: SessionId) => void) | null>(null);
  // Everything the panel shows is per-session state the store owns, so the thread comes in one selector.
  const thread = useChatStore((s) =>
    ownSessionId ? s.threads[ownSessionId] : undefined,
  );
  const isStreaming = useChatStore((s) =>
    ownSessionId ? !!s.streamingSessions[ownSessionId] : false,
  );
  const messages = thread?.messages ?? EMPTY_MESSAGES;
  const pendingPermission = thread?.pendingPermission;
  const { hydratePickers, applyPendingPicks, ...toolbar } = useSessionToolbar(
    ownSessionId,
    sessionIdRef,
    bootstrapToken,
  );
  // Kept out of `session`: the turn uses refreshSessionTitle and createSession, canCompose reads emptyChat.
  const { refreshSessionTitle, createSession, emptyChat, ...session } =
    useSessionBootstrap({
      lockedWorkspaceId,
      lockedWorkspaceName,
      isActive,
      sessionIdRef,
      bootstrapToken,
      setOwnSessionId,
      hydratePickers,
      applyPendingPicks,
      adoptTurnRef,
    });
  const {
    stop,
    retry: retryTurn,
    queuedPrompts,
    enqueue,
    removeQueued,
    clearQueued,
    restoredDraft,
    adopt,
  } = useTurn(
    sessionIdRef,
    ownSessionId,
    refreshSessionTitle,
    createSession,
    getEditorContext,
  );
  adoptTurnRef.current = adopt;
  // Held like the composer: a retry sent during the restart reaches no engine, and the reset after it drops the prompt.
  const retry = useCallback(
    async (assistantMessageId: string): Promise<void> => {
      if (!restarting) {
        await retryTurn(assistantMessageId);
      }
    },
    [restarting, retryTurn],
  );

  // Only the newest message can carry a live failure; anything further back is history the composer
  // shouldn't reopen. Being derived rather than stored is also what retires the banner without a close
  // button: a retry replaces the message, and the next prompt (or a session switch) pushes it out of
  // last place — so there is nothing to dismiss.
  // The scan skips user rows because addChoiceAnswer appends one at the end: answer a Choices question and
  // then lose the connection, and the errored answer is no longer last — reading it would hide the failure.
  const lastAnswer = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant');
  const requestError =
    lastAnswer?.status === 'error'
      ? {
          messageId: lastAnswer.id,
          message: lastAnswer.error,
          kind: lastAnswer.errorKind,
        }
      : undefined;

  useEffect(
    () => () => {
      clearSessionRequest();
      setSessionActionError(undefined);
    },
    [clearSessionRequest, setSessionActionError],
  );

  const respondPermission = useCallback(
    (outcome: PermissionOutcome): void => {
      const sessionId = sessionIdRef.current;
      const request = sessionId
        ? useChatStore.getState().threads[sessionId]?.pendingPermission
        : undefined;
      if (!sessionId || !request) {
        return;
      }
      permissionReply(request.id, outcome);
      setPendingPermission(sessionId, undefined);
    },
    [setPendingPermission],
  );

  const respondChoices = useCallback(
    (
      requestId: string,
      submission: ChoiceSubmission,
      echo?: ChoiceEcho,
    ): void => {
      // Echo the answer as a real user turn (a 'choice-answer' part rendered as its own
      // bubble); the agent's continuation then opens a fresh assistant message (so the
      // thread reads question → answer → reply).
      const sessionId = sessionIdRef.current;
      if (echo && sessionId) {
        addChoiceAnswer(sessionId, echo);
      }
      choicesReply(requestId, submission);
    },
    [addChoiceAnswer],
  );

  const openFile = useCallback((path: string): void => {
    setFileError(undefined);
    void openAgentFile(path).catch((e: unknown) => {
      setFileError(parseAgentError(e).message);
    });
  }, []);

  const dismissFileError = useCallback((): void => setFileError(undefined), []);

  const dismissSessionActionError = useCallback(
    (): void => setSessionActionError(undefined),
    [setSessionActionError],
  );

  return {
    ...toolbar, // models/modes pickers and the turn's counters
    messages,
    isStreaming,
    permission: pendingPermission && permissionView(pendingPermission),
    requestError,
    // the session pointer and the workspace it opens in, with their actions
    ...session,
    isNewSession: messages.length === 0 && !session.isLoadingSession,
    enqueue,
    queuedPrompts,
    removeQueued,
    clearQueued,
    stop,
    retry,
    respondPermission,
    respondChoices,
    currentSessionId: ownSessionId,
    canCompose: (ownSessionId !== null || emptyChat) && !restarting,
    restoredDraft,
    openFile,
    fileError,
    dismissFileError,
    sessionActionError:
      sessionActionError && actionErrorMessages[sessionActionError],
    dismissSessionActionError,
  };
};
