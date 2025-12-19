import { ShowDeviceV2_Response } from '@cloud-editor-mono/infrastructure';
import { DetectedDevicesGroup } from '@cloud-editor-mono/ui-components';

export type GetIotCloudDevices_Result = {
  [K in DetectedDevicesGroup]: ShowDeviceV2_Response[];
};

export enum UploadIotSketchNotReadyError {
  UpdateRequired = 'UPDATE_REQUIRED',
  WrongDevice = 'WRONG_DEVICE',
  OTAUnavailable = 'OTA_UNAVAILABLE',
  OTAIncompatible = 'OTA_INCOMPATIBLE',
}

export type UploadIotSketchReady_Result =
  | { value: true }
  | { value: false; reason: UploadIotSketchNotReadyError };

export type UploadIotSketch_Result = boolean;
