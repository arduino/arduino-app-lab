import { useCallback, useEffect, useRef, useState } from 'react';

import {
  deleteSession,
  listSessions,
  onWorkspaceAppForgotten,
  pinSession,
  renameSession,
  SessionId,
  SessionSummary,
} from '../../services';
import {
  lastTurnFailed,
  opensSessionOnFirstPrompt,
  useAiAssistantStore,
  useChatStore,
} from '../../store';
import {
  groupSessionsByApp,
  SessionDotState,
  sessionDotState,
  SessionFolder,
  titleIfNamed,
} from '../../utils';

// A read that fails while the agent restarts is asked again, or its rows keep the typing dot of a turn that died.
const LIST_RETRY_MS = [2000, 5000];

// The chats of a forgotten app, as the host keeps them: deleted, or unbound when their turn still runs.
interface ForgottenChats {
  deleted: Set<SessionId>;
  unbound: Set<SessionId>;
}

const withoutForgottenChats = (
  rows: SessionSummary[],
  { deleted, unbound }: ForgottenChats,
): SessionSummary[] =>
  rows.flatMap((row) => {
    if (deleted.has(row.id)) {
      return [];
    }
    return unbound.has(row.id)
      ? [{ ...row, workspaceAppId: undefined, workspaceName: undefined }]
      : [row];
  });

export interface AgentSidePanelLogic {
  pinnedSessions: SessionSummary[];
  // Unpinned sessions, one folder per app; pinning takes a session out of its folder into the pinned group.
  folders: SessionFolder[];
  isFolderOpen: (appId: string) => boolean;
  toggleFolder: (appId: string) => void;
  currentSessionId: SessionId | null;
  // The open session is a fresh one with no prompt yet, so it has no row of its own — the
  // "New Session" entry stands in as the selected item until the first prompt creates the row.
  isDraftSession: boolean;
  dotState: (session: SessionSummary) => SessionDotState;
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

export const useAgentSidePanelLogic = (
  generalFolderName: string,
): AgentSidePanelLogic => {
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const draftSessionId = useChatStore((s) => s.draftSessionId);
  const opensOnFirstPrompt = useAiAssistantStore(opensSessionOnFirstPrompt);
  const streamingSessions = useChatStore((s) => s.streamingSessions);
  const sessionListVersion = useChatStore((s) => s.sessionListVersion);
  const requestOpenSession = useChatStore((s) => s.requestOpenSession);
  const forgetSession = useChatStore((s) => s.forgetSession);
  const discardThread = useChatStore((s) => s.discardThread);
  const retitleSession = useChatStore((s) => s.retitleSession);
  const requestNewSession = useChatStore((s) => s.requestNewSession);
  // Sessions whose background turn finished with an unseen reply (drives the "reply ready" dot).
  const replyReadySessions = useChatStore((s) => s.replyReadySessions);
  const currentHasError = useChatStore((s) =>
    currentSessionId
      ? lastTurnFailed(s.threads[currentSessionId]?.messages)
      : false,
  );

  // Rejected mutations are reported by the chat's toast area, so they go through the store.
  const setActionError = useAiAssistantStore((s) => s.setSessionActionError);
  // A board switch takes the agent down and brings it back; the list is scoped to the connected board, so it must be refetched.
  const agentDown = useAiAssistantStore((s) => s.agentDown);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  // Folders the user opened or closed by hand; anything absent falls back to the default below.
  const [folderOverrides, setFolderOverrides] = useState<
    Record<string, boolean>
  >({});
  const [editingId, setEditingId] = useState<string>();
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmingId, setConfirmingId] = useState<string>();
  const [isDeleting, setIsDeleting] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  // Enter/Escape already handled the edit; the ensuing blur must not re-save (or re-save on Escape).
  const skipBlurSave = useRef(false);
  const retryRef = useRef<ReturnType<typeof setTimeout>>();
  // A read still running at unmount must not schedule another.
  const mountedRef = useRef(true);
  // By chat, not by app: a live app can have the same id, as one created again or one on another board.
  const forgottenRef = useRef<ForgottenChats>({
    deleted: new Set(),
    unbound: new Set(),
  });
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  // Resolves with the rows it read, or undefined when the read failed.
  const refresh = useCallback(async (): Promise<
    SessionSummary[] | undefined
  > => {
    clearTimeout(retryRef.current);
    const read = async (
      attempt: number,
    ): Promise<SessionSummary[] | undefined> => {
      try {
        const listed = await listSessions();
        const { deleted } = forgottenRef.current;
        deleted.forEach((id) => {
          if (!listed.some((row) => row.id === id)) {
            deleted.delete(id); // gone from the host: an id is never used again
          }
        });
        const rows = withoutForgottenChats(listed, forgottenRef.current);
        setSessions(rows);
        return rows;
      } catch {
        // Keep the last known rows: swapping them for [] makes a dead agent look like a fresh install.
        const delay = LIST_RETRY_MS[attempt];
        if (delay !== undefined && mountedRef.current) {
          retryRef.current = setTimeout(() => void read(attempt + 1), delay);
        }
        return undefined;
      }
    };
    return read(0);
  }, []);
  useEffect(() => {
    const retry = retryRef;
    const mounted = mountedRef;
    mounted.current = true;
    return (): void => {
      mounted.current = false;
      clearTimeout(retry.current);
    };
  }, []);

  // Refresh the list on mount and whenever the open session, any live turn, a late title or the agent's own liveness changes,
  // so titles, status dots and the board's folders stay current while the panel stays mounted (it no longer
  // opens/closes like the popover).
  useEffect(() => {
    void refresh();
  }, [
    refresh,
    currentSessionId,
    streamingSessions,
    agentDown,
    sessionListVersion,
  ]);

  // The rows go at once, and stay out of the reads made before the host is done: a row left there would open a chat it is deleting.
  useEffect(
    () =>
      onWorkspaceAppForgotten((appId, chatIds) => {
        const streaming = useChatStore.getState().streamingSessions;
        const { deleted, unbound } = forgottenRef.current;
        // An older host names no chat: the rows on the app stand in, a chat it keeps among them included.
        const named =
          chatIds ??
          sessionsRef.current
            .filter((row) => row.workspaceAppId === appId)
            .map((row) => row.id);
        named.forEach((id) => (streaming[id] ? unbound : deleted).add(id));
        setSessions((rows) =>
          withoutForgottenChats(rows, forgottenRef.current),
        );
        void refresh();
      }),
    [refresh],
  );

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
      setDraftTitle(titleIfNamed(session.title) ?? '');
    },
    [setActionError],
  );

  const saveRename = useCallback(
    async (id: SessionId): Promise<void> => {
      setActionError(undefined);
      setEditingId(undefined);
      const title = draftTitle.trim();
      let renamed = false;
      try {
        await renameSession(id, title);
        renamed = true;
      } catch {
        setActionError('rename');
      }
      const rows = await refresh();
      // A blank title gives the session back its engine title, which only the list knows.
      const row = rows?.find((s) => s.id === id);
      if (renamed && (title || row)) {
        retitleSession(id, titleIfNamed(title || row?.title));
      }
    },
    [draftTitle, refresh, retitleSession, setActionError],
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
        // Its workspace must stop offering it, or returning to that workspace reopens a session the agent no longer has.
        forgetSession(id);
        // And drop what the session still held: a queued prompt would otherwise drain at its turn's end into
        // a session the agent has already deleted, writing the failure into a thread nobody can reach.
        discardThread(id);
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
    [
      currentSessionId,
      forgetSession,
      discardThread,
      requestNewSession,
      refresh,
      setActionError,
    ],
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

  // The folder holding the open session starts expanded, so the session you are in is always in view. Undefined
  // when it has no folder at all: it is pinned, and sits in the group above.
  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const hasRow = !!currentSession;
  const openFolderId =
    currentSession && !currentSession.pinned
      ? currentSession.workspaceAppId ?? ''
      : undefined;
  const [lastFolderId, setLastFolderId] = useState<string>();

  // A draft has no row of its own, so leaving it to the line above would collapse every folder on each "New chat",
  // until the first prompt promotes it: keep the last folder that did resolve instead.
  useEffect(() => {
    if (hasRow) {
      setLastFolderId(openFolderId);
    }
  }, [hasRow, openFolderId]);

  // Derived, not the state above: read from it, the folder of the session being opened would stay shut for one render.
  const currentFolderId = hasRow ? openFolderId : lastFolderId;

  const isFolderOpen = useCallback(
    (appId: string): boolean =>
      folderOverrides[appId] ?? appId === currentFolderId,
    [folderOverrides, currentFolderId],
  );

  const toggleFolder = useCallback(
    (appId: string): void =>
      setFolderOverrides((open) => ({
        ...open,
        [appId]: !(open[appId] ?? appId === currentFolderId),
      })),
    [currentFolderId],
  );

  const dotState = useCallback(
    (session: SessionSummary): SessionDotState =>
      sessionDotState(session, {
        currentSessionId,
        isStreaming: streamingSessions[session.id],
        isReplyReady: replyReadySessions[session.id],
        hasCurrentError: currentHasError,
      }),
    [currentSessionId, streamingSessions, replyReadySessions, currentHasError],
  );

  return {
    pinnedSessions: sessions.filter((s) => s.pinned),
    folders: groupSessionsByApp(
      sessions.filter((s) => !s.pinned),
      generalFolderName,
    ),
    isFolderOpen,
    toggleFolder,
    currentSessionId,
    // An empty chat has no session yet, so no current id: New Session is the selected entry.
    isDraftSession:
      (opensOnFirstPrompt && !currentSessionId) ||
      (!!draftSessionId && draftSessionId === currentSessionId),
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
