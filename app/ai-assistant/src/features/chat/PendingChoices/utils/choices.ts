import { MessagePart } from '../../../../store';

/** The choice questions surfaced in a turn (each rendered as its own card). */
export const choiceRequests = (
  parts: MessagePart[],
): Extract<MessagePart, { type: 'choices' }>['choices'][] =>
  parts
    .filter(
      (p): p is Extract<MessagePart, { type: 'choices' }> =>
        p.type === 'choices',
    )
    .map((p) => p.choices);

/** Human answer for a choice (picked option labels + free text), echoed as the user's turn; '' when skipped. */
export const choiceAnswerText = (
  question: Extract<MessagePart, { type: 'choices' }>['choices'],
  submission?: { selectedIds: string[]; other?: string; cancelled?: boolean },
): string => {
  if (!submission || submission.cancelled) {
    return '';
  }
  const labels = submission.selectedIds
    .map((id) => question.options.find((o) => o.id === id)?.label)
    .filter((label): label is string => Boolean(label));
  if (submission.other) {
    labels.push(submission.other);
  }
  return labels.join(', ');
};
