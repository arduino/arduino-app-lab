import {
  instantiateStateSubject,
  StateSubject,
} from '@cloud-editor-mono/common';

import { setWebSerialState, webSerialState } from './state';
import { WebSerialState } from './state.type';

export function getStateSubject(): StateSubject<WebSerialState> {
  let { stateChangeSubject$ } = webSerialState;
  if (stateChangeSubject$) return stateChangeSubject$;

  stateChangeSubject$ = instantiateStateSubject(setWebSerialState);

  return stateChangeSubject$;
}
