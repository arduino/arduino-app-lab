import {
  TextSize,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { ReactNode, useContext } from 'react';
import { type IntlShape, IntlContext } from 'react-intl';

import { messages } from '../../../messages';
import { ChatMessage } from '../../../store';
import {
  Checklist,
  FileOpenProvider,
  Text,
  Thinking,
  Timeline,
  Typing,
} from '../../../ui';
import { Markdown, StreamingMarkdown } from './Markdown';
import { useMessageLogic } from './Message.logic';
import styles from './message.module.scss';
import { activityHeader, currentPhase } from './utils/activityHeader';
import {
  type MessageSegment,
  mergeThinking,
  thinkingSpan,
  thoughtLabel,
} from './utils/messageSegments';
import { timelineItems } from './utils/timelineItems';

interface MessageProps {
  message: ChatMessage;
  sessionId: string | null; // the session this panel displays, for the choices it already resolved
  streaming?: boolean; // the active turn: show live activity; once settled it's curated
  tokens?: number; // live token count for the streaming loader
  turnStartedAt?: number; // epoch ms the turn started, for the elapsed-time counter
  onOpenFile?: (path: string) => void; // open a file the turn linked (a timeline row or its prose)
}

export const Message: React.FC<MessageProps> = ({
  message,
  sessionId,
  streaming = false,
  tokens,
  turnStartedAt,
  onOpenFile,
}) => {
  const { formatMessage } = useI18n();
  // For its list formatter, which useI18n does not expose; null without an IntlProvider.
  const intl: IntlShape | null = useContext(IntlContext);
  const {
    parts,
    segments,
    revealTail,
    revealedTail,
    showLoader,
    awaitingApproval,
    elapsedSeconds,
    choiceAnswers,
    userText,
  } = useMessageLogic({ message, sessionId, streaming, turnStartedAt });

  if (message.role === 'user') {
    // Choice answers are echoed as their own user turn; render each as a two-line
    // bubble (the question, muted, above the picked answer) instead of plain text.
    if (choiceAnswers.length > 0) {
      return (
        <>
          {choiceAnswers.map((part) => (
            <div key={part.id} className={styles['choice-answer']}>
              <Text
                size={TextSize.XXSmall}
                className={styles['choice-answer-question']}
              >
                {part.question}
              </Text>
              <Text className={styles['choice-answer-value']}>
                {part.skipped
                  ? formatMessage(messages.chatChoiceSkipped)
                  : part.answer}
              </Text>
            </div>
          ))}
        </>
      );
    }

    return (
      <div className={clsx(styles['message'], styles['message--user'])}>
        <Text>{userText}</Text>
      </div>
    );
  }

  // Bare "starting to respond" indicator, only before any content streams. Once
  // parts arrive (thinking/tools/choices) we fall through to the live render so
  // interactive content — a choices question the turn is waiting on — can show;
  // otherwise the status stays 'typing' for the whole turn and shadows it.
  if (message.status === 'typing' && parts.length === 0) {
    return (
      <div className={styles['message--assistant']}>
        <Typing />
      </div>
    );
  }

  // A failed turn is reported by the composer (the retry/dismiss decision belongs next to the
  // input), so here it only shows whatever the agent had already produced — nothing at all when
  // the turn failed before writing anything.
  if (message.status === 'error' && parts.length === 0) {
    return null;
  }

  // The turn has started and nothing came yet: the loader says so, with the time that goes by. A stop says so at once.
  if (parts.length === 0 && showLoader && !message.cancelled) {
    return (
      <div className={styles['message--assistant']}>
        <Typing
          label={
            awaitingApproval
              ? formatMessage(messages.permWaiting)
              : currentPhase(parts, elapsedSeconds, formatMessage)
          }
          elapsedSeconds={elapsedSeconds}
          tokens={tokens}
        />
      </div>
    );
  }

  if (parts.length === 0) {
    return (
      <div className={styles['message--assistant']}>
        {message.cancelled ? (
          <Text size={TextSize.XXSmall} className={styles['cancelled']}>
            {formatMessage(messages.chatStoppedByUser)}
          </Text>
        ) : (
          <Text>...</Text>
        )}
      </div>
    );
  }

  const renderSegment = (segment: MessageSegment, i: number): ReactNode => {
    const isLast = i === segments.length - 1;

    switch (segment.kind) {
      case 'text':
        return isLast && revealTail ? (
          <StreamingMarkdown key={`text-${i}`} text={revealedTail} />
        ) : (
          <Markdown key={`text-${i}`} text={segment.text} />
        );
      case 'activity': {
        // Terminal "Done" row only on a trailing activity block; if the turn ends with text, that
        // answer is the closer and a "Done" would sit oddly before it.
        const done = !streaming && !message.cancelled && isLast;
        // The trailing thinking is still "Thinking" only while the turn streams; otherwise it settles to "Thought for Xs".
        const liveTail = streaming && isLast;
        const hasTools = segment.parts.some((p) => p.type === 'tool_call');
        if (hasTools) {
          return (
            <Timeline
              key={`activity-${i}`}
              summary={activityHeader(
                segment.parts,
                formatMessage,
                streaming,
                intl?.formatList,
              )}
              items={timelineItems(
                segment.parts,
                done,
                formatMessage,
                liveTail,
              )}
            />
          );
        }
        const thinking = mergeThinking(segment.parts);
        const span = thinkingSpan(segment.parts);
        return thinking.length > 0 ? (
          <Thinking
            key={`activity-${i}`}
            label={
              liveTail
                ? formatMessage(messages.chatThinking)
                : thoughtLabel(formatMessage, span.start, span.end)
            }
          >
            <Markdown text={thinking} />
          </Thinking>
        ) : null;
      }
      case 'checklist':
        return (
          <Checklist
            key={`plan-${segment.checklist.id}`}
            title={segment.checklist.title}
            items={segment.checklist.items}
          />
        );
      case 'plan':
        return (
          <div key={`exit-plan-${i}`} className={styles['plan']}>
            <Markdown text={segment.plan} />
          </div>
        );
      // Note: 'choices' segments render nothing here — they surface in the composer
      // (above the input) via PendingChoices, so they fall through to the default.
      default:
        return null;
    }
  };

  return (
    <FileOpenProvider value={onOpenFile}>
      <div className={styles['message--assistant']}>
        {segments.map((segment, i) => renderSegment(segment, i))}
        {showLoader && (
          <Typing
            label={
              awaitingApproval
                ? formatMessage(messages.permWaiting)
                : currentPhase(parts, elapsedSeconds, formatMessage)
            }
            elapsedSeconds={elapsedSeconds}
            tokens={tokens}
          />
        )}
        {message.cancelled && (
          <Text className={styles['cancelled']}>
            {formatMessage(messages.chatStoppedByUser)}
          </Text>
        )}
      </div>
    </FileOpenProvider>
  );
};

export default Message;
