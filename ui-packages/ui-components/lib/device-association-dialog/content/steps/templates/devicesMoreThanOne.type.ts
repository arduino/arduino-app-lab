import {
  DetectedDevices,
  Devices,
  OnSetDetectedBoardAndPort,
  OnSetUndetectedBoard,
} from '../../../deviceAssociationDialog.type';

export enum DevicesListModality {
  Detected = 'detected',
  Undetected = 'undetected',
  Loading = 'loading',
}

export interface DeviceListTypeMap {
  [DevicesListModality.Detected]: {
    devices: DetectedDevices;
    onItemSelect: OnSetDetectedBoardAndPort;
    onManualSelectChosen: () => void;
  };
  [DevicesListModality.Undetected]: {
    devices: Devices;
    onItemSelect: OnSetUndetectedBoard;
  };
  [DevicesListModality.Loading]: {
    devices: [];
  };
}

export interface DeviceListItemTypeMap {
  [DevicesListModality.Detected]: {
    onItemSelect: OnSetDetectedBoardAndPort;
    id: string;
    portName: string;
    isUnknownBoard?: boolean;
  };
  [DevicesListModality.Undetected]: {
    onItemSelect: OnSetUndetectedBoard;
  };
  [DevicesListModality.Loading]: {}; // eslint-disable-line @typescript-eslint/ban-types
}
