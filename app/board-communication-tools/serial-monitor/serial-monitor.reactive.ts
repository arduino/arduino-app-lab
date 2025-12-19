import {
  BoardDisconnectionError,
  SerialMonitor,
  SerialMonitorMessage,
  SerialMonitorStatusUpdate,
} from '@cloud-editor-mono/board-communication-tools';
import { State } from '@cloud-editor-mono/common';
import {
  filter,
  map,
  merge,
  Observable,
  Subject,
  switchMap,
  takeUntil,
  throwError,
} from 'rxjs';

export type SerialMonitorsMsgStream = Subject<SerialMonitorMessage>;
export type SerialMonitorsDisconnections = Subject<
  SerialMonitorStatusUpdate['port']
>;

function instantiateSerialMonitorsMsgStream<T extends State<T>>(
  setState: (newStateProps: Partial<State<T>>, doNotEmit?: boolean) => void,
): SerialMonitorsMsgStream {
  const serialMonitorsMsgStream$ = new Subject<SerialMonitorMessage>();
  setState({ serialMonitorsMsgStream$ });

  return serialMonitorsMsgStream$;
}

function getSerialMonitorsMsgStream<T extends State<T>>(
  setState: (newStateProps: Partial<State<T>>, doNotEmit?: boolean) => void,
  state: T,
): SerialMonitorsMsgStream {
  let { serialMonitorsMsgStream$ } = state;
  if (serialMonitorsMsgStream$) return serialMonitorsMsgStream$;

  serialMonitorsMsgStream$ = instantiateSerialMonitorsMsgStream(setState);

  return serialMonitorsMsgStream$;
}

export function serialMonitorsMsgStreamNext<T extends State<T>>(
  setState: (newStateProps: Partial<State<T>>, doNotEmit?: boolean) => void,
  state: T,
  msg: SerialMonitorMessage,
): void {
  const serialMonitorsMsgStream$ = getSerialMonitorsMsgStream(setState, state);

  serialMonitorsMsgStream$.next(msg);
}

function instantiateSerialMonitorsDisconnections<T extends State<T>>(
  setState: (newStateProps: Partial<State<T>>, doNotEmit?: boolean) => void,
): SerialMonitorsDisconnections {
  const serialMonitorsDisconnections$ = new Subject<
    SerialMonitorStatusUpdate['port']
  >();
  setState({ serialMonitorsDisconnections$ });

  return serialMonitorsDisconnections$;
}

function getSerialMonitorsDisconnections<T extends State<T>>(
  setState: (newStateProps: Partial<State<T>>, doNotEmit?: boolean) => void,
  state: T,
): SerialMonitorsDisconnections {
  let { serialMonitorsDisconnections$ } = state;
  if (serialMonitorsDisconnections$) return serialMonitorsDisconnections$;

  serialMonitorsDisconnections$ =
    instantiateSerialMonitorsDisconnections(setState);

  return serialMonitorsDisconnections$;
}

export function serialMonitorsDisconnectionsNext<T extends State<T>>(
  setState: (newStateProps: Partial<State<T>>, doNotEmit?: boolean) => void,
  state: T,
  port: SerialMonitor['port'],
): void {
  const serialMonitorsDisconnections$ = getSerialMonitorsDisconnections(
    setState,
    state,
  );

  serialMonitorsDisconnections$.next(port);
}

export function getSerialMonitorMsgStreamByPort<T extends State<T>>(
  setState: (newStateProps: Partial<State<T>>, doNotEmit?: boolean) => void,
  state: T,
  serialMonitors: SerialMonitor[],
  port: SerialMonitor['port'],
): Observable<string> {
  const serialMonitorsMsgStream$ = getSerialMonitorsMsgStream(setState, state);
  const serialMonitor = serialMonitors.find((sm) => sm.port === port);
  const serialMonitorsDisconnections$ = getSerialMonitorsDisconnections(
    setState,
    state,
  );

  if (!serialMonitor) {
    throw new Error(`Cannot find serial monitor with port ${port}`);
  }

  const $portDisconnected = serialMonitorsDisconnections$.pipe(
    filter((disconnectedPort) => disconnectedPort === port),
  );

  return merge(
    serialMonitorsMsgStream$.pipe(
      filter((msg) => msg.port === port),
      map((msg) => msg.data),
      takeUntil($portDisconnected),
    ),
    $portDisconnected.pipe(
      switchMap(() => throwError(() => new BoardDisconnectionError())),
    ),
  );
}
