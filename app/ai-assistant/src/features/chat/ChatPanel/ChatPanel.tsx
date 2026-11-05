import { ChatAgent, ChevronDown } from '@cloud-editor-mono/images/assets/icons';
import {
  type AgentEditorContext,
  ArduinoLoader,
  TextSize,
  useI18n,
  useTooltip,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';

import { messages } from '../../../messages';
import type { AgentWorkspace } from '../../../services';
import { getAgent, isBareInternalError } from '../../../services';
import { currentAuth, useAiAssistantStore } from '../../../store';
import {
  type PromptAction,
  AutoScrollProvider,
  Heading,
  Prompt,
  Text,
  Toast,
  WorkspaceChip,
} from '../../../ui';
import { useIsOffline, useStickToBottom } from '../../../utils';
import { CredentialRestartNotice } from '../../connect/CredentialRestartNotice/CredentialRestartNotice';
import { ChatInput } from '../ChatInput/ChatInput';
import { ChatInputPicker } from '../ChatInput/ChatInputPicker';
import { QueuedPrompts } from '../ChatInput/QueuedPrompts';
import { Message } from '../Message/Message';
import { PendingChoices } from '../PendingChoices/PendingChoices';
import styles from './chat-panel.module.scss';
import { useChatLogic } from './ChatPanel.logic';
import { useProviderNames } from './utils/useProviderNames';

// A failure can carry stderr or a JSON body: the banner keeps its first line, and caps it only when it is JSON.
const FAILURE_MAX_LENGTH = 200;
const failureSummary = (message: string): string => {
  const line = message.trim().split('\n')[0].trim();
  if (!/^[{[]/.test(line)) return line;
  const chars = Array.from(line); // code points: the cap must not leave half a surrogate pair
  return chars.length > FAILURE_MAX_LENGTH
    ? `${chars.slice(0, FAILURE_MAX_LENGTH).join('').trimEnd()}…`
    : chars.join('');
};

export interface ChatPanelProps {
  // Suppresses the panel's own toolbar/session-name bar for hosts that render the
  // session title in their own header instead (see onSessionTitleChange below).
  hideToolbar?: boolean;
  onSessionTitleChange?: (title: string | undefined) => void;
  workspaces?: AgentWorkspace[];
  // Binds the panel to one app, with no way to leave it; the host names the workspace itself.
  lockedWorkspaceId?: string;
  lockedWorkspaceName?: string;
  // False while the host keeps this panel mounted but hidden, so the visible one drives the session
  // lifecycle (the workspace rebind, the resume, a session opened from the sidebar) — see chatDriver.
  onScreen?: boolean;
  // Renders the docked side panel's presentation — compact greeting, tighter padding — at any
  // width, so widening the panel doesn't turn it into the full-screen Agent Mode view.
  docked?: boolean;
  // The editor beside a docked panel, read at each send: the agent gets it, the thread never shows it.
  getEditorContext?: () => AgentEditorContext;
  // Opens the agent's section of Settings; given, the model menu of an agent with provider keys links there.
  onOpenSettings?: VoidFunction;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  hideToolbar,
  onSessionTitleChange,
  workspaces = [],
  lockedWorkspaceId,
  lockedWorkspaceName,
  onScreen = true,
  docked = false,
  getEditorContext,
  onOpenSettings,
}) => {
  const { formatMessage } = useI18n();
  const {
    messages: chatMessages,
    isStreaming,
    turnTokens,
    turnStartedAt,
    permission,
    models,
    currentModelId,
    modelUnreadable,
    setModel,
    modes,
    currentModeId,
    setMode,
    modelPickFailed,
    dismissModelPickFailed,
    enqueue,
    queuedPrompts,
    removeQueued,
    clearQueued,
    stop,
    retry,
    respondPermission,
    respondChoices,
    requestError,
    bootstrapError,
    retryBootstrap,
    newChat,
    sessionTitle,
    isLoadingSession,
    isNewSession,
    currentSessionId,
    canCompose,
    restoredDraft,
    openFile,
    fileError,
    dismissFileError,
    sessionActionError,
    dismissSessionActionError,
    workspaceId,
    workspaceName,
    selectWorkspace,
  } = useChatLogic(
    lockedWorkspaceId,
    lockedWorkspaceName,
    onScreen,
    getEditorContext,
  );

  const {
    ref: threadRef,
    atBottom,
    atTop,
    onScroll: updateScrollEdges,
    scrollToBottom,
    pauseAutoScroll,
  } = useStickToBottom();

  const offline = useIsOffline();
  const justConnected = useAiAssistantStore((s) => s.justConnected);
  const setJustConnected = useAiAssistantStore((s) => s.setJustConnected);
  const auth = useAiAssistantStore(currentAuth);

  const { props: scrollTooltipProps, renderTooltip: renderScrollTooltip } =
    useTooltip({
      content: formatMessage(messages.chatScrollToBottom),
    });

  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const [offlineDismissed, setOfflineDismissed] = useState(false);

  const closeScrollTooltip = scrollTooltipProps.onMouseLeave;
  const connectedAgent = getAgent(
    auth.authenticated ? auth.agentId : undefined,
  );
  const providerNames = useProviderNames(connectedAgent, models);

  // Handed to the thread's collapsible blocks: expanding one stops the thread following its
  // bottom edge, so the content it reveals isn't pushed back out of view by the turn still
  // streaming underneath it.
  const autoScrollControl = useMemo(
    () => ({ pauseAutoScroll }),
    [pauseAutoScroll],
  );

  const workspaceItems = useMemo(
    () =>
      workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        icon: workspace.icon,
        dividerAfter: workspace.id === '',
      })),
    [workspaces],
  );

  // An app the board no longer lists still has to read as itself: the first entry would label a scoped session as the general workspace.
  const selectedWorkspace =
    workspaceItems.find((workspace) => workspace.id === workspaceId) ??
    (workspaceId
      ? { id: workspaceId, name: workspaceName || workspaceId }
      : workspaceItems[0]);

  useEffect(() => {
    if (atBottom) {
      closeScrollTooltip?.();
    }
  }, [atBottom, closeScrollTooltip]);

  useEffect(() => {
    if (!offline) {
      setOfflineDismissed(false);
    }
  }, [offline]);

  useEffect(() => {
    onSessionTitleChange?.(sessionTitle);
  }, [sessionTitle, onSessionTitleChange]);

  return (
    <div
      className={clsx(
        styles['chat'],
        docked && styles['chat--docked'],
        isNewSession && styles['chat--empty'],
      )}
    >
      {!hideToolbar && (
        <div className={styles['toolbar']}>
          <Heading className={styles['session-name']}>
            {sessionTitle ?? formatMessage(messages.chatUnnamedSession)}
          </Heading>
          {/* Until then the workspace row below is on screen, and the chip would repeat it. */}
          {sessionTitle && selectedWorkspace && (
            <WorkspaceChip name={selectedWorkspace.name} />
          )}
        </div>
      )}

      <div
        className={styles['thread-shadow']}
        style={{ opacity: atTop ? 0 : 1 }}
        aria-hidden="true"
        data-testid="chat-thread-shadow"
      />

      {/* Bottom-anchored scroller: messages are its direct children, newest first, so the
          browser keeps the newest one against the bottom edge as content and layout change. */}
      <AutoScrollProvider value={autoScrollControl}>
        <div
          className={styles['thread']}
          data-testid="chat-thread"
          ref={threadRef}
          onScroll={(e): void => updateScrollEdges(e.currentTarget)}
        >
          {chatMessages.length === 0 ? (
            isLoadingSession ? (
              <div className={styles['loading-state']}>
                <ArduinoLoader className={styles['loading-loader']} />
                <Text
                  size={TextSize.XXSmall}
                  className={styles['loading-caption']}
                >
                  {formatMessage(messages.chatLoadingSession)}
                </Text>
              </div>
            ) : (
              <div className={styles['empty-state']}>
                {docked ? (
                  <>
                    <ChatAgent
                      className={styles['empty-state-icon']}
                      aria-hidden="true"
                    />
                    <Heading className={styles['empty-state-title--compact']}>
                      {formatMessage(messages.chatEmptyTitleCompact)}
                    </Heading>
                  </>
                ) : (
                  <Heading className={styles['empty-state-title']}>
                    {formatMessage(messages.chatEmptyTitle)}
                  </Heading>
                )}
              </div>
            )
          ) : (
            chatMessages
              .map((message, i) => {
                const isStreamingMsg =
                  isStreaming && i === chatMessages.length - 1;
                return (
                  <div key={message.id} className={styles['thread-row']}>
                    <Message
                      message={message}
                      sessionId={currentSessionId}
                      streaming={isStreamingMsg}
                      tokens={isStreamingMsg ? turnTokens : undefined}
                      turnStartedAt={isStreamingMsg ? turnStartedAt : undefined}
                      onOpenFile={openFile}
                    />
                  </div>
                );
              })
              // The reversed scroller paints the first child at the bottom, so hand it the
              // newest message first. Reversing the rendered rows keeps the message order
              // (and the "last one is streaming" check above) reading forwards.
              .reverse()
          )}
        </div>
      </AutoScrollProvider>

      <div className={styles['composer']}>
        <div
          className={styles['thread-fade']}
          style={{ opacity: atBottom ? 0 : 1 }}
          aria-hidden="true"
        />
        {permission && (
          <div className={styles['permission']}>
            <Prompt
              state="permission"
              title={formatMessage(
                permission.planApproval
                  ? messages.planTitle
                  : messages.permDescription,
              )}
              description={
                permission.planApproval
                  ? formatMessage(messages.planDescription)
                  : undefined
              }
              actions={permission.actions.map(
                (action): PromptAction => ({
                  id: action.id,
                  label: action.label ?? formatMessage(action.labelMessage),
                  role: action.role,
                  onClick: (): void =>
                    respondPermission({ optionId: action.id }),
                }),
              )}
            >
              {permission.command && (
                <div className={styles['permission-tool']}>
                  <Text
                    size={TextSize.XXSmall}
                    className={styles['permission-tool-title']}
                  >
                    {permission.command}
                  </Text>
                  {permission.outsideWorkspace && (
                    <span className={styles['permission-outside']}>
                      {permission.outsideApp
                        ? formatMessage(messages.permOutsideApp, {
                            app: permission.outsideApp,
                          })
                        : formatMessage(messages.permOutsideWorkspace)}
                    </span>
                  )}
                </div>
              )}
              {permission.reason && (
                <Text className={styles['permission-reason']}>
                  {permission.reason}
                </Text>
              )}
            </Prompt>
          </div>
        )}
        {bootstrapError && (
          <div className={styles['request-error']}>
            <Prompt
              state="error"
              title={formatMessage(messages.chatSessionFailedTitle)}
              description={bootstrapError}
              actions={[
                {
                  id: 'new',
                  label: formatMessage(messages.chatSessionFailedNewChat),
                  role: 'secondary',
                  onClick: newChat,
                },
                {
                  id: 'retry',
                  label: formatMessage(messages.chatSessionFailedRetry),
                  role: 'primary',
                  onClick: retryBootstrap,
                },
              ]}
            />
          </div>
        )}
        {requestError && (
          <div className={styles['request-error']}>
            <Prompt
              state="error"
              title={formatMessage(messages.chatRequestFailed)}
              description={
                requestError.kind === 'network'
                  ? formatMessage(messages.offlineRequestError)
                  : requestError.kind === 'replayed'
                  ? formatMessage(messages.replayedRequestError)
                  : requestError.kind === 'session_gone'
                  ? formatMessage(messages.sessionGoneRequestError)
                  : requestError.kind === 'session_load_failed'
                  ? formatMessage(messages.sessionLoadFailedRequestError)
                  : requestError.kind === 'auth' && requestError.message
                  ? formatMessage(messages.providerAuthRequestError, {
                      error: failureSummary(requestError.message).replace(
                        /\.+$/,
                        '',
                      ),
                    })
                  : requestError.message &&
                    !isBareInternalError(requestError.message)
                  ? failureSummary(requestError.message)
                  : formatMessage(messages.internalRequestError)
              }
              actions={[
                ...(requestError.kind === 'auth' && onOpenSettings
                  ? [
                      {
                        id: 'settings',
                        label: formatMessage(messages.chatOpenSettings),
                        role: 'secondary' as const,
                        onClick: onOpenSettings,
                      },
                    ]
                  : []),
                ...(canCompose
                  ? [
                      // A chat the agent no longer has fails a retry the same way.
                      requestError.kind === 'session_gone'
                        ? {
                            id: 'new',
                            label: formatMessage(
                              messages.chatSessionFailedNewChat,
                            ),
                            role: 'primary' as const,
                            onClick: newChat,
                          }
                        : {
                            id: 'retry',
                            label: formatMessage(messages.chatRequestRetry),
                            role: 'primary' as const,
                            onClick: (): void =>
                              void retry(requestError.messageId),
                          },
                    ]
                  : []),
              ]}
            />
          </div>
        )}
        <PendingChoices
          sessionId={currentSessionId}
          className={styles['choices']}
          onChoicesReply={respondChoices}
        />
        {!atBottom && (
          <div className={styles['scroll-to-bottom']} {...scrollTooltipProps}>
            <button
              type="button"
              className={styles['scroll-to-bottom-button']}
              onClick={scrollToBottom}
              aria-label={formatMessage(messages.chatScrollToBottom)}
            >
              <ChevronDown aria-hidden="true" />
            </button>
            {renderScrollTooltip()}
          </div>
        )}
        {/* Only on an empty chat, a board with no apps of its own included: a session's workspace is fixed when
            it is created, so a started conversation has nothing to pick. From then on the toolbar chip names it. */}
        {lockedWorkspaceId === undefined && isNewSession && selectedWorkspace && (
          <div className={styles['workspace-row']}>
            <div className={styles['workspace-row-inner']}>
              <Text size={TextSize.XXSmall}>
                {formatMessage(messages.workspacePickerPrefix)}
              </Text>
              <ChatInputPicker
                items={workspaceItems}
                selected={selectedWorkspace}
                align="left"
                direction="down"
                label={formatMessage(messages.workspacePicker)}
                isOpen={workspacePickerOpen}
                onToggle={(): void => setWorkspacePickerOpen((open) => !open)}
                onClose={(): void => setWorkspacePickerOpen(false)}
                onSelect={(id): void => {
                  selectWorkspace(
                    id,
                    workspaceItems.find((w) => w.id === id)?.name,
                  );
                  setWorkspacePickerOpen(false);
                }}
                classes={{
                  trigger: styles['workspace-picker-trigger'],
                  value: styles['workspace-picker-value'],
                  icon: styles['workspace-picker-icon'],
                }}
              />
            </div>
          </div>
        )}
        <ChatInput
          isStreaming={isStreaming}
          canCompose={canCompose}
          restoredDraft={restoredDraft}
          onSend={(text): void => {
            scrollToBottom();
            enqueue(text);
          }}
          onStop={(): void => void stop()}
          models={models}
          currentModelId={currentModelId}
          modelUnreadable={modelUnreadable}
          setModel={setModel}
          modes={modes}
          currentModeId={currentModeId}
          setMode={setMode}
          onAddProvider={
            connectedAgent?.perProviderKeys ? onOpenSettings : undefined
          }
          providerNames={providerNames}
          freeModelsLabel={
            connectedAgent &&
            formatMessage(messages.providerFreeModels, {
              agent: connectedAgent.name,
            })
          }
          queue={
            // Keyed by session: the expanded/collapsed choice belongs to the queue it was made on.
            <QueuedPrompts
              key={currentSessionId ?? 'none'}
              prompts={queuedPrompts}
              onRemove={removeQueued}
              onClearAll={clearQueued}
            />
          }
        />
      </div>

      <div className={styles['chat-toast']}>
        <CredentialRestartNotice />
        {offline && !offlineDismissed && (
          <Toast
            variant="error"
            onDismiss={(): void => setOfflineDismissed(true)}
            dismissLabel={formatMessage(messages.dismiss)}
          >
            {formatMessage(messages.offlineToast)}
          </Toast>
        )}
        {justConnected && connectedAgent && (
          <Toast
            variant="success"
            autoDismiss
            onDismiss={(): void => setJustConnected(false)}
            dismissLabel={formatMessage(messages.dismiss)}
          >
            {formatMessage(
              connectedAgent.perProviderKeys
                ? messages.connectedToastProviders
                : messages.connectedToast,
              { agent: connectedAgent.name },
            )}
          </Toast>
        )}
        {fileError && (
          <Toast
            variant="error"
            autoDismiss
            onDismiss={dismissFileError}
            dismissLabel={formatMessage(messages.dismiss)}
          >
            {fileError}
          </Toast>
        )}
        {sessionActionError && (
          <Toast
            variant="error"
            autoDismiss
            onDismiss={dismissSessionActionError}
            dismissLabel={formatMessage(messages.dismiss)}
          >
            {formatMessage(sessionActionError)}
          </Toast>
        )}
        {modelPickFailed && (
          <Toast
            variant="error"
            autoDismiss
            onDismiss={dismissModelPickFailed}
            dismissLabel={formatMessage(messages.dismiss)}
          >
            {formatMessage(messages.modelPickFailed)}
          </Toast>
        )}
      </div>
    </div>
  );
};

export default ChatPanel;
