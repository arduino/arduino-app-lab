import { BOARD_FQBN } from '@cloud-editor-mono/common';
import {
  isUserPasswordSet,
  setUserPassword as apiSetUserPassword,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useReducer } from 'react';

import { useBoards } from '../../hooks/useBoards';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { LinuxCredentialsContextValue } from './linuxCredentialsContext';

interface SetUserPasswordState {
  isPasswordError: boolean;
  isPasswordConfirmationError: boolean;
  passwordErrorMsg: string;
  passwordConfirmationErrorMsg: string;
}

type SetUserPasswordAction =
  | { type: 'RESET_ERROR' }
  | { type: 'SET_PASSWORD_ERROR'; payload?: string }
  | { type: 'SET_PASSWORD_CONFIRMATION_ERROR'; payload?: string };

const setUserPasswordInitialState: SetUserPasswordState = {
  isPasswordError: false,
  isPasswordConfirmationError: false,
  passwordErrorMsg: '',
  passwordConfirmationErrorMsg: '',
};

function setUserPasswordReducer(
  state: SetUserPasswordState,
  action: SetUserPasswordAction,
): SetUserPasswordState {
  switch (action.type) {
    case 'RESET_ERROR':
      return {
        isPasswordError: false,
        isPasswordConfirmationError: false,
        passwordErrorMsg: '',
        passwordConfirmationErrorMsg: '',
      };
    case 'SET_PASSWORD_ERROR':
      return {
        isPasswordError: true,
        isPasswordConfirmationError: false,
        passwordErrorMsg: action.payload || '',
        passwordConfirmationErrorMsg: '',
      };
    case 'SET_PASSWORD_CONFIRMATION_ERROR':
      return {
        isPasswordError: false,
        isPasswordConfirmationError: true,
        passwordErrorMsg: '',
        passwordConfirmationErrorMsg: action.payload || '',
      };
    default:
      return state;
  }
}

export function useLinuxCredentials(): LinuxCredentialsContextValue {
  const queryClient = useQueryClient();

  const boardsProps = useBoards();
  const isVentunoQ = boardsProps.selectedBoard?.fqbn === BOARD_FQBN.VENTUNO_Q;

  const boardIsReachable = useBoardLifecycleStore(
    (state) => state.boardIsReachable,
  );

  const [errorState, dispatch] = useReducer(
    setUserPasswordReducer,
    setUserPasswordInitialState,
  );

  const { data: userPasswordIsSet, isSuccess: userPasswordChecked } = useQuery(
    ['get-user-password-set'],
    isUserPasswordSet,
    {
      enabled: boardIsReachable,
    },
  );

  const {
    mutate: setUserPassword,
    isLoading: setUserPasswordIsLoading,
    isSuccess: setUserPasswordIsSuccess,
  } = useMutation({
    mutationFn: apiSetUserPassword,
    onSuccess: () => {
      queryClient.setQueryData(['get-user-password-set'], true);
      dispatch({ type: 'RESET_ERROR' });
    },
    onError: (error) => {
      console.error('Failed to set user password', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to set user password';
      dispatch({ type: 'SET_PASSWORD_ERROR', payload: errorMessage });
    },
    onSettled: () => {
      queryClient.invalidateQueries(['get-user-password-set']);
    },
  });

  const handleSetUserPassword = useCallback(
    (password: string, passwordConfirmation: string) => {
      if (password.trim().length < 8) {
        dispatch({
          type: 'SET_PASSWORD_ERROR',
          payload: 'Fill with at least 8 characters',
        });
        return;
      }
      if (password.toLowerCase().includes('arduino')) {
        dispatch({
          type: 'SET_PASSWORD_ERROR',
          payload: 'Password must not contain the username',
        });
        return;
      }
      if (password !== passwordConfirmation) {
        dispatch({
          type: 'SET_PASSWORD_CONFIRMATION_ERROR',
          payload: "Passwords don't match",
        });
        return;
      }
      setUserPassword(password);
    },
    [setUserPassword],
  );

  return {
    isVentunoQ,
    userPasswordChecked,
    userPasswordIsSet: userPasswordIsSet ?? false,
    setUserPassword: handleSetUserPassword,
    setUserPasswordIsLoading,
    setUserPasswordIsError: errorState.isPasswordError,
    setUserPasswordIsSuccess,
    userPasswordErrorMsg: errorState.passwordErrorMsg,
    setUserPasswordConfirmationIsError: errorState.isPasswordConfirmationError,
    userPasswordConfirmationErrorMsg: errorState.passwordConfirmationErrorMsg,
  };
}
