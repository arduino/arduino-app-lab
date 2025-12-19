import {
  AppLabSetupItemId,
  UseBoardConfigurationLogic,
  UseConnectionLost,
  UseLinuxCredentialsLogic,
  UseNetworkLogic,
  UseSetupLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useContext, useEffect, useRef, useState } from 'react';

import { useIsBoard } from '../../hooks/board';
import { BoardConfigurationContext } from '../../providers/board-configuration/boardConfigurationContext';
import { LinuxCredentialsContext } from '../../providers/linux-credentials/linuxCredentialsContext';
import { NetworkContext } from '../../providers/network/networkContext';
import { SetupContext } from '../../providers/setup/setupContext';
import { useBoards } from '../../store/boards/boards';
import { SystemPropKey, useSystemProps } from '../../store/systemProps';
import { useFooterBarLogic } from '../footer-bar/footerBar.logic';

const createUseBoardConfigurationLogic =
  function (): UseBoardConfigurationLogic {
    return function useBoardConfigurationLogic(): ReturnType<UseBoardConfigurationLogic> {
      return useContext(BoardConfigurationContext);
    };
  };

const createUseNetworkLogic = function (): UseNetworkLogic {
  return function useNetworkLogic(): ReturnType<UseNetworkLogic> {
    return useContext(NetworkContext);
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

type SetupSteps =
  | 'waiting-selection'
  | 'checking-status'
  | AppLabSetupItemId
  | 'done';

export const createUseSetupLogic = function (): UseSetupLogic {
  return function useSetupLogic(): ReturnType<UseSetupLogic> {
    const [currentStep, setCurrentStep] =
      useState<SetupSteps>('waiting-selection');

    const { data: isBoard } = useIsBoard();
    const {
      boards,
      selectBoard,
      showBoardConnPswPrompt,
      onConnPswCancel,
      onConnPswSubmit,
      isConnectingToBoard,
      connToBoardError,
      connToBoardCompleted,
      setSelectedBoardCheckingStatus,
    } = useBoards();

    const {
      systemProps,
      getPropsError,
      getPropsLoading,
      upsertProp,
      upsertPropsLoading,
    } = useSystemProps();

    const { items, onOpenTerminal, terminalError } = useFooterBarLogic();
    const boardItem = items.find((item) => item.id === 'board');

    const {
      setBoardNameIsSuccess,
      setKeyboardLayoutIsSuccess,
      setBoardConfigurationIsSuccess,
      hasBoardConfigurationError,
    } = useContext(BoardConfigurationContext);
    const {
      networkStatusChecked,
      isConnected: networkConnected,
      connectRequestIsSuccess: networkConnectRequestIsSuccess,
      selectedNetwork,
      manualNetworkSetup,
    } = useContext(NetworkContext);
    const { setUserPasswordIsSuccess } = useContext(LinuxCredentialsContext);

    useEffect(() => {
      if (connToBoardCompleted) {
        setSelectedBoardCheckingStatus();
        setCurrentStep('checking-status');
      }
    }, [setSelectedBoardCheckingStatus, connToBoardCompleted]);

    const setupChecksDone = networkStatusChecked && !getPropsLoading;
    const setupPropsAreComplete = Boolean(
      setupChecksDone &&
        networkConnected &&
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
      setBoardConfigurationIsSuccess,
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

    function watchCurrentStep(): void {
      if (!setupChecksDone) {
        return;
      }

      if (getPropsError && networkStatusChecked && !networkConnected) {
        // If fetching SystemProps fails, skip to network setup and blocking update
        // This can happen is board has an older image
        setCurrentStep(AppLabSetupItemId.NetworkSetup);
      }

      if (setupCompleted) {
        return;
      }

      function stepTransition(step: SetupSteps): void {
        if (
          currentStep !== 'checking-status' &&
          !(
            firstSetupWasCompleted.current &&
            step === AppLabSetupItemId.NetworkSetup
          ) // don't slow transition when network reselection is attempted
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
          stepTransition(AppLabSetupItemId.BoardConfiguration);
          break;
        case !setupCompleted && networkStatusChecked && !networkConnected:
          stepTransition(AppLabSetupItemId.NetworkSetup);
          break;
        case systemProps && !systemProps[SystemPropKey.SetupCredentials]:
          stepTransition(AppLabSetupItemId.LinuxCredentials);
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
      setSetupCompleted,
      setupChecksDone,
      setupPropsAreComplete,
      setupCompleted,
      systemProps,
    ]);

    const showConfirmButton =
      currentStep !== AppLabSetupItemId.NetworkSetup ||
      manualNetworkSetup ||
      !!(currentStep === AppLabSetupItemId.NetworkSetup && selectedNetwork);

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
      currentStep === AppLabSetupItemId.BoardConfiguration &&
      hasBoardConfigurationError;

    return {
      isBoard,
      boards,
      selectBoard,
      showBoardConnPswPrompt,
      onConnPswCancel,
      onConnPswSubmit,
      isBoardConnectingOrChecking,
      connToBoardError,
      showBoardSelectionPage,
      showPostSelectionSetup,
      ...(showPostSelectionSetup && {
        currentStep,
        stepIsSkippable,
        contentLogicMap: {
          [AppLabSetupItemId.BoardConfiguration]:
            createUseBoardConfigurationLogic(),
          [AppLabSetupItemId.NetworkSetup]: createUseNetworkLogic(),
          [AppLabSetupItemId.LinuxCredentials]:
            createUseLinuxCredentialsLogic(),
        },
      }),
      showConfirmButton,
      boardItem,
      onOpenTerminal,
      terminalError,
    };
  };
};
