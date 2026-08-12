import type { AgentSidePanelProps } from '@cloud-editor-mono/ai-assistant/panel';
import { useLocation } from '@tanstack/react-router';
import { useContext, useMemo } from 'react';

import { UseBoards } from '../../hooks/useBoards';
import { AuthContext } from '../../providers/auth/authContext';

// Up to 2 initials from the user's full name, e.g. "Agustin Rujana" -> "AR"
const getInitials = (name?: string): string | undefined => {
  const parts = name?.trim().split(/\s+/).filter(Boolean) || [];
  if (parts.length === 0) {
    return undefined;
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
};

export const useAgentSidePanelLogic = (
  boardsProps: ReturnType<UseBoards>,
): AgentSidePanelProps => {
  const { pathname } = useLocation();
  const { user } = useContext(AuthContext);

  const isVisible = pathname.split('/').length <= 2;
  const initials = useMemo(() => getInitials(user?.name), [user?.name]);

  return {
    visible: isVisible,
    board: boardsProps.selectedBoard,
    boards: boardsProps.boards,
    onSelectBoard: boardsProps.selectBoard,
    user: initials ? { initials } : undefined,
  };
};
