import {
  findPorts,
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
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAppSSE } from '../../features/app/app-detail/hooks/useAppSSE';
import { useConsoleSources } from '../../features/app/app-detail/hooks/useConsoleSources';
import { useCurrentAction } from '../../features/app/app-detail/hooks/useCurrentAction';
import { sendAppLabNotification } from '../../features/notifications';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import useAppsStatus from './hooks/useAppsStatus';
import { RuntimeContextValue } from './runtimeContext';
import { AiModelRequiredDialogState } from './runtimeContextProvider.type';
import { UseRuntimeLogic } from './runtimeContextProvider.type';

export const useRuntimeLogic: UseRuntimeLogic =
  function (): RuntimeContextValue {
    const {
      currentAction,
      currentActionStatus,
      send: sendCurrentAction,
    } = useCurrentAction();

    //TODO: See is there is a way to pass it down as a parameter instead of needed it as a ref. We need to evaluate how to have a system that could potentially handle multiple active apps in the future.
    //The ref is needed cause on the if the ActiveApp is not yet set the onMessage callback set it as undefined,
    //and even if the active apps sets later the console remains empty.
    const activeAppRef = useRef<AppDetailedInfo | undefined>();

    //The activeApp is the app that the user is currently interacting with, not necessarily the one running/default.
    const [activeApp, setActiveApp] = useState<AppDetailedInfo | undefined>();

    const [appStarted, setAppStarted] = useState<boolean>(false);
    const [isSwapping, setIsSwapping] = useState<boolean>(false);

    const [aiModelRequiredDialog, setAiModelRequiredDialog] =
      useState<AiModelRequiredDialogState>({ open: false });

    const openAiModelRequired = useCallback(
      (params: { brickId?: string; modelId?: string }): void =>
        setAiModelRequiredDialog({ open: true, ...params }),
      [],
    );

    const closeAiModelRequired = useCallback(
      (): void =>
        setAiModelRequiredDialog((prev) => ({ ...prev, open: false })),
      [],
    );

    const {
      consoleTabs,
      consoleSources,
      activeConsoleTab,
      addConsoleSource,
      setActiveConsoleTab,
      setStyleToSource,
      resetAllSources,
      appendDataToSource: appendData,
      reset: resetConsoleSources,
    } = useConsoleSources();

    const { defaultApp, runningApp, failedApp } = useAppsStatus();

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
          const allPorts = await findPorts(app.id);
          console.log('Found ports for app', { appId: app.id, allPorts });

          for (const { port, type } of allPorts) {
            try {
              if (type === 'webview') {
                await openUIWhenReady(port, 45);
              } else {
                await forwardNonUIPort(port);
              }
            } catch (error) {
              console.warn(
                `Failed to open/forward port ${port} for app ${app.id}:`,
                error,
              );
            }
          }

          if (allPorts.length === 0) {
            console.error(`No alternative ports found for app ${app.id}`);
            return;
          }
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

    const notifyAppStatusChange = useMemo(
      () =>
        debounce((success: boolean) => {
          if (activeApp) {
            setStyleToSource(
              activeApp.id,
              CONSOLE_SOURCE_KEYS.STARTUP,
              success ? 'success' : 'error',
            );

            if (success) {
              openUIIfAvailable(activeApp);
            }
          }

          sendCurrentAction({
            type: success ? 'ACTION_SUCCEEDED' : 'ACTION_FAILED',
          });

          sendAppLabNotification({
            message: `${activeApp?.name ?? ''} ${
              success ? 'is now running' : 'failed to start'
            }`,
            variant: success ? 'success' : 'error',
          });
        }, 500),
      [activeApp, openUIIfAvailable, sendCurrentAction, setStyleToSource],
    );

    useEffect(() => {
      if (activeApp && activeApp?.id === failedApp?.id && appStarted) {
        notifyAppStatusChange(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeApp, failedApp, appStarted]);

    useEffect(() => {
      if (activeApp && activeApp?.id === runningApp?.id && appStarted) {
        notifyAppStatusChange(true);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeApp, runningApp, appStarted]);

    //On startup success if called after start/stop actions succeeded.
    const onStartupSuccess = useCallback(
      async (param?: { isStopped: boolean }): Promise<void> => {
        if (param?.isStopped) {
          sendCurrentAction({
            type: 'ACTION_SUCCEEDED',
          });
          if (activeApp?.id) {
            setStyleToSource(
              activeApp.id,
              CONSOLE_SOURCE_KEYS.STARTUP,
              'success',
            );
          }
          sendAppLabNotification({
            message: `${activeApp?.name ?? ''} has been stopped`,
            variant: 'success',
          });
        } else {
          setAppStarted(true);
        }
      },
      [sendCurrentAction, activeApp?.id, activeApp?.name, setStyleToSource],
    );

    //On startup success if called after start/stop actions fail.
    const onStartupError = useCallback(
      (data?: ErrorData): void => {
        if (activeApp?.id) {
          appendData(
            activeApp.id,
            CONSOLE_SOURCE_KEYS.STARTUP,
            data,
            undefined,
          );
          setStyleToSource(activeApp.id, CONSOLE_SOURCE_KEYS.STARTUP, 'error');
        }

        //Detect "missing AI model" failures so we can prompt the user to
        //select/download the model required by the offending brick.
        const missingModelMatch = data?.message?.match(
          /model "([^"]+)" for brick "([^"]+)" (?:not found|is not installed)/,
        );
        if (missingModelMatch) {
          openAiModelRequired({
            modelId: missingModelMatch[1],
            brickId: missingModelMatch[2],
          });
        }

        sendCurrentAction({
          type: 'ACTION_FAILED',
        });
      },
      [
        activeApp?.id,
        appendData,
        openAiModelRequired,
        sendCurrentAction,
        setStyleToSource,
      ],
    );

    const startAppOnMessage = useCallback(
      (message: MessageData): void => {
        if (activeAppRef.current?.id) {
          appendData(
            activeAppRef.current.id,
            CONSOLE_SOURCE_KEYS.STARTUP,
            message,
            true,
          );
        }
      },
      [appendData],
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
      } else {
        onStartupSuccess({ isStopped: true });
        setActiveApp(undefined);
      }

      setIsSwapping(false);
    }, [
      activeApp,
      isSwapping,
      onStartupSuccess,
      sendCurrentAction,
      startAppStream,
    ]);

    const stopAppOnMessage = useCallback(
      (message: MessageData): void => {
        if (activeAppRef.current?.id && !isSwapping) {
          appendData(
            activeAppRef.current.id,
            CONSOLE_SOURCE_KEYS.STARTUP,
            message,
            true,
          );
        }
      },
      [appendData, isSwapping],
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

      resetAllSources();

      setActiveApp(undefined);
    }, [resetAllSources, resetStreams, sendCurrentAction]);

    const runAction = useCallback(
      async (
        app: AppDetailedInfo,
        displaySwapDialog?: (e: boolean) => void,
      ): Promise<void> => {
        setAppStarted(false);
        cleanUp();

        if (displaySwapDialog) {
          if (runningApp && runningApp.id !== app.id) {
            displaySwapDialog(true);
            return;
          }
        }

        //Run action start
        setActiveApp(app);
        activeAppRef.current = app;

        addConsoleSource(app.id, CONSOLE_SOURCE_KEYS.STARTUP);
        startAppStream(app.id);

        sendCurrentAction({
          type: 'ACTION_REQUESTED',
          payload: {
            currentAction: Action.Run,
          },
        });
      },
      [
        addConsoleSource,
        cleanUp,
        runningApp,
        sendCurrentAction,
        startAppStream,
      ],
    );

    const stopAction = useCallback(
      async (app: AppDetailedInfo) => {
        setAppStarted(false);
        addConsoleSource(app.id, CONSOLE_SOURCE_KEYS.STARTUP);

        if (!activeApp?.id) {
          setActiveApp(app);
          activeAppRef.current = app;
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
        activeApp?.id,
        currentActionStatus,
        sendCurrentAction,
        stopAppStream,
        startAppAbort,
      ],
    );

    const swapAction = useCallback(
      async (app: AppDetailedInfo): Promise<void> => {
        setAppStarted(false);
        if (!runningApp?.id || !app.id) return;

        startAppAbort();
        resetConsoleSources(runningApp.id, []);
        resetConsoleSources(app.id, []);

        addConsoleSource(app.id, CONSOLE_SOURCE_KEYS.STARTUP);

        setActiveApp(app);
        activeAppRef.current = app;
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
        startAppAbort,
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
        consoleSources,
        consoleTabs,
        activeConsoleTab,
        setActiveConsoleTab,
        appendData,
        addConsoleSource,
        resetConsoleSources,
      }),
      [
        activeConsoleTab,
        addConsoleSource,
        appendData,
        consoleSources,
        consoleTabs,
        resetConsoleSources,
        setActiveConsoleTab,
      ],
    );

    const aiModelRequired = useMemo(
      () => ({
        state: aiModelRequiredDialog,
        open: openAiModelRequired,
        close: closeAiModelRequired,
      }),
      [aiModelRequiredDialog, closeAiModelRequired, openAiModelRequired],
    );

    return {
      appsStatus,
      runtimeActions,
      consoleLogic,
      aiModelRequired,
    };
  };
