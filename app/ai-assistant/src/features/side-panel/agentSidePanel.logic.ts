import { useCallback, useEffect, useRef, useState } from 'react';

import {
  deleteSession,
  listSessions,
  pinSession,
  renameSession,
  SessionId,
  SessionSummary,
} from '../../services';
import { useAiAssistantStore, useChatStore } from '../../store';
import { SessionState } from './sessionState.type';

export interface AgentSidePanelLogic {
  pinnedSessions: SessionSummary[];
  otherSessions: SessionSummary[];
  currentSessionId: SessionId | null;
  // The open session is a fresh one with no prompt yet, so it has no row of its own — the
  // "New Session" entry stands in as the selected item until the first prompt creates the row.
  isDraftSession: boolean;
  dotState: (session: SessionSummary) => SessionState;
  onNewSession: VoidFunction;
  onSelectSession: (session: SessionSummary) => void;
  onPin: (session: SessionSummary) => void;
  editingId?: string;
  draftTitle: string;
  setDraftTitle: (value: string) => void;
  editInputRef: React.RefObject<HTMLInputElement>;
  startRename: (session: SessionSummary) => void;
  onRenameBlur: (id: SessionId) => void;
  onRenameKeyDown: (e: React.KeyboardEvent, id: SessionId) => void;
  confirmingId?: string;
  isDeleting: boolean;
  askDelete: (id: SessionId) => void;
  cancelDelete: VoidFunction;
  confirmDelete: (id: SessionId) => void;
}

export const useAgentSidePanelLogic = (): AgentSidePanelLogic => {
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const draftSessionId = useChatStore((s) => s.draftSessionId);
  const streamingSessions = useChatStore((s) => s.streamingSessions);
  const requestOpenSession = useChatStore((s) => s.requestOpenSession);
  const requestNewSession = useChatStore((s) => s.requestNewSession);
  // Sessions whose background turn finished with an unseen reply (drives the "reply ready" dot).
  const replyReadySessions = useChatStore((s) => s.replyReadySessions);
  const currentHasError = useChatStore((s) =>
    currentSessionId
      ? !!s.threads[currentSessionId]?.messages.some(
          (m) => m.status === 'error',
        )
      : false,
  );

  // Rejected mutations are reported by the chat's toast area, so they go through the store.
  const setActionError = useAiAssistantStore((s) => s.setSessionActionError);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [editingId, setEditingId] = useState<string>();
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmingId, setConfirmingId] = useState<string>();
  const [isDeleting, setIsDeleting] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  // Enter/Escape already handled the edit; the ensuing blur must not re-save (or re-save on Escape).
  const skipBlurSave = useRef(false);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setSessions(await listSessions());
    } catch {
      // Keep the last known rows: swapping them for [] makes a dead agent look like a fresh install.
      // Nothing marks them stale — a dead agent already dims the whole panel, and a transient failure
      // is corrected by the next refresh.
    }
  }, []);

  // Refresh the list on mount and whenever the open session or any live turn changes, so titles and
  // status dots stay current while the panel stays mounted (it no longer opens/closes like the popover).
  useEffect(() => {
    void refresh();
  }, [refresh, currentSessionId, streamingSessions]);

  // Focus the rename input when editing starts (accessible alternative to autoFocus).
  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
    }
  }, [editingId]);

  const onNewSession = useCallback(
    (): void => requestNewSession(),
    [requestNewSession],
  );
  const onSelectSession = useCallback(
    (session: SessionSummary): void => requestOpenSession(session),
    [requestOpenSession],
  );

  const startRename = useCallback(
    (session: SessionSummary): void => {
      setActionError(undefined);
      setConfirmingId(undefined);
      setEditingId(session.id);
      setDraftTitle(session.title ?? '');
    },
    [setActionError],
  );

  const saveRename = useCallback(
    async (id: SessionId): Promise<void> => {
      setActionError(undefined);
      setEditingId(undefined);
      try {
        await renameSession(id, draftTitle.trim());
      } catch {
        setActionError('rename');
      }
      await refresh();
    },
    [draftTitle, refresh, setActionError],
  );

  const onRenameBlur = useCallback(
    (id: SessionId): void => {
      if (skipBlurSave.current) {
        skipBlurSave.current = false;
        return;
      }
      void saveRename(id);
    },
    [saveRename],
  );

  const onRenameKeyDown = useCallback(
    (e: React.KeyboardEvent, id: SessionId): void => {
      if (e.key === 'Enter') {
        skipBlurSave.current = true;
        void saveRename(id);
      } else if (e.key === 'Escape') {
        skipBlurSave.current = true;
        setEditingId(undefined);
      }
    },
    [saveRename],
  );

  const askDelete = useCallback((id: SessionId): void => {
    setEditingId(undefined);
    setConfirmingId(id);
  }, []);

  const cancelDelete = useCallback((): void => setConfirmingId(undefined), []);

  const confirmDelete = useCallback(
    async (id: SessionId): Promise<void> => {
      setActionError(undefined); // re-arm: the toast must reappear for this attempt
      setIsDeleting(true);
      try {
        await deleteSession(id);
        // Deleting the session currently open leaves the chat pointing at nothing — start a fresh one.
        if (id === currentSessionId) {
          requestNewSession();
        }
      } catch {
        setActionError('delete');
      } finally {
        // Always close and refresh: the row is gone or still there, and the toast says which.
        await refresh();
        setIsDeleting(false);
        setConfirmingId(undefined);
      }
    },
    [currentSessionId, requestNewSession, refresh, setActionError],
  );

  const onPin = useCallback(
    async (session: SessionSummary): Promise<void> => {
      setActionError(undefined); // re-arm: the toast must reappear for this attempt
      try {
        await pinSession(session.id, !session.pinned);
      } catch {
        setActionError('pin');
      }
      await refresh();
    },
    [refresh, setActionError],
  );

  const dotState = useCallback(
    (session: SessionSummary): SessionState => {
      const isCurrent = session.id === currentSessionId;
      if (streamingSessions[session.id] || session.status === 'running') {
        return 'typing';
      }
      // A background session whose turn finished with a reply the user hasn't seen yet.
      if (!isCurrent && replyReadySessions[session.id]) {
        return 'replyReady';
      }
      if (session.status === 'error' || (isCurrent && currentHasError)) {
        return 'error';
      }
      return isCurrent ? 'active' : 'idle';
    },
    [currentSessionId, streamingSessions, replyReadySessions, currentHasError],
  );

  return {
    pinnedSessions: sessions.filter((s) => s.pinned),
    otherSessions: sessions.filter((s) => !s.pinned),
    currentSessionId,
    isDraftSession: !!draftSessionId && draftSessionId === currentSessionId,
    dotState,
    onNewSession,
    onSelectSession,
    onPin,
    editingId,
    draftTitle,
    setDraftTitle,
    editInputRef,
    startRename,
    onRenameBlur,
    onRenameKeyDown,
    confirmingId,
    isDeleting,
    askDelete,
    cancelDelete,
    confirmDelete,
  };
};
