import {
  BoardDisconnectionError,
  PortAlreadyOpenError,
  SerialMonitorObservableMessage,
} from '@cloud-editor-mono/board-communication-tools';
import {
  closeAgentSerialMonitor$,
  openAgentSerialMonitor$,
  sendToAgentSerialMonitor,
} from '@cloud-editor-mono/create-agent-client-ts';
import { SerialMonitorStatus } from '@cloud-editor-mono/ui-components';
import {
  closeWebSerialMonitor$,
  openWebSerialMonitor$,
  sendToWebSerialMonitor,
} from '@cloud-editor-mono/web-board-communication';
import {
  catchError,
  EMPTY,
  filter,
  finalize,
  lastValueFrom,
  Observable,
  retry,
  Subject,
  tap,
  throwError,
  timer,
} from 'rxjs';

import { isChromeOs } from '../utils';
import type {
  SerialMonitorClearEventsSubject,
  SerialMonitorSubject,
} from './serialMonitorClientService.type';

let serialMonitor$: SerialMonitorSubject | undefined;
let serialMonitorClearEvents$: SerialMonitorClearEventsSubject | undefined;

export function resetSerialMonitorObervables(): void {
  serialMonitor$ = undefined;
  serialMonitorClearEvents$ = undefined;
}

function ignoreNextErrorIf<T>(shouldIgnoreError: (value: T) => boolean) {
  return (source$: Observable<T>): Observable<T> => {
    let ignoreError = false;

    return source$.pipe(
      tap((value) => {
        ignoreError = shouldIgnoreError(value);
      }),
      catchError((error) => {
        if (ignoreError) {
          return EMPTY;
        }
        return throwError(() => error);
      }),
    );
  };
}

function instantiateSerialMonitorClearEvents$(): SerialMonitorClearEventsSubject {
  serialMonitorClearEvents$ = new Subject();

  return serialMonitorClearEvents$;
}

function instantiateSerialMonitor$(
  portName: string,
  baudRate: number,
  onReady: VoidFunction,
): SerialMonitorSubject {
  serialMonitor$ = new Subject<SerialMonitorObservableMessage>().pipe(
    finalize(() => {
      serialMonitor$ = undefined;
    }),
    tap(({ type, value }) => {
      if (type === 'info' && value === 'ready') {
        onReady();
      }
    }),
    ignoreNextErrorIf(
      ({ type, value }) => type === 'info' && value === 'closing',
    ),
    filter(({ type }) => type === 'message'),
  ) as SerialMonitorSubject;

  const openSerialMonitor$ = isChromeOs
    ? openWebSerialMonitor$
    : openAgentSerialMonitor$;

  openSerialMonitor$(portName, baudRate)
    .pipe(
      retry({
        delay: (error: Error, retryCount: number) => {
          if (
            error instanceof BoardDisconnectionError ||
            error instanceof PortAlreadyOpenError ||
            retryCount > 4
          ) {
            return throwError(() => error);
          }
          // Exponential back-off retrying
          return timer(retryCount ** 2 * 100);
        },
      }),
    )
    .subscribe(serialMonitor$);

  return serialMonitor$;
}

export function getSerialMonitor$(
  status: SerialMonitorStatus,
  portName?: string,
  baudRate?: number,
  onReady = () => {},
): typeof serialMonitor$ {
  if (
    !portName ||
    !baudRate ||
    !(
      status === SerialMonitorStatus.Starting ||
      status === SerialMonitorStatus.Active
    )
  ) {
    return undefined;
  }

  if (!serialMonitor$) {
    serialMonitor$ = instantiateSerialMonitor$(portName, baudRate, onReady);
  }

  return serialMonitor$;
}

export function getSerialMonitorClearEvents$(): SerialMonitorClearEventsSubject {
  if (!serialMonitorClearEvents$) {
    serialMonitorClearEvents$ = instantiateSerialMonitorClearEvents$();
  }

  return serialMonitorClearEvents$;
}

export function serialMonitorNext(
  message: SerialMonitorObservableMessage,
  portName?: string,
): void {
  if (message.meta === 'sent' && portName) {
    if (isChromeOs) {
      sendToWebSerialMonitor(portName, message.value);
    } else {
      sendToAgentSerialMonitor(portName, message.value);
    }
  }

  serialMonitor$?.next(message);
}

export async function cancelSerialMonitor$(portName?: string): Promise<void> {
  if (portName) {
    serialMonitor$?.next({
      type: 'info',
      value: 'closing',
    });
    const closeSerialMonitor$ = isChromeOs
      ? closeWebSerialMonitor$
      : closeAgentSerialMonitor$;

    await lastValueFrom(closeSerialMonitor$(portName));
    serialMonitor$ = undefined;
  }
}

export function clearEventsNext(): void {
  serialMonitorClearEvents$ = getSerialMonitorClearEvents$();
  serialMonitorClearEvents$.next();
}
