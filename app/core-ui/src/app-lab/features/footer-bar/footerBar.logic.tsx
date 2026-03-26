import {
  checkAndApplyUpdate,
  getConnectionName,
  getCurrentVersion,
  newVersion,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { ArduinoLoop } from '@cloud-editor-mono/images/assets/icons';
import { AppDetailedInfo } from '@cloud-editor-mono/infrastructure';
import {
  FooterBarLogic,
  Notification,
  SystemResources,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useContext, useEffect, useMemo, useState } from 'react';

import { useBoardItem } from '../../hooks/useBoardItem';
import { UseBoards } from '../../hooks/useBoards';
import { useIsBoard } from '../../hooks/useIsBoard';
import { useTerminal } from '../../hooks/useTerminal';
import { BoardResourcesContext } from '../../providers/board-resources/boardResourcesContext';
import { NetworkContext } from '../../providers/network/networkContext';
import { RuntimeContext } from '../../providers/runtime/runtimeContext';
import { SetupContext } from '../../providers/setup/setupContext';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { messages } from './messages';

const bytesToGiB = (bytes: unknown): string =>
  ((bytes as number) / 1024 / 1024 / 1024).toFixed(2);

const getUsedPercent = (used: unknown, total: unknown): number =>
  ((used as number) / (total as number)) * 100;

// Temporarily disable footer update notifications in favour of BoardUpdateDialog
const enableFooterUpdate = false;

export const createUseFooterBarLogic = function (
  boardsProps: ReturnType<UseBoards>,
): FooterBarLogic {
  return function useFooterBarLogic(): ReturnType<FooterBarLogic> {
    const { formatMessage } = useI18n();
    const navigate = useNavigate();

    const { data: isBoard } = useIsBoard();

    const { boardItem } = useBoardItem();

    const { boards, selectedBoard, autoSelectBoard } = boardsProps;

    const { onOpenTerminal, terminalError } = useTerminal();

    const [systemResources, setSystemResources] = useState<SystemResources>({
      root: {},
      user: {},
      ram: {},
      cpu: {},
      network: {},
    });

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [newNotifications, setNewNotifications] = useState<number>(0);

    const runtimeContext = useContext(RuntimeContext);
    const { resources } = useContext(BoardResourcesContext);

    const boardIsReachable = useBoardLifecycleStore(
      (state) => state.boardIsReachable,
    );

    const { data: currentVersion } = useQuery(['current-version'], () =>
      getCurrentVersion(),
    );

    useEffect(() => {
      enableFooterUpdate &&
        newVersion()
          .then((v: string) => {
            if (v !== '') {
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (!resources) {
        return;
      }

      setSystemResources((prev) => ({
        ...prev,
        cpu: resources.cpuPercentage
          ? {
              label: formatMessage(messages.cpu, {
                used: (resources.cpuPercentage as number).toFixed(0),
              }),
              state: resources.cpuPercentage > 80 ? 'warning' : undefined,
            }
          : prev.cpu,
        ...[
          { key: 'ram', value: resources.ram },
          { key: 'user', value: resources.homeDisk, path: 'USER' },
          { key: 'root', value: resources.rootDisk, path: 'ROOT' },
        ].reduce(
          (obj, { key, value, path }) => ({
            ...obj,
            [key]: value
              ? {
                  label: formatMessage(
                    messages[key === 'ram' ? 'memory' : 'disk'],
                    {
                      used: bytesToGiB(value.used),
                      total: bytesToGiB(value.total),
                      path,
                    },
                  ),
                  state:
                    getUsedPercent(value.used, value.total) > 80
                      ? 'warning'
                      : undefined,
                }
              : prev[key as keyof SystemResources],
          }),
          {},
        ),
      }));
    }, [formatMessage, resources]);

    const resetNewNotifications = (): void => {
      setNewNotifications(0);
    };

    const { isConnected } = useContext(NetworkContext);
    const { data: connectingName } = useQuery(
      ['connection-name'],
      async () => getConnectionName(),
      {
        enabled: boardIsReachable && isConnected,
      },
    );

    const boardIP = useMemo(() => {
      if (!boardIsReachable || !selectedBoard?.address) {
        return;
      }

      return formatMessage(messages.ip, {
        type: 'IP',
        ip: selectedBoard.address,
      });
    }, [boardIsReachable, selectedBoard?.address, formatMessage]);

    const { setSetupCompleted, setNetworkStepSkipped } =
      useContext(SetupContext);
    useEffect(() => {
      if (boardIsReachable) {
        setSystemResources((prev) => {
          const newItems = { ...prev };
          newItems.network = {
            ...newItems.network,
            label: connectingName ?? undefined,
            state: isConnected ? 'default' : 'inactive',
            onClick: !isConnected
              ? (): void => {
                  setSetupCompleted(false);
                  setNetworkStepSkipped(false);
                }
              : undefined,
          };
          return newItems;
        });
      }
    }, [
      boardIsReachable,
      isConnected,
      connectingName,
      setSetupCompleted,
      setNetworkStepSkipped,
    ]);

    const onOpenApp = (app: AppDetailedInfo): void => {
      navigate({
        to: `/${app.example ? 'examples' : 'my-apps'}/${app.id}`,
      });
    };

    return {
      runtimeContext,
      currentVersion: currentVersion || '',
      notifications,
      newNotifications,
      resetNewNotifications,
      systemResources,
      boardItem,
      boardIP,
      onOpenApp,
      onOpenTerminal,
      isBoard: isBoard || false,
      terminalError,
      boards,
      selectedBoard,
      autoSelectBoard,
    };
  };
};
