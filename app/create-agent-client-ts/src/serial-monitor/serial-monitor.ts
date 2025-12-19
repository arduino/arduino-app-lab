import {
  listenForSerialMonitorClose$,
  listenForSerialMonitorOpen$,
  PortAlreadyOpenError,
  SerialMonitor,
  SerialMonitorObservableMessage,
  UploadStatus,
} from '@cloud-editor-mono/board-communication-tools';
import { defer, Observable, throwError } from 'rxjs';

import { daemonState, setAgentDaemonState } from '../daemon/state';
import { getStateSubject } from '../daemon/state.reactive';
import { AgentDaemonStateKeys } from '../daemon/state.type';

export function openAgentSerialMonitor$(
  port: SerialMonitor['port'],
  baudRate: SerialMonitor['baudRate'] = 9600,
): Observable<SerialMonitorObservableMessage> {
  return defer(() => {
    const {
      [AgentDaemonStateKeys.Ports]: ports,
      [AgentDaemonStateKeys.Socket]: socket,
      [AgentDaemonStateKeys.UploadStatus]: uploadStatus,
      [AgentDaemonStateKeys.SerialMonitors]: serialMonitors,
    } = daemonState;

    if (uploadStatus === UploadStatus.IN_PROG) {
      return throwError(
        () => new Error('Could not open serial monitor, upload in progress'),
      );
    }

    if (!socket) {
      return throwError(
        () =>
          new Error('Could not open serial monitor, no connection to agent'),
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

    socket.emit('command', `open ${port} ${baudRate} timed`);

    return listenForSerialMonitorOpen$(
      setAgentDaemonState,
      daemonState,
      AgentDaemonStateKeys.SerialMonitors,
      port,
      serialMonitors,
      getStateSubject(),
    );
  });
}

export function closeAgentSerialMonitor$(
  port: SerialMonitor['port'],
): Observable<SerialMonitor['port']> {
  return defer(() => {
    const {
      [AgentDaemonStateKeys.Socket]: socket,
      [AgentDaemonStateKeys.SerialMonitors]: serialMonitors,
    } = daemonState;

    if (!socket) {
      return throwError(
        () =>
          new Error('Could not close serial monitor, no connection to agent'),
      );
    }

    socket.emit('command', `close ${port}`);

    return listenForSerialMonitorClose$(
      daemonState,
      AgentDaemonStateKeys.SerialMonitors,
      AgentDaemonStateKeys.Ports,
      port,
      serialMonitors,
      getStateSubject(),
    );
  });
}

export function sendToAgentSerialMonitor(
  port: SerialMonitor['port'],
  data: string,
): void {
  const {
    [AgentDaemonStateKeys.Socket]: socket,
    [AgentDaemonStateKeys.SerialMonitors]: serialMonitors,
  } = daemonState;

  if (!socket) {
    throw new Error('Could not close serial monitor, no connection to agent');
  }

  if (!serialMonitors.some(({ port: smPort }) => smPort === port)) {
    throw new Error(`Could not find an opened serial monitor on port ${port}`);
  }

  socket.emit('command', `send ${port} ${data}`);
}
