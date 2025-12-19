import { UploadToPortPayload } from '@cloud-editor-mono/board-communication-tools';
import { ArduinoBuilderExtrafile } from '@cloud-editor-mono/infrastructure';

import { WebSerialPortName } from './ports.type';

export type UploadToWebSerialPortPayload =
  UploadToPortPayload<WebSerialPortName>;

export interface WebSerialUploadPayload {
  board: string;
  port: WebSerialPortName;
  filename: string;
  extrafiles: ArduinoBuilderExtrafile[];
  vid: number;
  pid: number;
}
