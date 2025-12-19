import { createState, stateSubjectNext } from '@cloud-editor-mono/common';

import { getStateSubject } from './state.reactive';
import { WebSerialState, WebSerialStateKeys } from './state.type';

export const initialState: WebSerialState = {
  [WebSerialStateKeys.WebSerialConnected]: false,
  [WebSerialStateKeys.Ports]: [],
  [WebSerialStateKeys.SerialMonitors]: [],
  [WebSerialStateKeys.SupportedFqbns]: [],
};

export let webSerialState = {
  ...initialState,
} as WebSerialState;

export function resetWebSerialState(): void {
  webSerialState = {
    ...initialState,
  };
}

export function setWebSerialState(
  newStateProps: Partial<WebSerialState>,
  doNotEmit = false,
): void {
  webSerialState = createState<WebSerialState>(webSerialState, newStateProps);

  const stateChangeSubject$ = getStateSubject();

  if (!doNotEmit) {
    stateSubjectNext<WebSerialState>(webSerialState, stateChangeSubject$);
  }
}

// Multi-window state management
export function exportWebSerialState(): WebSerialState {
  const {
    [WebSerialStateKeys.WebSerialConnected]: _webSerialConnected,
    uploadConcatResponseStream$: _uploadConcatResponseStream$,
    uploadResponseStream$: _uploadResponseStream$,
    serialMonitorsMsgStream$: _serialMonitorsMsgStream$,
    serialMonitorsDisconnections$: _serialMonitorsDisconnections$,
    stateChangeSubject$: _stateChangeSubject$,
    ...serializableState
  } = webSerialState;

  return {
    ...serializableState,
    [WebSerialStateKeys.WebSerialConnected]: null,
  };
}
