import { get, set } from 'idb-keyval';
import { useCallback } from 'react';

import { AGENT_MODE_SEEN } from '../constants';

// One-time hints introducing agent mode: the side-panel promo banner, the two footer tooltips
// (one on the first entry into agent mode, one on the first way back to the IDE) and the shine
// on the footer entry.
export type AgentModeHint =
  | 'banner'
  | 'backToIdeTooltip'
  | 'agentIsHereTooltip'
  // Set on the first click of the footer entry, which stops its shine animation.
  | 'entryClicked';

type AgentModeSeenState = Partial<Record<AgentModeHint, boolean>>;

// App-level flags ("this hint has been seen at least once"). Global, not per-board,
// and never reset on re-flash: once seen a hint stays seen.
export interface AgentModeSeenTracker {
  hasSeenAgentModeHint: (hint: AgentModeHint) => Promise<boolean>;
  markAgentModeHintSeen: (...hints: AgentModeHint[]) => Promise<void>;
}

const readState = async (): Promise<AgentModeSeenState> =>
  (await get<AgentModeSeenState>(AGENT_MODE_SEEN)) || {};

// Every mark is a read-modify-write on one key, and a mode switch fires several at once
// (the entry marks its own hints while the tooltip marks the one it just showed), so they
// are queued: interleaved writes would drop the flags set by whoever lost the race.
let writeQueue: Promise<void> = Promise.resolve();

const enqueueWrite = (write: () => Promise<void>): Promise<void> => {
  writeQueue = writeQueue.then(write, write);
  return writeQueue;
};

export const useAgentModeSeen = (): AgentModeSeenTracker => {
  const hasSeenAgentModeHint = useCallback(
    async (hint: AgentModeHint): Promise<boolean> => {
      try {
        return (await readState())[hint] === true;
      } catch (error) {
        console.error('Error checking agent-mode-seen flags:', error);
        return false;
      }
    },
    [],
  );

  const markAgentModeHintSeen = useCallback(
    (...hints: AgentModeHint[]): Promise<void> =>
      enqueueWrite(async () => {
        try {
          const state = await readState();
          hints.forEach((hint) => (state[hint] = true));
          await set(AGENT_MODE_SEEN, state);
        } catch (error) {
          console.error('Error marking agent-mode hints as seen:', error);
        }
      }),
    [],
  );

  return { hasSeenAgentModeHint, markAgentModeHintSeen };
};
