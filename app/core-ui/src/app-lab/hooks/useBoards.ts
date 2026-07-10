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

import {
  AUTO_SELECT_BOARD_ID,
  AUTO_SELECT_BOARD_SERIAL,
  BOARD_APP_MAPPING,
  PREVIOUS_BOARD_IDS,
  PREVIOUS_BOARD_SERIALS,
} from '../constants';
import { useBoardLifecycleStore } from '../store/boardLifecycle';
import { useIsBoard } from './useIsBoard';

const CONNECT_TIMEOUT_MS = 15_000;

export type BoardAppInfo = {
  appId: string;
  section: string;
};

export type UseBoards = () => {
  boards: Board[];
  selectedBoard?: Board;
  selectingBoard?: Board;
  boardSelectionStatus?:
    | 'selection-started'
    | 'conn-started'
    | 'conn-error'
    | 'conn-and-selection-done';
  selectBoard: (board: Board) => Promise<void>;
  autoSelectBoard: (boardSerial: string) => Promise<void>;
  isAutoSelectingBoard: boolean;
  couldNotAutoSelectBoard: boolean;
  showBoardConnPswPrompt: boolean;
  onConnPswCancel: () => void;
  onConnPswSubmit: (password: string) => Promise<void>;
  isConnectingToBoard: boolean;
  connToBoardError?: string;
  connToBoardCompleted: boolean;
  setSelectedBoardCheckingStatus: () => void;
  lastAppInfo?: BoardAppInfo;
  lastAppInfoLoaded: boolean;
  saveAppId: (appId: string, section: string) => Promise<void>;
  resetAppId: () => Promise<void>;
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
          isSelecting: b.serial === action.payload.board.serial,
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
          checkingStatus: b.serial === state.selected.board?.serial,
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
  const [couldNotAutoSelectBoard, setCouldNotAutoSelectBoard] = useState(false);

  const { isLoading: isLoadingBoards } = useQuery(['boards'], getBoards, {
    refetchInterval: isBoard ? undefined : 3000,
    enabled: !boardIsFlashing,
    onSuccess: (data) => {
      dispatch({ type: 'SET_BOARDS', payload: data });
    },
  });

  useEffect(() => {
    if (!selectedConnectedBoard) {
      return;
    }

    const updatedBoard = boards.find(
      (board) => board.serial === selectedConnectedBoard.serial,
    );

    if (!updatedBoard) {
      return;
    }

    if (
      updatedBoard.name !== selectedConnectedBoard.name ||
      updatedBoard.type !== selectedConnectedBoard.type ||
      updatedBoard.address !== selectedConnectedBoard.address
    ) {
      setSelectedConnectedBoard(updatedBoard);
    }
  }, [boards, selectedConnectedBoard, setSelectedConnectedBoard]);

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
        del(AUTO_SELECT_BOARD_SERIAL);
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
          apiSelectBoard(board.serial, password),
          CONNECT_TIMEOUT_MS,
        );

        dispatch({ type: 'COMPLETE_BOARD_CONN_AND_SELECTION' });
        setBoardIsReachable(true);
        setSelectedConnectedBoard(board);
        setIsAutoSelectingBoard(false);
        if (board.connectionType !== 'Network') {
          set(AUTO_SELECT_BOARD_SERIAL, board.serial);
        } else {
          del(AUTO_SELECT_BOARD_ID);
          del(PREVIOUS_BOARD_IDS);
          del(AUTO_SELECT_BOARD_SERIAL);
          del(PREVIOUS_BOARD_SERIALS);
        }
      } catch (err) {
        const msg = isAuthFailed(err)
          ? 'Password is not correct. Please try again.'
          : err instanceof Error && err.message === 'CONNECTION_TIMEOUT'
          ? 'Connection timeout. Check network connection and try again.'
          : 'An error occurred while connecting to the board.';
        dispatch({ type: 'BOARD_CONN_ERROR', payload: msg });

        console.error('Failed to select board', err);
        // Reset auto-selection state on connection error to prevent infinite loader
        setIsAutoSelectingBoard(false);

        throw err;
      }
    },
    [setBoardIsReachable, setSelectedConnectedBoard],
  );

  useEffect(() => {
    // Prevent auto-connection if:
    // 1. Already connecting/connected to a board
    // 2. There's a board connection error
    // 3. Already have a selected connected board
    if (boardStatus || selectedConnectedBoard) {
      return;
    }

    if (isBoard && boards.length !== 0) {
      connectToBoard(boards[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boards, isBoard, boardStatus, selectedConnectedBoard]);

  const handleSelectBoard = useCallback(
    async (board: Board) => {
      setIsAutoSelectingBoard(false);

      // Reset couldNotAutoSelectBoard when user manually selects a board
      setCouldNotAutoSelectBoard(false);

      dispatch({
        type: 'START_BOARD_SELECTION',
        payload: { board },
      });

      // save serial board to re-select if it is still connected
      if (board.connectionType !== 'Network') {
        set(AUTO_SELECT_BOARD_SERIAL, board.serial);
      } else {
        del(AUTO_SELECT_BOARD_ID);
        del(PREVIOUS_BOARD_IDS);
        del(AUTO_SELECT_BOARD_SERIAL);
        del(PREVIOUS_BOARD_SERIALS);
      }

      // Save current board list as reference for future auto-selection
      // Get fresh boards array to avoid closure issues
      const currentBoards = await getBoards();
      // Filter out network boards for auto-selection logic
      const nonNetworkBoards = currentBoards.filter(
        (b) => b.connectionType !== 'Network',
      );
      const boardSerialsToSave = nonNetworkBoards.map((b) => b.serial);

      if (board.connectionType !== 'Network') {
        await set(PREVIOUS_BOARD_SERIALS, boardSerialsToSave);
      }

      // For network boards, don't connect directly - let the password prompt handle it
      if (board.connectionType === 'Network') {
        return;
      }

      try {
        await connectToBoard(board);
        updateLastConnection(board.serial);
      } catch (error) {
        dispatch({ type: 'UNSELECT_BOARD' });
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

  // save boardSerial on idb to auto-select it on app reload
  const autoSelectBoard = useCallback(
    async (boardSerial: string) => {
      const board = boards.find((b) => b.serial === boardSerial);
      if (!board) {
        await set(AUTO_SELECT_BOARD_SERIAL, boardSerial);
        reloadApp();
        return;
      }
      if (board.connectionType === 'Network') {
        del(AUTO_SELECT_BOARD_ID);
        del(PREVIOUS_BOARD_IDS);
        del(AUTO_SELECT_BOARD_SERIAL);
        del(PREVIOUS_BOARD_SERIALS);
        await handleSelectBoard(board);
      } else {
        await set(AUTO_SELECT_BOARD_SERIAL, boardSerial);
        reloadApp();
      }
    },
    [boards, handleSelectBoard],
  );

  // save app ID mapped to current board with section
  const saveAppId = useCallback(
    async (appId: string, section: string): Promise<void> => {
      const boardSerial =
        useBoardLifecycleStore.getState().selectedConnectedBoard?.serial;
      if (!boardSerial) return;
      const mapping = {
        ...((await get<Record<string, BoardAppInfo>>(BOARD_APP_MAPPING)) || {}),
      };
      mapping[boardSerial] = { appId, section };
      await set(BOARD_APP_MAPPING, mapping);
    },
    [],
  );

  // reset app ID for current board
  const resetAppId = useCallback(async (): Promise<void> => {
    const boardSerial =
      useBoardLifecycleStore.getState().selectedConnectedBoard?.serial;
    if (!boardSerial) return;
    const mapping = {
      ...((await get<Record<string, BoardAppInfo>>(BOARD_APP_MAPPING)) || {}),
    };
    delete mapping[boardSerial];
    await set(BOARD_APP_MAPPING, mapping);
  }, []);

  // load last app info for current board
  const [lastAppInfo, setLastAppInfo] = useState<BoardAppInfo | undefined>();
  const [lastAppInfoLoaded, setLastAppInfoLoaded] = useState(false);
  useEffect(() => {
    const loadLastAppInfo = async (): Promise<void> => {
      const boardSerial = selectedConnectedBoard?.serial;
      if (!boardSerial) {
        setLastAppInfo(undefined);
        setLastAppInfoLoaded(false);
        // Reset couldNotAutoSelectBoard when no board is connected
        setCouldNotAutoSelectBoard(false);
        return;
      }
      const mapping = {
        ...((await get<Record<string, BoardAppInfo>>(BOARD_APP_MAPPING)) || {}),
      };
      setLastAppInfo(mapping[boardSerial]);
      setLastAppInfoLoaded(true);
      // Reset couldNotAutoSelectBoard when board changes
      setCouldNotAutoSelectBoard(false);
    };
    loadLastAppInfo();
  }, [selectedConnectedBoard?.serial]);

  // retrieve boardId from idb to auto-select board on app reload after it has been switched
  useEffect(() => {
    const autoSelectBoard = async (): Promise<void> => {
      // not retrigger
      if (!isAutoSelectingBoard || isBoard) {
        return;
      }

      // TODO: old auto selection logic, to be removed in future release
      const migrate = async (): Promise<void> => {
        const boardId = await get<string>(AUTO_SELECT_BOARD_ID);
        if (boardId && boards.length) {
          const board = boards.find((board) => board.id === boardId);
          if (board) {
            await set(AUTO_SELECT_BOARD_SERIAL, board.serial);
            del(AUTO_SELECT_BOARD_ID);
          }
        }

        const previousBoardIds =
          (await get<string[]>(PREVIOUS_BOARD_IDS)) || [];
        if (previousBoardIds.length && boards.length) {
          const previousBoards = boards.filter((board) =>
            previousBoardIds.includes(board.id),
          );
          if (previousBoards.length) {
            await set(
              PREVIOUS_BOARD_SERIALS,
              previousBoards.map((b) => b.serial),
            );
            del(PREVIOUS_BOARD_IDS);
          }
        }
      };
      await migrate();

      const boardSerial = await get<string>(AUTO_SELECT_BOARD_SERIAL);

      // no boards user can select
      if (!boardSerial) {
        // Stop auto-selection if no saved board serial but boards are available
        // This prevents infinite loader for new/flash boards
        if (
          !boardStatus ||
          boardStatus === 'conn-error' ||
          (boards.length > 0 && !selectedConnectedBoard)
        ) {
          setIsAutoSelectingBoard(false);
        }
        return;
      }

      if (!boards.length) {
        if (!isLoadingBoards) {
          setIsAutoSelectingBoard(false);
        }
        return;
      }

      const board = boards.find((board) => board.serial === boardSerial);

      // user can select the board
      if (!board) {
        setIsAutoSelectingBoard(false);
        setCouldNotAutoSelectBoard(true);
        // Clear the invalid board ID to prevent infinite loop
        del(AUTO_SELECT_BOARD_SERIAL);
        return;
      }

      // Check if board list has changed
      const previousBoardSerials =
        (await get<string[]>(PREVIOUS_BOARD_SERIALS)) || [];

      // If we have previous board serials stored, check if board list changed during session
      if (previousBoardSerials.length > 0) {
        // Filter out network boards for auto-selection logic
        const nonNetworkBoards = boards.filter(
          (b) => b.connectionType !== 'Network',
        );
        const currentBoardSerials = nonNetworkBoards.map((b) => b.serial);
        const boardListChanged =
          previousBoardSerials.length !== currentBoardSerials.length ||
          !previousBoardSerials.every((serial) =>
            currentBoardSerials.includes(serial),
          );

        if (boardListChanged) {
          // Board list changed - disable auto-selection and clear saved board ID
          // This forces manual selection but preserves app/workspace mapping

          setIsAutoSelectingBoard(false);
          del(AUTO_SELECT_BOARD_SERIAL);
          return;
        }
      }

      // no autoselect in network mode
      if (board.connectionType === 'Network') {
        setIsAutoSelectingBoard(false);
        return;
      }

      handleSelectBoard(board).catch(() => {
        setIsAutoSelectingBoard(false);
      });

      // Reset couldNotAutoSelectBoard when auto-selection succeeds
      if (board) {
        setCouldNotAutoSelectBoard(false);
      }
    };

    autoSelectBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boards.length, isLoadingBoards, isAutoSelectingBoard]);

  return {
    boards,
    selectedBoard: selectedConnectedBoard,
    selectingBoard: selectedBoard,
    boardSelectionStatus: boardStatus,
    selectBoard: handleSelectBoard,
    autoSelectBoard,
    isAutoSelectingBoard,
    couldNotAutoSelectBoard,
    showBoardConnPswPrompt:
      selectedBoard?.connectionType === 'Network' &&
      boardStatus !== 'conn-and-selection-done',
    onConnPswCancel,
    onConnPswSubmit: handleBoardConnectionWithPassword,
    isConnectingToBoard: boardStatus === 'conn-started',
    connToBoardError: boardStatus === 'conn-error' ? boardError : undefined,
    connToBoardCompleted: boardStatus === 'conn-and-selection-done',
    setSelectedBoardCheckingStatus,
    lastAppInfo,
    lastAppInfoLoaded,
    saveAppId,
    resetAppId,
  };
};
