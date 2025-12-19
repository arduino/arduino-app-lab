import {
  getAppLogs,
  getSerialMonitorLogs,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AppDetailedInfo,
  BrickCreateUpdateRequest,
  BrickInstance,
  MessageData,
} from '@cloud-editor-mono/infrastructure';
import {
  AL_PYTHON_KEY,
  AL_SERIAL_MONITOR_KEY,
  AL_STARTUP_KEY,
  AppLabActionStatus,
  ConfigureAppBricksDialogLogic,
  MultipleConsolePanelLogic,
  RuntimeActionsLogic,
  SwapRunningAppDialogLogic,
  TreeNode,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePreviousDistinct } from 'react-use';

import { RuntimeContext } from '../../providers/runtime/runtimeContext';
import { useBoardLifecycleStore } from '../../store/boards/boards';
import { useAppSSE } from './hooks/useAppSSE';
import { useAppWebSocket } from './hooks/useAppWebSocket';
import { checkIfHasIno, checkIfHasPython } from './utils/checkFileTypes';

export type UseAppDetailRuntimeLogic = (
  app?: AppDetailedInfo,
  appBricks?: BrickInstance[],
  fileTree?: TreeNode[],
  onAppDefaultChange?: (isSelected: boolean) => Promise<void>,
  updateAppBricks?: (
    bricks: Record<string, BrickCreateUpdateRequest>,
  ) => Promise<boolean>,
) => {
  configureAppBricksDialogLogic: ConfigureAppBricksDialogLogic;
  swapRunningAppDialogLogic: SwapRunningAppDialogLogic;
  multipleConsolePanelLogic: MultipleConsolePanelLogic;
  runtimeActionsLogic: RuntimeActionsLogic;
};

export const useAppDetailRuntimeLogic: UseAppDetailRuntimeLogic = function (
  app?: AppDetailedInfo,
  appBricks?: BrickInstance[],
  fileTree?: TreeNode[],
  onAppDefaultChange?: (isSelected: boolean) => Promise<void>,
  updateAppBricks?: (
    bricks: Record<string, BrickCreateUpdateRequest>,
  ) => Promise<boolean>,
): ReturnType<UseAppDetailRuntimeLogic> {
  const [open, setOpen] = useState(false);
  const [configureAppBricksDialogOpen, setConfigureAppBricksDialogOpen] =
    useState(false);

  const { selectedConnectedBoard: selectedBoard } = useBoardLifecycleStore();
  const {
    defaultApp,
    runningApp,
    getAppStatusById,
    activeApp,
    currentAction,
    currentActionStatus,
    resetCurrentAction,
    consoleSources,
    consoleSourcesResetSubject: resetSource,
    runAction,
    stopAction,
    swapAction,
    consoleTabs,
    activeConsoleTab,
    setActiveConsoleTab,
    appendData,
    addConsoleSource,
    resetConsoleSources,
    consoleSourcesOwner,
  } = useContext(RuntimeContext);

  const runApp = useCallback((): void => {
    if (!app) return;
    if (
      appBricks?.some(
        (brick) =>
          brick.config_variables?.some((v) => v.required && !v.value) ||
          (brick.require_model && !brick.model),
      )
    ) {
      setConfigureAppBricksDialogOpen(true);
    } else {
      runAction(app, setOpen);
    }
  }, [app, appBricks, runAction]);

  const onMessageLogs = useCallback(
    (message: MessageData) => {
      if (!message.id) return; //Some bricks are returning empty ids, this line prevents the logging of those
      appendData(message.id, message, true);
    },
    [appendData],
  );
  const {
    connect: getAppLogsStream,
    abort: getAppLogsAbort,
    abortController: getAppLogsAbortController,
  } = useAppSSE({
    appSSE: getAppLogs,
    onMessage: onMessageLogs,
  });

  const createMonitorSourceOnMsg = useRef(true);
  const onMessageSerial = useCallback(
    (message: string) => {
      const bypassCreate = createMonitorSourceOnMsg.current;
      appendData(
        AL_SERIAL_MONITOR_KEY,
        {
          id: AL_SERIAL_MONITOR_KEY,
          message,
        },
        bypassCreate,
      );
    },
    [appendData],
  );

  const {
    connect: getSerialMonitorLogsStream,
    abort: getSerialMonitorLogsAbort,
    send: sendSerialMonitorLogsMessage,
    socketRef,
    socketIsConnectingRef,
  } = useAppWebSocket({
    appWebSocket: getSerialMonitorLogs,
    onMessage: onMessageSerial,
  });

  const stopApp = useCallback((): void => {
    if (!app) return;

    createMonitorSourceOnMsg.current = false;
    getSerialMonitorLogsAbort();
    getAppLogsAbort();

    stopAction(app);
  }, [app, getAppLogsAbort, getSerialMonitorLogsAbort, stopAction]);

  useEffect(() => {
    if (currentActionStatus !== AppLabActionStatus.Pending) {
      if (!getAppLogsAbortController.current && !socketRef.current) {
        resetCurrentAction();
      }
    }

    if (!app?.id || !fileTree || !runningApp?.id || runningApp.id !== app.id)
      return;

    const hasPython = fileTree ? checkIfHasPython(fileTree[0]) : false;
    const hasIno = fileTree ? checkIfHasIno(fileTree[0]) : false;

    if (hasPython) {
      addConsoleSource(AL_PYTHON_KEY);
      if (!getAppLogsAbortController.current) {
        getAppLogsStream(app.id);
      }
    }

    if (hasIno) {
      createMonitorSourceOnMsg.current = true;
      addConsoleSource(AL_SERIAL_MONITOR_KEY);
      if (!socketRef.current && !socketIsConnectingRef.current) {
        getSerialMonitorLogsStream();
      }
    }
  }, [
    addConsoleSource,
    app?.id,
    currentActionStatus,
    fileTree,
    getAppLogsAbortController,
    getAppLogsStream,
    getSerialMonitorLogsStream,
    resetCurrentAction,
    runningApp?.id,
    socketIsConnectingRef,
    socketRef,
  ]);

  useEffect(() => {
    return () => {
      getAppLogsAbort();
      getSerialMonitorLogsAbort();
    };
  }, [getAppLogsAbort, getSerialMonitorLogsAbort]);

  useEffect(() => {
    setActiveConsoleTab(consoleTabs[0]);
  }, [consoleTabs, setActiveConsoleTab]);

  useEffect(() => {
    if (runningApp?.id !== app?.id) {
      createMonitorSourceOnMsg.current = false;
      getSerialMonitorLogsAbort();
      getAppLogsAbort();
    }
  }, [app?.id, getAppLogsAbort, getSerialMonitorLogsAbort, runningApp?.id]);

  const prevCurrentAction = usePreviousDistinct(currentAction);
  useEffect(() => {
    const keysToRemain: string[] = [];

    if (runningApp?.id === app?.id) {
      keysToRemain.push(AL_SERIAL_MONITOR_KEY);
      keysToRemain.push(AL_PYTHON_KEY);
    }

    if (currentAction !== null || !!prevCurrentAction) {
      keysToRemain.push(AL_STARTUP_KEY);
    }

    resetConsoleSources(keysToRemain);
  }, [
    app?.id,
    consoleSources,
    currentAction,
    prevCurrentAction,
    resetConsoleSources,
    runningApp?.id,
  ]);

  const useConfigureAppBricksDialogLogic =
    (): ReturnType<ConfigureAppBricksDialogLogic> => ({
      bricks: appBricks ?? [],
      open: configureAppBricksDialogOpen,
      onOpenChange: setConfigureAppBricksDialogOpen,
      confirmAction: async (bricks): Promise<boolean> => {
        if (!updateAppBricks) return false;
        const result = await updateAppBricks(bricks);
        if (result) {
          runApp();
        }
        return result;
      },
    });

  const configureAppBricksDialogLogic = useCallback(
    useConfigureAppBricksDialogLogic,
    [appBricks, configureAppBricksDialogOpen, runApp, updateAppBricks],
  );

  const isActiveApp =
    activeApp?.id === app?.id ||
    consoleSourcesOwner === app?.id ||
    app?.status === 'running';

  const swapRunningAppDialogLogic: SwapRunningAppDialogLogic = useCallback(
    () => ({
      open,
      setOpen,
      handleSwap: (): void => {
        if (!app) return;
        swapAction(app);
        setOpen(false);
      },
    }),
    [app, open, swapAction],
  );

  const multipleConsolePanelLogic: MultipleConsolePanelLogic = useCallback(
    () => ({
      showLogs: isActiveApp,
      consoleTabs,
      consoleSources,
      activeTab: activeConsoleTab,
      setActiveTab: setActiveConsoleTab,
      resetSource,
      onMessageSend: sendSerialMonitorLogsMessage,
      selectedBoard,
    }),
    [
      activeConsoleTab,
      consoleSources,
      consoleTabs,
      isActiveApp,
      resetSource,
      selectedBoard,
      sendSerialMonitorLogsMessage,
      setActiveConsoleTab,
    ],
  );

  const runtimeActionsLogic: RuntimeActionsLogic = useCallback(
    () => ({
      appId: app?.id || '',
      appDefault: defaultApp,
      appName: app?.name || '',
      appStatus: getAppStatusById(app?.id || ''),
      currentAction,
      currentActionStatus,
      runApp,
      stopApp,
      setAsDefaultApp: onAppDefaultChange,
      showStop: isActiveApp,
      isBannerEnabled: isActiveApp,
    }),
    [
      app?.id,
      app?.name,
      defaultApp,
      getAppStatusById,
      currentAction,
      currentActionStatus,
      runApp,
      stopApp,
      onAppDefaultChange,
      isActiveApp,
    ],
  );

  return {
    configureAppBricksDialogLogic,
    swapRunningAppDialogLogic,
    multipleConsolePanelLogic,
    runtimeActionsLogic,
  };
};
