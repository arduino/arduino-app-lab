import {
  listenForStateCondition,
  StateSubjectValuePair,
} from '@cloud-editor-mono/common';
import { orderBy, uniqueId } from 'lodash';

import { AgentPort } from './agent.type';
import { daemonState, setAgentDaemonState } from './state';
import { getStateSubject } from './state.reactive';
import { AgentDaemonState, AgentDaemonStateKeys } from './state.type';

export async function discoverPorts(): Promise<AgentPort[]> {
  const { socket } = daemonState;
  if (!socket) {
    return Promise.reject('Could not list ports, no connection to agent');
  }

  const predicate = ([
    prevValue,
    newValue,
  ]: StateSubjectValuePair<AgentDaemonState>): boolean => {
    if (!newValue[AgentDaemonStateKeys.Ports]) return false;

    const orderedCurrentPorts = orderBy(
      prevValue[AgentDaemonStateKeys.Ports],
      'portName',
    );
    const orderedNewPorts = orderBy(
      newValue[AgentDaemonStateKeys.Ports],
      'portName',
    );

    const portsChanged =
      JSON.stringify(orderedCurrentPorts) !== JSON.stringify(orderedNewPorts);

    return portsChanged;
  };

  const { ports } = daemonState;
  const portsListedPromise = listenForStateCondition(
    daemonState,
    AgentDaemonStateKeys.Ports,
    predicate,
    ports,
    getStateSubject(),
  );

  socket.emit('command', 'list');

  // here we add an item to the quota, this will be removed when any
  // list command socket msg is received from this point
  const quotaItemId = uniqueId();
  setAgentDaemonState({
    [AgentDaemonStateKeys.PortsListQuota]: [
      ...daemonState[AgentDaemonStateKeys.PortsListQuota],
      { timestamp: Date.now(), id: quotaItemId },
    ],
  });

  const portsListed = await portsListedPromise;

  // here we remove the quota item from the list if it's still there,
  // this would be the case if `listenForStateCondition` timed out
  setAgentDaemonState({
    [AgentDaemonStateKeys.PortsListQuota]: daemonState[
      AgentDaemonStateKeys.PortsListQuota
    ].filter((item) => item.id !== quotaItemId),
  });

  return portsListed;
}
