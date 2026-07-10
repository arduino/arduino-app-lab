import {
  boardNeedsImageUpdate,
  boardNeedsOSUpdate,
  getApps,
  openLinkExternal,
  reloadApp,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AppLabWelcomeDialogLogic,
  BoardUpdateDialogLogic,
  FlashBoardDialogLogic,
  OfflineWarningDialogLogic,
  SidePanelItemId,
  SidePanelItemInterface,
  sidePanelItems,
  SidePanelLogic,
  SidePanelSectionId,
  snackbar,
  Themes,
  UpdaterStatus,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from '@tanstack/react-router';
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useShallow } from 'zustand/react/shallow';

import { ThemeContext } from '../../../common/providers/theme/themeContext';
import { useBoards } from '../../hooks/useBoards';
import { useCurrentSection } from '../../hooks/useCurrentSection';
import { useIsBoard } from '../../hooks/useIsBoard';
import { useReloadApp } from '../../hooks/useReloadApp';
import { AuthContext } from '../../providers/auth/authContext';
import { NetworkContext } from '../../providers/network/networkContext';
import { SetupContext } from '../../providers/setup/setupContext';
import { UpdaterContext } from '../../providers/updater/updaterContext';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { useSystemPropsStore } from '../../store/systemProps';
import { UseMainLogic } from './main.type';

const FLASHER_TOOL_URL = 'https://www.arduino.cc/en/software/#flasher-tool';
const ARDUINO_SUPPORT_URL = 'https://www.arduino.cc/en/contact-us/';
const FLASHER_TUTORIAL_URL =
  'https://docs.arduino.cc/tutorials/BOARD_TYPE/update-image/';

const ROUTES_WITHOUT_SIDE_PANEL = ['/settings'];

export const useMainLogic: UseMainLogic =
  function (): ReturnType<UseMainLogic> {
    const useSidePanelLogic = (): ReturnType<SidePanelLogic> => {
      const { pathname } = useLocation();

      const isVisible =
        pathname.split('/').length <= 2 &&
        !ROUTES_WITHOUT_SIDE_PANEL.includes(pathname);

      const { user } = useContext(AuthContext);

      const activeItem = pathname
        .split('/')
        .filter((it) => it.length > 0)
        .shift();

      const { items: sidePanelItemsBySection } = useMemo(
        () =>
          sidePanelItems.reduce(
            (acc, item) => {
              const { sectionId, enabled } = item;

              if (!sectionId || !enabled) {
                return acc;
              }
              const currentItem = { ...item };

              currentItem.active = activeItem === item.id;

              if (!acc.items[sectionId]) {
                acc.items[sectionId] = [];
              }

              if (currentItem.id === SidePanelItemId.Account && user) {
                currentItem.Icon = user.picture;
              }

              acc.items[sectionId].push(currentItem);
              return acc;
            },
            {
              items: {} as Record<SidePanelSectionId, SidePanelItemInterface[]>,
            },
          ),
        [activeItem, user],
      );

      return {
        sidePanelItemsBySection,
        activeItem,
        user,
        visible: isVisible,
      };
    };
    const sidePanelLogic = useCallback(useSidePanelLogic, []);

    const useBoardUpdateDialogLogic =
      (): ReturnType<BoardUpdateDialogLogic> => {
        const [open, setOpen] = useState(false);

        const { setSetupCompleted, setNetworkStepSkipped } =
          useContext(SetupContext);

        const {
          status,
          canStartUpdate,
          boardUpdates,
          boardLogs,
          newAppVersion,
          releaseNotes,
          checkForUpdates,
          startUpdate,
          skipUpdate: updaterSkipUpdate,
          boardUpdateSucceeded,
          appUpdateSucceeded,
          bypassSkipUpdate,
          setStatus: setUpdaterStatus,
          setBoardLogs: setBoardUpdaterLogs,
        } = useContext(UpdaterContext);

        const {
          disconnectFromNetwork,
          setSelectedNetwork,
          setManualNetworkSetup,
        } = useContext(NetworkContext);

        const changeNetwork = useCallback(async (): Promise<void> => {
          try {
            await disconnectFromNetwork();
          } catch (e) {
            console.error(`Failed to disconnect from network: ${e}`);
            snackbar({
              message: 'Failed to disconnect current network. Update skipped.',
              variant: 'error',
            });
          } finally {
            setUpdaterStatus(UpdaterStatus.None);
            setBoardUpdaterLogs([]);
            setOpen(false);

            setSetupCompleted(false);

            setNetworkStepSkipped(false);
            setSelectedNetwork(undefined);
            setManualNetworkSetup(false);
          }
        }, [
          disconnectFromNetwork,
          setUpdaterStatus,
          setBoardUpdaterLogs,
          setSetupCompleted,
          setNetworkStepSkipped,
          setSelectedNetwork,
          setManualNetworkSetup,
        ]);

        const { data: isBoard } = useIsBoard();

        const { getPropsError, getPropsSuccess, isSetupDone } =
          useSystemPropsStore(
            useShallow((state) => ({
              getPropsError: state.isError,
              getPropsSuccess: state.isSuccess,
              isSetupDone: state.isSetupDone,
            })),
          );

        const isCheckUpdateBlocking =
          getPropsError || (getPropsSuccess && !isSetupDone());

        useLayoutEffect(() => {
          if (
            status === UpdaterStatus.None ||
            status === UpdaterStatus.Skipped ||
            status === UpdaterStatus.AlreadyUpToDate ||
            (status === UpdaterStatus.Checking && !isCheckUpdateBlocking)
          ) {
            setOpen(false);
          } else {
            setOpen(true);
          }
        }, [isCheckUpdateBlocking, status]);

        const { networkStepSkipped, setupCompleted } = useContext(SetupContext);
        useEffect(() => {
          if (
            canStartUpdate &&
            status === UpdaterStatus.None &&
            !networkStepSkipped &&
            setupCompleted
          ) {
            checkForUpdates();
          }
        }, [
          canStartUpdate,
          checkForUpdates,
          networkStepSkipped,
          setupCompleted,
          status,
        ]);

        const openFlasherTool = async (): Promise<void> => {
          openLinkExternal(FLASHER_TOOL_URL);
        };

        const openArduinoSupport = async (): Promise<void> => {
          openLinkExternal(ARDUINO_SUPPORT_URL);
        };

        const skipUpdate = useCallback((): void => {
          updaterSkipUpdate();
          setOpen(false);
        }, [updaterSkipUpdate]);

        const selectedConnectedBoard = useBoardLifecycleStore(
          (state) => state.selectedConnectedBoard,
        );

        return {
          board: selectedConnectedBoard,
          open,
          isBoard,
          status,
          boardUpdates,
          boardLogs,
          newAppVersion,
          releaseNotes,
          startUpdate,
          reloadApp,
          openFlasherTool,
          openArduinoSupport,
          skipUpdate,
          changeNetwork,
          boardUpdateSucceeded,
          appUpdateSucceeded,
          bypassSkipUpdate,
        };
      };

    const boardUpdateDialogLogic = useCallback(useBoardUpdateDialogLogic, []);

    const useFlashBoardDialogLogic = (): ReturnType<FlashBoardDialogLogic> => {
      const [open, setOpen] = useState(false);

      const { data: isBoard } = useIsBoard();

      const { selectedConnectedBoard, boardIsFlashing, setBoardIsFlashing } =
        useBoardLifecycleStore(
          useShallow((state) => ({
            selectedConnectedBoard: state.selectedConnectedBoard,
            boardIsFlashing: state.boardIsFlashing,
            setBoardIsFlashing: state.setBoardIsFlashing,
          })),
        );

      useEffect(() => {
        const setNeedsOSUpdateAsync = async (): Promise<void> => {
          const isR0Build = await boardNeedsImageUpdate();
          if (!isR0Build) return;

          const needsUpdate = await boardNeedsOSUpdate();
          setOpen(needsUpdate);
        };

        if (
          isBoard === false &&
          selectedConnectedBoard &&
          boardIsFlashing === undefined
        ) {
          setNeedsOSUpdateAsync();
        }
      }, [selectedConnectedBoard, boardIsFlashing, isBoard]);

      return {
        open,
        onOpenChange: setOpen,
        confirmAction: (): void => {
          setBoardIsFlashing(true);
        },
        openFlasherTutorial: (): void => {
          openLinkExternal(
            FLASHER_TUTORIAL_URL.replace(
              'BOARD_TYPE',
              selectedConnectedBoard?.type.toLowerCase().replaceAll(' ', '-') ||
                '',
            ),
          );
        },
      };
    };

    const flashBoardDialogLogic = useCallback(useFlashBoardDialogLogic, []);

    const useAppLabWelcomeDialogLogic =
      (): ReturnType<AppLabWelcomeDialogLogic> => {
        const [open, setOpen] = useState(false);

        const { setupCompleted } = useContext(SetupContext);
        const { dismissWelcomePage, isWelcomePageDismissed } =
          useContext(AuthContext);

        useEffect(() => {
          if (setupCompleted && !isWelcomePageDismissed && !open) {
            setOpen(true);
          }
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [setupCompleted, isWelcomePageDismissed]);

        const onConfirm = (): void => {
          setOpen(false);
          dismissWelcomePage();
        };

        return {
          open,
          onOpenChange: setOpen,
          onConfirm,
        };
      };

    const appLabWelcomeDialogLogic = useCallback(
      useAppLabWelcomeDialogLogic,
      [],
    );

    const useNetworkSettingsDialogLogic = () => {
      const [open, setOpen] = useState(false);
      const networkContext = useContext(NetworkContext);

      useEffect(() => {
        networkContext.setManualNetworkSetup(false);
        networkContext.setSelectedNetwork(undefined);
        networkContext.setScanningIsEnabled(open);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [open]);

      useEffect(() => {
        if (networkContext.connectRequestIsSuccess) {
          setOpen(false);
        }
      }, [networkContext.connectRequestIsSuccess]);

      return {
        ...networkContext,
        open,
        onOpenChange: setOpen,
      };
    };

    const useOfflineWarningDialogLogic = (
      openNetworkSettings: () => void,
    ): OfflineWarningDialogLogic => {
      const [open, setOpen] = useState(false);
      const [wasClosedByUser, setWasClosedByUser] = useState(false);
      const { networkStatusChecked, isConnected, isScanning, isConnecting } =
        useContext(NetworkContext);
      const {
        setupCompleted,
        networkStepSkipped,
        setOfflineWarningOpen,
        offlineWarningOpen,
      } = useContext(SetupContext);
      const { boardIsReachable } = useBoardLifecycleStore(
        useShallow((state) => ({
          boardIsReachable: state.boardIsReachable,
        })),
      );

      // Check if user has already made a choice about offline warning (reset on app restart if not connected)
      const [offlineWarningChoiceMade, setOfflineWarningChoiceMade] =
        useState(offlineWarningOpen);

      // Show dialog when there's a connected board, network is determined to be offline, and no scanning/connection operations
      useEffect(() => {
        const isNetworkOperationInProgress = isScanning || isConnecting;

        // Don't show modal if any blocking condition is met
        if (!setupCompleted || networkStepSkipped || offlineWarningChoiceMade) {
          setOpen(false);
          return;
        }

        if (
          boardIsReachable &&
          networkStatusChecked &&
          !isConnected &&
          !isNetworkOperationInProgress &&
          !wasClosedByUser
        ) {
          const timeoutId = setTimeout(() => {
            setOpen(true);
            setOfflineWarningOpen(true);
          }, 10000); // Wait 10 seconds for WiFi automatic connection

          return () => clearTimeout(timeoutId);
        } else if (isConnected) {
          setOpen(false);
          setWasClosedByUser(false);
          setOfflineWarningOpen(false);
        } else if (!boardIsReachable || isNetworkOperationInProgress) {
          setOpen(false);
          setWasClosedByUser(false);
          setOfflineWarningOpen(false);
          setOfflineWarningChoiceMade(false);
        }
      }, [
        boardIsReachable,
        networkStatusChecked,
        isConnected,
        isScanning,
        isConnecting,
        wasClosedByUser,
        setOfflineWarningOpen,
      ]);

      const onContinue = useCallback(() => {
        setOpen(false);
        setWasClosedByUser(true);
        setOfflineWarningOpen(false);
        setOfflineWarningChoiceMade(true);
      }, [setOfflineWarningOpen]);

      const onNetworkSettings = useCallback(() => {
        setOpen(false);
        setWasClosedByUser(true);
        setOfflineWarningOpen(false);
        setOfflineWarningChoiceMade(true);
        openNetworkSettings();
      }, [setOfflineWarningOpen, openNetworkSettings]);

      const handleOnOpenChange = useCallback(
        (isOpen: boolean) => {
          // If user is closing the modal (not opening it), save their choice
          if (!isOpen && open) {
            setOfflineWarningChoiceMade(true);
            setWasClosedByUser(true);
            setOfflineWarningOpen(false);
          }
          setOpen(isOpen);
        },
        [open, setOfflineWarningOpen],
      );

      return {
        open,
        onOpenChange: handleOnOpenChange,
        onContinue,
        onNetworkSettings,
      };
    };

    const networkSettingsDialogLogic = useNetworkSettingsDialogLogic();

    const offlineWarningDialogLogic = useOfflineWarningDialogLogic(() =>
      networkSettingsDialogLogic.onOpenChange(true),
    );

    const boardsProps = useBoards();

    // get app params to undestand if we are in details or not
    const params = useParams({ strict: false });
    const currentAppId = params.appId || params.resourceId;

    // determine section using dedicated hook
    const currentSection = useCurrentSection();

    const { boardIsFlashing, boardIsReachable } = useBoardLifecycleStore(
      useShallow((state) => ({
        boardIsFlashing: state.boardIsFlashing,
        boardIsReachable: state.boardIsReachable,
      })),
    );

    const { data: apps } = useQuery(
      ['check-apps-to-redirect'],
      () => {
        return getApps({
          query: { filter: 'apps' },
        });
      },
      {
        enabled: boardIsReachable,
      },
    );

    const { setupCompleted } = useContext(SetupContext);

    const showRoutes = setupCompleted && boardIsReachable;

    // Use reload app hook for persistence
    useReloadApp({
      boardsProps,
      showRoutes,
      currentAppId,
      apps,
      currentSection,
      lastAppInfoLoaded: boardsProps.lastAppInfoLoaded,
    });

    const { setTheme } = useContext(ThemeContext);
    useEffect(() => {
      setTheme(Themes.DarkTheme);
    }, [setTheme]);

    return {
      sidePanelLogic,
      boardUpdateDialogLogic,
      flashBoardDialogLogic,
      appLabWelcomeDialogLogic,
      offlineWarningDialogLogic,
      networkSettingsDialogLogic,
      boardsProps,
      boardIsFlashing,
      showRoutes,
    };
  };
