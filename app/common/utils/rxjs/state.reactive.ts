import {
  catchError,
  first,
  last,
  lastValueFrom,
  map,
  Observable,
  of,
  pairwise,
  startWith,
  Subject,
  timeout,
} from 'rxjs';

import { IO_COMMAND_TIMEOUT } from '../utils';
import { State } from './state.type';

export type StateSubject<T> = Subject<StateSubjectValue<T>>;

export type StateSubjectValue<T> = Partial<T>;
export type StateSubjectValuePair<T> = [
  StateSubjectValue<T>,
  StateSubjectValue<T>,
];
export type PairwisePredicate<T> = ([
  prevValue,
  newValue,
]: StateSubjectValuePair<T>) => boolean;

function lastValueIsState<T extends State<T>, K extends keyof T>(
  value: StateSubjectValue<T>[K],
): value is T[K] {
  return Boolean(value);
}

function getCompleteOnStateCondition<T extends State<T>, K extends keyof T>(
  returnStateProp: K,
  predicate: PairwisePredicate<T>,
  timeoutValue: T[K],
  timeoutMS: number,
  stateChangeSubject$: StateSubject<T>,
  state: T,
): Observable<T[K] | Partial<T>[K]> {
  const start: Partial<T> = {};
  start[returnStateProp] = state[returnStateProp];

  return stateChangeSubject$.pipe(
    startWith(start),
    pairwise(),
    first(predicate),
    timeout(timeoutMS),
    map(([_, newValue]) => newValue[returnStateProp]),
    catchError(() => of(timeoutValue)),
  );
}

export async function listenForStateCondition<
  T extends State<T>,
  K extends keyof T,
>(
  state: T,
  returnStateProp: K,
  predicate: PairwisePredicate<T>,
  timeoutValue: T[K],
  stateChangeSubject$: StateSubject<T>,
  timeoutMS = IO_COMMAND_TIMEOUT,
): Promise<T[K]> {
  const $completeOnStateCondition = getCompleteOnStateCondition(
    returnStateProp,
    predicate,
    timeoutValue,
    timeoutMS,
    stateChangeSubject$,
    state,
  );

  const lastValue = await lastValueFrom<StateSubjectValue<T>[K]>(
    $completeOnStateCondition,
  );

  return lastValueIsState<T, K>(lastValue) ? lastValue : timeoutValue;
}

export function listenForStateCondition$<T extends State<T>, K extends keyof T>(
  state: T,
  returnStateProp: K,
  predicate: PairwisePredicate<T>,
  timeoutValue: T[K],
  timeoutMS = IO_COMMAND_TIMEOUT,
  stateChangeSubject$: StateSubject<T>,
): Observable<T[K]> {
  return getCompleteOnStateCondition(
    returnStateProp,
    predicate,
    timeoutValue,
    timeoutMS,
    stateChangeSubject$,
    state,
  ).pipe(
    last(),
    map((lastValue) =>
      lastValueIsState<T, K>(lastValue) ? lastValue : timeoutValue,
    ),
  );
}

export function stateSubjectNext<T extends State<T>>(
  value: StateSubjectValue<T>,
  stateChangeSubject$: StateSubject<T>,
): void {
  stateChangeSubject$.next(value);
}

// ** State change stream
export function instantiateStateSubject<T extends State<T>>(
  setState: (newStateProps: Partial<T>, doNotEmit?: boolean) => void,
): StateSubject<T> {
  const stateChangeSubject$ = new Subject<StateSubjectValue<T>>();
  setState({ stateChangeSubject$ } as Partial<T>);

  return stateChangeSubject$;
}
