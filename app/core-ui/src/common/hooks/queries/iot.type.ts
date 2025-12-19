import {
  CompileErrors,
  GetSketchResult,
  UploadIotSketchReady_Result,
} from '@cloud-editor-mono/domain';
import { ManagedOtaErrors } from '@cloud-editor-mono/infrastructure';
import { IotDevicesGroups } from '@cloud-editor-mono/ui-components';
import { QueryObserverResult } from '@tanstack/react-query';
import { IntRange } from 'type-fest';

import { CompleteCommandData } from '../../../cloud-editor/features/main/main.type';
import { ShowThingV1Device_ResponseWithArchAndOriginalName } from './iot';

export type UseIoTSketch = (
  isReadOnly: boolean,
  sketchData?: GetSketchResult,
) => {
  isIotSketch: boolean;
  iotDevicesGroups?: IotDevicesGroups;
  thingDeviceDetails?: ShowThingV1Device_ResponseWithArchAndOriginalName;
  thingDeviceDetailsIsLoading: boolean;
  thingDeviceNotFound: boolean;
  refreshThingDeviceDetails: () => void;
};

export interface IotUploadPayload {
  deviceId: string;
  binaryKey: string;
}

export type Progression = IntRange<0, 101>;
export interface IotUploadOutput {
  stage?: 'precompile' | 'compile' | 'upload';
  stdout?: string;
  preCompileStdout?: string;
  stderr?: string;
  preCompileStderr?: string;
  warnLineStart?: number;
  warnLineEnd?: number;
  compileOutputLineEnd?: number;
  output: string;
  preCompileOutput?: string;
  hasFailed: boolean;
  step?: 'available' | 'start' | 'fetch' | 'flash' | 'reboot' | 'fail';
  otaStatus?: 'pending' | 'in_progress' | 'succeeded' | 'failed' | 'aborted';
  progression?: Progression;
  errorReason?: ManagedOtaErrors;
}

export type UseIotUpload = (
  verboseCompile: boolean,
  thingDeviceDetailsIsLoading: boolean,
  commandParams?: CompleteCommandData & {
    selectedFqbn: string;
  },
  selectedIoTDeviceId?: string,
  thingId?: string,
) => {
  startIotUpload: () => Promise<
    QueryObserverResult<UploadIotSketchReady_Result, unknown>
  >;
  isUploading: boolean;
  uploadHasError: boolean;
  resetUpload: () => void;
  abortPending: () => void;
  resetVerify: (notify?: boolean | undefined) => void;
  isVerifying: boolean;
  isPending: boolean;
  isCreating: boolean;
  output?: IotUploadOutput;
  setOutput: React.Dispatch<React.SetStateAction<IotUploadOutput | undefined>>;
  compileErrors?: CompileErrors;
  shouldCheckForOngoingOta: boolean;
  clearOtaState: () => void;
  compileProgress?: Progression;
  uploadOutputPostCompileLineStart?: number;
  compileResultMessages?: string;
  errorFiles?: string[];
};
