import { Bin, Pin, PlusSmall } from '@cloud-editor-mono/images/assets/icons';
import {
  Board,
  SidePanel,
  SidePanelUser,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { messages } from '../../messages';
import { SessionSummary } from '../../services';
import { useAiAssistantStore } from '../../store';
import { ConfirmDialog } from '../../ui';
import styles from './agent-side-panel.module.scss';
import { useAgentSidePanelLogic } from './agentSidePanel.logic';
import { SessionActionsMenu } from './SessionActionsMenu';
import { SessionStateIcon } from './SessionStateIcon';

export interface AgentSidePanelProps {
  visible?: boolean;
  board?: Board;
  boards: Board[];
  onSelectBoard: (board: Board) => void;
  user?: SidePanelUser;
}

// The agent-mode sidebar: it replaces the app's main sidebar while in agent mode and hosts the
// session list (new chat, pinned/other sessions, select, pin/rename/delete). It reuses the same
// SidePanel.* primitives as the app sidebar; sessions come from the coding-agent service + store.
export const AgentSidePanel = ({
  visible = true,
  board,
  boards,
  onSelectBoard,
  user,
}: AgentSidePanelProps): JSX.Element | null => {
  const { formatMessage } = useI18n();
  const {
    pinnedSessions,
    otherSessions,
    currentSessionId,
    isDraftSession,
    dotState,
    onNewSession,
    onSelectSession,
    onPin,
    editingId,
    draftTitle,
    setDraftTitle,
    editInputRef,
    startRename,
    onRenameBlur,
    onRenameKeyDown,
    confirmingId,
    isDeleting,
    askDelete,
    cancelDelete,
    confirmDelete,
  } = useAgentSidePanelLogic();

  const authenticated = useAiAssistantStore((s) => s.auth.authenticated);
  const agentDown = useAiAssistantStore((s) => s.agentDown);
  const agentReady = authenticated && !agentDown;

  if (!visible) {
    return null;
  }

  const confirmingSession = [...pinnedSessions, ...otherSessions].find(
    (session) => session.id === confirmingId,
  );

  const renderRow = (session: SessionSummary, pinned: boolean): JSX.Element => {
    if (editingId === session.id) {
      return (
        <input
          key={session.id}
          ref={editInputRef}
          className={styles['edit']}
          value={draftTitle}
          onChange={(e): void => setDraftTitle(e.target.value)}
          onBlur={(): void => onRenameBlur(session.id)}
          onKeyDown={(e): void => onRenameKeyDown(e, session.id)}
        />
      );
    }

    return (
      <SidePanel.Row
        key={session.id}
        icon={
          pinned ? (
            <span className={styles['pin-icon']}>
              <Pin />
            </span>
          ) : (
            <SessionStateIcon state={dotState(session)} />
          )
        }
        title={session.title || formatMessage(messages.sessionsUntitled)}
        onClick={agentReady ? (): void => onSelectSession(session) : undefined}
        active={session.id === currentSessionId}
        dimmed={!agentReady}
        trailing={
          agentReady ? (
            <SessionActionsMenu
              pinned={pinned}
              onRename={(): void => startRename(session)}
              onPin={(): void => void onPin(session)}
              onDelete={(): void => askDelete(session.id)}
            />
          ) : undefined
        }
        revealTrailingOnHover
      />
    );
  };

  return (
    <SidePanel.Root>
      <SidePanel.Content>
        <SidePanel.BoardItem
          board={board}
          boards={boards}
          onSelectBoard={onSelectBoard}
        />
        <SidePanel.Row
          icon={<PlusSmall />}
          title={formatMessage(messages.sessionsNewChat)}
          onClick={agentReady ? onNewSession : undefined}
          active={isDraftSession}
          dimmed={!agentReady}
        />
        {pinnedSessions.length > 0 && (
          <SidePanel.Accordion
            title={formatMessage(messages.sessionsPinnedHeading)}
          >
            {pinnedSessions.map((session) => renderRow(session, true))}
          </SidePanel.Accordion>
        )}
        {otherSessions.length > 0 && (
          <SidePanel.Accordion title={formatMessage(messages.sessionsTitle)}>
            {otherSessions.map((session) => renderRow(session, false))}
          </SidePanel.Accordion>
        )}
      </SidePanel.Content>
      <SidePanel.Bottom initials={user?.initials} />
      {confirmingSession && (
        <ConfirmDialog
          title={formatMessage(messages.sessionsDeleteDialogTitle)}
          Icon={Bin}
          heading={formatMessage(messages.sessionsDeleteDialogHeading, {
            title:
              confirmingSession.title ||
              formatMessage(messages.sessionsUntitled),
          })}
          description={formatMessage(messages.sessionsDeleteDialogBody)}
          confirmLabel={formatMessage(messages.sessionsDelete)}
          destructive
          loading={isDeleting}
          onConfirm={(): void => void confirmDelete(confirmingSession.id)}
          onClose={cancelDelete}
        />
      )}
    </SidePanel.Root>
  );
};

export default AgentSidePanel;
