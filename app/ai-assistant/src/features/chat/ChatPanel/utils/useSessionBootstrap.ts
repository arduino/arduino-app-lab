import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  closeSession,
  listSessions,
  loadSession,
  newSession,
  onWorkspaceAppRenamed,
  parseAgentError,
  SessionId,
  SessionState,
  SessionStatus,
  SessionSummary,
} from '../../../../services';
import {
  opensSessionOnFirstPrompt,
  useAiAssistantStore,
  useChatStore,
} from '../../../../store';
import { titleIfNamed } from '../../../../utils';

export interface SessionBootstrapOptions {
  // Binds the panel to one app (the editor's side panel): no picking, no resuming from elsewhere.
  lockedWorkspaceId?: string;
  lockedWorkspaceName?: string;
  // Whether this panel is the one driving the lifecycle; see useChatOwnership.
  isActive: boolean;
  sessionIdRef: MutableRefObject<SessionId | null>;
  bootstrapToken: MutableRefObject<number>;
  setOwnSessionId: (sessionId: SessionId | null) => void;
  hydratePickers: (
    id: SessionId,
    token: number,
  ) => Promise<SessionState | null>;
  applyPendingPicks: (id: SessionId) => Promise<void>;
  // Follows a turn the host is still running for a reopened session; set by the turn hook, which needs this one first.
  adoptTurnRef: MutableRefObject<((id: SessionId) => void) | null>;
}

export interface SessionBootstrap {
  sessionTitle?: string;
  isLoadingSession: boolean;
  bootstrapError?: string;
  retryBootstrap: VoidFunction;
  workspaceId: string;
  workspaceName?: string;
  selectWorkspace: (id: string, name?: string) => void;
  reopen: (session: SessionSummary) => void;
  newChat: VoidFunction;
  // A chat that takes a prompt with no session behind it: the prompt creates one.
  emptyChat: boolean;
  // Create and adopt the session for the first prompt of an empty chat.
  createSession: () => Promise<SessionId>;
  // Re-read the title the agent gave the session, once its first turn has settled.
  refreshSessionTitle: (sessionId: SessionId) => void;
}

// OpenCode names a session only after its turn has ended, so an unnamed one is asked again, less and less often.
const TITLE_RETRY_MS = [2000, 4000, 8000, 16000, 32000];

// Claude shows the first prompt, maybe cut short, as the title until it has written its own.
const isFinalTitle = (
  title: string | undefined,
  sessionId: SessionId,
): boolean => {
  if (!title) {
    return false;
  }
  const prompt = useChatStore
    .getState()
    .threads[sessionId]?.messages.find((m) => m.role === 'user')
    ?.parts.map((p) => (p.type === 'text' ? p.text : ''))
    .join('')
    .trim();
  return !prompt || !prompt.startsWith(title.replace(/(…|\.\.\.)$/, '').trim());
};

// Which session the panel points at, and which workspace the next one opens in. Two panels can be
// mounted at once but only the active one may open, resume or rebind a session — a hidden one doing
// it would move the shared pointer out from under the visible one.
export const useSessionBootstrap = ({
  lockedWorkspaceId,
  lockedWorkspaceName,
  isActive,
  sessionIdRef,
  bootstrapToken,
  setOwnSessionId,
  hydratePickers,
  applyPendingPicks,
  adoptTurnRef,
}: SessionBootstrapOptions): SessionBootstrap => {
  // The generation this panel's session was adopted in; a bump means its engine is gone.
  const adoptedGenerationRef = useRef(0);
  // Read by the unmount below: only the panel driving the chat owns the shared pointers it clears.
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const setCurrentSessionId = useChatStore((s) => s.setCurrentSessionId);
  const setLastSession = useChatStore((s) => s.setLastSession);
  const forgetWorkspaceSession = useChatStore((s) => s.forgetWorkspaceSession);
  const forgetSession = useChatStore((s) => s.forgetSession);
  const setDraftSessionId = useChatStore((s) => s.setDraftSessionId);
  const resetThread = useChatStore((s) => s.resetThread);
  const touchSessionList = useChatStore((s) => s.touchSessionList);
  const rememberSessionTitle = useChatStore((s) => s.rememberSessionTitle);
  const setPendingPermission = useChatStore((s) => s.setPendingPermission);
  const markReplayedTurn = useChatStore((s) => s.markReplayedTurn);
  const retitled = useChatStore((s) => s.retitled);
  const sessionRequest = useChatStore((s) => s.sessionRequest);
  const clearSessionRequest = useChatStore((s) => s.clearSessionRequest);

  const [sessionTitle, setSessionTitle] = useState<string | undefined>();
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | undefined>();
  const [emptyChat, setEmptyChat] = useState(false);
  const [creating, setCreating] = useState(false);
  // The same, read at event time by the activation effect: an empty chat has no session id to test.
  const openedEmptyRef = useRef(false);
  // The workspace the NEXT session opens in ('' = general). Its name is carried, not looked up: it
  // goes into the session's system prompt, and it labels a workspace the board no longer lists.
  const [workspaceId, setWorkspaceId] = useState(lockedWorkspaceId ?? '');
  const [workspaceName, setWorkspaceName] = useState(lockedWorkspaceName);

  // The workspace the held session belongs to: a hidden panel can be rebound before it is shown again.
  const sessionWorkspaceRef = useRef('');
  const workspaceIdRef = useRef(lockedWorkspaceId ?? '');
  const workspaceNameRef = useRef(lockedWorkspaceName);
  // Read through a ref so bootstrapResume and reopen don't take it as a dependency: a rebind would
  // give them a new identity and re-run the resume effect.
  const lockedWorkspaceIdRef = useRef(lockedWorkspaceId);
  lockedWorkspaceIdRef.current = lockedWorkspaceId;

  // On unmount: cancel any in-flight bootstrap and let go of the shared pointers. No session is closed —
  // a turn left running must finish in the background, not be interrupted; the store's subscriber keeps
  // writing it into its thread with no panel mounted.
  useEffect(
    () => () => {
      bootstrapToken.current += 1;
      // Clear the pointers only while they are still this panel's, or closing the docked one blanks the chat the user is looking at.
      if (
        isActiveRef.current &&
        useChatStore.getState().currentSessionId === sessionIdRef.current
      ) {
        setCurrentSessionId(null);
        setDraftSessionId(null);
      }
      sessionIdRef.current = null;
    },
    [bootstrapToken, sessionIdRef, setCurrentSessionId, setDraftSessionId],
  );

  // The only writer of the three: bootstrap reads the refs synchronously, so setting the state and forgetting the ref opens the next session on the previous workspace.
  const setWorkspace = useCallback((id: string, name?: string): void => {
    workspaceIdRef.current = id;
    workspaceNameRef.current = name;
    setWorkspaceId(id);
    setWorkspaceName(name);
  }, []);

  // Follow an agent rename, or the next session opens on an app that no longer exists. Locked panels too: their page can follow it without remounting them.
  useEffect(
    () =>
      onWorkspaceAppRenamed((oldId, newId, newName) => {
        if (sessionWorkspaceRef.current === oldId) {
          sessionWorkspaceRef.current = newId;
        }
        if (workspaceIdRef.current === oldId) {
          setWorkspace(newId, newName || workspaceNameRef.current);
        }
      }),
    [setWorkspace],
  );

  // Point the panel at a session: new (no id) or reopen (loadId, with its title); switching is display-only so the left session keeps streaming in its own thread.
  const bootstrap = useCallback(
    async (
      loadId?: SessionId,
      title?: string,
      status?: SessionStatus,
    ): Promise<void> => {
      if (
        !loadId &&
        opensSessionOnFirstPrompt(useAiAssistantStore.getState())
      ) {
        // No session yet: createSession opens it for the first prompt.
        bootstrapToken.current += 1;
        setCreating(false);
        setSessionTitle(undefined);
        setBootstrapError(undefined);
        setIsLoadingSession(false);
        sessionIdRef.current = null;
        setOwnSessionId(null);
        sessionWorkspaceRef.current = workspaceIdRef.current;
        setCurrentSessionId(null);
        setDraftSessionId(null);
        // Coming back to this workspace must find this empty chat, not the session it replaced.
        forgetWorkspaceSession(workspaceIdRef.current);
        setLastSession(null, undefined, {
          id: workspaceIdRef.current,
          name: workspaceNameRef.current,
        });
        openedEmptyRef.current = true;
        setEmptyChat(true);
        return;
      }
      const token = ++bootstrapToken.current;
      openedEmptyRef.current = false;
      setEmptyChat(false);
      // Pinned here: a switch that lands mid-flight moves the ref, and the failure below belongs to this workspace.
      const openedFor = workspaceIdRef.current;
      // The header showed the engine's raw timestamp while every list beside it read "Untitled chat".
      const named = titleIfNamed(title);
      setSessionTitle(named);
      setBootstrapError(undefined);
      try {
        const id =
          loadId ??
          (await newSession(
            workspaceIdRef.current || undefined,
            workspaceNameRef.current,
          ));
        if (bootstrapToken.current !== token) {
          if (!loadId) {
            void closeSession(id); // superseded/unmounted before we adopted the new session
          }
          return;
        }
        // Reopening a not-in-memory session needs a history replay; flag it (in the same tick as the
        // switch) so the panel shows a loader instead of flashing the empty "new chat" state. An empty
        // thread counts as none: a persisted session always has messages, so it is a leftover.
        const needsReplay =
          !!loadId && !useChatStore.getState().threads[id]?.messages.length;
        setIsLoadingSession(needsReplay);
        sessionIdRef.current = id; // what send/stop/setModel act on, and the title refresh compares against
        setOwnSessionId(id);
        sessionWorkspaceRef.current = workspaceIdRef.current;
        setCurrentSessionId(id); // the shared pointer the sidebar highlights; this panel's own display follows ownSessionId
        // A fresh session has no sidebar row until its first prompt gives it content; flag it so the
        // side panel can keep "New Session" selected in the meantime.
        setDraftSessionId(loadId ? null : id);
        // Remember it so navigating away and back reopens this session, workspace included.
        setLastSession(id, named, {
          id: workspaceIdRef.current,
          name: workspaceNameRef.current,
        });
        if (loadId && !needsReplay) {
          // In-memory reopen: the thread is already built (maybe a background turn still streaming) — just display it.
        } else {
          // resetThread first, and in this same tick: it is what creates the thread, and the store's
          // subscriber drops an update for a session that has none. Calling loadSession before it
          // would throw the whole replayed history away.
          resetThread(id);
          if (loadId) {
            await loadSession(loadId);
            if (bootstrapToken.current !== token) {
              return;
            }
          }
        }
        const state = await hydratePickers(id, token);
        if (state) {
          // After a reload the card is on the host only: its event went to the page that was there before.
          if (
            state.pendingPermission &&
            !useChatStore.getState().threads[id]?.pendingPermission
          ) {
            setPendingPermission(id, state.pendingPermission);
          }
          if (state.status === 'streaming') {
            adoptTurnRef.current?.(id);
          } else if (
            needsReplay &&
            (status === 'error' || status === 'cancelled')
          ) {
            // A replay carries no failure and no "stopped": the host keeps them only as the outcome of the last turn.
            markReplayedTurn(id, status);
          }
        }
      } catch (e) {
        // A remembered session that no longer loads must not be offered again: drop it so the workspace opens clean next time.
        if (loadId) {
          forgetWorkspaceSession(openedFor);
        }
        // Surface it: with no session id the composer stops rendering its send button, so a silent
        // failure is indistinguishable from a brand-new install.
        if (bootstrapToken.current === token) {
          setBootstrapError(parseAgentError(e).message);
        }
      } finally {
        // Clear the loader only if this bootstrap is still the current one (a newer switch owns it otherwise).
        if (bootstrapToken.current === token) {
          setIsLoadingSession(false);
        }
      }
    },
    [
      bootstrapToken,
      sessionIdRef,
      setOwnSessionId,
      resetThread,
      hydratePickers,
      adoptTurnRef,
      setPendingPermission,
      markReplayedTurn,
      setCurrentSessionId,
      setDraftSessionId,
      setLastSession,
      forgetWorkspaceSession,
    ],
  );

  // Shared by every send that arrives while it is in flight, for the chat that asked for it.
  const creatingRef = useRef<{
    token: number;
    session: Promise<SessionId>;
  } | null>(null);
  const createSession = useCallback((): Promise<SessionId> => {
    const token = bootstrapToken.current;
    if (creatingRef.current?.token === token) {
      return creatingRef.current.session;
    }
    const generation = useChatStore.getState().sessionGeneration;
    setCreating(true);
    setBootstrapError(undefined);
    const session = (async (): Promise<SessionId> => {
      let id: SessionId;
      try {
        id = await newSession(
          workspaceIdRef.current || undefined,
          workspaceNameRef.current,
        );
      } catch (e) {
        // The composer has already cleared the prompt, so the failure has to show.
        if (bootstrapToken.current === token) {
          setBootstrapError(parseAgentError(e).message);
        }
        throw e;
      }
      // First, and whatever happens next: the store drops an update for a session with no thread.
      resetThread(id);
      if (bootstrapToken.current !== token) {
        return id; // the panel moved on while it was created: the prompt runs as a background turn
      }
      // Read before the picks are applied: what it reports now is what a new session starts with.
      await hydratePickers(id, token);
      await applyPendingPicks(id);
      if (bootstrapToken.current !== token) {
        return id;
      }
      sessionIdRef.current = id;
      setOwnSessionId(id);
      sessionWorkspaceRef.current = workspaceIdRef.current;
      setCurrentSessionId(id);
      setLastSession(id, undefined, {
        id: workspaceIdRef.current,
        name: workspaceNameRef.current,
      });
      adoptedGenerationRef.current = generation;
      openedEmptyRef.current = false;
      setEmptyChat(false);
      return id;
    })();
    const entry = { token, session };
    creatingRef.current = entry;
    // A New session meanwhile has released the composer already, maybe for a newer creation.
    const clear = (): void => {
      if (creatingRef.current === entry) {
        creatingRef.current = null;
        setCreating(false);
      }
    };
    session.then(clear, clear);
    return session;
  }, [
    bootstrapToken,
    sessionIdRef,
    setOwnSessionId,
    resetThread,
    applyPendingPicks,
    hydratePickers,
    setCurrentSessionId,
    setLastSession,
  ]);

  const reopen = useCallback(
    (session: SessionSummary): void => {
      const workspace = session.workspaceAppId ?? '';
      const locked = lockedWorkspaceIdRef.current;
      if (locked !== undefined && workspace !== locked) {
        return; // a locked panel shows one app's sessions; anything else would rebind it from outside
      }
      // The picker shows the workspace of whatever is on screen, so adopt the reopened session's.
      setWorkspace(workspace, session.workspaceName);
      void bootstrap(session.id, session.title, session.status);
    },
    [bootstrap, setWorkspace],
  );

  const newChat = useCallback((): void => {
    void bootstrap();
  }, [bootstrap]);

  // A session's workspace is fixed at creation, so picking another opens a new session; the outgoing one is closed only if it was never used.
  const switchWorkspace = useCallback(
    (id: string, name?: string): void => {
      if (id === workspaceIdRef.current) {
        return;
      }
      setWorkspace(id, name);
      const current = sessionIdRef.current;
      const untouched =
        !useChatStore.getState().threads[current ?? '']?.messages.length;
      // Coming back to a workspace reopens the chat it was left on, so the user finds the situation they left.
      const remembered = useChatStore.getState().lastSessionByWorkspace[id];
      // Close the outgoing session only once its replacement is in place, or a failed bootstrap strands the composer on a dead one.
      void bootstrap(remembered?.id, remembered?.title).then(() => {
        if (current && untouched && sessionIdRef.current !== current) {
          // Its workspace remembered it on creation; closing it here would leave that pointer at a session the agent no longer has.
          forgetSession(current);
          void closeSession(current).catch(() => {
            // best-effort: a session already gone needs no cleanup
          });
        }
      });
    },
    [sessionIdRef, bootstrap, forgetSession, setWorkspace],
  );

  const selectWorkspace = useCallback(
    (id: string, name?: string): void => {
      if (lockedWorkspaceId === undefined) {
        switchWorkspace(id, name);
      }
    },
    [lockedWorkspaceId, switchWorkspace],
  );

  // Per session: a newer refresh of the same session stops the retries of the one before.
  const titleRefreshRef = useRef<Record<SessionId, number>>({});
  // A session that went to the background keeps being asked: its sidebar row waits for the name too.
  const refreshSessionTitle = useCallback(
    (sessionId: SessionId): void => {
      const refresh = (titleRefreshRef.current[sessionId] ?? 0) + 1;
      titleRefreshRef.current[sessionId] = refresh;
      const ask = (attempt: number, seen?: string): void => {
        if (titleRefreshRef.current[sessionId] !== refresh) {
          return;
        }
        void listSessions()
          .then((sessions) => {
            const title = titleIfNamed(
              sessions.find((s) => s.id === sessionId)?.title,
            );
            if (title && title !== seen) {
              rememberSessionTitle(sessionId, title);
              if (sessionId === sessionIdRef.current) {
                setSessionTitle((prev) => (title !== prev ? title : prev));
              }
              if (attempt > 0) {
                touchSessionList(); // the side panel read its rows before the engine named this one
              }
            }
            const delay = TITLE_RETRY_MS[attempt];
            if (delay !== undefined && !isFinalTitle(title, sessionId)) {
              setTimeout(() => ask(attempt + 1, title ?? seen), delay);
            }
          })
          .catch(() => {
            // best-effort: leave the title as-is on failure
          });
      };
      ask(0);
    },
    [sessionIdRef, rememberSessionTitle, touchSessionList],
  );
  // A rename from the sidebar reaches the header of whichever panel shows the session.
  useEffect(() => {
    if (retitled && retitled.sessionId === sessionIdRef.current) {
      setSessionTitle(retitled.title);
    }
  }, [retitled, sessionIdRef]);

  // An unmounted panel stops asking: the timers it leaves behind then do nothing.
  useEffect(() => {
    const refreshes = titleRefreshRef;
    return (): void => {
      refreshes.current = {};
    };
  }, []);

  // On (re)mount: reopen the session the user was in before navigating away this run; start fresh only on
  // the first open, after an app restart, or after a sign-out (all leave lastSessionId unset). Keeps the
  // current chat when toggling between Agent and other App Lab pages, without resuming it on a cold open.
  const bootstrapResume = useCallback(async (): Promise<void> => {
    const {
      lastSessionId,
      lastSessionTitle,
      lastSessionWorkspaceId,
      lastSessionWorkspaceName,
      lastSessionStatus,
      lastSessionByWorkspace,
    } = useChatStore.getState();
    // A locked panel resumes only what belongs to its own app; anything else starts a fresh session in the lock.
    const locked = lockedWorkspaceIdRef.current;
    const resumable =
      locked === undefined || (lastSessionWorkspaceId ?? '') === locked;
    // A chat of another workspace came last, as in Agent Mode: the app's own is the one its panel comes back to.
    const remembered =
      locked === undefined || resumable
        ? undefined
        : lastSessionByWorkspace[locked];
    if (lastSessionId && resumable) {
      // Adopt before bootstrapping: this path has no session summary to read the scope from, so a remount would resume a scoped session under the general label.
      setWorkspace(lastSessionWorkspaceId ?? '', lastSessionWorkspaceName);
      await bootstrap(lastSessionId, lastSessionTitle, lastSessionStatus);
    } else if (remembered) {
      await bootstrap(remembered.id, remembered.title);
    } else {
      // An empty chat has no session to carry its workspace across a remount; the store kept it.
      if (resumable && lastSessionWorkspaceId !== undefined) {
        setWorkspace(lastSessionWorkspaceId, lastSessionWorkspaceName);
      }
      await bootstrap();
    }
  }, [bootstrap, setWorkspace]);

  // Reopen whatever the failed bootstrap was aiming at. `newChat` is offered alongside it in the view,
  // because a retry can't help when the session itself is gone (a crash takes an unprompted draft with it).
  const retryBootstrap = useCallback((): void => {
    void bootstrapResume();
  }, [bootstrapResume]);

  // These three effects read the callbacks above, so they cannot move up with the others.

  // Rebinds the panel when the editor navigates to another app; the host loads the name after the id, so a late one is adopted without opening a session.
  useEffect(() => {
    if (lockedWorkspaceId === undefined) {
      return;
    }
    if (lockedWorkspaceId !== workspaceIdRef.current) {
      // A hidden panel only records the rebind: opening a session would move the shared pointer out from under the visible one.
      if (isActive) {
        switchWorkspace(lockedWorkspaceId, lockedWorkspaceName);
      } else {
        setWorkspace(lockedWorkspaceId, lockedWorkspaceName);
      }
    } else if (
      lockedWorkspaceName &&
      lockedWorkspaceName !== workspaceNameRef.current
    ) {
      setWorkspace(lockedWorkspaceId, lockedWorkspaceName);
    }
  }, [
    isActive,
    lockedWorkspaceId,
    lockedWorkspaceName,
    switchWorkspace,
    setWorkspace,
  ]);

  // Only the driving panel opens a session; taking over re-adopts the one this panel already holds, whose thread is still in the store.
  // In the deps because the panel only hides: without it a switch leaves a session the new engine lacks.
  const sessionGeneration = useChatStore((s) => s.sessionGeneration);
  // One switch bumps the generation twice, and both bumps opened a session: serialise, then re-run.
  const openingRef = useRef(false);
  const [rebootstrap, setRebootstrap] = useState(0);
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const sameScope =
      sessionWorkspaceRef.current === workspaceIdRef.current &&
      adoptedGenerationRef.current === sessionGeneration;
    if (sessionIdRef.current && sameScope) {
      setCurrentSessionId(sessionIdRef.current);
      return;
    }
    // An empty chat has no id to test; resuming here would replace it with the previous session.
    if (openedEmptyRef.current && sameScope) {
      setCurrentSessionId(null);
      return;
    }
    if (openingRef.current) {
      return;
    }
    openingRef.current = true;
    adoptedGenerationRef.current = sessionGeneration;
    void bootstrapResume().finally(() => {
      openingRef.current = false;
      if (
        useChatStore.getState().sessionGeneration !==
        adoptedGenerationRef.current
      ) {
        setRebootstrap((n) => n + 1);
      }
    });
  }, [
    isActive,
    bootstrapResume,
    sessionIdRef,
    setCurrentSessionId,
    sessionGeneration,
    adoptedGenerationRef,
    rebootstrap,
  ]);

  useEffect(() => {
    if (!sessionRequest || !isActive) {
      return; // one request, one panel: the hidden one would open a second session and win the global pointer
    }

    if (sessionRequest.type === 'open') {
      reopen(sessionRequest.session);
    } else if (
      sessionRequest.workspace &&
      lockedWorkspaceIdRef.current === undefined
    ) {
      switchWorkspace(
        sessionRequest.workspace.id,
        sessionRequest.workspace.name,
      );
    } else {
      newChat();
    }
    clearSessionRequest();
  }, [
    sessionRequest,
    isActive,
    reopen,
    newChat,
    switchWorkspace,
    clearSessionRequest,
  ]);

  return {
    sessionTitle,
    isLoadingSession,
    bootstrapError,
    retryBootstrap,
    workspaceId,
    workspaceName,
    selectWorkspace,
    reopen,
    newChat,
    emptyChat: emptyChat && !creating,
    createSession,
    refreshSessionTitle,
  };
};
