import { AgentId, start, stop } from '../../services';
import { useAiAssistantStore, useChatStore } from '../../store';

// Hands a freshly proven credential to the agent, for both surfaces that authenticate (the connect
// panel and the Settings "Agent" section). It has to respawn rather than start: the credential only
// reaches the agent through its child process' environment at spawn, and AgentStart is idempotent — so
// with the expired-credential process still alive (that path drops to the connect screen without
// stopping it) start() alone would keep the stale credential and loop the user back through login.
export const restartForNewCredential = async (
  agentId: AgentId,
): Promise<void> => {
  // Nothing running is a no-op, and a failed teardown has still freed Go's manager slot — either way
  // the start below spawns a fresh process, so a rejection must not block the sign-in.
  await stop().catch(() => undefined);
  await start(agentId);
  // The new process has none of the front end's sessions loaded, and a leftover thread would make the
  // chat skip its loadSession replay and prompt a session id it never saw. Keeps the session to reopen.
  useChatStore.getState().resetLoadedSessions();
  // Else a give-up from the process we just replaced keeps the panel on its "agent stopped" screen.
  useAiAssistantStore.getState().setAgentDown(false);
};
