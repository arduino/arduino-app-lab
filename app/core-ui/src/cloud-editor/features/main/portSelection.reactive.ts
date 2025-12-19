import {
  BehaviorSubject,
  distinctUntilChanged,
  map,
  Observable,
  shareReplay,
} from 'rxjs';

type SelectedPort = string | undefined;

interface PortSelectionState {
  selectedPort: SelectedPort;
  prevSelectedPort: SelectedPort;
}

type PortSelectionSubjectValue = PortSelectionState;

const defaultPortSelectionState: PortSelectionState = {
  selectedPort: undefined,
  prevSelectedPort: undefined,
};

let portSelection$: BehaviorSubject<PortSelectionSubjectValue> | null = null;
let portSelectionChanges$: Observable<SelectedPort> | null = null;

export function resetPortSelectionSubjects(): void {
  portSelection$ = null;
  portSelectionChanges$ = null;
}

export function instantiatePortSelectionSubject(): BehaviorSubject<PortSelectionState> {
  portSelection$ = new BehaviorSubject(defaultPortSelectionState);

  return portSelection$;
}

function getPortSelectionSubject(): BehaviorSubject<PortSelectionState> {
  let subject$ = portSelection$;
  if (!subject$) {
    subject$ = instantiatePortSelectionSubject();
  }

  return subject$;
}

export function getSelectedPort(): SelectedPort {
  const subject$ = getPortSelectionSubject();

  return subject$.getValue().selectedPort;
}

export function getPrevSelectedPort(): SelectedPort {
  const subject$ = getPortSelectionSubject();

  return subject$.getValue().prevSelectedPort;
}

export function portSelectionNext(
  state: PortSelectionState['selectedPort'],
): void {
  const subject$ = getPortSelectionSubject();
  subject$.next({
    prevSelectedPort: subject$.getValue().selectedPort,
    selectedPort: state,
  });
}

export function portSelectionReset(): void {
  const subject$ = getPortSelectionSubject();

  subject$.next(defaultPortSelectionState);
}

function instantiatePortSelectionChangesSubject(): Observable<SelectedPort> {
  const subject$ = getPortSelectionSubject();

  portSelectionChanges$ = subject$.pipe(
    map((state) => state.selectedPort),
    distinctUntilChanged(),
    shareReplay(1),
  );

  return portSelectionChanges$;
}

export function getPortSelectionChangesSubject(): Observable<SelectedPort> {
  let subject$ = portSelectionChanges$;
  if (!subject$) {
    subject$ = instantiatePortSelectionChangesSubject();
  }

  return subject$;
}
