import { Notifications } from '@cloud-editor-mono/ui-components';

import { useNotificationsLogic } from './notifications.logic';

const NotificationsFeat: React.FC = () => {
  return <Notifications notificationLogic={useNotificationsLogic} />;
};

export default NotificationsFeat;
