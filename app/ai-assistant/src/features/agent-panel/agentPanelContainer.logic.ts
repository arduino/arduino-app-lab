import { useCallback, useEffect, useState } from 'react';

import type { SessionId, SessionSummary } from '../../services';
import { listSessions, start } from '../../services';
import type { AgentDownReason } from '../../store';
import {
  currentAuth,
  lastTurnFailed,
  useAiAssistantStore,
  useChatStore,
} from '../../store';
import { SessionDotState, sessionDotState } from '../../utils';
import { resolveAgentAuth } from '../connect/utils/resolveAgentAuth';
import { reviveAgent, useAgentRevive } from '../panel/agentRestart';

export interface AgentPanelContainerLogic {
  authenticated: boolean;
  // The agent process is still being launched: hold ChatPanel back, or its first newSession finds no manager.
  starting: boolean;
  // The agent gave up restarting: the panel offers Reconnect, as Agent Mode does.
  agentDown: boolean;
  agentDownReason?: AgentDownReason;
  reconnecting: boolean;
  reconnect: VoidFunction;
  // Reviving on its own after a board switch the user confirmed: the loader, no prompt.
  reviving: boolean;
  onNewSession: VoidFunction;
  historyOpen: boolean;
  toggleHistory: VoidFunction;
  closeHistory: VoidFunction;
  // This app's sessions only, newest first as the backend lists them.
  sessions: SessionSummary[];
  currentSessionId: SessionId | null;
  onSelectSession: (session: SessionSummary) => void;
  dotState: (session: SessionSummary) => SessionDotState;
  // A session of this app got a reply while it wasn't the open one — badges the history button until seen.
  hasUnread: boolean;
}

// New chat mirrors AgentSidePanel's `onNewSession` — same store action, same request-driven
// hand-off to the persistent ChatPanel.
export const useAgentPanelContainerLogic = (
  appId: string,
): AgentPanelContainerLogic => {
  const authenticated = useAiAssistantStore(
    (s) => currentAuth(s).authenticated,
  );
  const setAuth = useAiAssistantStore((s) => s.setAuth);
  const setAgentDown = useAiAssistantStore((s) => s.setAgentDown);
  const agentDown = useAiAssistantStore((s) => s.agentDown);
  const revive = useAgentRevive((s) => s.reviving);
  const requestNewSession = useChatStore((s) => s.requestNewSession);
  const requestOpenSession = useChatStore((s) => s.requestOpenSession);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const streamingSessions = useChatStore((s) => s.streamingSessions);
  // Sessions whose background turn finished with an unseen reply (drives the "reply ready" dot and the badge).
  const replyReadySessions = useChatStore((s) => s.replyReadySessions);
  const currentSessionHasError = useChatStore((s) =>
    currentSessionId
      ? lastTurnFailed(s.threads[currentSessionId]?.messages)
      : false,
  );
  const [starting, setStarting] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  // Nothing else fetches auth status or starts the agent process unless Settings
  // or the full-screen Agent Mode (AiAssistantPanel.logic.ts) has mounted first.
  // ChatPanel itself never calls `start` — it assumes the process is already
  // running — so this panel has to do both, the same as that full-screen bootstrap,
  // or ChatPanel opens onto a process that was never launched ("agent not started").
  useEffect(() => {
    let active = true;
    resolveAgentAuth()
      .then(async (status) => {
        if (!active) return;
        if (!status?.authenticated) {
          setStarting(false);
          return;
        }
        try {
          await start(status.agentId);
          if (active) {
            setAuth(status.agentId, status);
            setAgentDown(undefined); // the process answered: drop a crash flag left by the full-screen panel
            setStarting(false);
          }
        } catch {
          // Couldn't launch the agent process — fall back to the connect CTA
          // rather than opening a chat with nothing behind it.
          if (active) {
            setAuth(status.agentId, { authenticated: false });
            setStarting(false);
          }
        }
      })
      .catch(() => {
        // The probe itself failed, so no agent is named and nothing can be recorded about one.
        if (active) {
          setStarting(false);
        }
      });
    return () => {
      active = false;
    };
  }, [setAuth, setAgentDown]);

  // Refetched on mount, on open (in case a session started elsewhere meanwhile), and whenever a reply comes in —
  // that last one is what lets the unread badge react while the menu stays closed, not just once opened.
  useEffect(() => {
    let active = true;
    listSessions()
      .then((all) => {
        if (active) {
          setSessions(all.filter((s) => (s.workspaceAppId ?? '') === appId));
        }
      })
      .catch(() => {
        // Keep the last known rows: emptying them makes a slow agent look like an app with no history.
      });
    return () => {
      active = false;
    };
  }, [historyOpen, appId, replyReadySessions]);

  const onNewSession = useCallback((): void => {
    setHistoryOpen(false);
    requestNewSession();
  }, [requestNewSession]);

  const toggleHistory = useCallback(
    (): void => setHistoryOpen((open) => !open),
    [],
  );
  const closeHistory = useCallback((): void => setHistoryOpen(false), []);

  const onSelectSession = useCallback(
    (session: SessionSummary): void => {
      setHistoryOpen(false);
      requestOpenSession(session);
    },
    [requestOpenSession],
  );

  const dotState = useCallback(
    (session: SessionSummary): SessionDotState =>
      sessionDotState(session, {
        currentSessionId,
        isStreaming: streamingSessions[session.id],
        isReplyReady: replyReadySessions[session.id],
        hasCurrentError: currentSessionHasError,
      }),
    [
      currentSessionId,
      streamingSessions,
      replyReadySessions,
      currentSessionHasError,
    ],
  );

  const hasUnread = sessions.some(
    (s) => s.id !== currentSessionId && replyReadySessions[s.id],
  );

  const reconnect = useCallback((): void => reviveAgent('manual'), []);

  return {
    authenticated,
    starting,
    agentDown: authenticated && !!agentDown,
    agentDownReason: agentDown?.reason,
    reconnecting: revive !== undefined,
    reconnect,
    reviving: revive === 'auto',
    onNewSession,
    historyOpen,
    toggleHistory,
    closeHistory,
    sessions,
    currentSessionId,
    onSelectSession,
    dotState,
    hasUnread,
  };
};
