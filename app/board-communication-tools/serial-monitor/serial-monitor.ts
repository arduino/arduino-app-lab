import {
  Port,
  SerialMonitor,
  SerialMonitorObservableMessage,
  SerialMonitorStatus,
} from '@cloud-editor-mono/board-communication-tools';
import {
  listenForStateCondition$,
  State,
  StateSubject,
  StateSubjectValuePair,
} from '@cloud-editor-mono/common';
import { concat, map, mergeMap, Observable, of } from 'rxjs';

import { getSerialMonitorMsgStreamByPort } from './serial-monitor.reactive';

export function serialMonitorOpenPredicate<T extends State<T>>(
  port: SerialMonitor['port'],
  serialMonitorsKey: keyof T,
) {
  return function ([_, newValue]: StateSubjectValuePair<T>): boolean {
    if (!newValue[serialMonitorsKey]) return false;

    const serialMonitor = (newValue[serialMonitorsKey] as SerialMonitor[]).find(
      (p) => p.port === port,
    );

    return serialMonitor?.status === SerialMonitorStatus.OPENED;
  };
}

function serialMonitorClosePredicate<T extends State<T>>(
  port: SerialMonitor['port'],
  serialMonitorsKey: keyof T,
  portsKey: keyof T,
) {
  return function ([_, newValue]: StateSubjectValuePair<T>): boolean {
    if (!newValue[serialMonitorsKey]) return false;

    const serialMonitorPort = (newValue[portsKey] as Port[])?.find(
      (p) => p.portName === port,
    );

    return (
      !(newValue[serialMonitorsKey] as SerialMonitor[]).some(
        (p) => p.port === port,
      ) && !serialMonitorPort?.isOpen
    );
  };
}

export function listenForSerialMonitorOpen$<
  T extends State<T>,
  K extends keyof T,
>(
  setState: (newStateProps: Partial<State<T>>, doNotEmit?: boolean) => void,
  state: T,
  serialMonitorsKey: K,
  port: SerialMonitor['port'],
  serialMonitors: T[K],
  stateChangeSubject$: StateSubject<T>,
): Observable<SerialMonitorObservableMessage> {
  return listenForStateCondition$(
    state,
    serialMonitorsKey,
    serialMonitorOpenPredicate(port, serialMonitorsKey),
    serialMonitors,
    100,
    stateChangeSubject$,
  ).pipe(
    mergeMap((updatedSerialMonitors) => {
      if (
        !updatedSerialMonitors ||
        (updatedSerialMonitors as SerialMonitor[]).find((p) => p.port === port)
          ?.status !== SerialMonitorStatus.OPENED
      ) {
        throw new Error('Could not open serial monitor');
      }

      return concat(
        of({ type: 'info', value: 'ready' }),
        getSerialMonitorMsgStreamByPort(
          setState,
          state,
          updatedSerialMonitors as SerialMonitor[],
          port,
        ).pipe(map((msg) => ({ type: 'message', value: msg }))),
      );
    }),
  );
}

export function listenForSerialMonitorClose$<
  T extends State<T>,
  K extends keyof T,
>(
  state: T,
  serialMonitorsKey: K,
  portsKey: K,
  port: SerialMonitor['port'],
  serialMonitors: T[K],
  stateChangeSubject$: StateSubject<T>,
): Observable<SerialMonitor['port']> {
  return listenForStateCondition$(
    state,
    serialMonitorsKey,
    serialMonitorClosePredicate(port, serialMonitorsKey, portsKey),
    serialMonitors,
    5000,
    stateChangeSubject$,
  ).pipe(
    map((updatedSerialMonitors) => {
      if (
        (updatedSerialMonitors as SerialMonitor[]).some((p) => p.port === port)
      ) {
        throw new Error('Could not close serial monitor');
      }
      return port;
    }),
  );
}
