import {
  TextSize,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { ReactNode } from 'react';

import { messages } from '../../../messages';
import { ChatMessage, MessagePart, useChatStore } from '../../../store';
import {
  Checklist,
  FileOpenProvider,
  Text,
  Thinking,
  Timeline,
  Typing,
} from '../../../ui';
import {
  type MessageSegment,
  activityHeader,
  currentPhase,
  Markdown,
  mergeThinking,
  messageSegments,
  thinkingSpan,
  thoughtLabel,
  timelineItems,
  useElapsedSeconds,
  useTypewriter,
  visibleParts,
} from './Message.logic';
import styles from './message.module.scss';

interface MessageProps {
  message: ChatMessage;
  streaming?: boolean; // the active turn: show live activity; once settled it's curated
  tokens?: number; // live token count for the streaming loader
  turnStartedAt?: number; // epoch ms the turn started, for the elapsed-time counter
  onOpenFile?: (path: string) => void; // open a file the turn linked (a timeline row or its prose)
}

export const Message: React.FC<MessageProps> = ({
  message,
  streaming = false,
  tokens,
  turnStartedAt,
  onOpenFile,
}) => {
  const { formatMessage } = useI18n();
  const currentSessionId = useChatStore((s) => s.currentSessionId);

  // A pending (unresolved) choice suppresses the live loader — the turn is waiting on
  // the user. The choice UI itself renders in the composer via PendingChoices, not here.
  const resolvedChoiceIds = useChatStore((s) =>
    currentSessionId
      ? s.threads[currentSessionId]?.resolvedChoiceIds
      : undefined,
  );

  // Ordered render blocks — narration, activity, plans and choices in the order the agent
  // produced them, so nothing written before/between tools is dropped or flashes away.
  const parts = visibleParts(message.parts);
  const segments = messageSegments(parts);
  const lastSegment = segments[segments.length - 1];
  const tailKind = lastSegment?.kind;

  const pendingChoices = segments
    .filter(
      (s): s is Extract<MessageSegment, { kind: 'choices' }> =>
        s.kind === 'choices',
    )
    .flatMap((s) => s.choices)
    .filter((q) => !(resolvedChoiceIds ?? []).includes(q.id));

  // The live loader shows while the agent is working with nothing live at the tail (the tail is not
  // answer text). A pending choice suppresses it — the turn is waiting on the user.
  const showLoader =
    streaming && tailKind !== 'text' && pendingChoices.length === 0;
  // Only the trailing text run is "live": stream it with the typewriter; earlier runs are settled.
  const revealTail = streaming && tailKind === 'text';
  const tailText = revealTail
    ? (lastSegment as Extract<MessageSegment, { kind: 'text' }>).text
    : '';
  const revealedTail = useTypewriter(tailText, streaming, revealTail);
  const elapsedSeconds = useElapsedSeconds(
    showLoader,
    streaming ? turnStartedAt : undefined,
  );

  if (message.role === 'user') {
    // Choice answers are echoed as their own user turn; render each as a two-line
    // bubble (the question, muted, above the picked answer) instead of plain text.
    const answers = message.parts.filter(
      (part): part is Extract<MessagePart, { type: 'choice-answer' }> =>
        part.type === 'choice-answer',
    );

    if (answers.length > 0) {
      return (
        <>
          {answers.map((part) => (
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

    const text = message.parts
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('');

    return (
      <div className={clsx(styles['message'], styles['message--user'])}>
        <Text>{text}</Text>
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

  if (parts.length === 0) {
    return (
      <div className={styles['message--assistant']}>
        {message.cancelled ? (
          <Text size={TextSize.XXSmall} className={styles['cancelled']}>
            You stopped the agent
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
        return (
          <Markdown
            key={`text-${i}`}
            text={isLast && revealTail ? revealedTail : segment.text}
          />
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
              summary={activityHeader(segment.parts)}
              items={timelineItems(segment.parts, done, liveTail)}
            />
          );
        }
        const thinking = mergeThinking(segment.parts);
        const span = thinkingSpan(segment.parts);
        return thinking.length > 0 ? (
          <Thinking
            key={`activity-${i}`}
            label={liveTail ? 'Thinking' : thoughtLabel(span.start, span.end)}
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
            label={currentPhase(parts, elapsedSeconds)}
            elapsedSeconds={elapsedSeconds}
            tokens={tokens}
          />
        )}
        {message.cancelled && (
          <Text className={styles['cancelled']}>You stopped the agent</Text>
        )}
      </div>
    </FileOpenProvider>
  );
};

export default Message;
