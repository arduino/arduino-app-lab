import { Key, useContext, useMemo } from 'react';

import DialogHeader from '../../essential/dialog-header/DialogHeader';
import { useI18n } from '../../i18n/useI18n';
import { DeviceAssociationContext } from '../context/deviceAssociationContext';
import styles from './device-association-dialog-content.module.scss';
import DeviceAssociationContentSwitch from './DeviceAssociationContentSwitch';
import { messages } from './messages';
import { DeviceAssociationSteps } from './steps';
import DevicesTabs from './sub-components/devices-tabs/DevicesTabs';
import { DetectedDevicesGroup } from './sub-components/devices-tabs/devicesTabs.type';

interface DeviceAssociationDialogContentProps {
  step: DeviceAssociationSteps;
  setStep: React.Dispatch<React.SetStateAction<DeviceAssociationSteps>>;
  onBack: () => void;
}

const DeviceAssociationDialogContent: React.FC<
  DeviceAssociationDialogContentProps
> = (props: DeviceAssociationDialogContentProps) => {
  const { step, setStep, onBack } = props;
  const {
    setIsOpen,
    setDetectedBoardAndPort,
    setDetectedUnknownBoard,
    setUndetectedBoard,
    unknownDeviceToIdentify,
    setUnknownDeviceToIdentify,
    uploadPromptData,
    iotDevicesGroups,
    selectedTab,
    setSelectedTab,
  } = useContext(DeviceAssociationContext);

  const { formatMessage } = useI18n();

  const onClose = (): void => {
    setStep(DeviceAssociationSteps.NoneDetected);
    setIsOpen(false);
  };

  const onSetDetectedBoardAndPort = (
    id: string,
    portName?: string,
    isUnknownBoard?: boolean,
    isIot?: boolean,
  ): void => {
    if (isUnknownBoard && portName) {
      setUnknownDeviceToIdentify({ id, portName });
      setStep(DeviceAssociationSteps.IdentifyUnknown);
      return;
    }

    setUnknownDeviceToIdentify(undefined);
    setDetectedBoardAndPort(id, isIot);
    onClose();
  };

  const onSetDetectedUnknownBoard = (
    fqbn: string,
    name: string,
    architecture: string,
  ): void => {
    if (unknownDeviceToIdentify) {
      setDetectedUnknownBoard(
        unknownDeviceToIdentify.id,
        fqbn,
        name,
        architecture,
        unknownDeviceToIdentify.portName,
      );
    }

    onClose();
  };

  const onSetUndetectedBoard = (
    fqbn: string,
    name: string,
    architecture: string,
  ): void => {
    setUnknownDeviceToIdentify(undefined);
    setUndetectedBoard(fqbn, name, architecture);
    onClose();
  };

  const devicesTabsItems = useMemo(() => {
    if (iotDevicesGroups && iotDevicesGroups.offline.length > 0) {
      return [
        {
          id: DetectedDevicesGroup.Online,
          label: messages.DetectedDevicesGroupLabel,
        },
        {
          id: DetectedDevicesGroup.Offline,
          label: messages.offlineDevicesTabLabel,
        },
      ];
    }

    return [];
  }, [iotDevicesGroups]);

  return (
    <div className={styles.container}>
      <DialogHeader
        title={
          step === DeviceAssociationSteps.IdentifyUnknown
            ? formatMessage(messages.titleIdentifyUnknown)
            : uploadPromptData
            ? formatMessage(messages.uploadPromptTitle)
            : formatMessage(messages.title)
        }
        onClickClose={onClose}
        onClickBack={onBack}
        includeBack={
          step === DeviceAssociationSteps.ManualSelection ||
          step === DeviceAssociationSteps.IdentifyUnknown
        }
        classes={{
          closeButton: styles['close-button'],
          backButton: styles['back-button'],
          header: styles.header,
        }}
      />
      {devicesTabsItems.length > 0 &&
      step !== DeviceAssociationSteps.ManualSelection &&
      step !== DeviceAssociationSteps.IdentifyUnknown &&
      step !== DeviceAssociationSteps.OneDetected ? (
        <DevicesTabs
          defaultTab={DetectedDevicesGroup.Online}
          tabs={devicesTabsItems}
          selectTab={setSelectedTab as (id: Key) => void}
          selectedTab={selectedTab}
        >
          <DeviceAssociationContentSwitch
            step={step}
            setStep={setStep}
            onSetDetectedBoardAndPort={onSetDetectedBoardAndPort}
            onSetDetectedUnknownBoard={onSetDetectedUnknownBoard}
            onSetUndetectedBoard={onSetUndetectedBoard}
          />
        </DevicesTabs>
      ) : (
        <DeviceAssociationContentSwitch
          step={step}
          setStep={setStep}
          onSetDetectedBoardAndPort={onSetDetectedBoardAndPort}
          onSetDetectedUnknownBoard={onSetDetectedUnknownBoard}
          onSetUndetectedBoard={onSetUndetectedBoard}
        />
      )}
    </div>
  );
};

export default DeviceAssociationDialogContent;
