import {
  NetworkCredentials,
  SetupItemId,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { Dispatch, SetStateAction, useState } from 'react';

export type SetupSteps =
  | 'waiting-selection'
  | 'checking-status'
  | SetupItemId
  | 'done';

export type UseSetup = () => {
  setupCompleted: boolean;
  setSetupCompleted: (completed: boolean) => void;
  networkStepSkipped: boolean;
  setNetworkStepSkipped: (skipped: boolean) => void;
  currentStep: SetupSteps;
  setCurrentStep: Dispatch<SetStateAction<SetupSteps>>;
  networkCredentialsDraft?: NetworkCredentials;
  setNetworkCredentialsDraft: (credentials?: NetworkCredentials) => void;
  autoFlowLocked: boolean;
  setAutoFlowLocked: (locked: boolean) => void;
};

export const useSetup: UseSetup = function (): ReturnType<UseSetup> {
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [networkStepSkipped, setNetworkStepSkipped] = useState(false);
  const [currentStep, setCurrentStep] =
    useState<SetupSteps>('waiting-selection');
  const [networkCredentialsDraft, setNetworkCredentialsDraft] =
    useState<NetworkCredentials>();
  const [autoFlowLocked, setAutoFlowLocked] = useState(false);

  return {
    setupCompleted,
    setSetupCompleted,
    networkStepSkipped,
    setNetworkStepSkipped,
    currentStep,
    setCurrentStep,
    networkCredentialsDraft,
    setNetworkCredentialsDraft,
    autoFlowLocked,
    setAutoFlowLocked,
  };
};
