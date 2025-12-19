import clsx from 'clsx';

import { EmojiPreview } from '../app-lab-emoji-picker/sub-components/EmojiPreview';
import { useI18n } from '../i18n/useI18n';
import { Skeleton } from '../skeleton';
import { getBackgroundIcon } from '../utils';
import styles from './app-item.module.scss';
import { AppItemProps } from './AppItem.type';
import { appItemMessages } from './messages';

const DEFAULT_ICON = '⚪'; // Default icon if none is provided

const AppItem: React.FC<AppItemProps> = (props: AppItemProps) => {
  const {
    icon,
    name,
    description,
    default: isDefault,
    status,
    variant = 'default',
  } = props;

  const { formatMessage } = useI18n();

  return (
    <div className={styles['container']}>
      {/* Header */}
      <div className={styles['header']}>
        <div
          className={styles['header-bg']}
          style={{ background: getBackgroundIcon(icon || DEFAULT_ICON) }}
        ></div>

        {isDefault && (
          <span className={styles['header-default']}>
            {formatMessage(appItemMessages.appDefault)}
          </span>
        )}

        <span
          className={clsx({
            [styles['header-icon-skeleton']]: variant === 'skeleton' || !icon,
            [styles['header-icon']]: variant === 'default',
          })}
        >
          <EmojiPreview size={32} value={icon || DEFAULT_ICON} />
        </span>
      </div>

      {/* Content */}
      {variant === 'default' && (
        <div className={styles['content']}>
          <div className={styles['content-title']}>
            <div className={styles['title']}>{name}</div>
            {status === 'running' && (
              <div className={styles['running']}>
                {formatMessage(appItemMessages.appRunning)}
              </div>
            )}
          </div>
          <div className={styles['content-description']}>{description}</div>
          {/* <div className={clsx(styles['content-footer'])}>
            {formatMessage(appItemMessages.appSize, { size: '123' })}
          </div> */}
        </div>
      )}
      {variant === 'skeleton' && (
        <div className={styles['content']}>
          <div className={styles['content-title-skeleton']}>
            <Skeleton variant="rounded" count={1} />
          </div>
          <div className={styles['content-description-skeleton']}>
            <Skeleton variant="rounded" count={3} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AppItem;
