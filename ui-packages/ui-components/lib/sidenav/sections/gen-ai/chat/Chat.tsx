import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useExternalStoreRuntime,
} from '@assistant-ui/react';
import { Config, setCSSVariable } from '@cloud-editor-mono/common';
import {
  Apply,
  ApplyFix,
  ArrowDown,
  CloseX,
  CodeIcon,
  EducationIcon,
  FeedbackThumbsDown,
  FeedbackThumbsUp,
  LightIcon,
  OpenInNewTab,
} from '@cloud-editor-mono/images/assets/icons';
import {
  GeneratedSketch_GenAiApi,
  RetrievedDocument,
} from '@cloud-editor-mono/infrastructure';
import {
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import ReactMarkdown from 'react-markdown';
import { useMeasure } from 'react-use';

import CodeBlock from '../../../../code-block/CodeBlock';
import CodeDiffBlock from '../../../../code-diff-block/CodeDiffBlock';
import CodeDiffSummary from '../../../../code-diff-block/CodeDiffSummary';
import { DetailsWrapper } from '../../../../details-wrapper';
import { CopyToClipboard } from '../../../../essential/copy-to-clipboard';
import { HintLabel } from '../../../../essential/hint-label';
import { IconButton } from '../../../../essential/icon-button';
import { DotsLoader } from '../../../../essential/loader';
import { useI18n } from '../../../../i18n/useI18n';
import { Link, XSmall, XXSmall, XXXSmall } from '../../../../typography';
import { SidenavContext } from '../../../context/sidenavContext';
import {
  GenAIChatMessage,
  retrievedDocumentsIconDictionary,
  SketchPlanActionType,
} from '../../../sidenav.type';
import { GenAIContext } from '../context/GenAIContext';
import { chatMessages as messages } from '../messages';
import styles from './chat.module.scss';
import LegalDisclaimer from './sub-components/LegalDisclaimer';
import SendBox from './sub-components/SendBox';
import SketchPlan from './sub-components/SketchPlan';
import SketchPlanSkeleton from './sub-components/SketchPlanSkeleton';
import ThreadSkeleton from './sub-components/ThreadSkeleton';
import {
  chatHistoryToString,
  isGeneratedSketchContent,
  isHumanContent,
  isSketchPlanContent,
  parseUnifiedDiff,
  splitDiff,
} from './utils';

const CHAT_PANEL_THREE_HINTS_WIDTH = 386;
const BUTTON_SCROLL_THRESHOLD = 200;

export function Chat(): JSX.Element {
  const { formatMessage } = useI18n();
  const {
    handleGenAiApplyCode,
    handleGenAiApplyFixToCode,
    handleApplyPatchAvailability,
    scrollToLine,
    shouldDisplayAiLimitBanner,
    aiMessagesRemaining,
    linksEnabled,
  } = useContext(GenAIContext);

  const {
    history,
    triggerSurvey,
    isLoading,
    isSending,
    sketchPlanAction,
    sketchPlanActionIsLoading,
    isSketchPlan,
    isStreamSending,
    actionType,
    onCopyCode,
    isLegalDisclaimerAccepted,
  } = useContext(SidenavContext);

  const [isUpgradePlanBannerDismissed, setIsUpgradePlanBannerDismissed] =
    useState(false);
  const [hintMessage, setHintMessage] = useState('');
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(false);
  const [isScrollButtonVisible, setIsScrollButtonVisible] = useState(false);
  const [isNewMessageStringVisible, setIsNewMessageStringVisible] =
    useState(false);

  const [chatPanelRef, { width: chatPanelWidth }] =
    useMeasure<HTMLDivElement>();

  const messageThreadContainerRef = useRef<HTMLDivElement>(null);

  const [sendBoxRef, { height: sendBoxHeight }] = useMeasure<HTMLDivElement>();

  const scrollChatToBottom = (): void => {
    if (messageThreadContainerRef.current) {
      messageThreadContainerRef.current.scrollTop =
        messageThreadContainerRef.current.scrollHeight;
      setIsScrollButtonVisible(false);
      setIsNewMessageStringVisible(false);
    }
  };

  const isChatAtBottom = (): boolean => {
    if (messageThreadContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        messageThreadContainerRef.current;
      return (
        Math.abs(scrollHeight - scrollTop - clientHeight) <
        BUTTON_SCROLL_THRESHOLD
      );
    }
    return false;
  };

  const handleScroll = useCallback((): void => {
    const isAtBottom = isChatAtBottom();
    setIsScrollButtonVisible(!isAtBottom);
    setIsAutoScrollEnabled(isAtBottom);
    if (isAtBottom) {
      setIsNewMessageStringVisible(false);
    }
  }, []);

  useLayoutEffect(() => {
    const isAtBottom = isChatAtBottom();
    setIsScrollButtonVisible(!isAtBottom);
    setIsNewMessageStringVisible((prev) => prev || isSending);
    if (isAutoScrollEnabled) {
      scrollChatToBottom();
    }
    setCSSVariable(
      styles.messageThreadHeight,
      `${messageThreadContainerRef.current?.clientHeight}px`,
    );
  }, [
    history,
    isSending,
    isAutoScrollEnabled,
    messageThreadContainerRef.current?.clientHeight,
    isUpgradePlanBannerDismissed,
    sendBoxHeight,
  ]);

  const renderGeneratedSketch = (
    message: GeneratedSketch_GenAiApi,
  ): JSX.Element => {
    const summaryNode = (
      <div className={styles['summary-node']}>
        <XXSmall title={message.name} bold>
          {message.name}
        </XXSmall>
        {message.code ? (
          <div className={styles['summary-node-buttons']}>
            <CopyToClipboard text={message.code} onClick={onCopyCode}>
              <XXSmall bold>Copy</XXSmall>
            </CopyToClipboard>
            <IconButton
              title={formatMessage(messages.generateSketchApply)}
              label={formatMessage(messages.generateSketchApply)}
              Icon={Apply}
              onPress={(): void => {
                onCopyCode && onCopyCode(message.code);
                handleGenAiApplyCode(message.code);
              }}
            >
              <XXSmall bold>
                {formatMessage(messages.generateSketchApply)}
              </XXSmall>
            </IconButton>
          </div>
        ) : (
          <IconButton label={'Open in new tab'} Icon={OpenInNewTab} />
        )}
      </div>
    );

    return (
      <DetailsWrapper
        summaryNode={summaryNode}
        introduction={message.introduction}
      >
        <CodeBlock
          code={message.code}
          onCopyCode={onCopyCode}
          classes={{ container: styles['code-block'] }}
        />
      </DetailsWrapper>
    );
  };

  const renderCodeBlock = (code: string): JSX.Element => {
    const summaryNode = (
      <div className={styles['summary-node']}>
        {code ? (
          <div className={styles['summary-node-buttons']}>
            <CopyToClipboard text={code} onClick={onCopyCode}>
              <XXSmall bold>Copy</XXSmall>
            </CopyToClipboard>
            <IconButton
              title={formatMessage(messages.generateSketchApply)}
              label={formatMessage(messages.generateSketchApply)}
              Icon={ApplyFix}
              onPress={(): void => {
                handleGenAiApplyCode(code);
              }}
              isDisabled={isSending}
            >
              <XXSmall bold>
                {formatMessage(messages.generateSketchApply)}
              </XXSmall>
            </IconButton>
          </div>
        ) : (
          <IconButton label={'Open in new tab'} Icon={OpenInNewTab} />
        )}
      </div>
    );

    return (
      <DetailsWrapper summaryNode={summaryNode}>
        <CodeBlock
          code={code}
          onCopyCode={onCopyCode}
          classes={{ container: styles['code-block'] }}
        />
      </DetailsWrapper>
    );
  };

  const renderDiffBlock = (diff: string): JSX.Element => {
    const { blocks } = splitDiff(diff);

    return (
      <>
        {blocks.map((block, index) => {
          const {
            fileName,
            original,
            modified,
            changes,
            startingLine,
            endingLine,
            updatedBlock,
          } = parseUnifiedDiff(block);

          const summaryNode = (
            <CodeDiffSummary
              fileName={fileName}
              scrollToLine={(): void => scrollToLine(endingLine, fileName)}
              handleGenAiApplyFixToCode={handleGenAiApplyFixToCode}
              handleApplyPatchAvailability={(): string | false =>
                handleApplyPatchAvailability(fileName, updatedBlock)
              }
              parentRef={messageThreadContainerRef}
              lineToScroll={endingLine}
              isSending={isSending}
            />
          );

          return (
            <DetailsWrapper key={index} summaryNode={summaryNode}>
              <CodeDiffBlock
                originalCode={original}
                modifiedCode={modified}
                changes={changes}
                startingLine={startingLine}
                onCopyCode={onCopyCode}
              />
            </DetailsWrapper>
          );
        })}
      </>
    );
  };

  const renderSurvey = (): JSX.Element => (
    <div className={styles['survey-trigger']}>
      <XXSmall>{formatMessage(messages.surveyLabel)} </XXSmall>
      <div className={styles['thumbs-container']}>
        <IconButton
          Icon={FeedbackThumbsUp}
          label="Thumbs up"
          onPress={(e): void => {
            if (!history) {
              return;
            }
            triggerSurvey(e, 'positive', chatHistoryToString(history));
          }}
          classes={{ button: styles['icon-button'] }}
        />
        <IconButton
          Icon={FeedbackThumbsDown}
          label="Thumbs down"
          onPress={(e): void => {
            if (!history) {
              return;
            }
            triggerSurvey(e, 'negative', chatHistoryToString(history));
          }}
          classes={{ button: styles['icon-button'] }}
        />
      </div>
    </div>
  );

  const renderHints = (): JSX.Element => (
    <div className={styles['hints-section']}>
      <XXSmall>{formatMessage(messages.tryHintsMessage)}</XXSmall>
      <div className={styles['hints-container']}>
        <HintLabel
          onClick={(): void =>
            setHintMessage(formatMessage(messages.createCodeExample))
          }
          label={formatMessage(messages.createCodeExample)}
          Icon={CodeIcon}
        />
        <HintLabel
          onClick={(): void =>
            setHintMessage(formatMessage(messages.explainFunctionExample))
          }
          label={formatMessage(messages.explainFunctionExample)}
          Icon={EducationIcon}
        />
        {chatPanelWidth > CHAT_PANEL_THREE_HINTS_WIDTH && (
          <HintLabel
            onClick={(): void =>
              setHintMessage(formatMessage(messages.suggestProjectExample))
            }
            label={formatMessage(messages.suggestProjectExample)}
            Icon={LightIcon}
          />
        )}
      </div>
    </div>
  );

  const renderSketchPlan = (message: GenAIChatMessage): JSX.Element => {
    const content = !isHumanContent(message.data) ? message.data : [];
    const lastContent = content[content.length - 1].data;
    return isSketchPlanContent(lastContent) ? (
      <div className={styles['sketch-plan-container']}>
        <SketchPlan
          sketchPlan={lastContent}
          onConfirm={(): void =>
            sketchPlanAction({
              actionType: SketchPlanActionType.ConfirmSketchPlan,
              promptMessageId: message.initiatingMessageId,
              assistantMessageTs: message.id,
            })
          }
          onCancel={(): void =>
            sketchPlanAction({
              actionType: SketchPlanActionType.CancelSketchPlan,
              promptMessageId: message.initiatingMessageId,
              assistantMessageTs: message.id,
            })
          }
          onRegenerate={(): void =>
            sketchPlanAction({
              actionType: SketchPlanActionType.RefreshSketchPlan,
              promptMessageId: message.initiatingMessageId,
              assistantMessageTs: message.id,
            })
          }
        />
        {sketchPlanActionIsLoading &&
        actionType === SketchPlanActionType.ConfirmSketchPlan ? (
          <div className={styles['loading-messages']}>
            <DotsLoader />
          </div>
        ) : null}
      </div>
    ) : (
      <></>
    );
  };

  const renderScrollButton = (): JSX.Element => (
    <div className={styles['scroll-to-bottom-container']}>
      <IconButton
        Icon={ArrowDown}
        label={formatMessage(messages.newMessages)}
        onPress={scrollChatToBottom}
        classes={{
          button: styles['scroll-to-bottom-button'],
        }}
      >
        {isNewMessageStringVisible ? (
          <XXSmall>{formatMessage(messages.newMessages)}</XXSmall>
        ) : null}
      </IconButton>
    </div>
  );

  const upgradePlanBanner = (): JSX.Element => {
    return (
      <div className={styles['upgrade-plan-banner']}>
        <div className={styles['upgrade-plan-banner-label']}>
          <XXSmall bold>
            {formatMessage(messages.remainingMessages, {
              messagesLeft: aiMessagesRemaining,
            })}
          </XXSmall>
        </div>
        {linksEnabled ? (
          <Link
            href={Config.DIGITAL_STORE_URL}
            target="_blank"
            rel="noreferrer"
          >
            <XXSmall className={styles['upgrade-plan-close-link']} bold>
              {formatMessage(messages.upgradePlan)}
            </XXSmall>
          </Link>
        ) : null}
        <IconButton
          classes={{
            button: styles['upgrade-plan-close-button'],
          }}
          label="Close"
          Icon={CloseX}
          onPress={(): void => {
            setIsUpgradePlanBannerDismissed(true);
          }}
        />
      </div>
    );
  };

  const renderSources = (
    retrievedDocuments: RetrievedDocument[],
  ): JSX.Element => {
    return (
      <div className={styles['retrieved-documents']}>
        <XXSmall>{formatMessage(messages.references)}</XXSmall>
        <div className={styles['list']}>
          {retrievedDocuments.map((doc, index) => {
            const Icon = retrievedDocumentsIconDictionary[doc.type];
            return (
              <Link
                key={index}
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className={styles['link']}
              >
                {Icon ? <Icon className={styles['icon']} /> : null}
                <XXSmall>{doc.title ?? doc.url.split('/').pop()}</XXSmall>
                <OpenInNewTab />
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAssistantMessages = (
    message: GenAIChatMessage,
    key: number,
  ): JSX.Element => {
    if (isHumanContent(message.data)) {
      return (
        <div key={key} className={styles['user-message-container']}>
          <div className={styles['content']}>
            <XXSmall>
              {message.createdAt.toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </XXSmall>
            <XSmall>{message.data.text}</XSmall>
          </div>
        </div>
      );
    }

    return (
      <div key={key} className={styles['assistant-message-container']}>
        <div className={styles['header']}>
          <XXSmall bold>{message.senderDisplayName}</XXSmall>
          <XXSmall>
            {message.createdAt.toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </XXSmall>
        </div>
        {message.data.map((content, index) => {
          return (
            <div key={index}>
              {content.type === 'sketch-plan' &&
              isSketchPlanContent(content.data) ? (
                <SketchPlan sketchPlan={content.data} />
              ) : content.type === 'generated-sketch' &&
                isGeneratedSketchContent(content.data) ? (
                renderGeneratedSketch(content.data)
              ) : content.type === 'code' &&
                typeof content.data === 'string' ? (
                renderCodeBlock(content.data ?? '')
              ) : content.type === 'diff' &&
                typeof content.data === 'string' ? (
                renderDiffBlock(content.data ?? '')
              ) : content.type === 'text' &&
                typeof content.data === 'string' ? (
                <ReactMarkdown className={styles['chat-markdown']}>
                  {content.data ?? ''}
                </ReactMarkdown>
              ) : (
                <></>
              )}
            </div>
          );
        })}
        {message.retrievedDocuments
          ? renderSources(message.retrievedDocuments)
          : null}
      </div>
    );
  };

  const runtime = useExternalStoreRuntime({
    messages: history,
    onNew: async () => {
      // No-op
    },
  });

  return (
    <div ref={chatPanelRef} className={styles['chat-container']}>
      {!isLegalDisclaimerAccepted ? (
        <LegalDisclaimer />
      ) : (
        <>
          {isLoading ? (
            <ThreadSkeleton />
          ) : history.length > 0 ? (
            <div
              ref={messageThreadContainerRef}
              onScroll={handleScroll}
              className={styles['message-thread-container']}
            >
              {!isSketchPlan ? (
                <AssistantRuntimeProvider runtime={runtime}>
                  <ThreadPrimitive.Root asChild>
                    <ThreadPrimitive.Viewport>
                      {history.map((message, key) =>
                        renderAssistantMessages(message, key),
                      )}
                    </ThreadPrimitive.Viewport>
                  </ThreadPrimitive.Root>
                </AssistantRuntimeProvider>
              ) : sketchPlanActionIsLoading &&
                actionType === SketchPlanActionType.RefreshSketchPlan ? (
                <SketchPlanSkeleton />
              ) : (
                renderSketchPlan(history[history.length - 1])
              )}
              {history.length > 0 &&
              ((isSending && !isStreamSending) || sketchPlanActionIsLoading) ? (
                <div className={styles['loading-messages']}>
                  <DotsLoader />
                </div>
              ) : null}
              {!isSending && renderSurvey()}
            </div>
          ) : (
            renderHints()
          )}
          {isScrollButtonVisible && history.length > 0 && renderScrollButton()}
          {shouldDisplayAiLimitBanner &&
          (!isUpgradePlanBannerDismissed ||
            (isUpgradePlanBannerDismissed && aiMessagesRemaining === 1))
            ? upgradePlanBanner()
            : null}
          {!isSketchPlan && (
            <SendBox
              ref={sendBoxRef}
              hintMessage={hintMessage}
              onClearHintMessage={(): void => setHintMessage('')}
              chatPanelWidth={chatPanelWidth}
              isAiBannerVisible={
                !!shouldDisplayAiLimitBanner && !isUpgradePlanBannerDismissed
              }
            />
          )}
          <XXXSmall className={styles['disclaimer-container']}>
            {formatMessage(messages.disclaimerArduinoAssistant)}
          </XXXSmall>
        </>
      )}
    </div>
  );
}
