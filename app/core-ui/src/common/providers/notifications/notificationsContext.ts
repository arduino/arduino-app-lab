import { createContext } from 'react';
import { MessageDescriptor } from 'react-intl';

export interface NotificationsContextValue {
  sendErrorNotification: (
    handler?: (...args: any) => any,
    toastIdToDismiss?: string,
    customMessage?: MessageDescriptor,
    customMessageArgs?: Record<string, any>,
  ) => {
    id: string;
    toastId: string;
  };
  sendSuccessNotification: (
    messageDescriptor: MessageDescriptor,
    toastIdToDismiss?: string,
  ) => string;
}

const NotificationsContextValue: NotificationsContextValue =
  {} as NotificationsContextValue;

export const NotificationsContext = createContext<NotificationsContextValue>(
  NotificationsContextValue,
);
