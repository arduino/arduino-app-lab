import { UploadToPortPayload } from '@cloud-editor-mono/board-communication-tools';
import { ArduinoBuilderExtrafile } from '@cloud-editor-mono/infrastructure';

export enum AgentUploadStatus {
  Starting = 'Starting',
  Busy = 'Busy',
  Error = 'Error',
  Killed = 'Killed',
  NotFound = 'Error 404 Not Found',
  Done = 'Done',
}

export interface UploadStatusResponse {
  status: AgentUploadStatus;
  message?: string;
  flash?: string;
}

export type UploadToAgentPortPayload = UploadToPortPayload<string>;

export interface httpUploadMsgPayload {
  board: string;
  port: string;
  commandline: string;
  filename: string;
  hex: string;
}

export interface HttpUploadPayload {
  board: string;
  port: string;
  filename: string;
  hex: string;
  signature: string;
  commandline: string;
  extra: { [key: string]: any };
  extrafiles: ArduinoBuilderExtrafile[];
}
