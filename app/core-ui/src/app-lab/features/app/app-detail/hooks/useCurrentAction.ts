import {
  Action,
  ActionStatus,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback, useReducer } from 'react';

interface State {
  currentAction: Action | null;
  currentActionStatus: ActionStatus;
}

interface Input {
  type: 'RESET' | 'ACTION_REQUESTED' | 'ACTION_SUCCEEDED' | 'ACTION_FAILED';
  payload?: Partial<State>;
}

interface UseCurrentAction {
  currentAction: Action | null;
  currentActionStatus: ActionStatus;
  send: (input: Input) => void;
}

const defaultState = {
  currentAction: null,
  currentActionStatus: ActionStatus.Idle,
};
export const useCurrentAction = (): UseCurrentAction => {
  const reducer = useCallback((state: State, input: Input): State => {
    switch (input.type) {
      case 'RESET':
        return {
          currentAction: null,
          currentActionStatus: ActionStatus.Idle,
        };
      case 'ACTION_REQUESTED': {
        return {
          currentAction: input?.payload?.currentAction ?? state.currentAction,
          currentActionStatus: ActionStatus.Pending,
        };
      }
      case 'ACTION_SUCCEEDED':
        return {
          currentAction: input?.payload?.currentAction ?? state.currentAction,
          currentActionStatus: ActionStatus.Succeeded,
        };
      case 'ACTION_FAILED':
        return {
          ...state,
          currentActionStatus: ActionStatus.Errored,
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
