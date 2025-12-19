import { hasNavigator } from '@cloud-editor-mono/common';

import { getChannel } from './channel';
import { mapPortsListMessage } from './mapper';
import { WebSerialBoard, WebSerialPort, WebSerialPortName } from './ports.type';

export function listenForPortUpdates(): void {
  if (hasNavigator(window)) {
    window.navigator.serial.addEventListener('connect', (event) => {
      console.log('Serial port connected', event);
    });
    window.navigator.serial.addEventListener('disconnect', (event) => {
      console.log('Serial port disconnected', event);
    });
  }
}

export async function listPorts(): Promise<WebSerialPort[]> {
  const channel = getChannel();

  const boards = await channel.listBoards();

  return mapPortsListMessage(boards);
}

export async function openPort(
  portName: string,
  baudrate: number,
): Promise<void> {
  const channel = getChannel();

  if (
    Object.keys(channel.openPorts).some(
      (port) => port === portName && channel.openPorts[port] === true,
    )
  ) {
    return;
  }
  await channel.openPort({ name: portName, baudrate });
}

export async function closePort(portName: string): Promise<void> {
  const channel = getChannel();

  await channel.closePort({ name: portName as WebSerialPortName });
}

export function writePort(port: string, data: string): void {
  const channel = getChannel();

  channel.writePort({
    name: port,
    data,
  });
}

export async function requestPort(): Promise<WebSerialBoard> {
  const n = navigator as Navigator & { serial: Record<string, any> };
  if (!n.serial) {
    return Promise.reject(new Error('Web Serial API is not available'));
  }

  const port = await n.serial.requestPort();
  return port.getInfo();
}
