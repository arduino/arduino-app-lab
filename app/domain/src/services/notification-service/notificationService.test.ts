import { isEqual, uniqueId } from 'lodash';
import { firstValueFrom } from 'rxjs';

import {
  NotificationEvent,
  NotificationMode,
  NotificationType,
} from './notification.type';
import {
  getToastNotificationsStream,
  sendNotification,
} from './notificationService';

const TOAST_NOTIFICATION: NotificationEvent = {
  id: 'test',
  message: 'Test notification',
  type: NotificationType.Change,
  mode: NotificationMode.Toast,
  modeOptions: {
    toastActions: [
      {
        id: uniqueId(),
        handler: () => alert(''),
        label: 'Retry',
      },
    ],
  },
};

describe('send a toast notification', async () => {
  const $toastNotificationStream = getToastNotificationsStream();

  const firstToastNotificationPromise = firstValueFrom(
    $toastNotificationStream,
  );

  sendNotification(TOAST_NOTIFICATION);

  const firstToastNotification = await firstToastNotificationPromise;

  it('the toast notification stream should emit a notification', () => {
    expect(isEqual(firstToastNotification, TOAST_NOTIFICATION)).toBeTruthy();
  });
});
