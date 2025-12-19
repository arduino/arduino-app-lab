import {
  cancelSerialMonitor$,
  clearEventsNext as clear,
} from '@cloud-editor-mono/domain';
import { SerialMonitorStatus } from '@cloud-editor-mono/ui-components';
import { useCallback, useReducer } from 'react';

import { SerialMonitorWindowUpdates } from '../../main/hooks/serialMonitorWindow';

type State = {
  status: SerialMonitorStatus;
  enabled: boolean;
};

type Dependencies = {
  portName?: string;
};

type ExecuteBeforeSideEffect = (
  dependencies: Dependencies,
) => Promise<void> | void;

type StateNode = {
  nextState: SerialMonitorStatus;
  enabledOutput: boolean;
  executeBefore?: ExecuteBeforeSideEffect[];
};

const active: ExecuteBeforeSideEffect = () => {
  window.dispatchEvent(
    new Event(SerialMonitorWindowUpdates.serialMonitorActive),
  );
};

const inactive: ExecuteBeforeSideEffect = () => {
  window.dispatchEvent(
    new Event(SerialMonitorWindowUpdates.serialMonitorInactive),
  );
};

const cancel: ExecuteBeforeSideEffect = async (dependencies) => {
  await cancelSerialMonitor$(dependencies.portName);
  inactive(dependencies);
};

type Input =
  | 'CONNECTED'
  | 'TOGGLE'
  | 'RESTART'
  | 'UPLOAD_STARTED'
  | 'NOT_REACHABLE'
  | 'STARTED'
  | 'UPLOAD_FINISHED';

export type UpdateStatusWithInput = (input: Input) => void;

const NEXT_STATE_GRAPH: Record<
  SerialMonitorStatus,
  Partial<Record<Input, StateNode>>
> = {
  [SerialMonitorStatus.Connecting]: {
    CONNECTED: {
      nextState: SerialMonitorStatus.Starting,
      enabledOutput: false,
    },
  },
  [SerialMonitorStatus.Starting]: {
    STARTED: {
      nextState: SerialMonitorStatus.Active,
      enabledOutput: true,
      executeBefore: [active],
    },
    NOT_REACHABLE: {
      nextState: SerialMonitorStatus.Unavailable,
      enabledOutput: false,
    },
  },
  [SerialMonitorStatus.Active]: {
    TOGGLE: {
      nextState: SerialMonitorStatus.Paused,
      enabledOutput: true,
      executeBefore: [cancel],
    },
    RESTART: {
      nextState: SerialMonitorStatus.Starting,
      enabledOutput: false,
      executeBefore: [cancel, clear],
    },
    UPLOAD_STARTED: {
      nextState: SerialMonitorStatus.Uploading,
      enabledOutput: false,
      executeBefore: [cancel],
    },
    NOT_REACHABLE: {
      nextState: SerialMonitorStatus.ActiveUnreachable,
      enabledOutput: false,
      executeBefore: [inactive],
    },
  },
  [SerialMonitorStatus.Paused]: {
    TOGGLE: {
      nextState: SerialMonitorStatus.Starting,
      enabledOutput: false,
    },
    NOT_REACHABLE: {
      nextState: SerialMonitorStatus.PausedUnreachable,
      enabledOutput: false,
      executeBefore: [inactive],
    },
  },
  [SerialMonitorStatus.ActiveUnreachable]: {
    RESTART: {
      nextState: SerialMonitorStatus.Starting,
      enabledOutput: false,
    },
  },
  [SerialMonitorStatus.PausedUnreachable]: {
    RESTART: {
      nextState: SerialMonitorStatus.Paused,
      enabledOutput: false,
    },
  },
  [SerialMonitorStatus.Uploading]: {
    UPLOAD_FINISHED: {
      nextState: SerialMonitorStatus.Starting,
      enabledOutput: false,
      executeBefore: [clear],
    },
  },
  [SerialMonitorStatus.Unavailable]: {},
};

function reducer(state: State, input: Input): State {
  const nextState = NEXT_STATE_GRAPH[state.status][input];
  if (nextState) {
    return {
      status: nextState.nextState,
      enabled: nextState.enabledOutput,
    };
  }
  return state;
}

function useStatus({ dependencies }: { dependencies: Dependencies }): {
  status: SerialMonitorStatus;
  enabled: boolean;
  send: UpdateStatusWithInput;
} {
  const [{ status, enabled }, reducerSend] = useReducer(reducer, {
    status: SerialMonitorStatus.Connecting,
    enabled: false,
  });

  const send = useCallback(
    async (input: Input) => {
      const executeBefore = NEXT_STATE_GRAPH[status][input]?.executeBefore;

      if (executeBefore) {
        for (const f of executeBefore) {
          await f(dependencies);
        }
      }

      reducerSend(input);
    },
    [dependencies, status],
  );

  return {
    status,
    enabled,
    send,
  };
}

export default useStatus;
