import { useState } from 'react';

import { DetectedDevicesGroup } from '../content/sub-components/devices-tabs/devicesTabs.type';
import { DeviceAssociationDialogLogic } from '../deviceAssociationDialog.type';
import {
  DeviceAssociationContext,
  UnknownDeviceIdentifiers,
} from './deviceAssociationContext';

export interface DeviceAssociationContextProviderProps {
  children?: React.ReactNode;
  childProps: {
    themeClass?: string;
    deviceAssociationDialogLogic: DeviceAssociationDialogLogic;
    promptUnknownDevice?: UnknownDeviceIdentifiers;
    uploadPromptData?: { fqbn: string };
  };
}

const DeviceAssociationContextProvider: React.FC<
  DeviceAssociationContextProviderProps
> = (props: DeviceAssociationContextProviderProps) => {
  const {
    children,
    childProps: {
      themeClass,
      deviceAssociationDialogLogic,
      promptUnknownDevice,
      uploadPromptData,
    },
  } = props;

  const [selectedTab, setSelectedTab] = useState(DetectedDevicesGroup.Online);

  const result = deviceAssociationDialogLogic();

  const [unknownDeviceToIdentify, setUnknownDeviceToIdentify] =
    useState<UnknownDeviceIdentifiers>();

  const tabsAreVisible = Boolean(
    result.iotDevicesGroups &&
      result.iotDevicesGroups[DetectedDevicesGroup.Offline].length > 0,
  );
  return (
    <DeviceAssociationContext.Provider
      value={{
        themeClass,
        promptUnknownDevice,
        uploadPromptData,
        unknownDeviceToIdentify,
        setUnknownDeviceToIdentify,
        selectedTab,
        setSelectedTab,
        tabsAreVisible,
        ...result,
      }}
    >
      {children}
    </DeviceAssociationContext.Provider>
  );
};

export default DeviceAssociationContextProvider;
