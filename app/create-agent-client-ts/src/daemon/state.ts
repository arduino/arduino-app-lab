import { createState, stateSubjectNext } from '@cloud-editor-mono/common';

import { DaemonProtocols } from './daemon.type';
import { getStateSubject } from './state.reactive';
import { AgentDaemonState, AgentDaemonStateKeys } from './state.type';

export const initialState: AgentDaemonState = {
  [AgentDaemonStateKeys.Config]: {
    protocolToUse: DaemonProtocols.HTTP,
    useV2: false,
  },
  [AgentDaemonStateKeys.SocketConnected]: false,
  [AgentDaemonStateKeys.DownloadQuota]: [],
  [AgentDaemonStateKeys.NetworkPorts]: [],
  [AgentDaemonStateKeys.Ports]: [],
  [AgentDaemonStateKeys.SerialMonitors]: [],
  [AgentDaemonStateKeys.PortsListQuota]: [],
  [AgentDaemonStateKeys.UploadQuota]: [],
  searchedForDaemon: false,
  socketEventsAreSet: false,
};

export let daemonState = {
  ...initialState,
} as AgentDaemonState;

export function resetDaemonState(): void {
  daemonState = {
    ...initialState,
  };
}

export function setAgentDaemonState(
  newStateProps: Partial<AgentDaemonState>,
  doNotEmit = false,
): void {
  daemonState = createState<AgentDaemonState>(daemonState, newStateProps);

  const stateChangeSubject$ = getStateSubject();

  if (!doNotEmit) {
    stateSubjectNext<AgentDaemonState>(daemonState, stateChangeSubject$);
  }
}

// Multi-window state management
export function exportAgentDaemonState(): AgentDaemonState {
  const {
    [AgentDaemonStateKeys.Socket]: _socket,
    [AgentDaemonStateKeys.SocketConnected]: _socketConnected,
    [AgentDaemonStateKeys.PortsListQuota]: _portsListQuota,
    [AgentDaemonStateKeys.UploadQuota]: _uploadQuota,
    socketEventsAreSet: _socketEventsAreSet,
    uploadConcatResponseStream$: _uploadConcatResponseStream$,
    uploadResponseStream$: _uploadResponseStream$,
    serialMonitorsMsgStream$: _serialMonitorsMsgStream$,
    serialMonitorsDisconnections$: _serialMonitorsDisconnections$,
    stateChangeSubject$: _stateChangeSubject$,
    ...serializableDaemonState
  } = daemonState;

  return {
    ...serializableDaemonState,
    [AgentDaemonStateKeys.SocketConnected]: null,
    [AgentDaemonStateKeys.PortsListQuota]: [],
    [AgentDaemonStateKeys.UploadQuota]: [],
    socketEventsAreSet: false,
  };
}
