import { isFFEnabled } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  HardwareCpu,
  HardwareNpu,
  HardwareRam,
  Spinner,
  StatusError,
  Stop,
} from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  useI18n,
  useTooltip,
  XXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useCallback } from 'react';

import { LinuxCredentialsDialog } from '../../../dialogs';
import { ArcSpinner } from '../../../essential/loader';
import { BoardSection } from '../board-section';
import { Action, ActionStatus } from '../runtime-actions';
import styles from './footer-bar.module.scss';
import { FooterBarProps } from './FooterBar.type';
import { messages } from './messages';
import { AgentModeTooltip } from './sub-components/agent-mode-tooltip/AgentModeTooltip';
import { AiAssistantEntry } from './sub-components/ai-assistant-entry/AiAssistantEntry';
import { BoardHardware } from './sub-components/board-hardware/BoardHardware';
import { BoardStorage } from './sub-components/board-storage/BoardStorage';
import { Network } from './sub-components/network/Network';
import { Notification } from './sub-components/notification/Notification';
import { System } from './sub-components/system/System';

const FooterBar: React.FC<FooterBarProps> = (props: FooterBarProps) => {
  const { formatMessage } = useI18n();
  const { footerBarLogic } = props;
  const {
    systemResources,
    boardItem,
    boardIP,
    newNotifications = 0,
    resetNewNotifications,
    runtimeContext,
    currentVersion,
    notifications,
    onOpenApp,
    onOpenAiAssistant,
    aiAssistantActive,
    agentModeTooltip,
    agentModeEntryShine,
    onOpenTerminal,
    terminalError,
    isBoard,
    boards,
    selectedBoard,
    lspId,
    lspState,
    bytesToGiB,
    selectBoard,
    linuxCredentialsDialog,
  } = footerBarLogic();

  const showVersion = isFFEnabled('SHOW_VERSION_IN_FOOTER');
  const showAiAssistant = isFFEnabled('AI_ASSISTANT');

  const {
    appsStatus: { runningApp },
    runtimeActions: { currentAction, currentActionStatus, stopAction },
  } = runtimeContext;

  const stopApp = useCallback((): void => {
    if (!runningApp) return;
    stopAction(runningApp);
  }, [runningApp, stopAction]);

  const stopDisabled =
    currentActionStatus === ActionStatus.Pending &&
    currentAction === Action.Stop;

  const { props: tooltipPropsAppName, renderTooltip: renderTooltipAppName } =
    useTooltip({
      content: runningApp?.name,
      timeout: 0,
    });

  const { props: tooltipLspLoading, renderTooltip: renderTooltipLspLoading } =
    useTooltip({
      content: formatMessage(messages.lspLoadingTooltip, {
        progress: lspState?.type === 'progress' ? lspState.progress : 0,
      }),
      timeout: 0,
    });

  // Mirrors the loading tooltip: the failure occupies the same footer slot, so
  // the reason belongs on hover rather than in a banner over the editor.
  const { props: tooltipLspError, renderTooltip: renderTooltipLspError } =
    useTooltip({
      content:
        lspState?.type === 'error' && lspState.message
          ? formatMessage(messages.lspErrorTooltip, {
              reason: lspState.message,
            })
          : formatMessage(messages.lspErrorTooltipNoReason),
      timeout: 0,
    });

  return (
    <footer className={styles['footer-bar']}>
      <div className={styles['footer-content']}>
        {/* Left section */}
        <div className={styles['footer-section--left']}>
          {/* Board section */}
          {boardItem ? (
            <BoardSection
              boardItem={boardItem}
              isBoard={isBoard}
              boards={boards}
              selectedBoard={selectedBoard}
              selectBoard={selectBoard}
              onOpenTerminal={onOpenTerminal}
              terminalError={terminalError}
            />
          ) : null}
        </div>

        {/* Center resources section */}
        <div
          className={clsx(
            styles['footer-section--center'],
            styles['footer-badge'],
            styles['xl'],
          )}
        >
          {systemResources.root || systemResources.user ? (
            <BoardStorage
              boardType={selectedBoard?.type}
              systemResources={systemResources}
              bytesToGiB={bytesToGiB}
            />
          ) : null}

          {systemResources.ram ? (
            <BoardHardware
              icon={<HardwareRam />}
              title={`${bytesToGiB(
                systemResources.ram?.value?.used ?? 0,
              )}/${bytesToGiB(systemResources.ram?.value?.total ?? 0)} GB`}
              label={systemResources.ram?.label}
              warning={systemResources.ram?.state === 'warning'}
            />
          ) : null}

          {systemResources.npu?.label ? (
            <BoardHardware
              icon={<HardwareNpu />}
              title={`${systemResources.npu.value?.used?.toFixed(0)}%`}
              label={systemResources.npu?.label}
              warning={systemResources.npu?.state === 'warning'}
            />
          ) : null}

          {systemResources.cpu ? (
            <BoardHardware
              icon={<HardwareCpu />}
              title={`${systemResources.cpu.value?.used?.toFixed(0)}%`}
              label={systemResources.cpu?.label}
              warning={systemResources.cpu?.state === 'warning'}
            />
          ) : null}
        </div>

        {/* Right section */}
        <div className={styles['footer-section--right']}>
          {lspState?.type === 'progress' && (
            <div
              className={styles['lsp-loading-container']}
              {...tooltipLspLoading}
            >
              <ArcSpinner />
              <XXSmall className={styles['lsp-loading-title']}>{lspId}</XXSmall>
              {renderTooltipLspLoading()}
            </div>
          )}
          {lspState?.type === 'error' && (
            <div
              className={clsx(
                styles['lsp-loading-container'],
                styles['lsp-error-container'],
              )}
              {...tooltipLspError}
            >
              <StatusError />
              <XXSmall className={styles['lsp-loading-title']}>{lspId}</XXSmall>
              {renderTooltipLspError()}
            </div>
          )}
          {runningApp ? (
            <div className={styles['footer-section']}>
              <div
                role="button"
                tabIndex={0}
                className={styles['app-name-container']}
                {...tooltipPropsAppName}
                onKeyUp={(): void => onOpenApp(runningApp)}
                onClick={(): void => onOpenApp(runningApp)}
              >
                <span>{runningApp.icon}</span>
                <XXSmall className={styles['app-name']}>
                  {runningApp.name}
                </XXSmall>
                {renderTooltipAppName(styles['app-name-tooltip-content'])}
              </div>
              {currentActionStatus === ActionStatus.Pending && (
                <div className={styles['app-name-loader']}>
                  <Spinner />
                </div>
              )}
              <Button
                onClick={stopApp}
                variant={ButtonVariant.Secondary}
                size={ButtonSize.XXSmall}
                appearance={ButtonAppearance.Destructive}
                Icon={Stop}
                iconPosition="left"
                disabled={stopDisabled}
                classes={{
                  button: styles['stop-button'],
                  textButtonText: styles['stop-button-text'],
                }}
              >
                {formatMessage(messages.stopButton)}
              </Button>
            </div>
          ) : null}

          {showVersion ? (
            <div className={clsx(styles['footer-section'], styles['version'])}>
              {formatMessage(messages.version, {
                version: currentVersion,
              })}
            </div>
          ) : null}

          <div className={styles['system-stats-container']}>
            <System systemResources={systemResources} />
          </div>

          <Notification
            notifications={notifications}
            newNotifications={newNotifications}
            resetNewNotifications={resetNewNotifications}
          />

          <Network networkItem={systemResources.network} boardIP={boardIP} />

          {showAiAssistant ? (
            <div className={styles['ai-assistant-entry']}>
              <AiAssistantEntry
                agentLabel={formatMessage(messages.aiAssistantEntryAgent)}
                editorLabel={formatMessage(messages.aiAssistantEntryEditor)}
                agentModeActive={aiAssistantActive}
                onClick={onOpenAiAssistant}
                shine={agentModeEntryShine}
              />
              {agentModeTooltip.variant ? (
                <AgentModeTooltip
                  variant={agentModeTooltip.variant}
                  onDismiss={agentModeTooltip.onDismiss}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <LinuxCredentialsDialog logic={linuxCredentialsDialog} />
    </footer>
  );
};

export default FooterBar;
