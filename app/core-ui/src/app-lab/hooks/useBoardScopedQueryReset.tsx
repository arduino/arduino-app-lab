import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { BoardScopedQuery } from '../boardScopedQuery';
import { useBoardLifecycleStore } from '../store/boardLifecycle';
import { getBoardCacheId } from '../utils/board';

const RESET_ON_BOARD_SWITCH: readonly BoardScopedQuery[] =
  Object.values(BoardScopedQuery);

export const useBoardScopedQueryReset = (): void => {
  const queryClient = useQueryClient();
  const connectedBoardCacheId = useBoardLifecycleStore((state) =>
    getBoardCacheId(state.selectedConnectedBoard),
  );

  const lastConnectedBoardId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!connectedBoardCacheId) {
      return;
    }

    const previousBoardId = lastConnectedBoardId.current;
    lastConnectedBoardId.current = connectedBoardCacheId;

    if (previousBoardId === undefined) {
      return;
    }

    if (previousBoardId === connectedBoardCacheId) {
      return;
    }

    RESET_ON_BOARD_SWITCH.forEach((key) => {
      queryClient.resetQueries({ queryKey: [key] });
    });
  }, [connectedBoardCacheId, queryClient]);
};

export const BoardScopedQueryReset: React.FC = () => {
  useBoardScopedQueryReset();
  return null;
};
