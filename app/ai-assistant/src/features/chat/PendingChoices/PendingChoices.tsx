import { ChoiceRequest, ChoiceSubmission } from '../../../services';
import { ChoiceEcho, useChatStore } from '../../../store';
import { Choices, ChoicesWizard } from '../../../ui';
import {
  choiceAnswerText,
  choiceRequests,
  visibleParts,
} from '../Message/Message.logic';

interface PendingChoicesProps {
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
  onChoicesReply,
  className,
}) => {
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const messages = useChatStore((s) =>
    currentSessionId ? s.threads[currentSessionId]?.messages : undefined,
  );
  const resolvedChoiceIds = useChatStore((s) =>
    currentSessionId
      ? s.threads[currentSessionId]?.resolvedChoiceIds
      : undefined,
  );
  const resolveChoice = useChatStore((s) => s.resolveChoice);
  const dismissChoice = (id: string): void => {
    if (currentSessionId) {
      resolveChoice(currentSessionId, id);
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
              onChoicesReply?.(q.id, submission, {
                question: `Step ${i + 1}/${total} — ${q.title}`,
                answer: choiceAnswerText(q, submission),
                skipped: submission.cancelled,
              });
              dismissChoice(q.id);
            });
          }}
          onClose={(): void => pending.forEach((q) => declineChoice(q))}
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
