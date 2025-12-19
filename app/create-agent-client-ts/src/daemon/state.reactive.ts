import {
  instantiateStateSubject,
  IO_COMMAND_TIMEOUT,
  listenForStateCondition,
  PairwisePredicate,
  StateSubject,
} from '@cloud-editor-mono/common';

import { daemonState, setAgentDaemonState } from './state';
import { AgentDaemonState, AgentDaemonStateKeys } from './state.type';

export async function listenForAgentStateCondition<
  K extends AgentDaemonStateKeys,
>(
  returnStateProp: K,
  predicate: PairwisePredicate<AgentDaemonState>,
  timeoutValue: AgentDaemonState[K],
  timeoutMS = IO_COMMAND_TIMEOUT,
  stateChangeSubject$ = getStateSubject(),
): Promise<AgentDaemonState[K]> {
  return listenForStateCondition<AgentDaemonState, K>(
    daemonState,
    returnStateProp,
    predicate,
    timeoutValue,
    stateChangeSubject$,
    timeoutMS,
  );
}

export function getStateSubject(): StateSubject<AgentDaemonState> {
  let { stateChangeSubject$ } = daemonState;
  if (stateChangeSubject$) return stateChangeSubject$;

  stateChangeSubject$ = instantiateStateSubject(setAgentDaemonState);

  return stateChangeSubject$;
}
