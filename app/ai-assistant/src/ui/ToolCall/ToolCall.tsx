import {
  TextSize,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { MessageDescriptor } from 'react-intl';

import { messages } from '../../messages';
import { ToolCall as ToolCallData, ToolCallStatus } from '../../services';
import { ExpandableCard } from '../ExpandableCard/ExpandableCard';
import { Text } from '../Text/Text';
import { formatToolTitle } from './formatToolTitle';
import styles from './tool-call.module.scss';

const STATUS_MESSAGE: Record<ToolCallStatus, MessageDescriptor> = {
  pending: messages.toolStatusPending,
  in_progress: messages.toolStatusRunning,
  completed: messages.toolStatusDone,
  failed: messages.toolStatusFailed,
};

const STATUS_ICON: Record<ToolCallStatus, string> = {
  pending: '○',
  in_progress: '◑',
  completed: '✓',
  failed: '✕',
};

interface ToolCallProps {
  toolCall: ToolCallData;
}

export const ToolCall: React.FC<ToolCallProps> = ({ toolCall }) => {
  const { formatMessage } = useI18n();
  const { title, status, output } = toolCall;

  const isExpandable = status === 'completed' || status === 'failed';

  return (
    <ExpandableCard
      className={styles[`tool-card--${status}`]}
      bodyClassName={styles['tool-body']}
      leading={
        <span
          className={clsx(
            styles['tool-status-icon'],
            styles[`tool-status-icon--${status}`],
          )}
          aria-hidden="true"
        >
          {STATUS_ICON[status]}
        </span>
      }
      title={formatToolTitle(title)}
      trailing={
        <Text size={TextSize.XXSmall} className={styles['tool-status']}>
          {formatMessage(STATUS_MESSAGE[status])}
        </Text>
      }
    >
      {isExpandable && output !== undefined && (
        <>
          <Text className={styles['tool-io-label']}>
            {formatMessage(messages.toolOutput)}
          </Text>
          <pre className={styles['tool-io']}>{output}</pre>
        </>
      )}
    </ExpandableCard>
  );
};

export default ToolCall;
