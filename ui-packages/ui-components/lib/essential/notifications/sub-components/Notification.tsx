import {
  CloseX,
  NotificationSuccessCheck,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { toast } from 'react-toastify';

import { Text } from '../../../typography';
import { Button, ButtonType } from '../../button';
import { IconButton } from '../../icon-button';
import {
  ToastActionItems,
  ToastIcon,
  ToastIconDictionary,
  ToastOnCloseHandler,
  ToastType,
} from '../notifications.type';
import styles from './notification.module.scss';

const toastIconDictionary: ToastIconDictionary = {
  [ToastIcon.Success]: NotificationSuccessCheck,
};

interface NotificationProps {
  id: string;
  message: string;
  type?: ToastType;
  toastIcon?: ToastIcon;
  onClose?: ToastOnCloseHandler;
  actionItems?: ToastActionItems;
}

const Notification: React.FC<NotificationProps> = (
  props: NotificationProps,
) => {
  const {
    id,
    message,
    toastIcon,
    type = ToastType.Persistent,
    onClose,
    actionItems,
  } = props;

  const onClickClose = onClose
    ? (): void => {
        toast.dismiss(id);
        onClose();
      }
    : (): void => toast.dismiss(id);

  const Icon =
    typeof toastIcon !== 'undefined' ? toastIconDictionary[toastIcon] : null;

  return (
    <div className={styles.container}>
      <div className={styles.messageContainer}>
        <Text
          className={clsx(styles.text, {
            [styles['text-padding']]:
              Boolean(Icon) ||
              Boolean(actionItems) ||
              type === ToastType.Persistent,
          })}
        >
          {message}
        </Text>
        {Icon ? (
          <Icon
            className={clsx({
              [styles['message-icon-padding']]:
                Boolean(actionItems) || type === ToastType.Persistent,
            })}
          />
        ) : null}
      </div>
      {actionItems?.map((item) => (
        <div className={styles.action} key={item.id}>
          <div className={styles.divider}></div>
          <Button
            type={ButtonType.Tertiary}
            classes={{ button: styles.actionButton }}
            onClick={item.handler}
          >
            {item.label}
          </Button>
        </div>
      ))}
      {type === ToastType.Persistent ? (
        <div className={styles.action}>
          <div className={styles.divider}></div>
          <IconButton
            Icon={CloseX}
            label={'Close'}
            classes={{ button: styles.closeButton }}
            onPress={onClickClose}
          />
        </div>
      ) : null}
    </div>
  );
};

export default Notification;
