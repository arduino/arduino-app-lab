import {
  findUIPort,
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
  AL_STARTUP_KEY,
  AppLabAction,
  AppLabActionStatus,
  UseRuntimeLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback, useState } from 'react';

import { useAppSSE } from '../../features/app-detail/hooks/useAppSSE';
import { useConsoleSources } from '../../features/app-detail/hooks/useConsoleSources';
import { useCurrentAction } from '../../features/app-detail/hooks/useCurrentAction';
import useAppsStatus from './hooks/useAppsStatus';
import { RuntimeContextValue } from './runtimeContext';

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

    const { defaultApp, runningApp, failedApp, getAppStatusById } =
      useAppsStatus();

    //On startup success if called after start/stop actions succeeded.
    const onStartupSuccess = useCallback(async (): Promise<void> => {
      appendData(AL_STARTUP_KEY, undefined, undefined, {
        className: 'success',
        isGlobalStyle: true,
      });
      sendCurrentAction({
        type: 'ACTION_SUCCEEDED',
      });
    }, [appendData, sendCurrentAction]);

    //On startup success if called after start/stop actions fail.
    const onStartupError = useCallback(
      (data?: ErrorData): void => {
        appendData(AL_STARTUP_KEY, data, undefined, {
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
        appendData(AL_STARTUP_KEY, message, true);
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
            currentAction: AppLabAction.Run,
          },
        });
        startAppStream(activeApp.id);
      } else {
        onStartupSuccess();
      }

      setIsSwapping(false);
      setActiveApp(undefined);
    }, [
      activeApp,
      isSwapping,
      onStartupSuccess,
      sendCurrentAction,
      startAppStream,
    ]);

    const stopAppOnMessage = useCallback(
      (message: MessageData): void => {
        appendData(AL_STARTUP_KEY, message, true);
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
        addConsoleSource(AL_STARTUP_KEY, { sourcesOwnerAppId: app.id });
        setActiveConsoleTab(AL_STARTUP_KEY);
        startAppStream(app.id);

        sendCurrentAction({
          type: 'ACTION_REQUESTED',
          payload: {
            currentAction: AppLabAction.Run,
          },
        });

        try {
          const uiPort = await findUIPort(app.id);
          await openUIWhenReady(uiPort);
        } catch (error) {
          console.error(`Failed to open UI for app ${app.id}:`, error);
        }
      },
      [
        addConsoleSource,
        cleanUp,
        runningApp,
        sendCurrentAction,
        setActiveConsoleTab,
        startAppStream,
      ],
    );

    const stopAction = useCallback(
      async (app: AppDetailedInfo) => {
        addConsoleSource(AL_STARTUP_KEY, { sourcesOwnerAppId: app.id });
        setActiveConsoleTab(AL_STARTUP_KEY);

        if (!activeApp?.id) {
          setActiveApp(app);
        }

        //Aborting the previous action
        if (
          currentActionStatus === AppLabActionStatus.Pending &&
          app.status !== 'running'
        ) {
          startAppAbort();
          sendCurrentAction({
            type: 'ACTION_SUCCEEDED',
            payload: {
              currentAction: AppLabAction.Stop,
            },
          });
          return;
        }

        sendCurrentAction({
          type: 'ACTION_REQUESTED',
          payload: {
            currentAction: AppLabAction.Stop,
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

        addConsoleSource(AL_STARTUP_KEY, { sourcesOwnerAppId: app.id });
        setActiveConsoleTab(AL_STARTUP_KEY);

        setActiveApp(app);
        sendCurrentAction({
          type: 'ACTION_REQUESTED',
          payload: {
            currentAction: AppLabAction.Stop,
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

    return {
      defaultApp,
      runningApp,
      activeApp,
      failedApp,
      getAppStatusById,
      runAction,
      stopAction,
      swapAction,
      consoleSourcesResetSubject,
      resetCurrentAction,
      resetConsoleSources,
      currentAction,
      currentActionStatus,
      consoleSources,
      progress: stopAppProgress || startAppProgress,
      consoleTabs,
      activeConsoleTab,
      setActiveConsoleTab,
      appendData,
      addConsoleSource,
      consoleSourcesOwner,
    };
  };
