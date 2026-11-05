import {
  boardNeedsImageUpdate,
  boardNeedsOSUpdate,
  getApps,
  onAgentModelImport,
  onAgentRenamedApp,
  onAgentRenamedAppFile,
  openLinkExternal,
  reloadApp,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AppLabWelcomeDialogLogic,
  BoardUpdateDialogLogic,
  FlashBoardDialogLogic,
  snackbar,
  UpdaterStatus,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useRouter } from '@tanstack/react-router';
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { useShallow } from 'zustand/react/shallow';

import { BoardScopedQuery } from '../../boardScopedQuery';
import { useBoards } from '../../hooks/useBoards';
import {
  useCurrentBreadcrumbId,
  useCurrentSection,
} from '../../hooks/useCurrentSection';
import { useIsBoard } from '../../hooks/useIsBoard';
import { useReloadApp } from '../../hooks/useReloadApp';
import {
  clearAgentRenames,
  isAgentFileRenameHandled,
  isModelImportSubscribed,
  recordAgentRename,
  stashModelImport,
} from '../../openAppFile';
import { AuthContext } from '../../providers/auth/authContext';
import { NetworkContext } from '../../providers/network/networkContext';
import { SetupContext } from '../../providers/setup/setupContext';
import { UpdaterContext } from '../../providers/updater/updaterContext';
import {
  entryKeyForApp,
  moveOpenFilesForApp,
  renameOpenFilesInApp,
} from '../../services/openFilesStore';
import { onStorageUnavailable } from '../../services/persistentStore';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { useCreateAppDialogStore } from '../../store/createAppDialog';
import { useImportAppDialogStore } from '../../store/importAppDialog';
import { useSystemPropsStore } from '../../store/systemProps';
import { openFilesQueryKey } from '../app/app-detail/hooks/useEditorFiles';
import { useCreateAppDialogLogic } from '../app/app-list/useCreateAppDialogLogic';
import { useImportAppDialogLogic } from '../app/app-list/useImportAppDialogLogic';
import { sendAppLabNotification } from '../notifications';
import { usePreparationRequiredDialogLogic } from '../release/preparationDialog.logic';
import { MY_APPS_FILTER } from '../release/releaseApp';
import {
  useCreateReleaseDialogLogic,
  useCreateReleaseIntroDialogLogic,
} from '../release/releaseDialogs.logic';
import { useAgentSidePanelProps } from '../side-panel/agentSidePanel.logic';
import { createUseSidePanelLogic } from '../side-panel/sidePanel.logic';
import { UseMainLogic } from './main.type';
import { mainMessages as messages } from './messages';
import { useNetworkSettingsDialogLogic } from './networkSettingsDialog';
import { useOfflineWarningDialogLogic } from './offlineWarningDialog';

const FLASHER_TOOL_URL = 'https://www.arduino.cc/en/software/#flasher-tool';
const ARDUINO_SUPPORT_URL = 'https://www.arduino.cc/en/contact-us/';
const FLASHER_TUTORIAL_URL =
  'https://docs.arduino.cc/tutorials/BOARD_TYPE/update-image/';

const isAgentModePath = (pathname: string): boolean =>
  pathname.startsWith('/ai-assistant');

export const useMainLogic: UseMainLogic =
  function (): ReturnType<UseMainLogic> {
    const navigate = useNavigate();
    const { formatMessage } = useI18n();

    useEffect(
      () =>
        onStorageUnavailable(() =>
          sendAppLabNotification({
            message: formatMessage(messages.storageUnavailable),
            variant: 'warning',
            duration: 10000,
          }),
        ),
      [formatMessage],
    );

    // The agent named a brick needing one of the user's own models: bring the user to that app, unless its screen is already listening — on a deep link that subscription waits for the app query, so the route alone would drop the event.
    useEffect(
      () =>
        onAgentModelImport((appId, brickId) => {
          if (isModelImportSubscribed(appId)) {
            return;
          }
          stashModelImport(appId, brickId);
          void navigate({ to: '/my-apps/$appId', params: { appId } });
        }),
      [navigate],
    );
    // An agent rename gives the app a new id. The app screen follows it itself; the open tabs and Agent Mode's exit have no mounted screen to do it.
    const router = useRouter();
    useEffect(
      () =>
        onAgentRenamedApp((oldId, newId) => {
          if (isAgentModePath(router.state.location.pathname)) {
            recordAgentRename(oldId, newId);
          }
          const { selectedConnectedBoard } = useBoardLifecycleStore.getState();
          void moveOpenFilesForApp(
            oldId,
            newId,
            selectedConnectedBoard?.serial,
          );
        }),
      [router],
    );
    // An agent file rename: the app's editor moves its tabs itself while on screen, and with none, as in Agent Mode, the stored tabs follow here.
    const queryClient = useQueryClient();
    useEffect(
      () =>
        onAgentRenamedAppFile((appId, appPath, from, to) => {
          if (isAgentFileRenameHandled(appPath)) {
            return;
          }
          const { selectedConnectedBoard } = useBoardLifecycleStore.getState();
          const serial = selectedConnectedBoard?.serial;
          // Dropped first, so the next editor reads the store, whose queue serves it after this rename.
          queryClient.removeQueries({
            queryKey: openFilesQueryKey(entryKeyForApp(appId, serial)),
          });
          void renameOpenFilesInApp(appId, from, to, serial);
        }),
      [queryClient],
    );
    useEffect(
      () =>
        router.subscribe('onResolved', ({ toLocation }) => {
          if (!isAgentModePath(toLocation.pathname)) {
            clearAgentRenames();
          }
        }),
      [router],
    );

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
          boardUpdateProgress,
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
          boardUpdateProgress,
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
        // Switching boards re-runs this effect, but the checks are slow
        // per-board SSH round-trips: an in-flight check started for the
        // previous board can resolve *after* the switch. Without this guard a
        // slow `true` for board A lands once we're already on board B and pops
        // the flash dialog for a board that doesn't need it.
        let cancelled = false;

        const setNeedsOSUpdateAsync = async (): Promise<void> => {
          const isR0Build = await boardNeedsImageUpdate();
          if (cancelled || !isR0Build) return;

          const needsUpdate = await boardNeedsOSUpdate();
          if (cancelled) return;

          setOpen(needsUpdate);
        };

        if (
          isBoard === false &&
          selectedConnectedBoard &&
          boardIsFlashing === undefined
        ) {
          // Clear any dialog left open for the previously selected board before
          // re-evaluating for the new one.
          setOpen(false);
          setNeedsOSUpdateAsync();
        }

        return () => {
          cancelled = true;
        };
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

    const boardsProps = useBoards();

    const createAppDialogOpen = useCreateAppDialogStore((state) => state.open);
    const setCreateAppDialogOpen = useCreateAppDialogStore(
      (state) => state.setOpen,
    );
    const createAppDialogLogic = useCreateAppDialogLogic(
      createAppDialogOpen,
      setCreateAppDialogOpen,
    );

    const createReleaseIntroDialogLogic = useCreateReleaseIntroDialogLogic();
    const createReleaseDialogLogic = useCreateReleaseDialogLogic();
    const preparationRequiredDialogLogic = usePreparationRequiredDialogLogic();

    const importAppDialogOpen = useImportAppDialogStore((state) => state.open);
    const setImportAppDialogOpen = useImportAppDialogStore(
      (state) => state.setOpen,
    );
    const setImportedAppId = useImportAppDialogStore(
      (state) => state.setImportedAppId,
    );
    const importAppDialogLogic = useImportAppDialogLogic(
      importAppDialogOpen,
      setImportAppDialogOpen,
      setImportedAppId,
    );

    const sidePanelLogic = useCallback(
      () => createUseSidePanelLogic(boardsProps)(),
      [boardsProps],
    );

    const agentSidePanelProps = useAgentSidePanelProps(boardsProps);

    // get app params to undestand if we are in details or not
    const params = useParams({ strict: false });
    const currentAppId = params.appId || params.resourceId;

    // determine section using dedicated hook
    const currentSection = useCurrentSection();
    const currentBreadcrumbId = useCurrentBreadcrumbId();

    const { boardIsFlashing, boardIsReachable } = useBoardLifecycleStore(
      useShallow((state) => ({
        boardIsFlashing: state.boardIsFlashing,
        boardIsReachable: state.boardIsReachable,
      })),
    );

    const { data: apps } = useQuery({
      queryKey: [BoardScopedQuery.CHECK_APPS_TO_REDIRECT],

      queryFn: () => {
        return getApps({
          query: { filter: MY_APPS_FILTER },
        });
      },

      enabled: boardIsReachable,
    });

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
      breadcrumbId: currentBreadcrumbId,
    });

    return {
      sidePanelLogic,
      agentSidePanelProps,
      createAppDialogLogic,
      createReleaseIntroDialogLogic,
      createReleaseDialogLogic,
      preparationRequiredDialogLogic,
      importAppDialogLogic,
      boardUpdateDialogLogic,
      flashBoardDialogLogic,
      appLabWelcomeDialogLogic,
      offlineWarningDialogLogic: useOfflineWarningDialogLogic,
      networkSettingsDialogLogic: useNetworkSettingsDialogLogic,
      boardsProps,
      boardIsFlashing,
      showRoutes,
    };
  };
