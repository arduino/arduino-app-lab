import {
  createNamesGenerator,
  getBoardName,
  getKeyboardLayout,
  listKeyboardLayouts,
  setBoardName as apiSetBoardName,
  setKeyboardLayout as apiSetKeyboardLayout,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useReducer, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { BoardScopedQuery } from '../../boardScopedQuery';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { BoardConfigurationContextValue } from './boardConfigurationContext';

const { generateName } = createNamesGenerator();

interface SetBoardConfigurationState {
  boardNameIsError: boolean;
  boardNameErrorMsg: string;
  keyboardLayoutIsError: boolean;
  keyboardLayoutErrorMsg: string;
}

type SetBoardConfigurationAction =
  | { type: 'RESET_ERROR' }
  | { type: 'SET_BOARD_NAME_ERROR'; payload?: string }
  | { type: 'SET_KEYBOARD_LAYOUT_ERROR'; payload?: string };

const setBoardConfigurationInitialState: SetBoardConfigurationState = {
  boardNameIsError: false,
  boardNameErrorMsg: '',
  keyboardLayoutIsError: false,
  keyboardLayoutErrorMsg: '',
};

function setBoardConfigurationReducer(
  state: SetBoardConfigurationState,
  action: SetBoardConfigurationAction,
): SetBoardConfigurationState {
  switch (action.type) {
    case 'RESET_ERROR':
      return {
        boardNameIsError: false,
        boardNameErrorMsg: '',
        keyboardLayoutIsError: false,
        keyboardLayoutErrorMsg: '',
      };
    case 'SET_BOARD_NAME_ERROR':
      return {
        boardNameIsError: true,
        boardNameErrorMsg: action.payload || '',
        keyboardLayoutIsError: false,
        keyboardLayoutErrorMsg: '',
      };
    case 'SET_KEYBOARD_LAYOUT_ERROR':
      return {
        boardNameIsError: false,
        boardNameErrorMsg: '',
        keyboardLayoutIsError: true,
        keyboardLayoutErrorMsg: action.payload || '',
      };
    default:
      return state;
  }
}

export function useBoardConfiguration(): BoardConfigurationContextValue {
  const queryClient = useQueryClient();

  const boardIsReachable = useBoardLifecycleStore(
    (state) => state.boardIsReachable,
  );

  const { selectedConnectedBoard } = useBoardLifecycleStore(
    useShallow((state) => ({
      selectedConnectedBoard: state.selectedConnectedBoard,
    })),
  );

  const [skipped, setSkipped] = useState(false);

  const {
    data: boardName,
    isError: getBoardNameIsError,
    isSuccess: boardNameChecked,
  } = useQuery([BoardScopedQuery.GET_BOARD_NAME], getBoardName, {
    enabled: boardIsReachable,
  });

  const {
    data: keyboardLayout,
    isError: getKeyboardLayoutIsError,
    isSuccess: keyboardLayoutChecked,
  } = useQuery([BoardScopedQuery.GET_KEYBOARD_LAYOUT], getKeyboardLayout, {
    enabled: boardIsReachable,
  });

  const { data: keyboardLayouts } = useQuery(
    [BoardScopedQuery.LIST_KEYBOARD_LAYOUTS],
    listKeyboardLayouts,
    {
      enabled: boardIsReachable,
    },
  );

  const [errorState, dispatch] = useReducer(
    setBoardConfigurationReducer,
    setBoardConfigurationInitialState,
  );

  const {
    mutate: setBoardName,
    isLoading: setBoardNameIsLoading,
    isSuccess: setBoardNameIsSuccess,
  } = useMutation({
    mutationFn: apiSetBoardName,
    onSuccess: (_, boardName) => {
      queryClient.setQueryData([BoardScopedQuery.GET_BOARD_NAME], boardName);
      dispatch({ type: 'RESET_ERROR' });
      if (selectedConnectedBoard) {
        useBoardLifecycleStore.setState({
          selectedConnectedBoard: {
            ...selectedConnectedBoard,
            name: boardName,
          },
        });
      }

      queryClient.invalidateQueries(['boards']);
    },
    onError: (error) => {
      console.error('Failed to set board name', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to set board name';
      dispatch({ type: 'SET_BOARD_NAME_ERROR', payload: errorMessage });
    },
    onSettled: () => {
      queryClient.invalidateQueries([BoardScopedQuery.GET_BOARD_NAME]);
    },
  });

  const {
    mutate: setKeyboardLayout,
    isLoading: setKeyboardLayoutIsLoading,
    isSuccess: setKeyboardLayoutIsSuccess,
  } = useMutation({
    mutationFn: apiSetKeyboardLayout,
    onSuccess: (_, keyboardLayout) => {
      queryClient.setQueryData(
        [BoardScopedQuery.GET_KEYBOARD_LAYOUT],
        keyboardLayout,
      );
      dispatch({ type: 'RESET_ERROR' });
    },
    onError: (error) => {
      console.error('Failed to set keyboard layout', error);
      dispatch({ type: 'SET_KEYBOARD_LAYOUT_ERROR' });
    },
    onSettled: () => {
      queryClient.invalidateQueries([BoardScopedQuery.GET_KEYBOARD_LAYOUT]);
    },
  });

  const checkBoardName = useCallback(
    (boardName: string | undefined): boolean => {
      if (!boardName) return false;
      const name = boardName.trim();
      const isValidHostname =
        /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(name);
      if (!isValidHostname) return false;
      return name.toLowerCase().replaceAll('-', '') !== 'unoq';
    },
    [],
  );

  const handleSetBoardConfiguration = useCallback(
    (name: string, layout: string) => {
      const boardNameIsSet = checkBoardName(name);
      if (boardNameIsSet && layout.length !== 0) {
        setBoardName(name);
        setKeyboardLayout(layout);
        return;
      }
      if (!boardNameIsSet) {
        dispatch({
          type: 'SET_BOARD_NAME_ERROR',
          payload: 'Please choose a name different from the default one.',
        });
      }
      if (layout.length === 0) {
        dispatch({
          type: 'SET_KEYBOARD_LAYOUT_ERROR',
          payload: 'Please select a keyboard layout.',
        });
      }
    },
    [checkBoardName, setBoardName, setKeyboardLayout],
  );

  const handleSkipBoardConfiguration = useCallback(() => {
    setSkipped(true);
  }, []);

  return {
    hasBoardConfigurationError:
      getBoardNameIsError ||
      getKeyboardLayoutIsError ||
      errorState.keyboardLayoutIsError ||
      errorState.boardNameIsError,
    checkBoardName,
    boardConfigurationChecked: boardNameChecked && keyboardLayoutChecked,
    boardConfigurationIsSet:
      skipped || (checkBoardName(boardName) && keyboardLayout !== undefined),
    keyboardLayout,
    keyboardLayouts: keyboardLayouts ?? [],
    keyboardLayoutErrorMsg: errorState.keyboardLayoutErrorMsg,
    setBoardConfiguration: handleSetBoardConfiguration,
    skipBoardConfiguration: handleSkipBoardConfiguration,
    setBoardConfigurationIsLoading:
      setBoardNameIsLoading || setKeyboardLayoutIsLoading,
    setBoardConfigurationIsSuccess:
      setBoardNameIsSuccess && setKeyboardLayoutIsSuccess,
    setKeyboardLayoutIsSuccess,
    setKeyboardLayoutIsError: errorState.keyboardLayoutIsError,
    boardName,
    proposeName: generateName,
    setBoardName,
    setKeyboardLayout,
    setBoardNameIsSuccess,
    setBoardNameIsError: errorState.boardNameIsError,
    boardNameErrorMsg: errorState.boardNameErrorMsg,
  };
}
