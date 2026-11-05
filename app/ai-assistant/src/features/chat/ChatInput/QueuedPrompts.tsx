import { ChevronDown, CloseX } from '@cloud-editor-mono/images/assets/icons';
import {
  ButtonAppearance,
  ButtonVariant,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useId, useState } from 'react';

import { messages } from '../../../messages';
import { QueuedPrompt } from '../../../store';
import { Button } from '../../../ui';
import styles from './queued-prompts.module.scss';

interface QueuedPromptsProps {
  prompts: QueuedPrompt[];
  onRemove: (id: string) => void;
  onClearAll: VoidFunction;
}

// From this many the rows would push the composer down the screen, so they collapse behind one header.
const COLLAPSE_FROM = 3;

// The prompts typed while the turn was running, shown above the input so they are visible and droppable before they go.
export const QueuedPrompts: React.FC<QueuedPromptsProps> = ({
  prompts,
  onRemove,
  onClearAll,
}) => {
  const { formatMessage } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const rowsId = useId();

  if (!prompts.length) {
    return null;
  }

  const rows = prompts.map((prompt) => (
    <div key={prompt.id} className={styles['queued-item']}>
      <span className={styles['queued-text']} title={prompt.text}>
        {prompt.text}
      </span>
      <button
        type="button"
        className={styles['queued-remove']}
        aria-label={formatMessage(messages.chatQueuedRemove)}
        onClick={(): void => onRemove(prompt.id)}
      >
        <CloseX aria-hidden="true" />
      </button>
    </div>
  ));

  if (prompts.length < COLLAPSE_FROM) {
    return <div className={styles['queued']}>{rows}</div>;
  }

  // Not ExpandableCard: its header is bare text sized to its content, and a click anywhere in its body
  // closes it — which here would collapse the queue every time the user drops one prompt.
  return (
    <div className={styles['queued']}>
      <div className={styles['queued-header']}>
        <button
          type="button"
          className={styles['queued-toggle']}
          aria-expanded={expanded}
          aria-controls={rowsId}
          onClick={(): void => setExpanded((open) => !open)}
        >
          <ChevronDown
            className={clsx(styles['queued-chevron'], {
              [styles['queued-chevron--expanded']]: expanded,
            })}
            aria-hidden="true"
          />
          <span className={styles['queued-text']}>
            {formatMessage(messages.chatQueuedCount, {
              count: prompts.length,
            })}
          </span>
        </button>
        <Button
          variant={ButtonVariant.Tertiary}
          appearance={ButtonAppearance.LowContrast}
          size="small"
          onClick={onClearAll}
        >
          {formatMessage(messages.chatQueuedClearAll)}
        </Button>
      </div>
      {expanded && (
        <div id={rowsId} className={styles['queued-rows']}>
          {rows}
        </div>
      )}
    </div>
  );
};
