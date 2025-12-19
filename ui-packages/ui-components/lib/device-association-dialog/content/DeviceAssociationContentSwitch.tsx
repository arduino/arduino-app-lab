import {
  OnSetDetectedBoardAndPort,
  OnSetDetectedUnknownBoard,
  OnSetUndetectedBoard,
} from '../deviceAssociationDialog.type';
import { messages } from './messages';
import {
  DetectedNone,
  DetectedOne,
  DetectedUpTo10,
  DeviceAssociationSteps,
} from './steps';
import DetectedOver10 from './steps/DetectedOver10';
import IdentifyUnknown from './steps/IdentifyUnknown';
import ManualSelection from './steps/ManualSelection';

interface DeviceAssociationContentSwitchProps {
  step: DeviceAssociationSteps;
  setStep: React.Dispatch<React.SetStateAction<DeviceAssociationSteps>>;
  onSetDetectedBoardAndPort: OnSetDetectedBoardAndPort;
  onSetDetectedUnknownBoard: OnSetDetectedUnknownBoard;
  onSetUndetectedBoard: OnSetUndetectedBoard;
}

const DeviceAssociationContentSwitch: React.FC<
  DeviceAssociationContentSwitchProps
> = (props: DeviceAssociationContentSwitchProps) => {
  const {
    step,
    setStep,
    onSetDetectedBoardAndPort,
    onSetDetectedUnknownBoard,
    onSetUndetectedBoard,
  } = props;

  const onManualSelectChosen = (): void =>
    setStep(DeviceAssociationSteps.ManualSelection);

  if (step === DeviceAssociationSteps.NoneDetected) {
    return <DetectedNone onManualSelectChosen={onManualSelectChosen} />;
  }

  if (step === DeviceAssociationSteps.OneDetected) {
    return (
      <DetectedOne
        onAssociate={onSetDetectedBoardAndPort}
        onManualSelectChosen={onManualSelectChosen}
      />
    );
  }

  if (step === DeviceAssociationSteps.UpTo10Detected) {
    return (
      <DetectedUpTo10
        onManualSelectChosen={onManualSelectChosen}
        onItemSelect={onSetDetectedBoardAndPort}
      />
    );
  }

  if (step === DeviceAssociationSteps.Over10Detected) {
    return (
      <DetectedOver10
        onManualSelectChosen={onManualSelectChosen}
        onItemSelect={onSetDetectedBoardAndPort}
      />
    );
  }

  if (step === DeviceAssociationSteps.ManualSelection) {
    return (
      <ManualSelection
        onItemSelect={onSetUndetectedBoard}
        description={messages.associateToSketchHelper}
        markAssociated
      />
    );
  }

  if (step === DeviceAssociationSteps.ChromeOSManualSelection) {
    return (
      <ManualSelection
        onItemSelect={onSetUndetectedBoard}
        description={messages.selectForUploadHelper}
        markAssociated
        noPrompt
        usingWebSerial
      />
    );
  }

  if (step === DeviceAssociationSteps.IdentifyUnknown) {
    return <IdentifyUnknown onItemSelect={onSetDetectedUnknownBoard} />;
  }

  return <></>;
};

export default DeviceAssociationContentSwitch;
