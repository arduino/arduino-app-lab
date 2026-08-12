import { ChevronDown } from '@cloud-editor-mono/images/assets/icons';
import {
  ArduinoLoader,
  TextSize,
  useI18n,
  useTooltip,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useEffect, useMemo } from 'react';

import { messages } from '../../../messages';
import { getAgent } from '../../../services';
import { useAiAssistantStore } from '../../../store';
import {
  type PromptAction,
  AutoScrollProvider,
  Heading,
  Prompt,
  Text,
  Toast,
} from '../../../ui';
import { ChatInput } from '../ChatInput/ChatInput';
import { Message } from '../Message/Message';
import { PendingChoices } from '../PendingChoices/PendingChoices';
import styles from './chat-panel.module.scss';
import { useChatLogic } from './ChatPanel.logic';
import { useStickToBottom } from './useStickToBottom';

export const ChatPanel: React.FC = () => {
  const { formatMessage } = useI18n();
  const {
    messages: chatMessages,
    isStreaming,
    usedTokens,
    turnStartedAt,
    permission,
    models,
    currentModelId,
    setModel,
    modes,
    currentModeId,
    setMode,
    send,
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
    openFile,
    fileError,
    dismissFileError,
    sessionActionError,
    dismissSessionActionError,
  } = useChatLogic();

  const {
    ref: threadRef,
    atBottom,
    onScroll: updateAtBottom,
    scrollToBottom,
    pauseAutoScroll,
  } = useStickToBottom();

  // Handed to the thread's collapsible blocks: expanding one stops the thread following its
  // bottom edge, so the content it reveals isn't pushed back out of view by the turn still
  // streaming underneath it.
  const autoScrollControl = useMemo(
    () => ({ pauseAutoScroll }),
    [pauseAutoScroll],
  );

  const { props: scrollTooltipProps, renderTooltip: renderScrollTooltip } =
    useTooltip({
      content: formatMessage(messages.chatScrollToBottom),
      timeout: 0,
      renderDelay: 500,
    });

  const closeScrollTooltip = scrollTooltipProps.onMouseLeave;

  const justConnected = useAiAssistantStore((s) => s.justConnected);
  const setJustConnected = useAiAssistantStore((s) => s.setJustConnected);
  const auth = useAiAssistantStore((s) => s.auth);
  const connectedAgent = getAgent(
    auth.authenticated ? auth.agentId : undefined,
  );

  useEffect(() => {
    if (atBottom) {
      closeScrollTooltip?.();
    }
  }, [atBottom, closeScrollTooltip]);

  return (
    <div
      className={clsx(styles['chat'], isNewSession && styles['chat--empty'])}
    >
      <div className={styles['toolbar']}>
        {sessionTitle && (
          <Heading className={styles['session-name']}>{sessionTitle}</Heading>
        )}
      </div>

      {/* Bottom-anchored scroller: messages are its direct children, newest first, so the
          browser keeps the newest one against the bottom edge as content and layout change. */}
      <AutoScrollProvider value={autoScrollControl}>
        <div
          className={styles['thread']}
          ref={threadRef}
          onScroll={(e): void => updateAtBottom(e.currentTarget)}
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
                <Heading className={styles['empty-state-title']}>
                  {formatMessage(messages.chatEmptyTitle)}
                </Heading>
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
                      streaming={isStreamingMsg}
                      tokens={isStreamingMsg ? usedTokens : undefined}
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
                  {permission.reason && <Text>{permission.reason}</Text>}
                </div>
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
              title="Request failed"
              description={requestError.message}
              actions={[
                {
                  id: 'retry',
                  label: 'Retry',
                  role: 'primary',
                  onClick: (): void => void retry(requestError.messageId),
                },
              ]}
            />
          </div>
        )}
        <PendingChoices
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
        <ChatInput
          isStreaming={isStreaming}
          hasSession={currentSessionId !== null}
          onSend={(text): void => {
            scrollToBottom();
            void send(text);
          }}
          onStop={(): void => void stop()}
          models={models}
          currentModelId={currentModelId}
          setModel={setModel}
          modes={modes}
          currentModeId={currentModeId}
          setMode={setMode}
        />
      </div>

      <div className={styles['chat-toast']}>
        {justConnected && connectedAgent && (
          <Toast
            variant="success"
            autoDismiss
            onDismiss={(): void => setJustConnected(false)}
            dismissLabel={formatMessage(messages.dismiss)}
          >
            {formatMessage(messages.connectedToast, {
              agent: connectedAgent.name,
            })}
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
      </div>
    </div>
  );
};

export default ChatPanel;
