import { DetectedDevicesGroup } from '../device-association-dialog';
import { ModalLogic } from '../essential/dialog';
import { DeviceAssociationSteps } from './content/steps';

export interface DetectedDevice {
  id?: string;
  portBoardId: string;
  fqbn?: string;
  name?: string;
  architecture?: string;
  portName: string;
  serialNumber: string;
  isUnknownBoard?: boolean;
  isAssociated: boolean;
  isIot?: boolean;
  originalName?: string;
  webSerialSupport?: boolean;
  otaCompatible?: boolean;
}

export type DetectedDevices = DetectedDevice[];

export type Device = {
  id: string;
  isAssociated: boolean;
  fqbn: string;
  name: string;
  architecture: string;
  webSerialSupport?: boolean;
};

export type Devices = Device[];

export type SetDetectedBoardAndPort = (
  portBoardId: string,
  isIot?: boolean,
) => void;

export type OnSetDetectedBoardAndPort = (
  id: string,
  portName?: string,
  isUnknownBoard?: boolean,
  isIot?: boolean,
) => void;

export type SetDetectedUnknownBoard = (
  id: string,
  fqbn: string,
  name: string,
  architecture: string,
  portName: string,
) => void;

export type OnSetDetectedUnknownBoard = (
  fqbn: string,
  name: string,
  architecture: string,
) => void;

export type SetUndetectedBoard = (
  fqbn: string,
  name: string,
  architecture: string,
) => void;

export type OnSetUndetectedBoard = (
  fqbn: string,
  name: string,
  architecture: string,
) => void;

export enum DeviceAssociationDialogLinks {
  TroubleshootingAgent,
  TroubleShootingDevices,
}

export type DeviceAssociationDialogLinkDictionary = {
  [K in DeviceAssociationDialogLinks]: string;
};

export type IotDevicesGroups = {
  [K in DetectedDevicesGroup]: DetectedDevices;
};

export type GetDevicesListLogic = () => {
  devices: Devices;
  devicesAreLoading: boolean;
};

export type DeviceAssociationDialogLogic = () => ReturnType<ModalLogic> & {
  detectedDevices: DetectedDevices;
  iotDevicesGroups?: IotDevicesGroups;
  setDetectedBoardAndPort: SetDetectedBoardAndPort;
  setDetectedUnknownBoard: SetDetectedUnknownBoard;
  setUndetectedBoard: SetUndetectedBoard;
  portIsSelected: boolean;
  boardsConfigIsUnknown: boolean;
  agentIsNotDetected: boolean;
  canDownloadAgent: boolean;
  onClickDownloadAgent: () => void;
  links: DeviceAssociationDialogLinkDictionary;
  initialStep?: DeviceAssociationSteps;
  getDevicesListLogic: GetDevicesListLogic;
  usingWebSerial: boolean;
};
