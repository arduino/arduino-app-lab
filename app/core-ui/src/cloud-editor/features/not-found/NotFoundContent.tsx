import { Config } from '@cloud-editor-mono/common';
import { isPlayStoreApp } from '@cloud-editor-mono/domain';
import { NotFoundPageImage } from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  Large,
  Link,
  Small,
  useI18n,
  XSmall,
} from '@cloud-editor-mono/ui-components';

import { NotFoundType } from '../../../routing/routing.type';
import { messages } from './messages';
import styles from './not-found-content.module.scss';

interface NotFoundContentProps {
  type: NotFoundType;
}

const NotFoundContent: React.FC<NotFoundContentProps> = (
  props: NotFoundContentProps,
) => {
  const { type } = props;

  const { formatMessage } = useI18n();

  const getInTouchLink = (
    <Link href={Config.ARDUINO_CONTACT_US_URL} target="_blank" rel="noreferrer">
      {formatMessage(messages.getInTouchLink)}
    </Link>
  );

  const handleClickGoToSketches = (): void => {
    window.location.href = `${Config.CLOUD_HOME_URL}/sketches`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <NotFoundPageImage />
        <Large bold className={styles.title}>
          {formatMessage(messages.helpTitle, { type })}
        </Large>
        <Small className={styles.message}>
          {formatMessage(messages.helpMessage, { type })}
        </Small>
        <Button
          classes={{ button: styles.button }}
          onClick={handleClickGoToSketches}
        >
          {formatMessage(messages.goToSketches)}
        </Button>
        <hr className={styles.divider} />
        {!isPlayStoreApp() ? (
          <XSmall>
            {formatMessage(messages.needHelpMessage, { getInTouchLink })}
          </XSmall>
        ) : null}
      </div>
    </div>
  );
};

export default NotFoundContent;
