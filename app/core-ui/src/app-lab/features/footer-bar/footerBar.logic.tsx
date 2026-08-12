import {
  checkAndApplyUpdate,
  getConnectionName,
  getCurrentVersion,
  getIPAddress,
  newVersion,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { ArduinoLoop } from '@cloud-editor-mono/images/assets/icons';
import { AppDetailedInfo } from '@cloud-editor-mono/infrastructure';
import {
  FooterBarLogic,
  SystemResources,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { useContext, useEffect, useState } from 'react';

import { BoardScopedQuery } from '../../boardScopedQuery';
import { useAgentModeSeen } from '../../hooks/useAgentModeSeen';
import { useBoardItem } from '../../hooks/useBoardItem';
import { UseBoards } from '../../hooks/useBoards';
import { useIsBoard } from '../../hooks/useIsBoard';
import { useTerminal } from '../../hooks/useTerminal';
import { BoardResourcesContext } from '../../providers/board-resources/boardResourcesContext';
import { useFooterNotifications } from '../../providers/footer-notifications/footerNotificationsContext';
import { LanguageServerContext } from '../../providers/language-server/languageServerContext';
import { NetworkContext } from '../../providers/network/networkContext';
import { RuntimeContext } from '../../providers/runtime/runtimeContext';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { useAgentModeEntryShineLogic } from './agentModeEntryShine.logic';
import { useAgentModeTooltipLogic } from './agentModeTooltip.logic';
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
    const router = useRouter();
    const aiAssistantActive = useRouterState({
      select: (state) => state.location.pathname.startsWith('/ai-assistant'),
    });

    const { data: isBoard } = useIsBoard();

    const { boardItem } = useBoardItem();

    const {
      boards,
      selectedBoard,
      selectBoard,
      autoSelectBoard,
      showBoardConnPswPrompt,
      onConnPswCancel,
      onConnPswSubmit,
      isConnectingToBoard,
      connToBoardError,
    } = boardsProps;

    const linuxCredentialsDialog = {
      open: showBoardConnPswPrompt,
      onOpenChange: (isOpen: boolean): void => {
        if (!isOpen) onConnPswCancel();
      },
      onSubmit: onConnPswSubmit,
      onCancel: onConnPswCancel,
      isLoading: isConnectingToBoard,
      error: connToBoardError,
    };

    const { onOpenTerminal, terminalError } = useTerminal();

    const [systemResources, setSystemResources] = useState<SystemResources>({
      root: {},
      user: {},
      ram: {},
      cpu: {},
      npu: {},
      network: {},
    });

    const {
      notifications,
      newNotifications,
      setNotification,
      resetNewNotifications,
    } = useFooterNotifications();

    const runtimeContext = useContext(RuntimeContext);
    const { resources } = useContext(BoardResourcesContext);

    const boardIsReachable = useBoardLifecycleStore(
      (state) => state.boardIsReachable,
    );
    const { markAgentModeHintSeen } = useAgentModeSeen();
    const agentModeTooltip = useAgentModeTooltipLogic(aiAssistantActive);
    const { shine: agentModeEntryShine, markEntryClicked } =
      useAgentModeEntryShineLogic(aiAssistantActive);

    const { data: currentVersion } = useQuery(['current-version'], () =>
      getCurrentVersion(),
    );

    useEffect(() => {
      enableFooterUpdate &&
        newVersion()
          .then((v: string) => {
            if (v !== '') {
              setNotification({
                icon: <ArduinoLoop />,
                label: formatMessage(messages.updateAvailable),
                tooltip: formatMessage(messages.updateAvailableTooltip, {
                  v,
                }),
                onClick: checkAndApplyUpdate,
              });
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
              value: {
                used: resources.cpuPercentage,
                total: 100,
              },
            }
          : prev.cpu,
        npu: resources.npuPercentage
          ? {
              label: formatMessage(messages.npu, {
                used: (resources.npuPercentage as number).toFixed(0),
              }),
              state: resources.npuPercentage > 80 ? 'warning' : undefined,
              value: {
                used: resources.npuPercentage,
                total: 100,
              },
            }
          : prev.npu,
        ...[
          { key: 'ram', value: resources.ram },
          { key: 'user', value: resources.homeDisk, path: 'User' },
          { key: 'root', value: resources.rootDisk, path: 'Root' },
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
                  value,
                }
              : prev[key as keyof SystemResources],
          }),
          {},
        ),
      }));
    }, [formatMessage, resources]);

    const { isConnected } = useContext(NetworkContext);
    const { data: connectingName } = useQuery(
      [BoardScopedQuery.CONNECTION_NAME],
      async () => getConnectionName(),
      {
        enabled: boardIsReachable && isConnected,
      },
    );

    const { data: boardIP } = useQuery(
      [BoardScopedQuery.IP_ADDRESS],
      async () => getIPAddress(),
      {
        enabled: boardIsReachable,
      },
    );

    useEffect(() => {
      if (boardIsReachable) {
        setSystemResources((prev) => {
          const newItems = { ...prev };
          newItems.network = {
            ...newItems.network,
            label: connectingName ?? undefined,
            state: isConnected ? 'default' : 'inactive',
            onClick: (): void => {
              navigate({
                to: '/settings',
                hash: 'network',
                hashScrollIntoView: { block: 'nearest', inline: 'nearest' },
                search: { openNetworkDialog: !isConnected },
              });
            },
          };
          return newItems;
        });
      }
    }, [boardIsReachable, isConnected, connectingName, navigate]);

    const onOpenApp = (app: AppDetailedInfo): void => {
      navigate({
        to: `/${app.example ? 'examples' : 'my-apps'}/${app.id}`,
      });
    };

    const { lspId, lspState } = useContext(LanguageServerContext);

    const onOpenAiAssistant = (): void => {
      if (aiAssistantActive) {
        router.history.back();
        return;
      }
      markAgentModeHintSeen('banner');
      markEntryClicked();

      navigate({ to: '/ai-assistant' });
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
      onOpenAiAssistant,
      aiAssistantActive,
      agentModeTooltip,
      agentModeEntryShine,
      onOpenTerminal,
      isBoard: isBoard || false,
      terminalError,
      boards,
      selectedBoard,
      lspId,
      lspState,
      bytesToGiB,
      selectBoard,
      autoSelectBoard,
      showBoardConnPswPrompt,
      onConnPswCancel,
      onConnPswSubmit,
      isConnectingToBoard,
      connToBoardError,
      linuxCredentialsDialog,
    };
  };
};
