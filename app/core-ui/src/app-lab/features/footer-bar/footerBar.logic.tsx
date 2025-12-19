import {
  checkAndApplyUpdate,
  getConnectionName,
  getCurrentVersion,
  getSystemResources,
  newVersion,
  openBoardTerminal,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { ArduinoLoop } from '@cloud-editor-mono/images/assets/icons';
import { SystemResourcesStreamMessageType } from '@cloud-editor-mono/infrastructure';
import {
  FooterBarLogic,
  FooterItem,
  Notification,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useContext, useEffect, useRef, useState } from 'react';

import { useIsBoard } from '../../hooks/board';
import { BoardConfigurationContext } from '../../providers/board-configuration/boardConfigurationContext';
import { NetworkContext } from '../../providers/network/networkContext';
import { RuntimeContext } from '../../providers/runtime/runtimeContext';
import { SetupContext } from '../../providers/setup/setupContext';
import { useBoardLifecycleStore } from '../../store/boards/boards';
import { useCreateAppTitleLogic } from '../app-detail/appDetailTitle.logic';
import { messages } from './messages';

const placeholderFooterItems: FooterItem[] = [
  {
    id: 'board',
  },
  {
    id: 'root',
  },
  {
    id: 'user',
  },
  {
    id: 'ram',
  },
  {
    id: 'cpu',
  },
  {
    id: 'network',
  },
  {
    id: 'ip',
  },
];

const bytesToGiB = (bytes: unknown): string =>
  ((bytes as number) / 1024 / 1024 / 1024).toFixed(2);

const getUsedPercent = (used: unknown, total: unknown): number =>
  ((used as number) / (total as number)) * 100;

// Temporarily disable footer update notifications in favour of BoardUpdateDialog
const enableFooterUpdate = false;

export const useFooterBarLogic: FooterBarLogic =
  function (): ReturnType<FooterBarLogic> {
    const { formatMessage } = useI18n();
    const { data: isBoard } = useIsBoard();
    const [terminalError, setTerminalError] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [items, setItems] = useState<FooterItem[]>([
      ...placeholderFooterItems,
    ]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [newNotifications, setNewNotifications] = useState<number>(0);

    const resourcesStreamAbortController = useRef<AbortController>();
    const resourcesStreamGuard = useRef<boolean>(false);

    const runtimeContext = useContext(RuntimeContext);

    const { boardIsReachable, selectedConnectedBoard: selectedBoard } =
      useBoardLifecycleStore();

    const { data: currentVersion } = useQuery(
      ['current-version'],
      () => getCurrentVersion(),
      {
        refetchOnWindowFocus: false,
      },
    );

    useEffect(() => {
      enableFooterUpdate &&
        newVersion()
          .then((v: string) => {
            if (v !== '') {
              console.log('New version available:', v);
              setNewNotifications((prev) => prev + 1);
              setNotifications((prev) => [
                ...prev,
                {
                  icon: <ArduinoLoop />,
                  label: formatMessage(messages.updateAvailable),
                  tooltip: formatMessage(messages.updateAvailableTooltip, {
                    v,
                  }),
                  onClick: checkAndApplyUpdate,
                },
              ]);
            }
          })
          .catch((error: Error) => {
            console.error('Error calling NewVersion:', error);
          });

      return () => {
        resourcesStreamAbortController.current?.abort();
      };

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { mutate: openStream } = useMutation({
      mutationFn: async () => {
        if (!boardIsReachable) {
          return;
        }

        return getSystemResources(
          {
            onopen: undefined,
            onclose: () => {
              if (!resourcesStreamAbortController.current?.signal.aborted) {
                resourcesStreamAbortController.current?.abort();
                setTimeout(() => {
                  openStream();
                }, 3000);
              }
            },
            onerror: undefined,
            onmessage: (event) => {
              const messageType = event.event;
              const data = JSON.parse(event.data);

              setItems((prev) =>
                prev.map((item) => {
                  if (
                    messageType === SystemResourcesStreamMessageType.Cpu &&
                    item.id === 'cpu'
                  ) {
                    return {
                      ...item,
                      label: formatMessage(messages.cpu, {
                        used: (data.used_percent as number).toFixed(0),
                      }),
                      state: data.used_percent > 80 ? 'warning' : undefined,
                    };
                  }
                  if (
                    messageType === SystemResourcesStreamMessageType.Memory &&
                    item.id === 'ram'
                  ) {
                    return {
                      ...item,
                      label: formatMessage(messages.memory, {
                        used: bytesToGiB(data.used),
                        total: bytesToGiB(data.total),
                      }),
                      state:
                        getUsedPercent(data.used, data.total) > 80
                          ? 'warning'
                          : undefined,
                    };
                  }
                  if (
                    messageType === SystemResourcesStreamMessageType.Disk &&
                    item.id === 'user' &&
                    data.path === '/home/arduino' // return only home directory disk usage
                  ) {
                    return {
                      ...item,
                      label: formatMessage(messages.disk, {
                        path: 'USER',
                        used: bytesToGiB(data.used),
                        total: bytesToGiB(data.total),
                      }),
                      state:
                        getUsedPercent(data.used, data.total) > 90
                          ? 'warning'
                          : undefined,
                    };
                  }
                  if (
                    messageType === SystemResourcesStreamMessageType.Disk &&
                    item.id === 'root' &&
                    data.path === '/'
                  ) {
                    return {
                      ...item,
                      label: formatMessage(messages.disk, {
                        path: 'ROOT',
                        used: bytesToGiB(data.used),
                        total: bytesToGiB(data.total),
                      }),
                      state:
                        getUsedPercent(data.used, data.total) > 90
                          ? 'warning'
                          : undefined,
                    };
                  }
                  return item;
                }),
              );
            },
          },
          resourcesStreamAbortController.current,
        );
      },
      onMutate: () => {
        resourcesStreamAbortController.current = new AbortController();
      },
    });

    useEffect(() => {
      // This is needed in react strict mode to avoid double streams
      // useEffect cleanup might occur before the abort controller is able to stop previous stream
      if (resourcesStreamGuard.current) {
        return;
      }
      resourcesStreamGuard.current = true;

      openStream();

      return () => {
        resourcesStreamAbortController.current?.abort();
      };
    }, [openStream]);

    const resetNewNotifications = (): void => {
      setNewNotifications(0);
    };

    const { boardConfigurationIsSet, boardName } = useContext(
      BoardConfigurationContext,
    );

    const { isConnected } = useContext(NetworkContext);
    const { data: connectingName } = useQuery(
      ['connection-name'],
      async () => getConnectionName(),
      {
        refetchOnWindowFocus: false,
        enabled: boardIsReachable && isConnected,
      },
    );

    useEffect(() => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === 'board') {
            if (boardIsReachable) {
              return {
                ...item,
                label: boardConfigurationIsSet
                  ? `${boardName} (Arduino UNO Q)`
                  : 'Arduino UNO Q',
                state: 'default',
              };
            }
            return {
              id: 'board',
              state: 'inactive',
            };
          }
          return item;
        }),
      );
    }, [boardName, boardIsReachable, boardConfigurationIsSet]);

    useEffect(() => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === 'ip') {
            if (boardIsReachable && selectedBoard && selectedBoard.address) {
              return {
                ...item,
                label: formatMessage(messages.ip, {
                  type: 'IP',
                  ip: selectedBoard.address,
                }),
              };
            }
          }
          return item;
        }),
      );
    }, [boardIsReachable, formatMessage, selectedBoard]);

    const { setSetupCompleted } = useContext(SetupContext);
    useEffect(() => {
      if (boardIsReachable) {
        setItems((prev) =>
          prev.map((item) => {
            if (item.id === 'network') {
              return {
                ...item,
                label: connectingName ?? undefined,
                state: isConnected ? 'default' : 'inactive',
                onClick: !isConnected
                  ? (): void => {
                      setSetupCompleted(false);
                    }
                  : undefined,
              };
            }
            return item;
          }),
        );
      }
    }, [boardIsReachable, isConnected, connectingName, setSetupCompleted]);

    const onOpenTerminal = async (): Promise<void> => {
      try {
        setTerminalError(null);
        await openBoardTerminal();
      } catch (e) {
        setTerminalError((e as Error).message);
        setTimeout(() => setTerminalError(null), 6000);
      }
    };

    return {
      runtimeContext,
      currentVersion: currentVersion || '',
      notifications,
      newNotifications,
      resetNewNotifications,
      items,
      useCreateAppTitleLogic,
      onOpenTerminal,
      isBoard: isBoard || false,
      terminalError,
    };
  };
