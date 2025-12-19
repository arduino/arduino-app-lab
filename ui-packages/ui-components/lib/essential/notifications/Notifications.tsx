import 'react-toastify/dist/ReactToastify.css';

import { ToastContainer } from 'react-toastify';

import styles from './notifications.module.scss';
import { NotificationsLogic } from './notifications.type';
import { useToastNotificationDismissal } from './useToastNotificationDismissal';
import { useToastNotifications } from './useToastNotifications';

interface NotificationsProps {
  notificationLogic: NotificationsLogic;
}

const Notifications: React.FC<NotificationsProps> = (
  props: NotificationsProps,
) => {
  const { notificationLogic } = props;

  const { latestToastNotification, latestToastDismissal } = notificationLogic();

  useToastNotifications(latestToastNotification);
  useToastNotificationDismissal(latestToastDismissal);

  return (
    <ToastContainer
      className={styles.container}
      toastClassName={styles.toast}
      bodyClassName={styles['toastBody']}
      closeButton={false}
      autoClose={false}
      hideProgressBar={true}
      position="bottom-center"
      closeOnClick={false}
    />
  );
};

export default Notifications;
