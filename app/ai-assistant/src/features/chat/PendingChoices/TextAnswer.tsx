import {
  Button,
  ButtonVariant,
  Input,
  InputStyle,
  Text,
  TextSize,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useState } from 'react';

import { messages } from '../../../messages';
import { ChoiceRequest } from '../../../services';
import styles from './text-answer.module.scss';

interface TextAnswerProps {
  question: ChoiceRequest;
  // Set when the question is one step of a batch: the card names the step, and the button moves on until the last one.
  step?: { counter: string; isLast: boolean };
  onSubmit: (text: string) => void;
  onSkip: VoidFunction;
}

// The engine asked for prose: the choices card would render it as one row with a checkbox.
export const TextAnswer: React.FC<TextAnswerProps> = ({
  question,
  step,
  onSubmit,
  onSkip,
}) => {
  const { formatMessage } = useI18n();
  const [text, setText] = useState('');
  const send = (): void => {
    const answer = text.trim();
    if (answer !== '') {
      onSubmit(answer);
    }
  };

  return (
    <div className={styles['text-answer']}>
      <Text size={TextSize.XSmall} className={styles['question']}>
        {step
          ? formatMessage(messages.textAnswerStep, {
              counter: step.counter,
              question: question.title,
            })
          : question.title}
      </Text>
      <div className={styles['row']}>
        <Input
          inputStyle={InputStyle.AppLab}
          outlined
          value={text}
          onChange={setText}
          onEnter={send}
          placeholder={formatMessage(messages.textAnswerPlaceholder)}
          className={styles['input']}
        />
        <Button
          variant={ButtonVariant.Primary}
          disabled={text.trim() === ''}
          onClick={send}
        >
          {formatMessage(
            step && !step.isLast
              ? messages.textAnswerNext
              : messages.textAnswerSend,
          )}
        </Button>
      </div>
      <button type="button" className={styles['skip']} onClick={onSkip}>
        {formatMessage(messages.textAnswerSkip)}
      </button>
    </div>
  );
};

export default TextAnswer;
