import { AgentPort } from '@cloud-editor-mono/create-agent-client-ts';
import { WebSerialPort } from '@cloud-editor-mono/web-board-communication';

export type Port = AgentPort | WebSerialPort;

export enum SerialMonitorStatus {
  Open = 'Open',
  OpenFail = 'OpenFail',
  Close = 'Close',
}

export interface SerialMonitorStatusUpdate {
  status: SerialMonitorStatus;
  port: Port['portName'];
  baudRate: Port['baud'];
}

export interface SerialMonitorMessage {
  port: Port['portName'];
  data: string;
}

export enum SerialMonitorStatus {
  NONE = 'none',
  OPENED = 'opened',
  FAILED = 'failed',
  CLOSED = 'closed',
}

export interface SerialMonitor {
  status: SerialMonitorStatus;
  port: Port['portName'];
  baudRate: Port['baud'];
}

export class BoardDisconnectionError extends Error {
  constructor() {
    super('Board disconnected');
    this.name = 'BoardDisconnectionError';
  }
}

export class PortAlreadyOpenError extends Error {
  constructor(port: string) {
    super(`Serial monitor at ${port} is already open`);
    this.name = 'PortAlreadyOpenError';
  }
}

export interface SerialMonitorObservableMessage {
  type: string;
  value: SerialMonitorMessage['data'];
  meta?: unknown;
}

const BAUD_RATES = [
  300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200,
] as const;
export const BAUD_RATES_VALUES = [...BAUD_RATES];

export const DEFAULT_BAUD_RATE = 9600;

export type BaudRate = typeof BAUD_RATES[number];

export function isBaudRate(value: number): value is BaudRate {
  return BAUD_RATES.includes(value as BaudRate);
}
