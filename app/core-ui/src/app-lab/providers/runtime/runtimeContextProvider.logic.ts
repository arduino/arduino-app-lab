import {
  findUIPorts,
  forwardNonUIPort,
  openUIWhenReady,
  startApp,
  stopApp,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AppDetailedInfo,
  ErrorData,
  MessageData,
} from '@cloud-editor-mono/infrastructure';
import {
  Action,
  ActionStatus,
  CONSOLE_SOURCE_KEYS,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback, useMemo, useState } from 'react';

import { useAppSSE } from '../../features/app/app-detail/hooks/useAppSSE';
import { useConsoleSources } from '../../features/app/app-detail/hooks/useConsoleSources';
import { useCurrentAction } from '../../features/app/app-detail/hooks/useCurrentAction';
import { sendAppLabNotification } from '../../features/notifications';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import useAppsStatus from './hooks/useAppsStatus';
import { RuntimeContextValue } from './runtimeContext';
import { UseRuntimeLogic } from './runtimeContextProvider.type';

export const useRuntimeLogic: UseRuntimeLogic =
  function (): RuntimeContextValue {
    const {
      currentAction,
      currentActionStatus,
      send: sendCurrentAction,
    } = useCurrentAction();

    //The activeApp is the app that the user is currently interacting with, not necessarily the one running/default.
    const [activeApp, setActiveApp] = useState<AppDetailedInfo | undefined>();
    const [isSwapping, setIsSwapping] = useState<boolean>(false);

    const {
      consoleTabs,
      consoleSources,
      activeConsoleTab,
      addConsoleSource,
      setActiveConsoleTab,
      consoleSourcesOwner,
      consoleSourcesResetSubject,
      appendDataToSource: appendData,
      reset: resetConsoleSources,
    } = useConsoleSources();

    const { defaultApp, runningApp, failedApp } = useAppsStatus();

    //On startup success if called after start/stop actions succeeded.
    const onStartupSuccess = useCallback(
      async (param?: { isStopped: boolean }): Promise<void> => {
        appendData(CONSOLE_SOURCE_KEYS.STARTUP, undefined, undefined, {
          className: 'success',
          isGlobalStyle: true,
        });
        sendCurrentAction({
          type: 'ACTION_SUCCEEDED',
        });
        sendAppLabNotification({
          message: param?.isStopped
            ? `${activeApp?.name ?? ''} has been stopped`
            : `${activeApp?.name ?? ''} is now running`,
          variant: 'success',
        });
      },
      [activeApp?.name, appendData, sendCurrentAction],
    );

    //On startup success if called after start/stop actions fail.
    const onStartupError = useCallback(
      (data?: ErrorData): void => {
        appendData(CONSOLE_SOURCE_KEYS.STARTUP, data, undefined, {
          className: 'error',
        });
        sendCurrentAction({
          type: 'ACTION_FAILED',
        });
      },
      [appendData, sendCurrentAction],
    );

    const startAppOnMessage = useCallback(
      (message: MessageData): void => {
        appendData(CONSOLE_SOURCE_KEYS.STARTUP, message, true);
      },
      [appendData],
    );

    const selectedBoard = useBoardLifecycleStore(
      (state) => state.selectedConnectedBoard,
    );

    const openUIIfAvailable = useCallback(
      async (app: AppDetailedInfo): Promise<void> => {
        // Temp. work-around for video streaming in examples via port `4912`,
        // the port is not currently exposed in app data by orchestrator
        const requiresVideoStreamPortForward =
          selectedBoard?.connectionType === 'USB' &&
          app.bricks?.some((b) => b.id === 'arduino:video_object_detection');

        if (requiresVideoStreamPortForward) {
          const port = 4912;

          try {
            await forwardNonUIPort(port);
          } catch {
            console.warn(`Could not forward port ${port}`);
          }
        }

        try {
          const allPorts = await findUIPorts(app.id);

          const defaultPort = 7000;
          const defaultPortFound = allPorts.includes(defaultPort);

          if (defaultPortFound) {
            try {
              await openUIWhenReady(defaultPort, 45);
              return;
            } catch (error) {
              console.error(
                `Failed to open UI for app ${app.id} on default port (${defaultPort}): `,
                error,
              );
            }
          }

          if (allPorts.length === 0) {
            console.error(`No alternative ports found for app ${app.id}`);
            return;
          }

          await Promise.any(allPorts.map((p) => openUIWhenReady(p, 300)));
        } catch (error) {
          if (error instanceof AggregateError) {
            console.error('All ports failed:', error.errors);
          } else {
            console.error('An unexpected error occurred:', error);
          }
        }
      },
      [selectedBoard?.connectionType],
    );

    const {
      connect: startAppStream,
      abort: startAppAbort,
      progress: startAppProgress,
    } = useAppSSE({
      appSSE: startApp,
      onMessage: startAppOnMessage,
      onSuccess: onStartupSuccess,
      onError: onStartupError,
    });

    //On stop app success we need to check if there was another app stopping, if that's the case we swap apps.
    const onStopAppSuccess = useCallback((): void => {
      if (isSwapping && activeApp?.id) {
        //Swap application flow
        sendCurrentAction({
          type: 'ACTION_REQUESTED',
          payload: {
            currentAction: Action.Run,
          },
        });
        startAppStream(activeApp.id);
        openUIIfAvailable(activeApp);
      } else {
        onStartupSuccess({ isStopped: true });
      }

      setIsSwapping(false);
      setActiveApp(undefined);
    }, [
      activeApp,
      isSwapping,
      onStartupSuccess,
      openUIIfAvailable,
      sendCurrentAction,
      startAppStream,
    ]);

    const stopAppOnMessage = useCallback(
      (message: MessageData): void => {
        appendData(CONSOLE_SOURCE_KEYS.STARTUP, message, true);
      },
      [appendData],
    );

    const {
      connect: stopAppStream,
      abort: stopAppAbort,
      progress: stopAppProgress,
    } = useAppSSE({
      appSSE: stopApp,
      onMessage: stopAppOnMessage,
      onSuccess: onStopAppSuccess,
      onError: onStartupError,
    });

    const resetStreams = useCallback((): void => {
      startAppAbort();
      stopAppAbort();
    }, [startAppAbort, stopAppAbort]);

    const cleanUp = useCallback((): void => {
      resetStreams();
      sendCurrentAction({ type: 'RESET' });

      consoleSourcesResetSubject.next();

      setActiveApp(undefined);
    }, [consoleSourcesResetSubject, resetStreams, sendCurrentAction]);

    const runAction = useCallback(
      async (
        app: AppDetailedInfo,
        displaySwapDialog?: (e: boolean) => void,
      ): Promise<void> => {
        cleanUp();

        if (displaySwapDialog) {
          if (runningApp && runningApp.id !== app.id) {
            displaySwapDialog(true);
            return;
          }
        }

        //Run action start
        setActiveApp(app);
        addConsoleSource(CONSOLE_SOURCE_KEYS.STARTUP, {
          sourcesOwnerAppId: app.id,
        });
        setActiveConsoleTab(CONSOLE_SOURCE_KEYS.STARTUP);
        startAppStream(app.id);

        sendCurrentAction({
          type: 'ACTION_REQUESTED',
          payload: {
            currentAction: Action.Run,
          },
        });

        openUIIfAvailable(app);
      },
      [
        addConsoleSource,
        cleanUp,
        openUIIfAvailable,
        runningApp,
        sendCurrentAction,
        setActiveConsoleTab,
        startAppStream,
      ],
    );

    const stopAction = useCallback(
      async (app: AppDetailedInfo) => {
        addConsoleSource(CONSOLE_SOURCE_KEYS.STARTUP, {
          sourcesOwnerAppId: app.id,
        });
        setActiveConsoleTab(CONSOLE_SOURCE_KEYS.STARTUP);

        if (!activeApp?.id) {
          setActiveApp(app);
        }

        //Aborting the previous action
        if (
          currentActionStatus === ActionStatus.Pending &&
          app.status !== 'running'
        ) {
          startAppAbort();
          sendCurrentAction({
            type: 'ACTION_SUCCEEDED',
            payload: {
              currentAction: Action.Stop,
            },
          });
          return;
        }

        sendCurrentAction({
          type: 'ACTION_REQUESTED',
          payload: {
            currentAction: Action.Stop,
          },
        });

        stopAppStream(app.id);
      },
      [
        addConsoleSource,
        setActiveConsoleTab,
        activeApp?.id,
        currentActionStatus,
        sendCurrentAction,
        stopAppStream,
        startAppAbort,
      ],
    );

    const swapAction = useCallback(
      async (app: AppDetailedInfo): Promise<void> => {
        if (!runningApp?.id || !app.id) return;
        resetConsoleSources([]);

        addConsoleSource(CONSOLE_SOURCE_KEYS.STARTUP, {
          sourcesOwnerAppId: app.id,
        });
        setActiveConsoleTab(CONSOLE_SOURCE_KEYS.STARTUP);

        setActiveApp(app);
        sendCurrentAction({
          type: 'ACTION_REQUESTED',
          payload: {
            currentAction: Action.Stop,
          },
        });

        setIsSwapping(true);
        stopAppStream(runningApp?.id);
      },
      [
        addConsoleSource,
        resetConsoleSources,
        runningApp,
        sendCurrentAction,
        setActiveConsoleTab,
        stopAppStream,
      ],
    );

    const resetCurrentAction = useCallback((): void => {
      sendCurrentAction({ type: 'RESET' });
    }, [sendCurrentAction]);

    const appsStatus = useMemo(
      () => ({
        defaultApp,
        runningApp,
        activeApp,
        failedApp,
      }),
      [activeApp, defaultApp, failedApp, runningApp],
    );

    const runtimeActions = useMemo(
      () => ({
        runAction,
        stopAction,
        swapAction,
        resetCurrentAction,
        currentAction,
        currentActionStatus,
        progress: stopAppProgress || startAppProgress,
      }),
      [
        currentAction,
        currentActionStatus,
        resetCurrentAction,
        runAction,
        startAppProgress,
        stopAction,
        stopAppProgress,
        swapAction,
      ],
    );

    const consoleLogic = useMemo(
      () => ({
        consoleSourcesResetSubject,
        consoleSources,
        consoleTabs,
        activeConsoleTab,
        setActiveConsoleTab,
        appendData,
        addConsoleSource,
        consoleSourcesOwner,
        resetConsoleSources,
      }),
      [
        activeConsoleTab,
        addConsoleSource,
        appendData,
        consoleSources,
        consoleSourcesOwner,
        consoleSourcesResetSubject,
        consoleTabs,
        resetConsoleSources,
        setActiveConsoleTab,
      ],
    );

    return {
      appsStatus,
      runtimeActions,
      consoleLogic,
    };
  };
