import { useI18n } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { defineMessages } from 'react-intl';

import { Text } from '../Text/Text';
import styles from './typing.module.scss';

const messages = defineMessages({
  typing: {
    id: 'ai-assistant.typing',
    description: 'Label for typing indicator',
    defaultMessage: 'Thinking',
  },
});

interface TypingProps {
  label?: string; // current phase (e.g. "Reading files"); defaults to "Thinking"
  elapsedSeconds?: number; // time since the turn started, counts up
  tokens?: number; // live token count for the turn
}

// "5s" under a minute, "12m 55s" beyond.
const formatElapsed = (s: number): string => {
  if (s < 60) {
    return `${s}s`;
  }
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

// Compact token count: 340 → "340", 34000 → "34k", 34100 → "34.1k".
const formatTokens = (n: number): string => {
  if (n < 1000) {
    return `${n}`;
  }
  const k = (n / 1000).toFixed(1);
  return `${k.endsWith('.0') ? k.slice(0, -2) : k}k`;
};

export const Typing: React.FC<TypingProps> = ({
  label,
  elapsedSeconds,
  tokens,
}) => {
  const { formatMessage } = useI18n();

  const bits: string[] = [];
  if (elapsedSeconds !== undefined) {
    bits.push(formatElapsed(elapsedSeconds));
  }
  if (tokens !== undefined) {
    bits.push(`${formatTokens(tokens)} tokens`);
  }
  bits.push(label ?? formatMessage(messages.typing));

  return (
    <div className={styles['typing']}>
      <svg
        className={styles['typing-dots']}
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="3.5" cy="8" r="1.5" />
        <circle cx="8" cy="8" r="1.5" />
        <circle cx="12.5" cy="8" r="1.5" />
      </svg>
      <Text className={styles['typing-label']}>{bits.join(' · ')}</Text>
    </div>
  );
};

export default Typing;
