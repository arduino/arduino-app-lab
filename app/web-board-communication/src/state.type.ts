import {
  SerialMonitor,
  UploadStatus,
} from '@cloud-editor-mono/board-communication-tools';
import { State } from '@cloud-editor-mono/common';

import { WebSerialPort } from './ports.type';

export enum WebSerialStateKeys {
  WebSerialConnected = 'webSerialConnected',
  Ports = 'ports',
  UploadStatus = 'uploadStatus',
  SerialMonitors = 'serialMonitors',
  SupportedFqbns = 'supportedFqbns',
}

export interface WebSerialState extends State<WebSerialState> {
  [WebSerialStateKeys.WebSerialConnected]: boolean | null;
  [WebSerialStateKeys.Ports]: WebSerialPort[];
  [WebSerialStateKeys.UploadStatus]?: UploadStatus;
  [WebSerialStateKeys.SerialMonitors]: SerialMonitor[];
  [WebSerialStateKeys.SupportedFqbns]: string[];
}
