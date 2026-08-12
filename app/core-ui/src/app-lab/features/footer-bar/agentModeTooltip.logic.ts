import { isFFEnabled } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AgentModeTooltipLogic,
  AgentModeTooltipVariant,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback, useEffect, useState } from 'react';

import { AgentModeHint, useAgentModeSeen } from '../../hooks/useAgentModeSeen';

const HINT_BY_VARIANT: Record<AgentModeTooltipVariant, AgentModeHint> = {
  [AgentModeTooltipVariant.BackToIde]: 'backToIdeTooltip',
  [AgentModeTooltipVariant.AgentIsHere]: 'agentIsHereTooltip',
};

// One-shot tooltips on the mode toggle: entering agent mode for the first time points out the
// way back to the IDE, and the first return to the IDE points out where the agent now lives.
// Each is marked as seen as soon as it is shown, so it never comes back.
export const useAgentModeTooltipLogic = (
  aiAssistantActive: boolean,
): AgentModeTooltipLogic => {
  const [variant, setVariant] = useState<AgentModeTooltipVariant>();
  const { hasSeenAgentModeHint, markAgentModeHintSeen } = useAgentModeSeen();

  useEffect(() => {
    let active = true;
    setVariant(undefined);

    // The mode toggle these tooltips point at only exists behind the flag: never spend a
    // one-shot hint on a footer that does not show it.
    if (!isFFEnabled('AI_ASSISTANT')) {
      return;
    }

    const nextVariant = aiAssistantActive
      ? AgentModeTooltipVariant.BackToIde
      : AgentModeTooltipVariant.AgentIsHere;

    const resolve = async (): Promise<void> => {
      if (await hasSeenAgentModeHint(HINT_BY_VARIANT[nextVariant])) {
        return;
      }

      // The "agent is here" tooltip belongs to the way back from agent mode: without this it
      // would greet users on the very first launch, where the promo banner already does the job.
      if (
        nextVariant === AgentModeTooltipVariant.AgentIsHere &&
        !(await hasSeenAgentModeHint('backToIdeTooltip'))
      ) {
        return;
      }

      if (!active) {
        return;
      }

      await markAgentModeHintSeen(HINT_BY_VARIANT[nextVariant]);

      if (active) {
        setVariant(nextVariant);
      }
    };

    resolve();

    return () => {
      active = false;
    };
  }, [aiAssistantActive, hasSeenAgentModeHint, markAgentModeHintSeen]);

  const onDismiss = useCallback((): void => {
    setVariant(undefined);
  }, []);

  return { variant, onDismiss };
};
