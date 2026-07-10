import { Notification } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback, useRef, useState } from 'react';

import { FooterNotificationsContextValue } from './footerNotificationsContext';

export const useFooterNotificationsLogic =
  (): FooterNotificationsContextValue => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [newNotifications, setNewNotifications] = useState<number>(0);
    const lastNotificationLabelRef = useRef<string>();

    const setNotification = useCallback((notification: Notification): void => {
      // Defensive de-dupe: ignore a notification identical to the one just
      // added. Completion of a single action can be signalled by more than one
      // upstream event, and this keeps the panel from stacking identical
      // entries even if a caller emits the same notification twice.
      if (lastNotificationLabelRef.current === notification.label) {
        return;
      }
      lastNotificationLabelRef.current = notification.label;
      setNotifications((prev) => [...prev, notification]);
      setNewNotifications((prev) => prev + 1);
    }, []);

    const resetNewNotifications = useCallback((): void => {
      setNewNotifications(0);
    }, []);

    return {
      notifications,
      newNotifications,
      setNotification,
      resetNewNotifications,
    };
  };
