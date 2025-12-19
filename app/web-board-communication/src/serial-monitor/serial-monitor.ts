import {
  listenForSerialMonitorClose$,
  listenForSerialMonitorOpen$,
  PortAlreadyOpenError,
  SerialMonitor,
  SerialMonitorObservableMessage,
  SerialMonitorStatus,
  UploadStatus,
} from '@cloud-editor-mono/board-communication-tools';
import { defer, Observable, throwError } from 'rxjs';

import { closePort, openPort, writePort } from '../ports';
import { setWebSerialState, webSerialState } from '../state';
import { getStateSubject } from '../state.reactive';
import { WebSerialStateKeys } from '../state.type';

export function openWebSerialMonitor$(
  port: SerialMonitor['port'],
  baudRate: SerialMonitor['baudRate'] = 9600,
): Observable<SerialMonitorObservableMessage> {
  return defer(() => {
    const {
      [WebSerialStateKeys.Ports]: ports,
      [WebSerialStateKeys.UploadStatus]: uploadStatus,
      [WebSerialStateKeys.SerialMonitors]: serialMonitors,
    } = webSerialState;

    if (uploadStatus === UploadStatus.IN_PROG) {
      return throwError(
        () => new Error('Could not open serial monitor, upload in progress'),
      );
    }

    const serialMonitorPort = ports.find((p) => p.portName === port);
    if (!serialMonitorPort) {
      return throwError(
        () =>
          new Error(
            `Could not open serial monitor, can't find board at ${port}`,
          ),
      );
    }

    if (serialMonitorPort.isOpen) {
      return throwError(() => new PortAlreadyOpenError(port));
    }

    const serialMonitorIndex = serialMonitors.findIndex(
      (sm) => sm.port === port,
    );
    const serialMonitorExists = serialMonitorIndex !== -1;
    let newSerialMonitors: SerialMonitor[];

    if (serialMonitorExists) {
      newSerialMonitors = serialMonitors.map((sm) => {
        if (sm.port === port) {
          return {
            ...sm,
          };
        } else {
          return sm;
        }
      });
    } else {
      newSerialMonitors = [
        ...serialMonitors,
        {
          port: port,
          baudRate: baudRate,
          status: SerialMonitorStatus.OPENED,
        },
      ];
    }

    openPort(port, 9600);

    setWebSerialState({
      [WebSerialStateKeys.SerialMonitors]: newSerialMonitors,
    });

    return listenForSerialMonitorOpen$(
      setWebSerialState,
      webSerialState,
      WebSerialStateKeys.SerialMonitors,
      port,
      serialMonitors,
      getStateSubject(),
    );
  });
}

export function closeWebSerialMonitor$(
  port: SerialMonitor['port'],
): Observable<SerialMonitor['port']> {
  return defer(() => {
    const { [WebSerialStateKeys.SerialMonitors]: serialMonitors } =
      webSerialState;

    closePort(port);

    return listenForSerialMonitorClose$(
      webSerialState,
      WebSerialStateKeys.SerialMonitors,
      WebSerialStateKeys.Ports,
      port,
      serialMonitors,
      getStateSubject(),
    );
  });
}

export function sendToWebSerialMonitor(
  port: SerialMonitor['port'],
  data: string,
): void {
  const { [WebSerialStateKeys.SerialMonitors]: serialMonitors } =
    webSerialState;

  if (!serialMonitors.some(({ port: smPort }) => smPort === port)) {
    throw new Error(`Could not find an opened serial monitor on port ${port}`);
  }

  writePort(port, data);
}
