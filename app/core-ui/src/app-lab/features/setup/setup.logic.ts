import { setNetworkMode } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  NetworkCredentials,
  SetupItemId,
  UseBoardConfigurationLogic,
  UseConnectionLost,
  UseLinuxCredentialsLogic,
  UseNetworkLogic,
  UseSetupLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback, useContext, useEffect, useRef } from 'react';

import { useBoardItem } from '../../hooks/useBoardItem';
import { UseBoards } from '../../hooks/useBoards';
import { useIsBoard } from '../../hooks/useIsBoard';
import { useSystemProps } from '../../hooks/useSystemProps';
import { useTerminal } from '../../hooks/useTerminal';
import { BoardConfigurationContext } from '../../providers/board-configuration/boardConfigurationContext';
import { LinuxCredentialsContext } from '../../providers/linux-credentials/linuxCredentialsContext';
import { NetworkContext } from '../../providers/network/networkContext';
import { SetupContext } from '../../providers/setup/setupContext';
import { SystemPropKey } from '../../store/systemProps';
import { createUseArduinoAccountLogic } from '../account/account.logic';

const SETUP_STEPS_ORDER: SetupItemId[] = [
  SetupItemId.BoardConfiguration,
  SetupItemId.NetworkSetup,
  SetupItemId.LinuxCredentials,
];

const createUseBoardConfigurationLogic =
  function (): UseBoardConfigurationLogic {
    return function useBoardConfigurationLogic(): ReturnType<UseBoardConfigurationLogic> {
      return useContext(BoardConfigurationContext);
    };
  };

const createUseLinuxCredentialsLogic = function (): UseLinuxCredentialsLogic {
  return function UseLinuxCredentialsLogic(): ReturnType<UseLinuxCredentialsLogic> {
    return useContext(LinuxCredentialsContext);
  };
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const useConnectionLost: UseConnectionLost = function (
  setupCompleted,
  isConnected,
  onConnectionLost,
) {
  // Always go back to setup after 10 seconds of disconnected state
  function checkConnectionLost(): () => void {
    let t: NodeJS.Timeout | null = null;
    if (setupCompleted && !isConnected) {
      t = setTimeout(() => {
        onConnectionLost?.();
      }, 10_000);
    }

    return () => {
      if (t) clearTimeout(t);
    };
  }

  useEffect(checkConnectionLost, [
    isConnected,
    onConnectionLost,
    setupCompleted,
  ]);
};

export type SetupSteps =
  | 'waiting-selection'
  | 'checking-status'
  | SetupItemId
  | 'done';

export const createUseSetupLogic = function (
  boardsProps: ReturnType<UseBoards>,
): UseSetupLogic {
  return function useSetupLogic(): ReturnType<UseSetupLogic> {
    const {
      networkStepSkipped,
      setNetworkStepSkipped,
      currentStep,
      setCurrentStep,
      networkCredentialsDraft,
      setNetworkCredentialsDraft,
      autoFlowLocked,
      setAutoFlowLocked,
    } = useContext(SetupContext);

    const unlockAutoFlow = useCallback(() => {
      setAutoFlowLocked(false);
    }, [setAutoFlowLocked]);

    const { data: isBoard } = useIsBoard();
    const {
      boards,
      selectedBoard,
      selectBoard,
      autoSelectBoard,
      isAutoSelectingBoard,
      showBoardConnPswPrompt,
      onConnPswCancel,
      onConnPswSubmit,
      isConnectingToBoard,
      connToBoardError,
      connToBoardCompleted,
      setSelectedBoardCheckingStatus,
    } = boardsProps;

    const {
      systemProps,
      getPropsError,
      getPropsLoading,
      upsertProp,
      upsertPropsLoading,
    } = useSystemProps();

    const { onOpenTerminal, terminalError } = useTerminal();
    const { boardItem } = useBoardItem();

    const {
      setBoardNameIsSuccess,
      setKeyboardLayoutIsSuccess,
      hasBoardConfigurationError,
    } = useContext(BoardConfigurationContext);

    const {
      networkStatusChecked,
      isConnected: networkConnected,
      connectRequestIsSuccess: networkConnectRequestIsSuccess,
      selectedNetwork,
      manualNetworkSetup,
      setScanningIsEnabled,
    } = useContext(NetworkContext);

    useEffect(() => {
      setScanningIsEnabled(currentStep === SetupItemId.NetworkSetup);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStep]);

    // If network comes online "outside" setup, consider network setup step "un-skipped"
    useEffect(() => {
      if (networkConnected) {
        setNetworkStepSkipped(false);
      }
    }, [networkConnected, setNetworkStepSkipped]);

    const { setUserPasswordIsSuccess } = useContext(LinuxCredentialsContext);

    useEffect(() => {
      if (connToBoardCompleted) {
        setCurrentStep((prev) => {
          if (prev === 'done') return prev;
          setSelectedBoardCheckingStatus();
          return 'checking-status';
        });
      }
    }, [setSelectedBoardCheckingStatus, connToBoardCompleted, setCurrentStep]);

    const setupChecksDone = networkStatusChecked && !getPropsLoading;
    const setupPropsAreComplete = Boolean(
      setupChecksDone &&
        (networkConnected || networkStepSkipped) &&
        systemProps &&
        systemProps[SystemPropKey.SetupBoardName] &&
        systemProps[SystemPropKey.SetupKeyboard] &&
        systemProps[SystemPropKey.SetupCredentials],
    );

    useEffect(() => {
      if (upsertPropsLoading || !systemProps) {
        return;
      }
      if (setBoardNameIsSuccess && !systemProps[SystemPropKey.SetupBoardName]) {
        upsertProp({ key: SystemPropKey.SetupBoardName, value: 'done' });
      }
      if (
        setKeyboardLayoutIsSuccess &&
        !systemProps[SystemPropKey.SetupKeyboard]
      ) {
        upsertProp({ key: SystemPropKey.SetupKeyboard, value: 'done' });
      }
      if (
        setUserPasswordIsSuccess &&
        !systemProps[SystemPropKey.SetupCredentials]
      ) {
        upsertProp({ key: SystemPropKey.SetupCredentials, value: 'done' });
      }
      if (
        networkConnectRequestIsSuccess &&
        !systemProps[SystemPropKey.SetupNetwork]
      ) {
        // Not currently used but stored for future use
        upsertProp({ key: SystemPropKey.SetupNetwork, value: 'done' });
      }
    }, [
      networkConnectRequestIsSuccess,
      setBoardNameIsSuccess,
      setKeyboardLayoutIsSuccess,
      setUserPasswordIsSuccess,
      systemProps,
      upsertProp,
      upsertPropsLoading,
    ]);

    // !! Redundant with new props store
    const { setupCompleted, setSetupCompleted } = useContext(SetupContext);
    const firstSetupWasCompleted = useRef(setupCompleted);

    const onBackStep = useCallback(() => {
      if (!currentStep || currentStep === 'waiting-selection') return;
      if (currentStep === 'checking-status') return;
      if (currentStep === 'done') return;

      const idx = SETUP_STEPS_ORDER.indexOf(currentStep as SetupItemId);
      if (idx <= 0) return;
      const prev = SETUP_STEPS_ORDER[idx - 1];
      setAutoFlowLocked(true);

      if (currentStep === SetupItemId.LinuxCredentials && networkStepSkipped) {
        setNetworkStepSkipped(false);
      }

      setCurrentStep(prev);
    }, [
      currentStep,
      networkStepSkipped,
      setAutoFlowLocked,
      setCurrentStep,
      setNetworkStepSkipped,
    ]);

    const createUseNetworkLogicWithSkip = function (): UseNetworkLogic {
      return function useNetworkLogic(): ReturnType<UseNetworkLogic> {
        const network = useContext(NetworkContext);

        return {
          ...network,
          draftNetworkCredentials: networkCredentialsDraft,
          setDraftNetworkCredentials: setNetworkCredentialsDraft,

          connectToWifiNetwork: (credentials: NetworkCredentials): void => {
            setAutoFlowLocked(false);
            return network.connectToWifiNetwork(credentials);
          },

          onSkipNetworkSetup: (): void => {
            setAutoFlowLocked(false);
            setNetworkStepSkipped(true);
            setCurrentStep(SetupItemId.LinuxCredentials);
          },
        };
      };
    };

    function watchCurrentStep(): void {
      if (!setupChecksDone) {
        return;
      }
      if (autoFlowLocked) return;
      if (
        getPropsError &&
        networkStatusChecked &&
        !networkConnected &&
        !networkStepSkipped
      ) {
        // If fetching SystemProps fails, skip to network setup and blocking update
        // This can happen is board has an older image
        setCurrentStep(SetupItemId.NetworkSetup);
      }

      if (setupCompleted) {
        return;
      }

      function stepTransition(step: SetupSteps): void {
        if (
          currentStep !== 'checking-status' &&
          !(firstSetupWasCompleted.current && step === SetupItemId.NetworkSetup) // don't slow transition when network reselection is attempted
        ) {
          // Wait for 1 second before transitioning to the next step for visual feedback
          setTimeout(() => {
            setCurrentStep(step);
          }, 1_000);
        } else {
          setCurrentStep(step);
        }
      }

      switch (true) {
        case systemProps &&
          (!systemProps[SystemPropKey.SetupBoardName] ||
            !systemProps[SystemPropKey.SetupKeyboard]):
          stepTransition(SetupItemId.BoardConfiguration);
          break;
        case !setupCompleted &&
          !networkStepSkipped &&
          networkStatusChecked &&
          !networkConnected:
          stepTransition(SetupItemId.NetworkSetup);
          break;
        case systemProps && !systemProps[SystemPropKey.SetupCredentials]:
          stepTransition(SetupItemId.LinuxCredentials);
          break;
        case setupPropsAreComplete:
          setSetupCompleted(true);
          stepTransition('done');
          firstSetupWasCompleted.current = true;
          break;
      }
    }

    useEffect(watchCurrentStep, [
      currentStep,
      getPropsError,
      networkStatusChecked,
      networkConnected,
      networkStepSkipped,
      autoFlowLocked,
      setSetupCompleted,
      setupChecksDone,
      setupPropsAreComplete,
      setupCompleted,
      systemProps,
      setCurrentStep,
    ]);

    const showConfirmButton =
      currentStep !== SetupItemId.ArduinoAccount &&
      (currentStep !== SetupItemId.NetworkSetup ||
        manualNetworkSetup ||
        !!(currentStep === SetupItemId.NetworkSetup && selectedNetwork));

    const showBoardSelectionPage =
      isBoard !== true &&
      (currentStep === 'waiting-selection' ||
        currentStep === 'checking-status');

    const showPostSelectionSetup =
      currentStep !== 'waiting-selection' &&
      currentStep !== 'checking-status' &&
      currentStep !== 'done';

    const isBoardConnectingOrChecking =
      isConnectingToBoard ||
      (connToBoardCompleted && currentStep === 'waiting-selection') || // step is updating to 'checking-status'
      currentStep === 'checking-status';

    const stepIsSkippable =
      (currentStep === SetupItemId.BoardConfiguration &&
        hasBoardConfigurationError) ||
      currentStep === SetupItemId.NetworkSetup ||
      currentStep === SetupItemId.ArduinoAccount;

    const showLoader =
      isAutoSelectingBoard &&
      showBoardSelectionPage &&
      !showBoardConnPswPrompt &&
      !connToBoardError;

    // enable network mode by default if setup is shown, means it's first usage (new board or after flash)
    useEffect(() => {
      if (showPostSelectionSetup) {
        setNetworkMode(true);
      }
    }, [showPostSelectionSetup]);

    return {
      isBoard,
      boards,
      selectedBoard,
      selectBoard,
      autoSelectBoard,
      isAutoSelectingBoard,
      showBoardConnPswPrompt,
      onConnPswCancel,
      onConnPswSubmit,
      isBoardConnectingOrChecking,
      connToBoardError,
      showLoader,
      showBoardSelectionPage,
      showPostSelectionSetup,
      setupCompleted,
      ...(showPostSelectionSetup && {
        currentStep,
        stepIsSkippable,
        onBackStep,
        contentLogicMap: {
          [SetupItemId.BoardConfiguration]: createUseBoardConfigurationLogic(),
          [SetupItemId.NetworkSetup]: createUseNetworkLogicWithSkip(),
          [SetupItemId.LinuxCredentials]: createUseLinuxCredentialsLogic(),
          [SetupItemId.ArduinoAccount]: createUseArduinoAccountLogic(),
        },
      }),
      showConfirmButton,
      boardItem,
      onOpenTerminal,
      terminalError,
      unlockAutoFlow,
    };
  };
};
