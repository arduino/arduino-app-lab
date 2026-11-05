import {
  ChatAgent,
  CloseX,
  IconTimeClockNormal,
  PlusSmall,
} from '@cloud-editor-mono/images/assets/icons';
import {
  type AgentEditorContext,
  ArduinoLoader,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  IconButton,
  useI18n,
  useTooltip,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback, useState } from 'react';

import { useChatStore } from '../../store';
import { Button, Picker, WorkspaceChip } from '../../ui';
import { titleIfNamed } from '../../utils';
import { ChatPanel } from '../chat/ChatPanel/ChatPanel';
import { AgentStoppedPrompt } from '../panel/AiAssistantPanel';
import { SessionStateIcon } from '../side-panel/SessionStateIcon';
import styles from './agent-panel-container.module.scss';
import { useAgentPanelContainerLogic } from './agentPanelContainer.logic';
import { messages } from './messages';

export interface AgentPanelContainerProps {
  appName: string;
  // The agent workspace this panel is bound to: the app being edited, named by the badge and never changed from here.
  appId: string;
  onClose: VoidFunction;
  onSetupAgent: VoidFunction;
  getEditorContext?: () => AgentEditorContext;
}

export const AgentPanelContainer: React.FC<AgentPanelContainerProps> = ({
  appName,
  appId,
  onClose,
  onSetupAgent,
  getEditorContext,
}) => {
  const { formatMessage } = useI18n();
  const {
    authenticated,
    starting,
    agentDown,
    agentDownReason,
    reconnecting,
    reconnect,
    reviving,
    onNewSession,
    historyOpen,
    toggleHistory,
    closeHistory,
    sessions,
    currentSessionId,
    onSelectSession,
    dotState,
    hasUnread,
  } = useAgentPanelContainerLogic(appId);
  const agentModeActive = useChatStore((s) => s.agentModeActive);
  const [sessionTitle, setSessionTitle] = useState<string | undefined>();

  const handleClose = useCallback(() => onClose(), [onClose]);

  const title =
    sessionTitle ??
    formatMessage(
      authenticated || starting
        ? messages.newSessionTitle
        : messages.noAgentTitle,
    );
  const { props: titleTooltipProps, renderTooltip: renderTitleTooltip } =
    useTooltip({ content: title });

  return (
    <div className={styles['container']}>
      <div className={styles['header']}>
        <div className={styles['title']}>
          <div {...titleTooltipProps} className={styles['title-text']}>
            {title}
            {renderTitleTooltip()}
          </div>
          <WorkspaceChip name={appName} />
        </div>
        <div className={styles['actions']}>
          <IconButton
            size={ButtonSize.XSmall}
            variant={ButtonVariant.Tertiary}
            appearance={ButtonAppearance.LowContrast}
            label={formatMessage(messages.newChatButton)}
            Icon={PlusSmall}
            onClick={onNewSession}
          />
          <Picker
            items={sessions}
            title={formatMessage(messages.historyTitle)}
            rowSize="small"
            isOpen={historyOpen}
            onClose={closeHistory}
            isSelected={(session): boolean => session.id === currentSessionId}
            onSelect={(id): void => {
              const session = sessions.find((s) => s.id === id);
              if (session) onSelectSession(session);
            }}
            getOption={(
              session,
            ): { label: string; Icon: React.ReactElement } => ({
              label:
                titleIfNamed(session.title) ??
                formatMessage(messages.historyUntitled),
              Icon: <SessionStateIcon state={dotState(session)} />,
            })}
            emptyState={formatMessage(messages.historyEmpty)}
            classes={{ menu: styles['history-menu'] }}
            renderTrigger={(): React.ReactNode => (
              <span className={styles['history-trigger']}>
                <IconButton
                  size={ButtonSize.XSmall}
                  variant={ButtonVariant.Tertiary}
                  appearance={ButtonAppearance.LowContrast}
                  label={formatMessage(messages.historyButton)}
                  Icon={IconTimeClockNormal}
                  aria-haspopup="listbox"
                  aria-expanded={historyOpen}
                  onClick={toggleHistory}
                />
                {hasUnread && (
                  <span className={styles['unread-badge']} aria-hidden="true" />
                )}
              </span>
            )}
          />
          <IconButton
            size={ButtonSize.XSmall}
            variant={ButtonVariant.Tertiary}
            appearance={ButtonAppearance.LowContrast}
            label={formatMessage(messages.closeButton)}
            Icon={CloseX}
            onClick={handleClose}
          />
        </div>
      </div>
      <div className={styles['body']}>
        {starting || reviving ? (
          <div className={styles['empty-state']}>
            <ArduinoLoader className={styles['empty-state-icon']} />
          </div>
        ) : agentDown ? (
          <AgentStoppedPrompt
            reason={agentDownReason}
            reconnecting={reconnecting}
            onReconnect={reconnect}
          />
        ) : authenticated ? (
          <ChatPanel
            docked
            hideToolbar
            onSessionTitleChange={setSessionTitle}
            lockedWorkspaceId={appId}
            lockedWorkspaceName={appName}
            onScreen={!agentModeActive}
            getEditorContext={getEditorContext}
            onOpenSettings={onSetupAgent}
          />
        ) : (
          <div className={styles['empty-state']}>
            <ChatAgent className={styles['empty-state-icon']} />
            <p className={styles['empty-state-text']}>
              {formatMessage(messages.noAgentText)}
            </p>
            <Button size="small" onClick={onSetupAgent}>
              {formatMessage(messages.setupAgentButton)}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentPanelContainer;
