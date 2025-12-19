import { useContext, useMemo } from 'react';

import { useI18n } from '../../../i18n/useI18n';
import { DeviceAssociationContext } from '../../context/deviceAssociationContext';
import { OnSetDetectedBoardAndPort } from '../../deviceAssociationDialog.type';
import { messages } from '../messages';
import { DetectedDevicesGroup } from '../sub-components/devices-tabs/devicesTabs.type';
import DevicesMoreThanOne from './templates/DevicesMoreThanOne';
import { DevicesListModality } from './templates/devicesMoreThanOne.type';

interface DetectedOver10Props {
  onManualSelectChosen: () => void;
  onItemSelect: OnSetDetectedBoardAndPort;
}

const DetectedOver10: React.FC<DetectedOver10Props> = (
  props: DetectedOver10Props,
) => {
  const { onManualSelectChosen, onItemSelect } = props;
  const { detectedDevices, iotDevicesGroups, selectedTab, tabsAreVisible } =
    useContext(DeviceAssociationContext);
  const { formatMessage } = useI18n();

  const devices = useMemo(() => {
    if (iotDevicesGroups && iotDevicesGroups[selectedTab].length > 0) {
      return selectedTab === DetectedDevicesGroup.Offline
        ? iotDevicesGroups[selectedTab]
        : [...detectedDevices, ...iotDevicesGroups[selectedTab]];
    }

    return detectedDevices;
  }, [detectedDevices, iotDevicesGroups, selectedTab]);

  return (
    <DevicesMoreThanOne
      devices={devices}
      deviceListModality={DevicesListModality.Detected}
      onManualSelectChosen={onManualSelectChosen}
      searchable={true}
      listHelper={
        tabsAreVisible
          ? undefined
          : formatMessage(messages.detectedDeviceListHelper)
      }
      onItemSelect={onItemSelect}
    />
  );
};

export default DetectedOver10;
