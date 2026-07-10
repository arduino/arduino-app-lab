import { Notification } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { createContext, useContext } from 'react';

export type FooterNotificationsContextValue = {
  notifications: Notification[];
  newNotifications: number;
  setNotification: (notification: Notification) => void;
  resetNewNotifications: () => void;
};

const FooterNotificationsContextValue: FooterNotificationsContextValue = {
  notifications: [],
  newNotifications: 0,
  setNotification: () => undefined,
  resetNewNotifications: () => undefined,
};

export const FooterNotificationsContext =
  createContext<FooterNotificationsContextValue>(
    FooterNotificationsContextValue,
  );

export const useFooterNotifications = (): FooterNotificationsContextValue => {
  const context = useContext(FooterNotificationsContext);

  if (!context) {
    throw new Error(
      'useFooterNotifications must be used within a FooterNotificationsContextProvider',
    );
  }

  return context;
};
