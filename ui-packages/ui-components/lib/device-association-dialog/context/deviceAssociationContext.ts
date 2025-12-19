import { createContext } from 'react';

import { DetectedDevicesGroup } from '../content/sub-components/devices-tabs/devicesTabs.type';
import {
  DetectedDevice,
  DeviceAssociationDialogLogic,
  GetDevicesListLogic,
} from '../deviceAssociationDialog.type';

export interface UnknownDeviceIdentifiers {
  id: DetectedDevice['portBoardId'];
  portName: DetectedDevice['portName'];
}

export type DeviceAssociationContextValue = {
  themeClass?: string;
  promptUnknownDevice?: UnknownDeviceIdentifiers;
  uploadPromptData?: { fqbn: string };
  unknownDeviceToIdentify?: UnknownDeviceIdentifiers;
  setUnknownDeviceToIdentify: React.Dispatch<
    React.SetStateAction<UnknownDeviceIdentifiers | undefined>
  >;
  setSelectedTab: (tab: DetectedDevicesGroup) => void;
  selectedTab: DetectedDevicesGroup;
  tabsAreVisible: boolean;
  getDevicesListLogic: GetDevicesListLogic;
} & ReturnType<DeviceAssociationDialogLogic>;

const deviceAssociationContextValue: DeviceAssociationContextValue =
  {} as DeviceAssociationContextValue;

export const DeviceAssociationContext =
  createContext<DeviceAssociationContextValue>(deviceAssociationContextValue);
