import { daemonState } from '../daemon/state';
import {
  initialState as initialDaemonState,
  setAgentDaemonState,
} from '../daemon/state';
import { AgentDaemonStateKeys } from '../daemon/state.type';
import { connectToAgentWebSocket } from './setup';

const socketInstanceMock = vi.fn();

vi.mock('socket.io-client', () => ({
  default() {
    return {
      on: socketInstanceMock,
    };
  },
}));

describe('connectToAgentWebSocket', () => {
  beforeEach(() => {
    socketInstanceMock.mockClear();

    setAgentDaemonState({
      ...initialDaemonState,
      [AgentDaemonStateKeys.Socket]: undefined,
    });
  });

  afterAll(() => {
    vi.resetAllMocks();
  });

  it('should not fail with correct arguments', () => {
    const wsAddress = 'ws://127.0.0.1:8991';
    expect(() => connectToAgentWebSocket(wsAddress)).not.toThrow();
  });

  it('should connect to the websocket', () => {
    expect(daemonState[AgentDaemonStateKeys.Socket]).toBeFalsy();

    const wsAddress = 'ws://127.0.0.1:8991';
    connectToAgentWebSocket(wsAddress);

    expect(daemonState[AgentDaemonStateKeys.Socket]).not.toBeFalsy();
  });

  it('should setup socket events', () => {
    const wsAddress = 'ws://127.0.0.1:8991';
    connectToAgentWebSocket(wsAddress);

    const calls = socketInstanceMock.mock.calls;

    expect(socketInstanceMock).toHaveBeenCalledTimes(4);
    ['connect', 'message', 'error', 'disconnect'].forEach((event, i) => {
      expect(calls[i][0]).toEqual(event);
    });
  });
});
