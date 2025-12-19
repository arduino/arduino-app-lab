import { Ai as AiIcon } from '@cloud-editor-mono/images/assets/icons';

import { useI18n } from '../../../i18n/useI18n';
import { XXXSmall } from '../../../typography';
import { messages } from '../../messages';
import styles from './ai-badge.module.scss';

export const AppLabAiBadge: React.FC = () => {
  const { formatMessage } = useI18n();

  return (
    <div className={styles['ai-badge']}>
      <AiIcon />
      <XXXSmall className={styles['ai-badge-text']}>
        {formatMessage(messages.aiModelBadge)}
      </XXXSmall>
    </div>
  );
};
