import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { BoardScopedQuery } from '../boardScopedQuery';
import { useBoardLifecycleStore } from '../store/boardLifecycle';
import { getBoardCacheId } from '../utils/board';

const RESET_ON_BOARD_SWITCH: readonly BoardScopedQuery[] =
  Object.values(BoardScopedQuery);

export const useBoardScopedQueryReset = (): void => {
  const queryClient = useQueryClient();
  const hasBoard = useBoardLifecycleStore(
    (state) => !!state.selectedConnectedBoard,
  );
  const connectedBoardCacheId = useBoardLifecycleStore((state) =>
    getBoardCacheId(state.selectedConnectedBoard),
  );

  // Kept for a board with no cache id too: the next board's selection must still reset what it loaded.
  const lastConnectedBoard = useRef<{ id?: string }>();

  useEffect(() => {
    if (!hasBoard) {
      return;
    }

    const previousBoard = lastConnectedBoard.current;
    lastConnectedBoard.current = { id: connectedBoardCacheId };

    if (!previousBoard || previousBoard.id === connectedBoardCacheId) {
      return;
    }

    RESET_ON_BOARD_SWITCH.forEach((key) => {
      queryClient.resetQueries({ queryKey: [key] });
    });
  }, [hasBoard, connectedBoardCacheId, queryClient]);
};

export const BoardScopedQueryReset: React.FC = () => {
  useBoardScopedQueryReset();
  return null;
};
