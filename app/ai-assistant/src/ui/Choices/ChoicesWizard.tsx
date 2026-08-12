import { useRef, useState } from 'react';

import { ChoiceRequest, ChoiceSubmission } from '../../services';
import { Choices, ChoicesSubmission } from './Choices';

interface ChoicesWizardProps {
  // One AskUserQuestion batch (2+ questions), shown one at a time with a "1/N" pager.
  questions: ChoiceRequest[];
  // Fires once the last question is answered/skipped, with a submission per question (same order).
  onComplete: (answers: ChoiceSubmission[]) => void;
  // Dismiss the whole batch without finishing (skips every question).
  onClose: VoidFunction;
}

// Pages through a multi-question elicitation: reuses Choices per step, collecting answers, and hands the
// whole batch back on the last step so the agent gets every answer at once (like claude.ai's AskUserQuestion).
export const ChoicesWizard: React.FC<ChoicesWizardProps> = ({
  questions,
  onComplete,
  onClose,
}) => {
  const [step, setStep] = useState(0);
  const answers = useRef<ChoiceSubmission[]>([]);
  // The questions actually being paged, not the batch's advertised size: with fewer of them (some already
  // answered) the pager would run past the end and complete on questions never shown.
  const total = questions.length;
  const question = questions[step];
  const isLast = step >= total - 1;

  const advance = (submission: ChoiceSubmission): void => {
    answers.current[step] = submission;
    if (!isLast) {
      setStep(step + 1);
      return;
    }

    onComplete(
      questions.map(
        (_, i) => answers.current[i] ?? { selectedIds: [], cancelled: true },
      ),
    );
  };

  if (!question) {
    return null;
  }

  return (
    <Choices
      key={question.id}
      counter={`${step + 1}/${total}`}
      title={question.title}
      choices={question.options}
      multiple={question.multiple}
      allowOther={question.allowOther}
      submitLabel={isLast ? 'Submit' : 'Next'}
      skipLabel="Skip"
      onSubmit={(s: ChoicesSubmission): void =>
        advance({
          selectedIds: s.selectedIds,
          ...(s.other ? { other: s.other } : {}),
        })
      }
      onSkip={(): void => advance({ selectedIds: [], cancelled: true })}
      onClose={onClose}
    />
  );
};

export default ChoicesWizard;
