import io from 'socket.io-client';

import { daemonState, setAgentDaemonState } from '../daemon/state';
import { AgentDaemonStateKeys } from '../daemon/state.type';
import { messageEventHandler } from './socket';

export function resetSocketHandlers(): void {
  const { socket } = daemonState;
  if (socket) {
    socket.removeAllListeners();
    (socket as SocketIOClient.Socket & { destroy?: () => void }).destroy?.();
  }
}

function setupSocketEvents(socket: SocketIOClient.Socket): void {
  const { socketEventsAreSet } = daemonState;
  if (socketEventsAreSet) return;

  socket.on('connect', () => {
    setAgentDaemonState({ [AgentDaemonStateKeys.SocketConnected]: true });
  });
  socket.on('message', messageEventHandler);
  socket.on('error', () => {});
  socket.on('disconnect', () => {
    setAgentDaemonState({ [AgentDaemonStateKeys.SocketConnected]: false });
  });

  setAgentDaemonState({ socketEventsAreSet: true });
}

function instantiateWebSocket(address: string): SocketIOClient.Socket {
  const clientSocket = io(address, { transports: ['websocket'] });
  return clientSocket;
}

function getWebSocket(wsAddress: string): SocketIOClient.Socket {
  let { socket } = daemonState;
  if (socket) return socket;

  socket = instantiateWebSocket(wsAddress);
  setAgentDaemonState({ [AgentDaemonStateKeys.Socket]: socket });

  return socket;
}

export function connectToAgentWebSocket(wsAddress: string): void {
  const socket = getWebSocket(wsAddress);

  setupSocketEvents(socket);
}
