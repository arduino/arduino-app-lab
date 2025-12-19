import {
  AiUserPlan,
  ManagedOtaErrors,
  TransmissionTag,
} from '@cloud-editor-mono/infrastructure';
import { IntRange } from 'type-fest';

import { GetCode, GetCodeInstanceId } from '../code-mirror/codeMirror.type';

export enum ConsolePanelStatus {
  IDLE = 'idle',
  VERIFYING = 'verifying',
  UPLOADING = 'uploading',
  SUCCESS = 'success',
  ERROR = 'error',
  IOT_ERROR = 'iotError',
  //Intermediate OTA steps
  PENDING_OTA = 'pendingOta',
  AVAILABLE = 'available',
  START = 'start',
  FETCH = 'fetch',
  FLASH = 'flash',
  REBOOT = 'reboot',
  FAIL = 'fail',
}

export type ConsolePanelLogic = () => {
  getOutputStringInstanceId?: GetCodeInstanceId;
  getOutputString?: GetCode;
  status: ConsolePanelStatus;
  sketchName: string;
  errReason?: ManagedOtaErrors;
  progression?: IntRange<0, 101>;
  errorLines?: number[];
  sendTextMessage: (text: string, tag?: TransmissionTag) => void;
  compileResultMessages?: string;
  canUseGenAi: boolean;
  aiUserPlan?: AiUserPlan;
  genAiMessageUsageExceeded?: boolean;
  genAiMessageLimit?: number;
  upgradePlanLinkEnabled: boolean;
};

export enum OutputStringType {
  Compile = 'compile',
  Upload = 'upload',
  None = 'none',
}

export interface CopyTooltipMessage {
  INITIAL: string;
  COPIED: string;
  ERROR: string;
}

export interface StatusBarMessage {
  VERIFYING: string;
  UPLOADING: string;
  PENDING_OTA: string;
  AVAILABLE: string;
  START: string;
  FETCH: string;
  FLASH: string;
  REBOOT: string;
  FAIL: string;
  VERIFY_SUCCESS: string;
  UPLOAD_SUCCESS: string;
  VERIFY_ERROR: string;
  UPLOAD_ERROR: string;
}
