import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

import DeviceAssociationDialogBase from './base/DeviceAssociationDialogBase';
import DeviceAssociationDialogContent from './content/DeviceAssociationDialogContent';
import { DeviceAssociationSteps } from './content/steps';
import { DeviceAssociationContext } from './context/deviceAssociationContext';

const DeviceAssociationDialogContainer: React.FC = () => {
  const {
    detectedDevices,
    iotDevicesGroups,
    selectedTab,
    promptUnknownDevice,
    setUnknownDeviceToIdentify,
    initialStep,
  } = useContext(DeviceAssociationContext);

  const [step, setStep] = useState<DeviceAssociationSteps>(
    initialStep || DeviceAssociationSteps.NoneDetected,
  );

  const chooseDetectionStep = useCallback(
    (invokedOnBackAction = false) => {
      setStep((prevStep) => {
        if (
          !invokedOnBackAction &&
          (prevStep === DeviceAssociationSteps.ManualSelection ||
            prevStep === DeviceAssociationSteps.IdentifyUnknown)
        ) {
          return prevStep;
        }

        const devices = !iotDevicesGroups
          ? detectedDevices
          : [...detectedDevices, ...iotDevicesGroups[selectedTab]];

        if (devices.length === 0) {
          return DeviceAssociationSteps.NoneDetected;
        }

        if (devices.length === 1) {
          return DeviceAssociationSteps.UpTo10Detected;
        }

        if (devices.length > 1 && detectedDevices.length < 11) {
          return DeviceAssociationSteps.UpTo10Detected;
        }

        if (devices.length >= 11) {
          return DeviceAssociationSteps.Over10Detected;
        }

        return prevStep;
      });
    },
    [detectedDevices, iotDevicesGroups, selectedTab],
  );

  const onBack = (): void => {
    chooseDetectionStep(true);
  };

  useLayoutEffect(() => {
    if (!initialStep) {
      chooseDetectionStep();
    }
  }, [chooseDetectionStep, initialStep]);

  useEffect(() => {
    if (promptUnknownDevice) {
      setUnknownDeviceToIdentify(promptUnknownDevice);
      setStep(DeviceAssociationSteps.IdentifyUnknown);
    }
  }, [promptUnknownDevice, setUnknownDeviceToIdentify]);

  return (
    <DeviceAssociationDialogBase step={step}>
      <DeviceAssociationDialogContent
        step={step}
        setStep={setStep}
        onBack={onBack}
      />
    </DeviceAssociationDialogBase>
  );
};

export default DeviceAssociationDialogContainer;
