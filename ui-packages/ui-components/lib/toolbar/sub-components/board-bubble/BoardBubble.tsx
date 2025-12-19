import { Board } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import { IconButton } from '../../../essential/icon-button';
import { useI18n } from '../../../i18n/useI18n';
import { messages } from '../../messages';
import styles from './board-bubble.module.scss';

interface BoardBubbleProps {
  onClick: (...args: any) => any;
  variant?: 'div' | 'button';
  badgeValue?: number;
  classes?: { container?: string; button?: string };
}

const BoardBubble: React.FC<BoardBubbleProps> = (props: BoardBubbleProps) => {
  const { onClick, variant = 'button', badgeValue = 0, classes } = props;
  const { formatMessage } = useI18n();

  const changeDeviceTooltip = formatMessage(messages.changeDevice);

  return (
    <div className={clsx(styles.container, classes?.container)}>
      {badgeValue ? <div className={styles.badge}>{badgeValue}</div> : null}
      {variant === 'button' ? (
        <IconButton
          Icon={Board}
          onPress={onClick}
          label={changeDeviceTooltip}
          title={changeDeviceTooltip}
          classes={{
            button: clsx(styles['device-link-button'], classes?.button, {
              [styles['device-link-button-with-badge']]: !!badgeValue,
            }),
          }}
        />
      ) : (
        <div
          className={clsx(styles['device-link-button'], classes?.button, {
            [styles['device-link-button-with-badge']]: !!badgeValue,
          })}
        >
          <Board />
        </div>
      )}
    </div>
  );
};

export default BoardBubble;
