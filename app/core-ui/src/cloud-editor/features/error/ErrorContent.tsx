import { Config } from '@cloud-editor-mono/common';
import { isPlayStoreApp } from '@cloud-editor-mono/domain';
import { StatusError } from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  Large,
  Link,
  Small,
  useI18n,
  XSmall,
} from '@cloud-editor-mono/ui-components';
import { memo } from 'react';

import styles from './error-content.module.scss';
import { messages } from './messages';

interface ErrorContentProps {
  onClickCopyError?: () => void;
}

const ErrorContent: React.FC<ErrorContentProps> = (
  props: ErrorContentProps,
) => {
  const { onClickCopyError } = props;

  const { formatMessage } = useI18n();

  const getInTouchLink = (
    <Link href={Config.ARDUINO_CONTACT_US_URL} target="_blank" rel="noreferrer">
      {formatMessage(messages.getInTouchLink)}
    </Link>
  );

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.iconContainer}>
          <StatusError />
        </div>
        <Large bold className={styles.title}>
          {formatMessage(messages.helpTitle)}
        </Large>
        <Small className={styles.message}>
          {formatMessage(messages.helpMessage)}
        </Small>
        <Button classes={{ button: styles.button }} onClick={onClickCopyError}>
          {formatMessage(messages.copyError)}
        </Button>
        <hr className={styles.divider} />
        {!isPlayStoreApp() ? (
          <XSmall>
            {formatMessage(messages.needHelpMessage, { getInTouchLink })}
          </XSmall>
        ) : undefined}
      </div>
    </div>
  );
};

export default memo(ErrorContent);
