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

import { RuntimeContext } from '../../../providers/runtime/runtimeContext';
import { useBoardLifecycleStore } from '../../../store/boardLifecycle';
import { useAppSSE } from './hooks/useAppSSE';
import { useAppWebSocket } from './hooks/useAppWebSocket';
import { checkIfHasIno, checkIfHasPython } from './utils/checkFileTypes';

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
  tabsLogic: TabsLogic<'editor' | 'console'>;
  configureAppBricksDialogLogic: ConfigureAppBricksDialogLogic;
  swapRunningAppDialogLogic: SwapRunningAppDialogLogic;
  multipleConsolePanelLogic: MultipleConsolePanelLogic;
  runtimeActionsLogic: RuntimeActionsLogic;
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
      consoleSourcesResetSubject: resetSource,
      consoleTabs,
      activeConsoleTab,
      setActiveConsoleTab,
      appendData,
      addConsoleSource,
      resetConsoleSources,
      consoleSourcesOwner,
    },
  } = useContext(RuntimeContext);

  const runApp = useCallback((): void => {
    if (!app) return;
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
        CONSOLE_SOURCE_KEYS.SERIAL_MONITOR,
        {
          id: CONSOLE_SOURCE_KEYS.SERIAL_MONITOR,
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
      addConsoleSource(CONSOLE_SOURCE_KEYS.PYTHON);
      if (!getAppLogsAbortController.current) {
        getAppLogsStream(app.id);
      }
    }

    if (hasIno) {
      createMonitorSourceOnMsg.current = true;
      addConsoleSource(CONSOLE_SOURCE_KEYS.SERIAL_MONITOR);
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
    if (app?.status !== 'running') {
      createMonitorSourceOnMsg.current = false;
      getSerialMonitorLogsAbort();
      getAppLogsAbort();
    }
  }, [app?.id, app?.status, getAppLogsAbort, getSerialMonitorLogsAbort]);

  const prevCurrentAction = usePreviousDistinct(currentAction);
  useEffect(() => {
    const keysToRemain: string[] = [];

    if (currentAction !== null || !!prevCurrentAction) {
      keysToRemain.push(CONSOLE_SOURCE_KEYS.SERIAL_MONITOR);
      keysToRemain.push(CONSOLE_SOURCE_KEYS.PYTHON);
      keysToRemain.push(CONSOLE_SOURCE_KEYS.STARTUP);
    }

    resetConsoleSources(keysToRemain);
  }, [currentAction, prevCurrentAction, resetConsoleSources]);

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

  const serialMonitorLogic: SerialMonitorLogic = useCallback(
    (logSource$: BehaviorSubject<ConsoleLogValue>) => {
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
            next(message: ConsoleLogValue) {
              receiveContentUpdate(
                message.value,
                false,
                message?.meta?.className,
                message?.meta?.isGlobalStyle,
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
        onMessageSend: sendSerialMonitorLogsMessage,
      };
    },
    [sendSerialMonitorLogsMessage],
  );

  const multipleConsolePanelLogic: MultipleConsolePanelLogic = useCallback(
    () => ({
      showLogs: isActiveApp,
      consoleTabs,
      consoleSources,
      activeTab: activeConsoleTab,
      setActiveTab: setActiveConsoleTab,
      resetSource,
      selectedBoard,
      serialMonitorLogic,
      isAppStarting:
        currentAction === Action.Run &&
        currentActionStatus === ActionStatus.Pending,
    }),
    [
      isActiveApp,
      consoleTabs,
      consoleSources,
      activeConsoleTab,
      setActiveConsoleTab,
      resetSource,
      selectedBoard,
      serialMonitorLogic,
      currentAction,
      currentActionStatus,
    ],
  );

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
      appDefault: defaultApp,
      appName: app?.name || '',
      appStatus: getAppStatus(),
      currentAction,
      currentActionStatus,
      openApp,
      runApp,
      stopApp,
      setAsDefaultApp: async (isSelected: boolean): Promise<void> => {
        await updateApp?.({
          default: isSelected,
        });
      },
      showStop: isActiveApp,
      isBannerEnabled: isActiveApp,
    };
  }, [
    app?.id,
    app?.name,
    app?.status,
    runningApp,
    currentAction,
    currentActionStatus,
    defaultApp,
    isActiveApp,
    openApp,
    runApp,
    stopApp,
    updateApp,
  ]);

  return {
    activePanel,
    tabsLogic,
    configureAppBricksDialogLogic,
    swapRunningAppDialogLogic,
    multipleConsolePanelLogic,
    runtimeActionsLogic,
  };
};
