import { create } from 'zustand';

import {
  type AgentRestart,
  type Unsubscribe,
  DEFAULT_AGENT_ID,
  onRestart,
  start,
} from '../../services';
import type { AgentDownReason } from '../../store';
import {
  currentAuth,
  useAiAssistantStore,
  useBoardSwitchStore,
  useChatStore,
} from '../../store';

// Why the agent is being restarted: the user pressed Reconnect, or a board switch they confirmed did it.
export type ReviveMode = 'manual' | 'auto';

// Shared, so Agent Mode and the editor's docked panel show the same restart whichever of them started it.
export const useAgentRevive = create<{ reviving?: ReviveMode }>(() => ({}));

// The host names its deliberate teardowns on the restart event; anything else was a crash.
const teardownReason = (reason?: string): AgentDownReason =>
  reason === 'board-changed' || reason === 'board-flashed' ? reason : 'crashed';

// Clearing agentDown remounts the chat, which replays the last session. The mode is what the panels
// show meanwhile: the prompt with a spinner, or the loader on its own.
export const reviveAgent = (mode: ReviveMode): void => {
  void (async (): Promise<void> => {
    const current = currentAuth(useAiAssistantStore.getState());
    if (!current.authenticated) {
      return;
    }
    useAgentRevive.setState({ reviving: mode });
    try {
      await start(current.agentId);
      useAiAssistantStore.getState().setAgentDown(undefined);
    } catch {
      // Still down: clearing the mode drops back to the prompt so the user can retry.
    } finally {
      useAgentRevive.setState({ reviving: undefined });
    }
  })();
};

// Only the give-up matters: the earlier events fire before each relaunch, so they say nothing yet.
const onGiveUp = (restart: AgentRestart): void => {
  if (!restart.gaveUp) {
    return;
  }
  const reason = teardownReason(restart.reason);
  // A crash comes back to the same board, so the session to reopen survives. A board switch does not:
  // the list is scoped to the board and app ids repeat across them, so a kept pointer reopens another
  // board's chat under a row this sidebar no longer has. A flash leaves the board in place but takes
  // its apps, so those pointers are just as dead.
  if (reason === 'crashed') {
    useChatStore.getState().resetLoadedSessions(); // the replacement process has none loaded
  } else {
    useChatStore.getState().reset();
  }
  // A crash can land before the probe names an agent; dropping it would lose the reconnect prompt.
  const running =
    useAiAssistantStore.getState().selectedAgentId ?? DEFAULT_AGENT_ID;
  useAiAssistantStore.getState().setAgentDown({ agentId: running, reason });

  // A confirmed switch already answered "yes, interrupt it", so revive straight away instead of
  // asking again. A crash, a flash, or a switch nobody was asked about, still stops at the prompt:
  // after a flash the board is still rebooting, so there is nothing to revive onto yet.
  if (
    reason === 'board-changed' &&
    useBoardSwitchStore.getState().consumeConfirmed()
  ) {
    reviveAgent('auto');
  }
};

let stopGiveUp: VoidFunction | undefined;
let giveUpHolders = 0;

// Started at startup, so a give-up counts whatever is mounted; Agent Mode holds it too, and every holder shares one handler.
export const subscribeAgentGiveUp = (): Unsubscribe => {
  giveUpHolders += 1;
  if (!stopGiveUp) {
    stopGiveUp = onRestart(onGiveUp);
  }
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    giveUpHolders -= 1;
    if (giveUpHolders === 0) {
      stopGiveUp?.();
      stopGiveUp = undefined;
    }
  };
};
