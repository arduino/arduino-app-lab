import { ChoiceRequest, ChoiceSubmission } from '../../../services';
import { ChoiceEcho, useChatStore } from '../../../store';
import { Choices, ChoicesWizard } from '../../../ui';
import { visibleParts } from '../utils/visibleParts';
import { TextAnswer } from './TextAnswer';
import { choiceAnswerText, choiceRequests } from './utils/choices';

interface PendingChoicesProps {
  // The session this panel displays, not the shared pointer: the card must resolve on the same
  // thread the reply echoes into, or an answer lands in the other panel's session.
  sessionId: string | null;
  onChoicesReply?: (
    requestId: string,
    submission: ChoiceSubmission,
    echo?: ChoiceEcho,
  ) => void;
  // Wrapper class supplied by the composer; only applied when there is a pending question.
  className?: string;
}

// Renders the choice elicitation the current turn is waiting on. Lives in the composer
// (above the input, outside the thread) like the permission prompt, not inline in a message.
export const PendingChoices: React.FC<PendingChoicesProps> = ({
  sessionId,
  onChoicesReply,
  className,
}) => {
  const messages = useChatStore((s) =>
    sessionId ? s.threads[sessionId]?.messages : undefined,
  );
  const resolvedChoiceIds = useChatStore((s) =>
    sessionId ? s.threads[sessionId]?.resolvedChoiceIds : undefined,
  );
  const resolveChoice = useChatStore((s) => s.resolveChoice);
  const dismissChoice = (id: string): void => {
    if (sessionId) {
      resolveChoice(sessionId, id);
    }
  };
  // Dismissing without answering must still reply: the agent blocks on the elicitation until it hears back, so a
  // silently closed card stalls the turn for the whole 10-minute timeout.
  const declineChoice = (question: ChoiceRequest, echo?: ChoiceEcho): void => {
    onChoicesReply?.(question.id, { selectedIds: [], cancelled: true }, echo);
    dismissChoice(question.id);
  };

  const resolved = resolvedChoiceIds ?? [];
  // Only the newest question set can still be live: a turn blocks on one AskUserQuestion at a time, so an
  // older unanswered card belongs to a turn that already ended. Including those would mis-count the wizard's
  // pager and let closing it auto-skip live questions the user never saw. The composer can only show one thing
  // above the input, so the set is surfaced as a single unit (not stacked cards) — decoupled from the BE
  // `batchId` grouping, which the wire may not always populate.
  const latest = (messages ?? [])
    .map((message) => choiceRequests(visibleParts(message.parts)))
    .filter((questions) => questions.length > 0)
    .pop();
  const pending: ChoiceRequest[] = (latest ?? []).filter(
    (question) => !resolved.includes(question.id),
  );

  // No live-turn gate: `streamingSessions` is FE-memory nothing rehydrates, so after a reload it would hide a card the agent is still blocked on — the newest-set filter is what keeps replayed history out.
  if (pending.length === 0) {
    return null;
  }

  // Page as a wizard only when there is genuinely more than one question to answer;
  // a lone question shows as a single card (no "1/1" pager).
  const isWizard = pending.length > 1;

  // A text question is answered with text, alone or as a step of the wizard.
  if (!isWizard && pending[0].kind === 'text') {
    const question = pending[0];
    return (
      <div className={className}>
        <TextAnswer
          question={question}
          onSubmit={(answer): void => {
            onChoicesReply?.(
              question.id,
              { selectedIds: [], other: answer },
              { question: question.title, answer },
            );
            dismissChoice(question.id);
          }}
          // A skip echoes nothing: the "No preference" of a skipped pick reads wrong for a question asked for text.
          onSkip={(): void => declineChoice(question)}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      {isWizard ? (
        <ChoicesWizard
          questions={pending}
          onComplete={(answers): void => {
            // One reply + one echo bubble per question, so the thread records every
            // answer of the batch (each labelled "Step i/N — question").
            const total = pending.length;
            pending.forEach((q, i) => {
              const submission = answers[i] ?? {
                selectedIds: [],
                cancelled: true,
              };
              const skippedText = q.kind === 'text' && submission.cancelled;
              onChoicesReply?.(
                q.id,
                submission,
                skippedText
                  ? undefined
                  : {
                      question: `Step ${i + 1}/${total} — ${q.title}`,
                      answer: choiceAnswerText(q, submission),
                      skipped: submission.cancelled,
                    },
              );
              dismissChoice(q.id);
            });
          }}
          onClose={(): void => pending.forEach((q) => declineChoice(q))}
          renderTextStep={({
            question,
            counter,
            isLast,
            onAnswer,
            onSkip,
          }): React.ReactNode => (
            <TextAnswer
              question={question}
              step={{ counter, isLast }}
              onSubmit={onAnswer}
              onSkip={onSkip}
            />
          )}
        />
      ) : (
        <Choices
          title={pending[0].title}
          multiple={pending[0].multiple}
          allowOther={pending[0].allowOther}
          choices={pending[0].options}
          onSubmit={(submission): void => {
            onChoicesReply?.(pending[0].id, submission, {
              question: pending[0].title,
              answer: choiceAnswerText(pending[0], submission),
            });
            dismissChoice(pending[0].id);
          }}
          onSkip={(): void =>
            declineChoice(pending[0], {
              question: pending[0].title,
              answer: choiceAnswerText(pending[0], {
                selectedIds: [],
                cancelled: true,
              }),
              skipped: true,
            })
          }
          onClose={(): void => declineChoice(pending[0])}
        />
      )}
    </div>
  );
};

export default PendingChoices;
