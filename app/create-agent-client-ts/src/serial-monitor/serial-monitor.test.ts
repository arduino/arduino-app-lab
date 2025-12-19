import {
  BoardDisconnectionError,
  SerialMonitor,
  SerialMonitorMessage,
  SerialMonitorStatus,
  UploadStatus,
} from '@cloud-editor-mono/board-communication-tools';
import { StateSubjectValue } from '@cloud-editor-mono/common';
import { Observable } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { afterAll, beforeEach } from 'vitest';

import { initialState, setAgentDaemonState } from '../daemon/state';
import { AgentDaemonState, AgentDaemonStateKeys } from '../daemon/state.type';
import { connectToAgentWebSocket } from '../socket/setup';
import {
  closeAgentSerialMonitor$,
  openAgentSerialMonitor$,
} from './serial-monitor';

const EXAMPLE_PORT = {
  baud: 9600,
  bufferAlgorithm: 'mock',
  deviceClass: 'mock',
  isOpen: false,
  isPrimary: true,
  portName: 'COM3',
  networkPort: true,
  productId: 'mock',
  serialNumber: 'mock',
  vendorId: 'mock',
  version: 'mock',
};

const EXAMPLE_SERIAL_MONITOR = {
  status: SerialMonitorStatus.OPENED,
  port: 'COM3',
  baudRate: 9600,
};

const socketEmit = vi.fn();

vi.mock('socket.io-client', () => ({
  default() {
    return {
      on: vi.fn(),
      emit: socketEmit,
    };
  },
}));

describe('openSerialMonitor', () => {
  let scheduler: TestScheduler;

  beforeEach(() => {
    vi.clearAllMocks();

    setAgentDaemonState({
      ...initialState,
      [AgentDaemonStateKeys.Socket]: undefined,
      [AgentDaemonStateKeys.UploadStatus]: undefined,
      [AgentDaemonStateKeys.SerialMonitors]: undefined,
      serialMonitorsMsgStream$: undefined,
      stateChangeSubject$: undefined,
      serialMonitorsDisconnections$: undefined,
    });

    scheduler = new TestScheduler((actual, expected) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        console.log('Actual:', actual);
        console.log('Expected:', expected);
      }
      expect(actual).toEqual(expected);
    });
  });

  afterAll(() => {
    vi.resetAllMocks();
  });

  it('should return an Observable', () => {
    const serialMonitor$ = openAgentSerialMonitor$('COM3', 9600);

    expect(serialMonitor$).toBeInstanceOf(Observable);
  });

  it('should request to open a port via websocket', () => {
    connectToAgentWebSocket('ws://127.0.0.1:8991');
    setAgentDaemonState({
      [AgentDaemonStateKeys.Ports]: [EXAMPLE_PORT],
    });
    openAgentSerialMonitor$('COM3', 9600).subscribe();

    expect(socketEmit).toBeCalledTimes(1);
  });

  it('if there is an upload in progress, the Observable should emit an error', () => {
    scheduler.run(({ expectObservable }) => {
      setAgentDaemonState({
        [AgentDaemonStateKeys.UploadStatus]: UploadStatus.IN_PROG,
      });

      const serialMonitor$ = openAgentSerialMonitor$('COM3', 9600);

      expectObservable(serialMonitor$).toBe(
        '#',
        {},
        new Error('Could not open serial monitor, upload in progress'),
      );
    });
  });

  it("if there isn't a socket connection in `daemonState`, the Observable should emit an error", () => {
    scheduler.run(({ expectObservable }) => {
      const serialMonitor$ = openAgentSerialMonitor$('COM3', 9600);

      expectObservable(serialMonitor$).toBe(
        '#',
        {},
        new Error('Could not open serial monitor, no connection to agent'),
      );
    });
  });

  it('should return an Observable that emits serial monitor data for the board connected to the required port', () => {
    connectToAgentWebSocket('ws://127.0.0.1:8991');

    scheduler.run(({ expectObservable, hot }) => {
      // After sending the agent the command to open the COM3 port,
      // the opening will be successful and the status will be updated
      // with a new serial monitor
      const stateChangeSubject$ = hot<StateSubjectValue<AgentDaemonState>>(
        '--s',
        {
          s: {
            [AgentDaemonStateKeys.SerialMonitors]: [EXAMPLE_SERIAL_MONITOR],
          },
        },
      );

      // Agent will sent some messages from ports COM3 and COM4 (COM4 was already open)
      const serialMonitorsMsgStream$ = hot<SerialMonitorMessage>(
        '---a-bc-d-e',
        {
          a: { port: 'COM3', data: '🍎' },
          b: { port: 'COM4', data: '🍌' },
          c: { port: 'COM4', data: '🍎' },
          d: { port: 'COM3', data: '🍐' },
          e: { port: 'COM4', data: '🍇' },
        },
      );

      setAgentDaemonState({
        [AgentDaemonStateKeys.Ports]: [EXAMPLE_PORT],
        serialMonitorsMsgStream$,
        stateChangeSubject$,
      });

      const serialMonitor$ = openAgentSerialMonitor$('COM3', 9600);
      serialMonitor$.subscribe();

      expectObservable(serialMonitor$).toBe('--ra----b', {
        r: { type: 'info', value: 'ready' },
        a: { type: 'message', value: '🍎' },
        b: { type: 'message', value: '🍐' },
      });
    });
  });

  it('when a serial monitor is errored, should complete', () => {
    connectToAgentWebSocket('ws://127.0.0.1:8991');

    scheduler.run(({ expectObservable, hot }) => {
      // Serial monitor will be disconnected
      const serialMonitorsDisconnections$ = hot<SerialMonitor['port']>(
        '-----a',
        {
          a: 'COM3',
        },
      );

      // After sending the agent the command to open the COM3 port,
      // the opening will be successful and the status will be updated
      // with a new serial monitor
      const stateChangeSubject$ = hot<StateSubjectValue<AgentDaemonState>>(
        '--s',
        {
          s: {
            [AgentDaemonStateKeys.SerialMonitors]: [EXAMPLE_SERIAL_MONITOR],
          },
        },
      );

      // Agent will sent some messages from ports COM3 and COM4 (COM4 was already open)
      const serialMonitorsMsgStream$ = hot<SerialMonitorMessage>(
        '---a-bc-d-e',
        {
          a: { port: 'COM3', data: '🍎' },
          b: { port: 'COM4', data: '🍌' },
          c: { port: 'COM4', data: '🍎' },
          d: { port: 'COM3', data: '🍐' },
          e: { port: 'COM4', data: '🍇' },
        },
      );

      setAgentDaemonState({
        [AgentDaemonStateKeys.Ports]: [EXAMPLE_PORT],
        serialMonitorsMsgStream$,
        stateChangeSubject$,
        serialMonitorsDisconnections$,
      });

      const serialMonitor$ = openAgentSerialMonitor$('COM3', 9600);
      serialMonitor$.subscribe({
        error: () => {},
      });

      expectObservable(serialMonitor$).toBe(
        '--ra-#',
        {
          r: { type: 'info', value: 'ready' },
          a: { type: 'message', value: '🍎' },
        },
        new BoardDisconnectionError(),
      );
    });
  });

  it('should return different serial monitor Observables when called with different port arguments', async () => {
    connectToAgentWebSocket('ws://127.0.0.1:8991');

    scheduler.run(({ expectObservable, hot }) => {
      // We will request to open 3 ports, they will open in different times
      const stateChangeSubject$ = hot<StateSubjectValue<AgentDaemonState>>(
        'xy-z',
        {
          x: {
            [AgentDaemonStateKeys.SerialMonitors]: [EXAMPLE_SERIAL_MONITOR],
          },
          y: {
            [AgentDaemonStateKeys.SerialMonitors]: [
              EXAMPLE_SERIAL_MONITOR,
              { ...EXAMPLE_SERIAL_MONITOR, port: 'COM4' },
            ],
          },
          z: {
            [AgentDaemonStateKeys.SerialMonitors]: [
              EXAMPLE_SERIAL_MONITOR,
              { ...EXAMPLE_SERIAL_MONITOR, port: 'COM4' },
              { ...EXAMPLE_SERIAL_MONITOR, port: 'COM5' },
            ],
          },
        },
      );

      // Agent will sent some messages from ports COM3, COM4 and COM5
      const serialMonitorsMsgStream$ = hot<SerialMonitorMessage>(
        '---(af)-bc-d-e',
        {
          a: { port: 'COM3', data: '🍎' },
          b: { port: 'COM4', data: '🍌' },
          c: { port: 'COM4', data: '🍎' },
          d: { port: 'COM3', data: '🍐' },
          e: { port: 'COM5', data: '🍐' },
          f: { port: 'COM4', data: '🍇' },
        },
      );
      setAgentDaemonState({
        [AgentDaemonStateKeys.Ports]: [
          EXAMPLE_PORT,
          { ...EXAMPLE_PORT, portName: 'COM4' },
          { ...EXAMPLE_PORT, portName: 'COM5' },
        ],
        serialMonitorsMsgStream$,
        stateChangeSubject$,
      });

      const serialMonitor1$ = openAgentSerialMonitor$('COM3');
      serialMonitor1$.subscribe();
      const serialMonitor2$ = openAgentSerialMonitor$('COM4');
      serialMonitor2$.subscribe();
      const serialMonitor3$ = openAgentSerialMonitor$('COM5');
      serialMonitor3$.subscribe();

      const values = {
        r: { type: 'info', value: 'ready' },
        a: { type: 'message', value: '🍎' },
        b: { type: 'message', value: '🍌' },
        c: { type: 'message', value: '🥥' },
        d: { type: 'message', value: '🍐' },
        e: { type: 'message', value: '🍇' },
      };
      expectObservable(serialMonitor1$).toBe('r--a-------d', values);
      expectObservable(serialMonitor2$).toBe('-r-e----ba', values);
      expectObservable(serialMonitor3$).toBe('---r---------d', values);
    });
  });

  describe('closeSerialMonitor', () => {
    let scheduler: TestScheduler;

    beforeEach(() => {
      vi.clearAllMocks();

      setAgentDaemonState({
        ...initialState,
        [AgentDaemonStateKeys.Socket]: undefined,
        [AgentDaemonStateKeys.UploadStatus]: undefined,
        [AgentDaemonStateKeys.SerialMonitors]: undefined,
        serialMonitorsMsgStream$: undefined,
        stateChangeSubject$: undefined,
        serialMonitorsDisconnections$: undefined,
      });

      scheduler = new TestScheduler((actual, expected) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          console.log('Actual:', actual);
          console.log('Expected:', expected);
        }
        expect(actual).toEqual(expected);
      });
    });

    afterAll(() => {
      vi.resetAllMocks();
    });

    it('when closes a serial monitor, should make the serial monitor on that port complete', () => {
      connectToAgentWebSocket('ws://127.0.0.1:8991');

      scheduler.run(({ expectObservable, hot }) => {
        // Serial monitor will be disconnected
        const serialMonitorsDisconnections$ = hot<SerialMonitor['port']>(
          '-----a',
          {
            a: 'COM3',
          },
        );
        // After sending the agent the command to open the COM3 port,
        // the opening will be successful and the status will be updated
        // with a new serial monitor, then serial monitor will be closed.
        const stateChangeSubject$ = hot<StateSubjectValue<AgentDaemonState>>(
          '--x--y',
          {
            x: {
              [AgentDaemonStateKeys.SerialMonitors]: [EXAMPLE_SERIAL_MONITOR],
            },
            y: {
              [AgentDaemonStateKeys.SerialMonitors]: [],
            },
          },
        );

        // Agent will sent some messages from ports COM3 and COM4 (COM4 was already open)
        const serialMonitorsMsgStream$ = hot<SerialMonitorMessage>(
          '---a-bc-d-e',
          {
            a: { port: 'COM3', data: '🍎' },
            b: { port: 'COM4', data: '🍌' },
            c: { port: 'COM4', data: '🍎' },
            d: { port: 'COM3', data: '🍐' },
            e: { port: 'COM4', data: '🍇' },
          },
        );

        setAgentDaemonState({
          [AgentDaemonStateKeys.Ports]: [EXAMPLE_PORT],
          serialMonitorsMsgStream$,
          stateChangeSubject$,
          serialMonitorsDisconnections$,
        });

        const serialMonitor$ = openAgentSerialMonitor$('COM3', 9600);
        serialMonitor$.subscribe({
          error: () => {},
        });
        const serialMonitorClosed$ = closeAgentSerialMonitor$('COM3');
        serialMonitorClosed$.subscribe();

        expectObservable(serialMonitor$).toBe(
          '--ra-#',
          {
            r: { type: 'info', value: 'ready' },
            a: { type: 'message', value: '🍎' },
          },
          new BoardDisconnectionError(),
        );
        expectObservable(serialMonitorClosed$).toBe('-----(a|)', {
          a: 'COM3',
        });
      });
    });

    it('when closes a serial monitor, should make the serial monitor on that port complete and should not close the others', () => {
      connectToAgentWebSocket('ws://127.0.0.1:8991');

      scheduler.run(({ expectObservable, hot }) => {
        // Serial monitor will be disconnected
        const serialMonitorsDisconnections$ = hot<SerialMonitor['port']>(
          '-----a',
          {
            a: 'COM3',
          },
        );
        // After sending the agent the command to open the COM3 port,
        // the opening will be successful and the status will be updated
        // with a new serial monitor, then serial monitor will be closed.
        const stateChangeSubject$ = hot<StateSubjectValue<AgentDaemonState>>(
          '--x--y',
          {
            x: {
              [AgentDaemonStateKeys.SerialMonitors]: [
                EXAMPLE_SERIAL_MONITOR,
                { ...EXAMPLE_SERIAL_MONITOR, port: 'COM4' },
              ],
            },
            y: {
              [AgentDaemonStateKeys.SerialMonitors]: [
                { ...EXAMPLE_SERIAL_MONITOR, port: 'COM4' },
              ],
            },
          },
        );

        // Agent will sent some messages from ports COM3 and COM4 (COM4 was already open)
        const serialMonitorsMsgStream$ = hot<SerialMonitorMessage>(
          '---a-bc-d-e',
          {
            a: { port: 'COM3', data: '🍎' },
            b: { port: 'COM4', data: '🍌' },
            c: { port: 'COM4', data: '🍎' },
            d: { port: 'COM3', data: '🍐' },
            e: { port: 'COM4', data: '🍇' },
          },
        );

        setAgentDaemonState({
          [AgentDaemonStateKeys.Ports]: [
            EXAMPLE_PORT,
            { ...EXAMPLE_PORT, portName: 'COM4' },
          ],
          serialMonitorsMsgStream$,
          stateChangeSubject$,
          serialMonitorsDisconnections$,
        });

        const serialMonitor1$ = openAgentSerialMonitor$('COM3');
        serialMonitor1$.subscribe({
          error: () => {},
        });
        const serialMonitor2$ = openAgentSerialMonitor$('COM4');
        serialMonitor2$.subscribe();
        const serialMonitorClosed$ = closeAgentSerialMonitor$('COM3');
        serialMonitorClosed$.subscribe();

        expectObservable(serialMonitor1$).toBe(
          '--ra-#',
          {
            r: { type: 'info', value: 'ready' },
            a: { type: 'message', value: '🍎' },
          },
          new BoardDisconnectionError(),
        );
        expectObservable(serialMonitor2$).toBe('--r--ba---c', {
          r: { type: 'info', value: 'ready' },
          a: { type: 'message', value: '🍎' },
          b: { type: 'message', value: '🍌' },
          c: { type: 'message', value: '🍇' },
        });
        expectObservable(serialMonitorClosed$).toBe('-----(a|)', {
          a: 'COM3',
        });
      });
    });
  });
});
