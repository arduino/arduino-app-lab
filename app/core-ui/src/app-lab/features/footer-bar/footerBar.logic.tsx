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
  FormatMessage,
  LinuxCredentialsDialogLogic,
  SystemResource,
  SystemResources,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { useCallback, useContext, useEffect, useMemo } from 'react';
import { MessageDescriptor } from 'react-intl';

import { BoardScopedQuery } from '../../boardScopedQuery';
import { useAgentModeSeen } from '../../hooks/useAgentModeSeen';
import { useBoardItem } from '../../hooks/useBoardItem';
import { UseBoards } from '../../hooks/useBoards';
import { useIsBoard } from '../../hooks/useIsBoard';
import { useTerminal } from '../../hooks/useTerminal';
import { useFooterNotifications } from '../../providers/footer-notifications/footerNotificationsContext';
import { LanguageServerContext } from '../../providers/language-server/languageServerContext';
import { NetworkContext } from '../../providers/network/networkContext';
import { RuntimeContext } from '../../providers/runtime/runtimeContext';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import {
  bytesToGiB,
  getUsedPercent,
  useBoardResourcesStore,
} from '../../store/boardResources';
import { useNetworkSettingsDialogStore } from '../../store/networkSettingsDialog';
import { useAgentModeEntryShineLogic } from './agentModeEntryShine.logic';
import { useAgentModeTooltipLogic } from './agentModeTooltip.logic';
import { messages } from './messages';

const WARNING_PERCENT = 80;

const percentResource = (
  formatMessage: FormatMessage,
  message: MessageDescriptor,
  percentage: number | undefined,
): SystemResource =>
  percentage == undefined
    ? {}
    : {
        label: formatMessage(message, { used: percentage.toFixed(0) }),
        state: percentage > WARNING_PERCENT ? 'warning' : undefined,
        value: { used: percentage, total: 100 },
      };

const sizeResource = (
  formatMessage: FormatMessage,
  message: MessageDescriptor,
  value: { used: number; total: number } | undefined,
  path?: string,
): SystemResource =>
  value === undefined
    ? {}
    : {
        label: formatMessage(message, {
          used: bytesToGiB(value.used),
          total: bytesToGiB(value.total),
          path,
        }),
        state:
          getUsedPercent(value.used, value.total) > WARNING_PERCENT
            ? 'warning'
            : undefined,
        value,
      };

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

    const linuxCredentialsDialog: LinuxCredentialsDialogLogic = () => ({
      open: showBoardConnPswPrompt,
      onOpenChange: (isOpen: boolean): void => {
        if (!isOpen) onConnPswCancel();
      },
      onSubmit: onConnPswSubmit,
      onCancel: onConnPswCancel,
      isLoading: isConnectingToBoard,
      error: connToBoardError,
    });

    const { onOpenTerminal } = useTerminal();

    const {
      notifications,
      newNotifications,
      setNotification,
      resetNewNotifications,
    } = useFooterNotifications();

    const runtimeContext = useContext(RuntimeContext);
    const resources = useBoardResourcesStore((state) => state.resources);

    const boardIsReachable = useBoardLifecycleStore(
      (state) => state.boardIsReachable,
    );
    const { markAgentModeHintSeen } = useAgentModeSeen();
    const agentModeTooltip = useAgentModeTooltipLogic(aiAssistantActive);
    const { shine: agentModeEntryShine, markEntryClicked } =
      useAgentModeEntryShineLogic(aiAssistantActive);

    const { data: currentVersion } = useQuery({
      queryKey: ['current-version'],

      queryFn: () => getCurrentVersion(),
    });

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

    const { isConnected } = useContext(NetworkContext);
    const { data: connectingName } = useQuery({
      queryKey: [BoardScopedQuery.CONNECTION_NAME],
      queryFn: async () => getConnectionName(),
      enabled: boardIsReachable && isConnected,
    });

    const { data: boardIP } = useQuery({
      queryKey: [BoardScopedQuery.IP_ADDRESS],
      queryFn: async () => getIPAddress(),
      enabled: boardIsReachable,
    });

    const setNetworkSettingsDialogOpen = useNetworkSettingsDialogStore(
      (state) => state.setOpen,
    );

    const onNetworkClick = useCallback((): void => {
      if (router.state.location.pathname === '/settings') {
        setNetworkSettingsDialogOpen(true);
      } else {
        navigate({
          to: '/settings',
          hash: 'network',
          hashScrollIntoView: { block: 'nearest', inline: 'nearest' },
          search: { openNetworkDialog: true },
        });
      }
    }, [navigate, router, setNetworkSettingsDialogOpen]);

    const cpu = useMemo(
      () =>
        percentResource(formatMessage, messages.cpu, resources?.cpuPercentage),
      [formatMessage, resources?.cpuPercentage],
    );

    const npu = useMemo(
      () =>
        percentResource(formatMessage, messages.npu, resources?.npuPercentage),
      [formatMessage, resources?.npuPercentage],
    );

    const ram = useMemo(
      () => sizeResource(formatMessage, messages.memory, resources?.ram),
      [formatMessage, resources?.ram],
    );

    const user = useMemo(
      () =>
        sizeResource(formatMessage, messages.disk, resources?.homeDisk, 'User'),
      [formatMessage, resources?.homeDisk],
    );

    const root = useMemo(
      () =>
        sizeResource(formatMessage, messages.disk, resources?.rootDisk, 'Root'),
      [formatMessage, resources?.rootDisk],
    );

    const network = useMemo<SystemResource>(
      () => ({
        label: boardIsReachable ? connectingName ?? undefined : undefined,
        state: boardIsReachable && isConnected ? 'default' : 'inactive',
        onClick: boardIsReachable ? onNetworkClick : undefined,
      }),
      [boardIsReachable, connectingName, isConnected, onNetworkClick],
    );

    const systemResources = useMemo<SystemResources>(
      () => ({ root, user, ram, cpu, npu, network }),
      [root, user, ram, cpu, npu, network],
    );

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
