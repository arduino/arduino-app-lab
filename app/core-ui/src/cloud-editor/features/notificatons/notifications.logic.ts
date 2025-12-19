import {
  getToastNotificationDismissalStream,
  getToastNotificationsStream,
  NotificationType,
} from '@cloud-editor-mono/domain';
import {
  NotificationsLogic,
  ToastIcon,
} from '@cloud-editor-mono/ui-components';
import { useEffect, useState } from 'react';

import { useObservable } from '../../../common/hooks/useObservable';

export const useNotificationsLogic =
  function (): ReturnType<NotificationsLogic> {
    const $toastNotificationStream = getToastNotificationsStream();
    const toastNotification = useObservable($toastNotificationStream);

    const $toastNotificationDismissalStream =
      getToastNotificationDismissalStream();
    const latestToastDismissal = useObservable(
      $toastNotificationDismissalStream,
    );

    const [latestToastNotification, setLatestToastNotification] =
      useState<ReturnType<NotificationsLogic>['latestToastNotification']>(null);

    useEffect(() => {
      let latestToastNotification = null;

      if (toastNotification) {
        const { type, modeOptions, message } = toastNotification;

        const toastIcon =
          type === NotificationType.Success ? ToastIcon.Success : undefined;

        latestToastNotification = {
          message,
          toastIcon,
          ...modeOptions,
        };
      }

      setLatestToastNotification(latestToastNotification);
    }, [toastNotification]);

    return {
      latestToastNotification,
      latestToastDismissal,
    };
  };
