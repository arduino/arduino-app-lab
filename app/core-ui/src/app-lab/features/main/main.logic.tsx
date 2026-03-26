import {
  boardNeedsImageUpdate,
  boardNeedsOSUpdate,
  openLinkExternal,
  reloadApp,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AppLabWelcomeDialogLogic,
  BoardUpdateDialogLogic,
  FlashBoardDialogLogic,
  SidePanelItemId,
  SidePanelItemInterface,
  sidePanelItems,
  SidePanelLogic,
  SidePanelSectionId,
  snackbar,
  Themes,
  UpdaterStatus,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useLocation } from '@tanstack/react-router';
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
import { useIsBoard } from '../../hooks/useIsBoard';
import { AuthContext } from '../../providers/auth/authContext';
import { NetworkContext } from '../../providers/network/networkContext';
import { SetupContext } from '../../providers/setup/setupContext';
import { UpdaterContext } from '../../providers/updater/updaterContext';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { useSystemPropsStore } from '../../store/systemProps';
import { UseMainLogic } from './main.type';

export const DIALOG_SKIPPED_KEY = 'arduino:app-lab:skipped-image-warning';
export type DialogSkippedStore = { [key: string]: boolean };

const FLASHER_TOOL_URL = 'https://www.arduino.cc/en/software/#flasher-tool';
const ARDUINO_SUPPORT_URL = 'https://www.arduino.cc/en/contact-us/';
const FLASHER_TUTORIAL_URL =
  'https://docs.arduino.cc/tutorials/uno-q/update-image/';

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

        const { getPropsError, getPropsSuccess, isSetupDone } =
          useSystemPropsStore(
            useShallow((state) => ({
              getPropsError: state.isError,
              getPropsSuccess: state.isSuccess,
              isSetupDone: state.isSetupDone,
            })),
          );

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
        }, [status, isCheckUpdateBlocking]);

        const { networkStepSkipped } = useContext(SetupContext);
        useEffect(() => {
          if (
            canStartUpdate &&
            status === UpdaterStatus.None &&
            !networkStepSkipped
          ) {
            checkForUpdates();
          }
        }, [canStartUpdate, checkForUpdates, networkStepSkipped, status]);

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

        return {
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
          openLinkExternal(FLASHER_TUTORIAL_URL);
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

    const boardsProps = useBoards();

    const { boardIsFlashing, boardIsReachable } = useBoardLifecycleStore(
      useShallow((state) => ({
        boardIsFlashing: state.boardIsFlashing,
        boardIsReachable: state.boardIsReachable,
      })),
    );

    const { setupCompleted } = useContext(SetupContext);

    const showRoutes = setupCompleted && boardIsReachable;

    const { setTheme } = useContext(ThemeContext);
    useEffect(() => {
      setTheme(Themes.DarkTheme);
    }, [setTheme]);

    return {
      sidePanelLogic,
      boardUpdateDialogLogic,
      flashBoardDialogLogic,
      appLabWelcomeDialogLogic,
      boardsProps,
      boardIsFlashing,
      showRoutes,
    };
  };
