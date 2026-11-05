import {
  getAppLogs,
  getSerialMonitorLogs,
  onAgentModelImport,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AppBrickListItem,
  AppDetailedInfo,
  AppStatus,
  BrickCreateUpdateRequest,
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
  useI18n,
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

import { useInstalledAIModels } from '../../../../../hooks/useInstalledAIModels';
import {
  clearPendingModelImport,
  peekPendingModelImport,
  setModelImportSubscribed,
  stashModelImport,
} from '../../../../../openAppFile';
import { CloudConnectorContext } from '../../../../../providers/cloud-connector/cloudConnectorContext';
import { RuntimeContext } from '../../../../../providers/runtime/runtimeContext';
import { useBoardLifecycleStore } from '../../../../../store/boardLifecycle';
import { notifyDefaultAppSet } from '../../../default-app/notifyDefaultAppSet';
import { useAppSSE } from '../../hooks/useAppSSE';
import { useAppWebSocket } from '../../hooks/useAppWebSocket';
import { LINE_SEPARATOR } from '../../utils/constants';

export type UseAppDetailRuntimeLogic = (
  app?: AppDetailedInfo,
  appBricks?: AppBrickListItem[],
  // The app's root entries. A `python` / `sketch` folder there is what says
  // which log streams the running app has.
  rootNodes?: TreeNode[],
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
  appBricks?: AppBrickListItem[],
  rootNodes?: TreeNode[],
  openApp?: (app: AppDetailedInfo) => void,
  updateApp?: (request: UpdateAppDetailRequest) => Promise<boolean>,
  updateAppBricks?: (
    bricks: Record<string, BrickCreateUpdateRequest>,
  ) => Promise<boolean>,
): ReturnType<UseAppDetailRuntimeLogic> {
  const { formatMessage } = useI18n();
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
    consoleState: {
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
  const { status, showRequiredDialog } = useContext(CloudConnectorContext);

  const { getInstalledModel } = useInstalledAIModels();

  // The agent can only ask; the Edge Impulse key stays with App Lab, so the user picks the model in this dialog.
  // Being subscribed is what tells Main to hand the request over directly instead of stashing it and navigating.
  const appId = app?.id;
  const bricksLoaded = appBricks !== undefined;
  useEffect(() => {
    if (!appId) {
      return;
    }
    setModelImportSubscribed(appId, true);
    // The dialog names the model in its message, so resolve it like the run-time check below does.
    const openPicker = (brickId: string): void =>
      aiModelRequired.open({
        brickId,
        modelId: appBricks?.find((brick) => brick.id === brickId)?.model,
      });

    const stashed = peekPendingModelImport(appId);
    // Only the bricks name the model, so a request that beats them is parked for the rerun their arrival causes.
    if (stashed && bricksLoaded) {
      clearPendingModelImport(appId);
      openPicker(stashed);
    }
    const unsubscribe = onAgentModelImport((requestedApp, brickId) => {
      if (requestedApp !== appId) {
        return;
      }
      if (bricksLoaded) {
        openPicker(brickId);
      } else {
        stashModelImport(appId, brickId);
      }
    });
    return () => {
      setModelImportSubscribed(appId, false);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, appBricks]);

  const startApp = useCallback((): void => {
    if (!app) return;
    runAction(app, setOpen);
    setActivePanel('console');
  }, [app, runAction]);

  const runApp = useCallback((): void => {
    if (!app) return;

    const brickNeedingProvisioning =
      status?.provisioning !== 'provisioned' &&
      appBricks?.some((brick) => brick.id === 'arduino:arduino_cloud');
    if (brickNeedingProvisioning) {
      showRequiredDialog();
      return;
    }

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
      startApp();
    }
  }, [
    app,
    status?.provisioning,
    appBricks,
    showRequiredDialog,
    getInstalledModel,
    aiModelRequired,
    startApp,
  ]);

  const setAsDefaultApp = useCallback(
    async (isSelected: boolean): Promise<void> => {
      if (!updateApp || !app) return;
      const result = await updateApp({
        default: isSelected,
      });
      if (result && isSelected) {
        notifyDefaultAppSet(app, formatMessage);
      }
    },
    [app, formatMessage, updateApp],
  );

  const onMessageLogs = useCallback(
    (message: MessageData) => {
      // Brick containers get one tab each, labeled "brick_id [container_name]".
      const tabKey =
        message.id !== CONSOLE_SOURCE_KEYS.PYTHON
          ? `${message.id} [${message.container_name}]`
          : message.id;
      if (!tabKey) return; // some bricks emit empty ids: skip to avoid a bogus tab
      if (app?.id) {
        appendData(app.id, tabKey, message, true);
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
    trimMessageStart: false,
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

    setActivePanel('console');
    stopAction(app);
  }, [app, stopAction]);

  useEffect(() => {
    if (
      currentActionStatus !== ActionStatus.Pending &&
      app?.status !== 'running'
    ) {
      resetCurrentAction();
    }
  }, [app?.status, currentActionStatus, resetCurrentAction]);

  // The streams stay open until the app status leaves 'running', so output
  // written while the app shuts down still arrives. No stream connects while a
  // stop is in progress: every log connect replays the tail, so a page opened
  // again during a stop would print that history twice. A failed stop leaves
  // the app running, so connecting is allowed again once the stop has errored.
  const isStopping =
    currentAction === Action.Stop &&
    currentActionStatus !== ActionStatus.Errored;

  useEffect(() => {
    const appId = app?.id;
    if (!appId || !rootNodes || app?.status !== 'running' || isStopping) {
      return;
    }

    const hasRootFolder = (name: string): boolean =>
      rootNodes.some((node) => node.type === 'folder' && node.name === name);

    if (hasRootFolder('python')) {
      if (!getAppLogsAbortController.current) {
        getAppLogsStream(appId);
      }
    }

    if (hasRootFolder('sketch')) {
      createMonitorSourceOnMsg.current = true;
      addConsoleSource(appId, CONSOLE_SOURCE_KEYS.SERIAL_MONITOR);
      if (!socketRef.current && !socketIsConnectingRef.current) {
        getSerialMonitorLogsStream();
      }
    }
  }, [
    addConsoleSource,
    app?.id,
    app?.status,
    rootNodes,
    isStopping,
    getAppLogsAbortController,
    getAppLogsStream,
    getSerialMonitorLogsStream,
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
          // "App launch" is only relevant while starting, so drop it but keep
          // the real log sources so their history survives navigation.
          const currentKeys = Object.keys(consoleSources[currentAppId] || {});
          resetConsoleSources(
            currentAppId,
            currentKeys.filter((k) => k !== CONSOLE_SOURCE_KEYS.STARTUP),
          );
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

  // The source reset below clears the active tab in the same commit as this
  // effect and its update lands later, so the Python choice has to be
  // re-asserted once the tab is empty again. While stopping it is not, because
  // the stop log goes to "App launch".
  const pythonTabAppliedRef = useRef(false);
  useEffect(() => {
    const currentAppId = app?.id;
    if (!currentAppId) return;

    if (app?.status !== 'running') {
      pythonTabAppliedRef.current = false;
      return;
    }
    if (currentAction === Action.Stop) return;

    const currentTabs = consoleTabs[currentAppId] || [];
    if (!currentTabs.includes(CONSOLE_SOURCE_KEYS.PYTHON)) return;

    // A tab the user picked stays picked; only an empty one is re-asserted.
    if (pythonTabAppliedRef.current && activeConsoleTab[currentAppId]) return;

    pythonTabAppliedRef.current = true;
    setActiveConsoleTab(currentAppId, CONSOLE_SOURCE_KEYS.PYTHON);
  }, [
    app?.status,
    app?.id,
    activeConsoleTab,
    consoleTabs,
    currentAction,
    setActiveConsoleTab,
  ]);

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

    // "App launch" is transient, so keep it only while an action runs; the
    // real log sources are kept below whenever the app is running.
    if (
      currentAction !== null ||
      !!prevCurrentAction ||
      app?.status === 'running'
    ) {
      const currentKeys = Object.keys(consoleSources[app?.id || ''] || {});
      keysToRemain.push(
        ...currentKeys.filter((k) => k !== CONSOLE_SOURCE_KEYS.STARTUP),
      );
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
        // This closure holds the bricks from before the save, so running the
        // Run checks again here would reopen this dialog.
        if (result) {
          startApp();
        }
        return result;
      },
    });

  const configureAppBricksDialogLogic = useCallback(
    useConfigureAppBricksDialogLogic,
    [appBricks, configureAppBricksDialogOpen, startApp, updateAppBricks],
  );

  const isActiveApp =
    activeApp?.id === app?.id ||
    !!consoleSources[app?.id || ''] ||
    app?.status === 'running';

  const swapRunningAppDialogLogic: SwapRunningAppDialogLogic = useCallback(
    () => ({
      open,
      setOpen,
      runningAppName: runningApp?.name ?? '',
      newAppName: app?.name ?? '',
      runningAppIsDefault: !!runningApp && runningApp.id === defaultApp?.id,
      handleSwap: (): void => {
        if (!app) return;
        swapAction(app);
        setOpen(false);
      },
    }),
    [app, defaultApp?.id, open, runningApp, swapAction],
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
