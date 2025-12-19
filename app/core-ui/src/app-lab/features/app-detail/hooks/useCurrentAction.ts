import {
  AppLabAction,
  AppLabActionStatus,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback, useReducer } from 'react';

interface State {
  currentAction: AppLabAction | null;
  currentActionStatus: AppLabActionStatus;
}

interface Input {
  type: 'RESET' | 'ACTION_REQUESTED' | 'ACTION_SUCCEEDED' | 'ACTION_FAILED';
  payload?: Partial<State>;
}

interface UseCurrentAction {
  currentAction: AppLabAction | null;
  currentActionStatus: AppLabActionStatus;
  send: (input: Input) => void;
}

const defaultState = {
  currentAction: null,
  currentActionStatus: AppLabActionStatus.Idle,
};
export const useCurrentAction = (): UseCurrentAction => {
  const reducer = useCallback((state: State, input: Input): State => {
    switch (input.type) {
      case 'RESET':
        return {
          currentAction: null,
          currentActionStatus: AppLabActionStatus.Idle,
        };
      case 'ACTION_REQUESTED': {
        return {
          currentAction: input?.payload?.currentAction ?? state.currentAction,
          currentActionStatus: AppLabActionStatus.Pending,
        };
      }
      case 'ACTION_SUCCEEDED':
        return {
          currentAction: input?.payload?.currentAction ?? state.currentAction,
          currentActionStatus: AppLabActionStatus.Succeeded,
        };
      case 'ACTION_FAILED':
        return {
          ...state,
          currentActionStatus: AppLabActionStatus.Errored,
        };
      default:
        return state;
    }
  }, []);

  const [{ currentAction, currentActionStatus }, reducerSend] = useReducer(
    reducer,
    defaultState,
  );

  return {
    currentAction,
    currentActionStatus,
    send: reducerSend,
  };
};
