import {
  NotificationEvent,
  NotificationMode,
  NotificationType,
  sendNotification,
} from '@cloud-editor-mono/domain';
import { act, renderHook, waitFor } from '@testing-library/react';
import { uniqueId } from 'lodash';

import TestProviderWrapper from '../../../../tests-setup';
import { useNotificationsLogic } from './notifications.logic';

const TOAST_NOTIFICATION_ONE: NotificationEvent = {
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

const TOAST_NOTIFICATION_TWO: NotificationEvent = {
  id: 'test',
  message: 'Test notification two',
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

describe('call useNotificationsLogic', () => {
  describe('when a notification is sent', () => {
    it('the latestToastNotification should reflect what was sent', async () => {
      const { result } = renderHook(useNotificationsLogic, {
        wrapper: TestProviderWrapper,
      });

      act(() => {
        sendNotification(TOAST_NOTIFICATION_ONE);
      });

      await waitFor(() => {
        const { latestToastNotification } = result.current;

        expect(latestToastNotification?.message).toEqual(
          TOAST_NOTIFICATION_ONE.message,
        );
      });

      act(() => {
        sendNotification(TOAST_NOTIFICATION_TWO);
      });

      await waitFor(() => {
        const { latestToastNotification } = result.current;

        expect(latestToastNotification?.message).toEqual(
          TOAST_NOTIFICATION_TWO.message,
        );
      });
    });
  });
});
