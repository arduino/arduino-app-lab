import {
  getAppLogs,
  getSerialMonitorLogs,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AppDetailedInfo,
  AppStatus,
  BrickCreateUpdateRequest,
  BrickInstance,
  MessageData,
  UpdateAppDetailRequest,
} from '@cloud-editor-mono/infrastructure';
import {
  Action,
  ActionStatus,
  ConfigureAppBricksDialogLogic,
  CONSOLE_SOURCE_KEYS,
  ConsoleLogValue,
  ConsoleSourceKey,
  ContentUpdateLogic,
  MultipleConsolePanelLogic,
  RuntimeActionsLogic,
  SerialMonitorLogic,
  SerialMonitorStatus,
  SwapRunningAppDialogLogic,
  TabsLogic,
  TreeNode,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePreviousDistinct } from 'react-use';
import { BehaviorSubject, Subject } from 'rxjs';

import { useAiModels } from '../../../../../providers/ai-models/aiModelsContext';
import { RuntimeContext } from '../../../../../providers/runtime/runtimeContext';
import { useBoardLifecycleStore } from '../../../../../store/boardLifecycle';
import { useAppSSE } from '../../hooks/useAppSSE';
import { useAppWebSocket } from '../../hooks/useAppWebSocket';
import { checkIfHasIno, checkIfHasPython } from '../../utils/checkFileTypes';
import { LINE_SEPARATOR } from '../../utils/constants';

export type UseAppDetailRuntimeLogic = (
  app?: AppDetailedInfo,
  appBricks?: BrickInstance[],
  fileTree?: TreeNode[],
  openApp?: (app: AppDetailedInfo) => void,
  updateApp?: (request: UpdateAppDetailRequest) => Promise<boolean>,
  updateAppBricks?: (
    bricks: Record<string, BrickCreateUpdateRequest>,
  ) => Promise<boolean>,
) => {
  activePanel: 'editor' | 'console';
  defaultApp?: AppDetailedInfo;
  setAsDefaultApp: (isSelected: boolean) => Promise<void>;
  tabsLogic: TabsLogic<'editor' | 'console'>;
  configureAppBricksDialogLogic: ConfigureAppBricksDialogLogic;
  swapRunningAppDialogLogic: SwapRunningAppDialogLogic;
  multipleConsolePanelLogic: MultipleConsolePanelLogic;
  runtimeActionsLogic: RuntimeActionsLogic;
  aiModelRequiredDialog: {
    open: boolean;
    brickId?: string;
    modelId?: string;
    close: () => void;
  };
};

export const useAppDetailRuntimeLogic: UseAppDetailRuntimeLogic = function (
  app?: AppDetailedInfo,
  appBricks?: BrickInstance[],
  fileTree?: TreeNode[],
  openApp?: (app: AppDetailedInfo) => void,
  updateApp?: (request: UpdateAppDetailRequest) => Promise<boolean>,
  updateAppBricks?: (
    bricks: Record<string, BrickCreateUpdateRequest>,
  ) => Promise<boolean>,
): ReturnType<UseAppDetailRuntimeLogic> {
  const [open, setOpen] = useState(false);

  const panels = useMemo(() => ['editor', 'console'] as const, []);
  const [activePanel, setActivePanel] =
    useState<typeof panels[number]>('editor');

  const tabsLogic: TabsLogic<typeof panels[number]> = useCallback(
    () => ({
      tabs: panels,
      activeTab: activePanel,
      setTab: setActivePanel,
    }),
    [activePanel, panels],
  );

  const [configureAppBricksDialogOpen, setConfigureAppBricksDialogOpen] =
    useState(false);

  const selectedBoard = useBoardLifecycleStore(
    (state) => state.selectedConnectedBoard,
  );

  const {
    appsStatus: { defaultApp, activeApp, runningApp },
    runtimeActions: {
      currentAction,
      currentActionStatus,
      resetCurrentAction,
      runAction,
      stopAction,
      swapAction,
    },
    consoleLogic: {
      consoleSources,
      consoleTabs,
      activeConsoleTab,
      setActiveConsoleTab,
      appendData,
      addConsoleSource,
      resetConsoleSources,
    },
    aiModelRequired,
  } = useContext(RuntimeContext);

  const { getInstalledModel } = useAiModels();

  const runApp = useCallback((): void => {
    if (!app) return;

    const brickNeedingModel = appBricks?.find((brick) =>
      brick.model && app?.example
        ? !(getInstalledModel(brick.model)?.status == 'installed')
        : !!brick.require_model && !brick.model,
    );
    if (brickNeedingModel?.id) {
      aiModelRequired.open({
        brickId: brickNeedingModel.id,
        modelId: brickNeedingModel.model,
      });
      return;
    }

    if (
      appBricks?.some((brick) =>
        brick.config_variables?.some((v) => v.required && !v.value),
      )
    ) {
      setConfigureAppBricksDialogOpen(true);
    } else {
      runAction(app, setOpen);
      setActivePanel('console');
    }
  }, [app, appBricks, aiModelRequired, getInstalledModel, runAction]);

  const setAsDefaultApp = useCallback(
    async (isSelected: boolean): Promise<void> => {
      if (!updateApp) return;
      await updateApp({
        default: isSelected,
      });
    },
    [updateApp],
  );

  const onMessageLogs = useCallback(
    (message: MessageData) => {
      if (!message.id) return; //Some bricks are returning empty ids, this line prevents the logging of those
      if (app?.id) {
        appendData(app.id, message.id, message, true);
      }
    },
    [appendData, app?.id],
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
      if (app?.id) {
        appendData(
          app.id,
          CONSOLE_SOURCE_KEYS.SERIAL_MONITOR,
          {
            id: CONSOLE_SOURCE_KEYS.SERIAL_MONITOR,
            message,
          },
          bypassCreate,
        );
      }
    },
    [appendData, app?.id],
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

    setActivePanel('console');
    stopAction(app);
  }, [app, getAppLogsAbort, getSerialMonitorLogsAbort, stopAction]);

  useEffect(() => {
    if (currentActionStatus !== ActionStatus.Pending) {
      if (!getAppLogsAbortController.current && !socketRef.current) {
        resetCurrentAction();
      }
    }

    if (!app?.id || !fileTree || app.status !== 'running') return;

    const hasPython = fileTree ? checkIfHasPython(fileTree[0]) : false;
    const hasIno = fileTree ? checkIfHasIno(fileTree[0]) : false;

    if (hasPython) {
      addConsoleSource(app.id, CONSOLE_SOURCE_KEYS.PYTHON);
      if (!getAppLogsAbortController.current) {
        getAppLogsStream(app.id);
      }
    }

    if (hasIno) {
      createMonitorSourceOnMsg.current = true;
      addConsoleSource(app.id, CONSOLE_SOURCE_KEYS.SERIAL_MONITOR);
      if (!socketRef.current && !socketIsConnectingRef.current) {
        getSerialMonitorLogsStream();
      }
    }
  }, [
    addConsoleSource,
    app?.id,
    app?.status,
    currentActionStatus,
    fileTree,
    getAppLogsAbortController,
    getAppLogsStream,
    getSerialMonitorLogsStream,
    resetCurrentAction,
    socketIsConnectingRef,
    socketRef,
  ]);

  const currentActionStatusRef = useRef(currentActionStatus);
  useEffect(() => {
    currentActionStatusRef.current = currentActionStatus;
  }, [currentActionStatus]);

  useEffect(() => {
    const currentAppId = app?.id;
    return () => {
      getAppLogsAbort();
      getSerialMonitorLogsAbort();

      // Clean up global states immediately when navigating away
      // so long as it's not still actively preparing/launching
      if (currentActionStatusRef.current !== ActionStatus.Pending) {
        resetCurrentAction();

        if (currentAppId) {
          resetConsoleSources(currentAppId, [
            CONSOLE_SOURCE_KEYS.SERIAL_MONITOR,
            CONSOLE_SOURCE_KEYS.PYTHON,
          ]);
        }
      }
    };
  }, [
    getAppLogsAbort,
    getSerialMonitorLogsAbort,
    resetCurrentAction,
    app?.id,
    resetConsoleSources,
  ]);

  useEffect(() => {
    const currentAppId = app?.id;
    if (!currentAppId) return;

    const currentTabs = consoleTabs[currentAppId] || [];
    if (activeConsoleTab[currentAppId] || currentTabs.length === 0) return;

    if (currentTabs.includes(CONSOLE_SOURCE_KEYS.STARTUP)) {
      setActiveConsoleTab(currentAppId, CONSOLE_SOURCE_KEYS.STARTUP);
      return;
    }

    setActiveConsoleTab(currentAppId, currentTabs[0]);
  }, [app?.id, activeConsoleTab, consoleTabs, setActiveConsoleTab]);

  useEffect(() => {
    if (app?.status !== 'running') {
      createMonitorSourceOnMsg.current = false;
      getSerialMonitorLogsAbort();
      getAppLogsAbort();
    }
  }, [app?.id, app?.status, getAppLogsAbort, getSerialMonitorLogsAbort]);

  const prevCurrentAction = usePreviousDistinct(currentAction);
  useEffect(() => {
    const keysToRemain: string[] = [];

    // Keep the "App Launch" tab ONLY while an action is actively starting or stopping
    if (currentAction !== null || !!prevCurrentAction) {
      keysToRemain.push(CONSOLE_SOURCE_KEYS.STARTUP);
    }

    // Keep Serial Monitor and Python if it's running OR if an action is in progress
    if (
      currentAction !== null ||
      !!prevCurrentAction ||
      app?.status === 'running'
    ) {
      keysToRemain.push(CONSOLE_SOURCE_KEYS.SERIAL_MONITOR);
      keysToRemain.push(CONSOLE_SOURCE_KEYS.PYTHON);
    }

    if (app?.id) {
      resetConsoleSources(app.id, keysToRemain);
    }
  }, [
    app?.id,
    app?.status,
    currentAction,
    prevCurrentAction,
    resetConsoleSources,
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
    !!consoleSources[app?.id || ''] ||
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

  const serialMonitorLogic: SerialMonitorLogic = useCallback(
    <T = ConsoleLogValue>(logSource$?: BehaviorSubject<T> | Subject<T>) => {
      const useContentUpdate: ContentUpdateLogic = (
        receiveContentUpdate: (
          content: string,
          isSentByUser: boolean,
          className?: string,
          isGlobalStyle?: boolean,
        ) => void,
        receiveContentReset: () => void,
        resetSource?: Subject<void>,
      ): void => {
        useEffect(() => {
          const s = logSource$?.subscribe({
            next(message: T) {
              receiveContentUpdate(
                (message as ConsoleLogValue).value,
                (message as ConsoleLogValue)?.meta?.isSentByUser ?? false,
                (message as ConsoleLogValue)?.meta?.className,
                (message as ConsoleLogValue)?.meta?.isGlobalStyle,
              );
            },
            error(e: Error) {
              console.error(e);
              receiveContentReset();
            },
          });
          return () => s?.unsubscribe();
        }, [receiveContentUpdate, receiveContentReset]);

        useEffect(() => {
          const s = resetSource?.subscribe(receiveContentReset);
          return () => s?.unsubscribe();
        }, [receiveContentReset, resetSource]);
      };

      return {
        contentUpdateLogic: useContentUpdate,
        baudRates: [9600],
        selectedBaudRate: 9600,
        onBaudRateSelected: (baudRate: number): void => {
          console.log(`New baudrate: ${baudRate} selected`);
        },
        onPlayPause: (): void => {
          console.log('Play/Pause triggered');
        },
        clearMessages: (): void => {
          console.log(`Clear message triggered`);
        },
        status: SerialMonitorStatus.Active,
        disabled: false,
        onMessageSend: (message: string): void => {
          sendSerialMonitorLogsMessage(message);
          logSource$?.next({
            value: message.replace(/[\r\n]*$/, '') + LINE_SEPARATOR,
            meta: { id: 'local', isSentByUser: true },
          } as T);
        },
      };
    },
    [sendSerialMonitorLogsMessage],
  );

  const multipleConsolePanelLogic: MultipleConsolePanelLogic =
    useCallback(() => {
      const currentAppId = app?.id || '';

      const setActiveTabCallback = (
        tab: React.SetStateAction<ConsoleSourceKey | undefined>,
      ): void => {
        const value =
          typeof tab === 'function' ? tab(activeConsoleTab[currentAppId]) : tab;
        setActiveConsoleTab(currentAppId, value);
      };

      return {
        showLogs: true,
        consoleTabs: consoleTabs[currentAppId] || [],
        consoleSources: consoleSources[currentAppId] || {},
        activeTab: activeConsoleTab[currentAppId],
        setActiveTab: setActiveTabCallback,
        selectedBoard,
        serialMonitorLogic,
        isAppStarting:
          activeApp?.id === currentAppId &&
          currentAction === Action.Run &&
          currentActionStatus === ActionStatus.Pending,
        isAppStopping:
          activeApp?.id === currentAppId &&
          currentAction === Action.Stop &&
          currentActionStatus === ActionStatus.Pending,
      };
    }, [
      app?.id,
      consoleTabs,
      consoleSources,
      activeConsoleTab,
      setActiveConsoleTab,
      selectedBoard,
      serialMonitorLogic,
      currentAction,
      currentActionStatus,
      activeApp?.id,
    ]);

  const runtimeActionsLogic: RuntimeActionsLogic = useCallback(() => {
    // Use real-time status from runningApp if it matches current app, otherwise fall back to app.status
    // Also consider intermediate states based on currentAction and currentActionStatus
    const getAppStatus = (): AppStatus => {
      // Check for intermediate states first
      if (
        currentAction === Action.Run &&
        currentActionStatus === ActionStatus.Pending
      ) {
        return 'starting';
      }
      if (
        currentAction === Action.Stop &&
        currentActionStatus === ActionStatus.Pending
      ) {
        return 'stopping';
      }

      // Use real-time status from runningApp if it matches current app
      if (runningApp?.id === app?.id) {
        return runningApp?.status || 'stopped';
      }
      return app?.status || 'stopped';
    };

    return {
      appId: app?.id || '',
      appName: app?.name || '',
      appStatus: getAppStatus(),
      currentAction,
      currentActionStatus,
      openApp,
      runApp,
      stopApp,
      showStop: isActiveApp,
      isBannerEnabled: activeApp?.id === app?.id,
    };
  }, [
    app?.id,
    app?.name,
    app?.status,
    currentAction,
    currentActionStatus,
    openApp,
    runApp,
    stopApp,
    isActiveApp,
    activeApp?.id,
    runningApp?.id,
    runningApp?.status,
  ]);

  return {
    activePanel,
    defaultApp,
    setAsDefaultApp,
    tabsLogic,
    configureAppBricksDialogLogic,
    swapRunningAppDialogLogic,
    multipleConsolePanelLogic,
    runtimeActionsLogic,
    aiModelRequiredDialog: {
      open: aiModelRequired.state.open,
      brickId: aiModelRequired.state.brickId,
      modelId: aiModelRequired.state.modelId,
      close: aiModelRequired.close,
    },
  };
};
