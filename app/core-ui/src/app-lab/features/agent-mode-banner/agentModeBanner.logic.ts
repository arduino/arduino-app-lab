import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';

import { useAgentModeSeen } from '../../hooks/useAgentModeSeen';

interface AgentModeBannerLogic {
  visible: boolean;
  onConfigure: VoidFunction;
}

export const useAgentModeBannerLogic = (): AgentModeBannerLogic => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const { hasSeenAgentModeHint, markAgentModeHintSeen } = useAgentModeSeen();

  useEffect(() => {
    let active = true;

    hasSeenAgentModeHint('banner').then((seen) => {
      if (active) {
        setVisible(!seen);
      }
    });

    return () => {
      active = false;
    };
  }, [hasSeenAgentModeHint]);

  const onConfigure = useCallback((): void => {
    markAgentModeHintSeen('banner');
    setVisible(false);
    navigate({ to: '/ai-assistant' });
  }, [markAgentModeHintSeen, navigate]);

  return { visible, onConfigure };
};
