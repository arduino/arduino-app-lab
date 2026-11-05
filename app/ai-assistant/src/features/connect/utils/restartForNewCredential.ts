import {
  AgentId,
  setDefaultAgent,
  start,
  stop,
  switchAgent,
} from '../../../services';
import {
  readOpenSession,
  useAiAssistantStore,
  useChatStore,
} from '../../../store';
import { agentIsBusy } from '../../../store/chatStore';
import { switchRefusalOf } from './describeError';
import { errorText } from './errorText';

// The new process has none of the front end's sessions loaded, and a leftover thread would make the
// chat skip its loadSession replay and prompt a session id it never saw. Keeps the session to reopen.
// Another engine has never seen it: loading a foreign id fails, and the retry orphaned a session.
const dropLoadedSessions = (
  leaving: AgentId | undefined,
  agentId: AgentId,
): void => {
  if (leaving && leaving !== agentId) {
    useChatStore.getState().reset();
  } else {
    useChatStore.getState().resetLoadedSessions();
  }
};

// Hands a freshly proven credential to the agent, for both surfaces that authenticate (the connect
// panel and the Settings "Agent" section). It has to respawn rather than start: the credential only
// reaches the agent through its child process' environment at spawn, and AgentStart is idempotent — so
// with the expired-credential process still alive (that path drops to the connect screen without
// stopping it) start() alone would keep the stale credential and loop the user back through login.
const replaceProcess = async (agentId: AgentId): Promise<void> => {
  const leaving = useAiAssistantStore.getState().selectedAgentId;
  useAiAssistantStore
    .getState()
    .setCredentialRestart({ agentId, phase: 'restarting' });
  if (leaving && leaving !== agentId) {
    await readOpenSession();
  }
  // A switch, so the mirror is synced and emptied; uncaught, because a refusal must stop the sign-in.
  try {
    await switchAgent(agentId);
  } catch (e) {
    const { restarted, restartFailed } = switchRefusalOf(errorText(e));
    // Either way Go stopped the agent in use, and its sessions went with that process.
    if (restarted || restartFailed) {
      useChatStore.getState().resetLoadedSessions();
    }
    // Its start again failed: the agent in use is down, and its stopped prompt offers Reconnect.
    if (restartFailed && leaving) {
      useAiAssistantStore
        .getState()
        .setAgentDown({ agentId: leaving, reason: 'start-failed' });
    }
    throw e;
  }
  // Nothing running is a no-op, and a failed teardown has still freed Go's manager slot — either way
  // the start below spawns a fresh process, so a rejection must not block the sign-in.
  await stop().catch(() => undefined);
  try {
    await start(agentId);
  } catch (e) {
    // The host has already moved, so the panel must say the agent is down, not wait for a prompt.
    useAiAssistantStore
      .getState()
      .setAgentDown({ agentId, reason: 'start-failed' });
    // Reconnect only starts the agent, so the sessions the stopped process had loaded are dropped here.
    dropLoadedSessions(leaving, agentId);
    useAiAssistantStore.getState().setSelectedAgent(agentId);
    throw e;
  }
  dropLoadedSessions(leaving, agentId);
  // Else a give-up from the process we just replaced keeps the panel on its "agent stopped" screen.
  useAiAssistantStore.getState().setAgentDown(undefined);
  // Whatever moves the process names it: a later probe would pick the default and point at the wrong one.
  useAiAssistantStore.getState().setSelectedAgent(agentId);
  // And the default, or the next launch resolves the old one and hands back the agent you left.
  await setDefaultAgent(agentId).catch(() => undefined);
};

// Key changes made during one wait share the restart that ends it.
let waiting: { agentId: AgentId; restarted: Promise<boolean> } | undefined;
let tail: Promise<unknown> = Promise.resolve();
let inFlight = 0;

// A restart already running keeps the hold on Send, whatever is asked for after it.
const hold = (agentId: AgentId, phase: 'waiting' | 'restarting'): void => {
  const { credentialRestart, setCredentialRestart } =
    useAiAssistantStore.getState();
  if (credentialRestart?.phase !== 'restarting') {
    setCredentialRestart({ agentId, phase });
  }
};

// The chat holds Send from the first request to the end of the last restart queued behind it.
const releaseHold = (): void => {
  if (inFlight === 0 && !waiting) {
    useAiAssistantStore.getState().setCredentialRestart(undefined);
  }
};

// One at a time: a second stop and start under the first would stop the engine it is starting.
const queue = <T>(agentId: AgentId, job: () => Promise<T>): Promise<T> => {
  hold(agentId, 'restarting');
  inFlight += 1;
  const done = tail
    .catch(() => undefined)
    .then(job)
    .finally(() => {
      inFlight -= 1;
      releaseHold();
    });
  tail = done;
  return done;
};

export const restartForNewCredential = (agentId: AgentId): Promise<void> =>
  queue(agentId, () => replaceProcess(agentId));

// A restart not started yet reads every key stored before it starts, so the changes made meanwhile share it.
let queuedKeyRestart:
  | { agentId: AgentId; restarted: Promise<boolean> }
  | undefined;

const keyRestart = (agentId: AgentId): Promise<boolean> => {
  if (queuedKeyRestart?.agentId === agentId) {
    return queuedKeyRestart.restarted;
  }
  const entry = { agentId } as {
    agentId: AgentId;
    restarted: Promise<boolean>;
  };
  entry.restarted = queue(agentId, async () => {
    if (queuedKeyRestart === entry) {
      queuedKeyRestart = undefined;
    }
    const { agentDown, selectedAgentId } = useAiAssistantStore.getState();
    // A give-up is answered by Reconnect, whose start reads the key too; another agent reads it at its next start.
    if (agentDown || selectedAgentId !== agentId) {
      return false;
    }
    await replaceProcess(agentId);
    return true;
  });
  queuedKeyRestart = entry;
  return entry.restarted;
};

// Checked again after each end: a queued prompt starts the next turn in the same tick.
const turnsEnded = async (): Promise<void> => {
  while (agentIsBusy()) {
    await new Promise<void>((resolve) => {
      const unsubscribe = useChatStore.subscribe(() => {
        if (!agentIsBusy()) {
          unsubscribe();
          resolve();
        }
      });
    });
  }
};

// A key reaches the engine only through a respawn, which kills a turn in flight, so this waits for the turns to end.
export const restartAfterTurns = (agentId: AgentId): Promise<boolean> => {
  if (waiting?.agentId === agentId) {
    return waiting.restarted;
  }
  if (!agentIsBusy()) {
    return keyRestart(agentId);
  }
  const restarted = (async (): Promise<boolean> => {
    hold(agentId, 'waiting');
    try {
      await turnsEnded();
    } finally {
      waiting = undefined;
    }
    return keyRestart(agentId);
  })();
  waiting = { agentId, restarted };
  return restarted;
};
