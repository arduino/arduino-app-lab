import { useCallback, useEffect, useState } from 'react';

import { useAgentModeSeen } from '../../hooks/useAgentModeSeen';

interface AgentModeEntryShineLogic {
  shine: boolean;
  markEntryClicked: VoidFunction;
}

// The footer entry keeps shining until agent mode is opened from it for the first time, so the
// "Agent Mode" label is never just another footer button on a fresh install.
export const useAgentModeEntryShineLogic = (
  aiAssistantActive: boolean,
): AgentModeEntryShineLogic => {
  const [neverClicked, setNeverClicked] = useState(false);
  const { hasSeenAgentModeHint, markAgentModeHintSeen } = useAgentModeSeen();

  useEffect(() => {
    let active = true;

    hasSeenAgentModeHint('entryClicked').then((clicked) => {
      if (active) {
        setNeverClicked(!clicked);
      }
    });

    return () => {
      active = false;
    };
  }, [hasSeenAgentModeHint]);

  const markEntryClicked = useCallback((): void => {
    setNeverClicked(false);
    markAgentModeHintSeen('entryClicked');
  }, [markAgentModeHintSeen]);

  // Only the "Agent Mode" label shines: in agent mode the entry is the way back to the IDE.
  return { shine: neverClicked && !aiAssistantActive, markEntryClicked };
};
