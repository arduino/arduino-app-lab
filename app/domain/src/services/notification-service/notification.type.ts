import {
  OnToastUnmount,
  ToastActionItems,
  ToastDismissal,
  ToastOnCloseHandler,
  ToastSize,
  ToastType,
} from '@cloud-editor-mono/ui-components';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export enum NotificationType {
  Change,
  Success,
  Error,
}

export enum NotificationMode {
  Toast,
  NonUI,
}

interface ToastMode {
  toastId?: string;
  toastType?: ToastType;
  toastOnClose?: ToastOnCloseHandler;
  toastActions?: ToastActionItems;
  toastSize?: ToastSize;
  onUnmount?: OnToastUnmount;
}

interface NotificationModeOptionDictionary {
  [NotificationMode.Toast]: ToastMode;
  [NotificationMode.NonUI]: undefined;
}

interface Mode<K extends keyof NotificationModeOptionDictionary> {
  id?: string;
  type?: NotificationType;
  mode: K;
  modeOptions?: NotificationModeOptionDictionary[K];
}
export type NotificationEventDictionary = {
  [K in keyof NotificationModeOptionDictionary]: Mode<K> & { message: string };
};

export type NotificationEvent =
  NotificationEventDictionary[keyof NotificationEventDictionary];

export type NotificationSubjectValue = NotificationEvent | null;
export type NotificationSubject = BehaviorSubject<NotificationSubjectValue>;

export const isToastNotification = (
  notification: NotificationSubjectValue,
): notification is NotificationEventDictionary[NotificationMode.Toast] => {
  return Boolean(notification && notification.mode === NotificationMode.Toast);
};

export type ToastNotificationStream = Observable<
  NotificationEventDictionary[NotificationMode.Toast] | null
>;

export type ToastNotificationDismissal = ToastDismissal;
export type ToastNotificationDismissalStream =
  Subject<ToastNotificationDismissal>;

export interface NotificationState {
  $notificationStream?: NotificationSubject;
  $toastNotificationStream?: ToastNotificationStream;
  $toastNotificationDismissalStream?: ToastNotificationDismissalStream;
}
