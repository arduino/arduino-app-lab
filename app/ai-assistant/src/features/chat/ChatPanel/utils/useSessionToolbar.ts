import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  AgentMode,
  AgentModel,
  getSessionState,
  newSessionState,
  SessionId,
  SessionState,
  setSessionMode,
  setSessionModel,
} from '../../../../services';
import {
  currentAuth,
  estimateOutputTokens,
  opensSessionOnFirstPrompt,
  useAiAssistantStore,
  useChatStore,
} from '../../../../store';

// Stable empty arrays so a toolbar with nothing advertised yet doesn't hand the view a new reference
// on every render.
const EMPTY_MODELS: AgentModel[] = [];
const EMPTY_MODES: AgentMode[] = [];

// Few retries: a read can fail or find no models yet, and one that times out may leave an untitled session the list cannot filter.
const NEW_SESSION_PICKS_RETRY_MS = [2000, 8000];

// One read per engine generation for every mounted chat: each read opens and deletes a hidden session.
let newSessionPicksRead:
  | { generation: number; done: Promise<void> }
  | undefined;

const loadNewSessionPicks = (generation: number): Promise<void> => {
  if (newSessionPicksRead?.generation === generation) {
    return newSessionPicksRead.done;
  }
  const done = newSessionState().then((state) => {
    if (useChatStore.getState().sessionGeneration !== generation) {
      return;
    }
    if (!state.models?.length) {
      throw new Error('the new session listed no models');
    }
    useAiAssistantStore.getState().setPickers({
      models: state.models,
      currentModelId: state.modelId,
      modes: state.modes ?? [],
      currentModeId: state.modeId,
    });
    useChatStore
      .getState()
      .setNewSessionPicks({ modelId: state.modelId, modeId: state.modeId });
  });
  newSessionPicksRead = { generation, done };
  done.catch(() => {
    if (newSessionPicksRead?.done === done) {
      newSessionPicksRead = undefined;
    }
  });
  return done;
};

export interface SessionToolbar {
  models: AgentModel[];
  currentModelId?: string;
  setModel: (modelId: string) => Promise<void>;
  modes: AgentMode[];
  currentModeId?: string;
  setMode: (modeId: string) => Promise<void>;
  // Our estimate of what the agent has written this turn; no engine reports its output live.
  turnTokens: number;
  turnStartedAt?: number;
  // Read the session's models/modes from the agent and record them, for the panel that opened it; null when superseded or failed.
  hydratePickers: (
    id: SessionId,
    token: number,
  ) => Promise<SessionState | null>;
  // For a session a first prompt created: note what it started with, then apply the picks made before it existed.
  applyPendingPicks: (id: SessionId) => Promise<void>;
  // The session could not say which model it is on: the menu stays open to a pick, with none shown as current.
  modelUnreadable: boolean;
  // The agent refused a model the user picked, so the session stays on the one it had.
  modelPickFailed: boolean;
  dismissModelPickFailed: VoidFunction;
}

// What the composer's toolbar shows for the session on screen: the pickers the agent advertises per
// session, and the live count of the running turn. All of it lives on that session's thread, so the
// two panels agree and switching between them mid-turn keeps the values.
export const useSessionToolbar = (
  ownSessionId: SessionId | null,
  sessionIdRef: MutableRefObject<SessionId | null>,
  bootstrapToken: MutableRefObject<number>,
): SessionToolbar => {
  const setSessionPickers = useChatStore((s) => s.setSessionPickers);
  const setSessionModelId = useChatStore((s) => s.setSessionModelId);
  const setSessionModeId = useChatStore((s) => s.setSessionModeId);
  const setPickers = useAiAssistantStore((s) => s.setPickers);
  const setNewSessionPicks = useChatStore((s) => s.setNewSessionPicks);
  // Only this agent's cache: the fallback exists to bridge a re-open, not to describe another engine.
  const cachedPickers = useAiAssistantStore((s) =>
    s.pickers?.agentId === s.selectedAgentId ? s.pickers : undefined,
  );
  const sessionPickers = useChatStore((s) =>
    ownSessionId ? s.threads[ownSessionId]?.pickers : undefined,
  );
  const writtenChars = useChatStore((s) =>
    ownSessionId ? s.threads[ownSessionId]?.turnOutChars ?? 0 : 0,
  );
  const turnStartedAt = useChatStore((s) =>
    ownSessionId ? s.threads[ownSessionId]?.turnStartedAt : undefined,
  );

  // Lists: the previous session's cache stands in per list while this one has none, so the toolbar
  // renders instead of popping in and no picker can vanish. ChatInput hides a picker whose list is
  // empty, and this session may well hold one empty list for good: a model_change that lands before
  // getSessionState carries no modes, and nothing retries a hydrate that failed.
  const opensOnFirstPrompt = useAiAssistantStore(opensSessionOnFirstPrompt);
  const newSessionPicks = useChatStore((s) => s.newSessionPicks);
  // An empty chat has no session to ask: until a new session's state is read, any pick shown is a guess.
  const startUnknown = !ownSessionId && opensOnFirstPrompt && !newSessionPicks;
  const models = sessionPickers?.models.length
    ? sessionPickers.models
    : startUnknown
    ? EMPTY_MODELS
    : cachedPickers?.models ?? EMPTY_MODELS;
  const modes = sessionPickers?.modes.length
    ? sessionPickers.modes
    : startUnknown
    ? EMPTY_MODES
    : cachedPickers?.modes ?? EMPTY_MODES;
  // Picks: only what THIS session reported, never the cache. ChatInput falls back to the first item
  // of the list, and the re-advertise below re-selects this value — another session's model here
  // would switch this session's instead of being the no-op it is meant to be.
  // Before the first prompt there is no session to tell, so a pick waits here until one exists.
  const [pendingModelId, setPendingModelId] = useState<string>();
  const [pendingModeId, setPendingModeId] = useState<string>();
  const pendingRef = useRef({ modelId: pendingModelId, modeId: pendingModeId });
  pendingRef.current = { modelId: pendingModelId, modeId: pendingModeId };
  const sessionGeneration = useChatStore((s) => s.sessionGeneration);
  // Dropped once the chat has a session, or once the engine that listed the options restarts.
  useEffect(() => {
    setPendingModelId(undefined);
    setPendingModeId(undefined);
  }, [ownSessionId, sessionGeneration]);

  const agentReady = useAiAssistantStore(
    (s) => currentAuth(s).authenticated && !s.agentDown,
  );
  // Every engine restart empties the picks of an empty chat, and only a new session's state restores them.
  useEffect(() => {
    if (!startUnknown || !agentReady) {
      return;
    }
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const attempt = (n: number): void => {
      loadNewSessionPicks(sessionGeneration).catch(() => {
        if (!cancelled && n < NEW_SESSION_PICKS_RETRY_MS.length) {
          retry = setTimeout(
            () => attempt(n + 1),
            NEW_SESSION_PICKS_RETRY_MS[n],
          );
        }
      });
    };
    attempt(0);
    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  }, [startUnknown, agentReady, sessionGeneration]);
  // Unpicked, an empty chat shows what the session its prompt creates will start with.
  const currentModelId = ownSessionId
    ? sessionPickers?.currentModelId
    : pendingModelId ?? newSessionPicks?.modelId;
  const currentModeId = ownSessionId
    ? sessionPickers?.currentModeId
    : pendingModeId ?? newSessionPicks?.modeId;

  // Latest selected model, read by the delayed refresh below without re-arming its timers.
  const currentModelIdRef = useRef<string | undefined>(currentModelId);
  currentModelIdRef.current = currentModelId;
  // The thread names a pick only once it lands: a refresh meanwhile would re-select the model it replaces.
  const picksInFlight = useRef(0);
  const [modelPickFailed, setModelPickFailed] = useState(false);
  // The session whose state read failed, so its model may never be reported.
  const [unreadSession, setUnreadSession] = useState<SessionId>();

  const reselectModel = useCallback((sessionId: SessionId): void => {
    const modelId = currentModelIdRef.current;
    if (modelId && picksInFlight.current === 0) {
      void setSessionModel(sessionId, modelId).catch(() => {
        // best-effort refresh; ignore failures
      });
    }
  }, []);
  // Not during a turn, where the engine would get a model change in the middle of it: the turn's end runs it once.
  const reselectAfterTurn = useRef(false);
  const turnRuns = useChatStore((s) =>
    ownSessionId ? !!s.streamingSessions[ownSessionId] : false,
  );

  // Soon after a session opens, re-select the current model (no-op) so the agent re-advertises the now-warmer catalog cache — surfaces a late-loading Fable 5 without user action.
  useEffect(() => {
    reselectAfterTurn.current = false;
    if (!ownSessionId) {
      return;
    }
    const timers = [3000, 12000].map((ms) =>
      setTimeout(() => {
        if (useChatStore.getState().streamingSessions[ownSessionId]) {
          reselectAfterTurn.current = true;
        } else {
          reselectModel(ownSessionId);
        }
      }, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [ownSessionId, reselectModel]);

  useEffect(() => {
    if (turnRuns || !ownSessionId || !reselectAfterTurn.current) {
      return;
    }
    reselectAfterTurn.current = false;
    reselectModel(ownSessionId);
  }, [turnRuns, ownSessionId, reselectModel]);

  const hydratePickers = useCallback(
    async (id: SessionId, token: number): Promise<SessionState | null> => {
      const state = await getSessionState(id).catch(() => null);
      if (bootstrapToken.current !== token) {
        return null;
      }
      if (!state) {
        setUnreadSession(id);
        return null;
      }
      setUnreadSession((unread) => (unread === id ? undefined : unread));
      const next = {
        models: state.models ?? [],
        currentModelId: state.modelId,
        modes: state.modes ?? [],
        currentModeId: state.modeId,
      };
      setSessionPickers(id, next);
      // Cache for the next open, so its pickers render without a gap. Read back what the thread
      // ended up with: setSessionPickers grows the models list, and seeding the next session from
      // the cold read would drop a model this one had.
      setPickers({
        ...next,
        models:
          useChatStore.getState().threads[id]?.pickers?.models ?? next.models,
      });
      return state;
    },
    [bootstrapToken, setPickers, setSessionPickers],
  );

  const setModel = useCallback(
    async (modelId: string): Promise<void> => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) {
        if (opensOnFirstPrompt) {
          // Also on the ref: a creation that is applying the picks reads it before the next render.
          pendingRef.current = { ...pendingRef.current, modelId };
          setPendingModelId(modelId);
        }
        return;
      }
      setModelPickFailed(false);
      const was =
        useChatStore.getState().threads[sessionId]?.pickers?.currentModelId;
      // A user pick of the model the session already runs is no change; the catalog refresh above calls the engine itself.
      if (modelId === was) {
        return;
      }
      picksInFlight.current += 1;
      try {
        await setSessionModel(sessionId, modelId);
        setSessionModelId(sessionId, modelId);
        // The backend starts the next chat on a switch from a known model, so an empty chat shows it too.
        const { newSessionPicks: picks, setNewSessionPicks } =
          useChatStore.getState();
        if (was && picks) {
          setNewSessionPicks({ ...picks, modelId });
        }
      } catch {
        setModelPickFailed(true);
        // failed switch: resync the picker to the agent's actual model
        const state = await getSessionState(sessionId).catch(() => null);
        if (state) {
          setSessionModelId(sessionId, state.modelId);
        }
      } finally {
        picksInFlight.current -= 1;
      }
    },
    [opensOnFirstPrompt, sessionIdRef, setSessionModelId],
  );

  const setMode = useCallback(
    async (modeId: string): Promise<void> => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) {
        if (opensOnFirstPrompt) {
          pendingRef.current = { ...pendingRef.current, modeId };
          setPendingModeId(modeId);
        }
        return;
      }
      try {
        await setSessionMode(sessionId, modeId);
        setSessionModeId(sessionId, modeId);
      } catch {
        // failed switch: resync the picker to the agent's actual mode
        const state = await getSessionState(sessionId).catch(() => null);
        if (state) {
          setSessionModeId(sessionId, state.modeId);
        }
      }
    },
    [opensOnFirstPrompt, sessionIdRef, setSessionModeId],
  );

  const applyPendingPicks = useCallback(
    async (sessionId: SessionId): Promise<void> => {
      const reported = useChatStore.getState().threads[sessionId]?.pickers;
      if (reported) {
        setNewSessionPicks({
          modelId: reported.currentModelId,
          modeId: reported.currentModeId,
        });
      }
      // Picks made while these are applied wait too, so read them again until nothing new is left.
      // A model the new session already runs is no change to send.
      const applied: { modelId?: string; modeId?: string } = {
        modelId: reported?.currentModelId,
      };
      for (;;) {
        const { modelId, modeId } = pendingRef.current;
        const model = modelId !== applied.modelId ? modelId : undefined;
        const mode = modeId !== applied.modeId ? modeId : undefined;
        if (!model && !mode) {
          return;
        }
        applied.modelId = modelId;
        applied.modeId = modeId;
        // A pick the engine refuses leaves its default: the prompt must still go.
        await Promise.all([
          model &&
            setSessionModel(sessionId, model)
              .then(() => {
                setSessionModelId(sessionId, model);
                // A switch from a known model is what the backend starts the next chat on, as in setModel.
                const { newSessionPicks: picks } = useChatStore.getState();
                if (reported?.currentModelId && picks) {
                  setNewSessionPicks({ ...picks, modelId: model });
                }
              })
              .catch(() => setModelPickFailed(true)),
          mode &&
            setSessionMode(sessionId, mode)
              .then(() => setSessionModeId(sessionId, mode))
              .catch(() => undefined),
        ]);
      }
    },
    [setNewSessionPicks, setSessionModelId, setSessionModeId],
  );

  const dismissModelPickFailed = useCallback(
    (): void => setModelPickFailed(false),
    [],
  );

  // A free model shows only the elapsed time.
  const onFreeModel = models.some((m) => m.id === currentModelId && m.free);

  return {
    models,
    currentModelId,
    setModel,
    modes,
    currentModeId,
    setMode,
    turnTokens: onFreeModel ? 0 : estimateOutputTokens(writtenChars),
    turnStartedAt,
    hydratePickers,
    applyPendingPicks,
    modelUnreadable:
      !!ownSessionId &&
      unreadSession === ownSessionId &&
      currentModelId === undefined,
    modelPickFailed,
    dismissModelPickFailed,
  };
};
