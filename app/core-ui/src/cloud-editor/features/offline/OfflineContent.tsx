import { Large, Small, useI18n } from '@cloud-editor-mono/ui-components';
import { memo } from 'react';

import { messages } from './messages';
import styles from './offline-content.module.scss';

const OfflineContent: React.FC = () => {
  const { formatMessage } = useI18n();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <Large bold className={styles.title}>
          {formatMessage(messages.offlineTitle)}
        </Large>
        <Small className={styles.message}>
          {formatMessage(messages.offlineMessage)}
        </Small>
      </div>
    </div>
  );
};

export default memo(OfflineContent);
