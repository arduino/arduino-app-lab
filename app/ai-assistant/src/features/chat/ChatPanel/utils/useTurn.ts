import type { AgentEditorContext } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { type MutableRefObject, useCallback, useRef, useState } from 'react';

import {
  awaitTurn,
  cancel,
  getAgent,
  isAuthError,
  isNetworkError,
  parseAgentError,
  prompt,
  SessionId,
} from '../../../../services';
import {
  type QueuedPrompt,
  opensSessionOnFirstPrompt,
  useAiAssistantStore,
  useChatStore,
} from '../../../../store';
import { isOffline } from '../../../../utils';

let idCounter = 0;
const nextId = (): string => `queued-${(idCounter += 1)}`;

// A stable empty array: a fresh [] per render would make the selector re-render forever.
const EMPTY_QUEUE: QueuedPrompt[] = [];

// A prompt that never left the page: the turn fails as a network one, with no words of the agent's.
const OFFLINE = new Error('offline');

export interface Turn {
  stop: () => Promise<void>;
  retry: (assistantMessageId: string) => Promise<void>;
  // Prompts waiting for the running turn to end, oldest first, with the gestures the panel offers.
  queuedPrompts: QueuedPrompt[];
  enqueue: (text: string) => void;
  removeQueued: (id: string) => void;
  clearQueued: VoidFunction;
  // A first prompt whose session did not open, for the composer to take back; a new object each time.
  restoredDraft?: { text: string };
  // Follow a turn the host runs that no send of this page owns, one sent before a reload, as if it were sent here.
  adopt: (sessionId: SessionId) => void;
}

// One turn of the conversation: sending a prompt, stopping it, and replaying a failed one. Everything
// it writes goes to the session's own thread, so a turn that outlives the panel it was sent from keeps
// building. `onSettled` runs when the turn ends, whichever way it ended.
export const useTurn = (
  sessionIdRef: MutableRefObject<SessionId | null>,
  // The panel's own session, reactive: the ref cannot drive a selector, and the store's shared pointer can
  // name the other mounted panel's chat, which would list its queued rows above this composer.
  ownSessionId: SessionId | null,
  onSettled: (sessionId: SessionId) => void,
  createSession: () => Promise<SessionId>,
  getEditorContext?: () => AgentEditorContext,
): Turn => {
  const getEditorContextRef = useRef(getEditorContext);
  getEditorContextRef.current = getEditorContext;
  const addUserText = useChatStore((s) => s.addUserText);
  const beginTurn = useChatStore((s) => s.beginTurn);
  const resumeTurn = useChatStore((s) => s.resumeTurn);
  const endTurn = useChatStore((s) => s.endTurn);
  const setMessageError = useChatStore((s) => s.setMessageError);
  const setMessageCancelled = useChatStore((s) => s.setMessageCancelled);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const markReplyReady = useChatStore((s) => s.markReplyReady);
  const setDraftSessionId = useChatStore((s) => s.setDraftSessionId);
  const setAuth = useAiAssistantStore((s) => s.setAuth);
  const setSessionExpired = useAiAssistantStore((s) => s.setSessionExpired);
  const [restoredDraft, setRestoredDraft] = useState<{ text: string }>();

  // send re-enters itself to drain the queue, which it cannot do through its own deps.
  const sendRef = useRef<
    ((text: string, targetSessionId?: SessionId) => Promise<void>) | null
  >(null);

  // The end of a turn, whichever way it ends: a prompt sent here and a turn adopted after a reload end alike.
  const runTurn = useCallback(
    async (
      sessionId: SessionId,
      assistantId: string,
      turn: () => Promise<void>,
    ): Promise<void> => {
      let succeeded = false;
      try {
        await turn();
        succeeded = true;
      } catch (e) {
        const { message, cause, kind, code } = parseAgentError(e);
        // The credential that expired is the running agent's; another one's must stay as it was.
        const running = useAiAssistantStore.getState().selectedAgentId;
        const authFailed = e !== OFFLINE && isAuthError(message, code);
        // With a key per provider, one provider refusing its key leaves the agent and its other providers working.
        if (authFailed && !getAgent(running)?.perProviderKeys) {
          setSessionExpired(true);
          if (running) {
            setAuth(running, { authenticated: false }); // drop to the connect screen to re-authenticate
          }
        } else if (e === OFFLINE) {
          setMessageError(sessionId, assistantId, '', 'network');
        } else {
          const failure = authFailed
            ? 'auth'
            : isNetworkError(message)
            ? 'network'
            : kind;
          setMessageError(sessionId, assistantId, cause ?? message, failure);
        }
      } finally {
        // The turn ended for THIS session, regardless of which session is on screen now — always clear its flags.
        endTurn(sessionId);
        if (succeeded) {
          const queued = useChatStore.getState().dequeuePrompt(sessionId);
          if (queued) {
            void sendRef.current?.(queued.text, sessionId);
          }
        } else {
          // A failed turn drops the queue, as Stop does: what waited on it may no longer apply.
          useChatStore.getState().clearQueuedPrompts(sessionId);
        }
        // Finished while the user had switched away → light the sidebar's "reply ready" dot.
        const isBackground =
          sessionId !== useChatStore.getState().currentSessionId;
        if (succeeded && isBackground) {
          markReplyReady(sessionId);
        }
        onSettled(sessionId);
      }
    },
    [
      endTurn,
      setMessageError,
      setAuth,
      setSessionExpired,
      markReplyReady,
      onSettled,
    ],
  );

  const send = useCallback(
    async (text: string, targetSessionId?: SessionId): Promise<void> => {
      const trimmed = text.trim();
      // A queued prompt belongs to the session it was typed in, which may no longer be the one on screen.
      const sessionId = targetSessionId ?? sessionIdRef.current;
      if (
        !trimmed ||
        !sessionId ||
        useChatStore.getState().streamingSessions[sessionId]
      ) {
        return;
      }

      // Only the session on screen leaves draft state; a background drain must not move the user out of their draft.
      if (sessionId === sessionIdRef.current) {
        setDraftSessionId(null);
      }

      addUserText(sessionId, trimmed);
      const assistantId = beginTurn(sessionId);
      await runTurn(sessionId, assistantId, async () => {
        if (isOffline()) {
          throw OFFLINE;
        }
        await prompt(sessionId, trimmed, getEditorContextRef.current?.());
      });
    },
    [sessionIdRef, addUserText, beginTurn, runTurn, setDraftSessionId],
  );
  sendRef.current = send;

  // Abort the in-flight turn; the agent settles the pending call, so the turn's end resets streaming.
  const stop = useCallback(async (): Promise<void> => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || !useChatStore.getState().streamingSessions[sessionId]) {
      return;
    }
    const streamingId =
      useChatStore.getState().threads[sessionId]?.streamingMessageId;
    if (streamingId) {
      setMessageCancelled(sessionId, streamingId);
    }
    // Stop drops the queue before the await, so the stopped turn's end sends only what is typed after it.
    useChatStore.getState().clearQueuedPrompts(sessionId);
    await cancel(sessionId);
  }, [sessionIdRef, setMessageCancelled]);

  const retry = useCallback(
    async (assistantMessageId: string): Promise<void> => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) {
        return;
      }

      const allMessages =
        useChatStore.getState().threads[sessionId]?.messages ?? [];
      const idx = allMessages.findIndex((m) => m.id === assistantMessageId);
      const userMessage = idx > 0 ? allMessages[idx - 1] : undefined;
      if (userMessage?.role !== 'user') {
        return;
      }
      const text = userMessage.parts
        .map((p) => (p.type === 'text' ? p.text : ''))
        .join('');
      if (!text) return;

      // Replay the turn from scratch: drop the failed reply *and* the prompt behind it, since
      // send() re-adds that prompt — otherwise the question stays in the thread twice.
      removeMessage(sessionId, assistantMessageId);
      removeMessage(sessionId, userMessage.id);
      await send(text);
    },
    [sessionIdRef, removeMessage, send],
  );

  // The queue is per session, so switching away and back finds the same prompts still waiting.
  const queuedPrompts = useChatStore(
    (s) =>
      (ownSessionId ? s.queuedPrompts[ownSessionId] : undefined) ?? EMPTY_QUEUE,
  );

  // Always through the queue, so a prompt never overtakes one still waiting; it reaches the thread only once sent.
  const enqueue = useCallback(
    (text: string): void => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      const queueFor = (sessionId: SessionId): void => {
        useChatStore.getState().enqueuePrompt(sessionId, nextId(), trimmed);
        if (useChatStore.getState().streamingSessions[sessionId]) {
          return;
        }
        const queued = useChatStore.getState().dequeuePrompt(sessionId);
        if (queued) {
          void sendRef.current?.(queued.text, sessionId);
        }
      };
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        queueFor(sessionId);
        return;
      }
      if (!opensSessionOnFirstPrompt(useAiAssistantStore.getState())) {
        return; // this engine's session opens with the chat: there is none to send to yet
      }
      void createSession().then(queueFor, () => {
        // createSession has put the failure on screen; the composer had already cleared the prompt.
        setRestoredDraft({ text: trimmed });
      });
    },
    [sessionIdRef, createSession],
  );

  const removeQueued = useCallback(
    (id: string): void => {
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        useChatStore.getState().removeQueuedPrompt(sessionId, id);
      }
    },
    [sessionIdRef],
  );

  const clearQueued = useCallback((): void => {
    const sessionId = sessionIdRef.current;
    if (sessionId) {
      useChatStore.getState().clearQueuedPrompts(sessionId);
    }
  }, [sessionIdRef]);

  const adopt = useCallback(
    (sessionId: SessionId): void => {
      if (useChatStore.getState().streamingSessions[sessionId]) {
        return; // a send from this page owns the turn
      }
      const assistantId = resumeTurn(sessionId);
      if (assistantId) {
        void runTurn(sessionId, assistantId, () => awaitTurn(sessionId));
      }
    },
    [resumeTurn, runTurn],
  );

  return {
    stop,
    retry,
    queuedPrompts,
    enqueue,
    removeQueued,
    clearQueued,
    restoredDraft,
    adopt,
  };
};
