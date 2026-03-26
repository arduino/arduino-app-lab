import {
  boardNeedsImageUpdate,
  getBoards,
  reloadApp,
  selectBoard as apiSelectBoard,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { useBoardSerialTracker } from '@cloud-editor-mono/ui-components/lib/common/utils';
import { Board } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery } from '@tanstack/react-query';
import { del, get, set } from 'idb-keyval';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useBoardLifecycleStore } from '../store/boardLifecycle';
import { useIsBoard } from './useIsBoard';

const CONNECT_TIMEOUT_MS = 15_000;
const AUTO_SELECT_BOARD_ID = 'arduino:auto-select-board-id';

export type UseBoards = () => {
  boards: Board[];
  selectedBoard?: Board;
  selectBoard: (board: Board) => Promise<void>;
  autoSelectBoard: (boardId: string) => Promise<void>;
  isAutoSelectingBoard: boolean;
  showBoardConnPswPrompt: boolean;
  onConnPswCancel: () => void;
  onConnPswSubmit: (password: string) => Promise<void>;
  isConnectingToBoard: boolean;
  connToBoardError?: string;
  connToBoardCompleted: boolean;
  setSelectedBoardCheckingStatus: () => void;
};

type BoardsState = {
  boards: Board[];
  selected: {
    board?: Board;
    status?:
      | 'selection-started'
      | 'conn-started'
      | 'conn-error'
      | 'conn-and-selection-done';
    error?: string;
  };
};

type BoardsAction =
  | { type: 'SET_BOARDS'; payload: Board[] }
  | {
      type: 'START_BOARD_SELECTION';
      payload: { board: Board };
    }
  | { type: 'START_BOARD_CONN' }
  | { type: 'BOARD_CONN_ERROR'; payload?: string }
  | { type: 'COMPLETE_BOARD_CONN_AND_SELECTION' }
  | { type: 'UNSELECT_BOARD' }
  | { type: 'SET_SELECTED_BOARD_CHECKING_STATUS' };

const boardsInitialState: BoardsState = {
  boards: [],
  selected: {
    board: undefined,
    status: undefined,
    error: undefined,
  },
};

function boardsReducer(state: BoardsState, action: BoardsAction): BoardsState {
  switch (action.type) {
    case 'SET_BOARDS':
      return { ...state, boards: action.payload };

    case 'START_BOARD_SELECTION':
      return {
        ...state,
        boards: state.boards.map((b) => ({
          ...b,
          isSelecting: b.id === action.payload.board.id,
        })),
        selected: {
          board: action.payload.board,
          status: 'selection-started',
          error: undefined,
        },
      };

    case 'START_BOARD_CONN':
      return {
        ...state,
        selected: {
          ...state.selected,
          status: 'conn-started',
          error: undefined,
        },
      };

    case 'BOARD_CONN_ERROR':
      return {
        ...state,
        boards: state.boards.map((b) => ({
          ...b,
          isSelecting: false,
        })),
        selected: {
          ...state.selected,
          status: 'conn-error',
          error: action.payload,
        },
      };

    case 'COMPLETE_BOARD_CONN_AND_SELECTION':
      return {
        ...state,
        boards: state.boards.map((b) => ({
          ...b,
          isSelecting: false,
        })),
        selected: {
          ...state.selected,
          status: 'conn-and-selection-done',
          error: undefined,
        },
      };

    case 'UNSELECT_BOARD':
      return {
        ...state,
        boards: state.boards.map((b) => ({
          ...b,
          isSelecting: false,
        })),
        selected: { ...boardsInitialState.selected },
      };

    case 'SET_SELECTED_BOARD_CHECKING_STATUS':
      return {
        ...state,
        boards: state.boards.map((b) => ({
          ...b,
          checkingStatus: b.id === state.selected.board?.id,
        })),
      };

    default:
      return state;
  }
}

const withTimeout = async <T>(p: Promise<T>, timeoutMs: number): Promise<T> => {
  let t: number | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    t = window.setTimeout(
      () => reject(new Error('CONNECTION_TIMEOUT')),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([p, timeoutPromise]);
  } finally {
    if (typeof t !== 'undefined') window.clearTimeout(t);
  }
};

const isAuthFailed = (err: unknown): boolean =>
  Boolean((err as { isSSHErrorAuthFailed?: boolean })?.isSSHErrorAuthFailed);

export const useBoards: UseBoards = () => {
  const { updateLastConnection } = useBoardSerialTracker();
  const {
    boardIsFlashing,
    setBoardIsReachable,
    setSelectedConnectedBoard,
    selectedConnectedBoard,
    needsImageUpdate,
    setNeedsImageUpdate,
  } = useBoardLifecycleStore(
    useShallow((state) => ({
      boardIsFlashing: state.boardIsFlashing,
      setBoardIsReachable: state.setBoardIsReachable,
      setSelectedConnectedBoard: state.setSelectedConnectedBoard,
      selectedConnectedBoard: state.selectedConnectedBoard,
      needsImageUpdate: state.needsImageUpdate,
      setNeedsImageUpdate: state.setNeedsImageUpdate,
    })),
  );

  const { data: isBoard } = useIsBoard();
  const [
    {
      boards,
      selected: {
        board: selectedBoard,
        status: boardStatus,
        error: boardError,
      },
    },
    dispatch,
  ] = useReducer(boardsReducer, boardsInitialState);

  const [isAutoSelectingBoard, setIsAutoSelectingBoard] = useState(true);

  useQuery(['boards'], getBoards, {
    refetchInterval: isBoard ? undefined : 3000,
    enabled: !boardIsFlashing,
    onSuccess: (data) => {
      dispatch({ type: 'SET_BOARDS', payload: data });
    },
  });

  // If the selected board is unplugged, and no longer detected for 5 seconds, reload the app
  useEffect(() => {
    let timeout: NodeJS.Timeout | void;
    if (
      !boardIsFlashing &&
      selectedBoard &&
      selectedBoard.connectionType === 'USB' && //! manage disconnect only for USB boards, as we don't have serial in network mode tes
      !boards.map((b) => b.serial).includes(selectedBoard.serial)
    ) {
      timeout = setTimeout(() => {
        reloadApp();
      }, 5000);
    }

    return () => timeout && clearTimeout(timeout);
  }, [boardIsFlashing, boards, selectedBoard]);

  useEffect(() => {
    const setNeedsImageUpdateAsync = async (): Promise<void> => {
      const needsUpdate = await boardNeedsImageUpdate();
      setNeedsImageUpdate(needsUpdate);
    };
    if (selectedConnectedBoard && needsImageUpdate === undefined) {
      setNeedsImageUpdateAsync();
    }
  }, [selectedConnectedBoard, setNeedsImageUpdate, needsImageUpdate]);

  const connectToBoard = useCallback(
    async (board: Board, password?: string): Promise<void> => {
      dispatch({ type: 'START_BOARD_CONN' });

      try {
        await withTimeout(
          apiSelectBoard(board.id, password),
          CONNECT_TIMEOUT_MS,
        );

        dispatch({ type: 'COMPLETE_BOARD_CONN_AND_SELECTION' });
        setBoardIsReachable(true);
        setSelectedConnectedBoard(board);
      } catch (err) {
        const msg = isAuthFailed(err)
          ? 'Password is not correct. Please try again.'
          : err instanceof Error && err.message === 'CONNECTION_TIMEOUT'
          ? 'Connection timeout. Check network connection and try again.'
          : 'An error occurred while connecting to the board.';
        dispatch({ type: 'BOARD_CONN_ERROR', payload: msg });

        console.error('Failed to select board', err);
        throw err;
      }
    },
    [setBoardIsReachable, setSelectedConnectedBoard],
  );

  useEffect(() => {
    if (isBoard && boards.length !== 0) {
      connectToBoard(boards[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boards, isBoard]);

  const handleSelectBoard = useCallback(
    async (board: Board) => {
      dispatch({
        type: 'START_BOARD_SELECTION',
        payload: { board },
      });

      del(AUTO_SELECT_BOARD_ID);

      if (board.connectionType !== 'Network') {
        try {
          await connectToBoard(board);
          updateLastConnection(board.serial);
        } catch {
          dispatch({ type: 'UNSELECT_BOARD' });
        }
      }
    },
    [connectToBoard, updateLastConnection],
  );

  const handleBoardConnectionWithPassword = useCallback(
    async (password: string) => {
      if (!selectedBoard) {
        console.error('No board selected for password submission');
        return;
      }

      try {
        await connectToBoard(selectedBoard, password);
        updateLastConnection(selectedBoard.serial);
      } catch (error) {
        let errorMessage;
        if (
          (error as { isSSHErrorAuthFailed?: boolean }).isSSHErrorAuthFailed
        ) {
          errorMessage = 'Password is not correct. Please try again.';
        } else {
          console.error('Error selecting board:', error);
          errorMessage = 'An error occurred while connecting to the board.';
        }
        dispatch({ type: 'BOARD_CONN_ERROR', payload: errorMessage });
      }
    },
    [connectToBoard, selectedBoard, updateLastConnection],
  );

  const onConnPswCancel = useCallback(() => {
    dispatch({ type: 'UNSELECT_BOARD' });
  }, []);

  const setSelectedBoardCheckingStatus = useCallback(() => {
    dispatch({ type: 'SET_SELECTED_BOARD_CHECKING_STATUS' });
  }, []);

  // save boardId on idb to auto-select it on app reload
  const autoSelectBoard = useCallback(async (boardId: string) => {
    await set(AUTO_SELECT_BOARD_ID, boardId);
    reloadApp();
  }, []);

  // retrieve boardId from idb to auto-select board on app reload after it has been switched
  useEffect(() => {
    const autoSelectBoard = async (): Promise<void> => {
      if (isBoard) {
        setIsAutoSelectingBoard(false);
        return;
      }

      const boardId = await get<string>(AUTO_SELECT_BOARD_ID);

      if (!boardId) {
        if (!boardStatus || boardStatus === 'conn-error') {
          setIsAutoSelectingBoard(false);
        }
        return;
      }

      if (!boards.length) return;

      const board = boards.find((board) => board.id === boardId);

      if (!board) {
        setIsAutoSelectingBoard(false);
        return;
      }

      await handleSelectBoard(board);
    };

    autoSelectBoard();
  }, [boardStatus, boards, handleSelectBoard, isBoard]);

  return {
    boards,
    selectedBoard: selectedConnectedBoard,
    selectBoard: handleSelectBoard,
    autoSelectBoard,
    isAutoSelectingBoard,
    showBoardConnPswPrompt: selectedBoard?.connectionType === 'Network',
    onConnPswCancel,
    onConnPswSubmit: handleBoardConnectionWithPassword,
    isConnectingToBoard: boardStatus === 'conn-started',
    connToBoardError: boardStatus === 'conn-error' ? boardError : undefined,
    connToBoardCompleted: boardStatus === 'conn-and-selection-done',
    setSelectedBoardCheckingStatus,
  };
};
