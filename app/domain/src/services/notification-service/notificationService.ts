import { uniqueId } from 'lodash';
import { BehaviorSubject, filter, shareReplay, Subject } from 'rxjs';

import {
  isToastNotification,
  NotificationEvent,
  NotificationState,
  NotificationSubject,
  NotificationSubjectValue,
  NotificationType,
  ToastNotificationDismissal,
  ToastNotificationDismissalStream,
  ToastNotificationStream,
} from './notification.type';

let notificationState: NotificationState = {};

export function resetNotificationState(): void {
  notificationState = {};
}

function createNotificationState(
  currentState: NotificationState,
  newStateProps: Partial<NotificationState>,
): NotificationState {
  return {
    ...currentState,
    ...newStateProps,
  };
}

function setNotificationState(newStateProps: Partial<NotificationState>): void {
  notificationState = createNotificationState(notificationState, newStateProps);
}

function instantiateNotificationSubject(
  initialValue: NotificationSubjectValue,
): NotificationSubject {
  const $notificationStream = new BehaviorSubject<NotificationSubjectValue>(
    initialValue,
  );

  setNotificationState({ $notificationStream });

  return $notificationStream;
}

const defaultNotificationSubjectValue = null;
export function getNotificationsSubject(
  initialValue: NotificationSubjectValue = defaultNotificationSubjectValue,
): NotificationSubject {
  let { $notificationStream } = notificationState;
  if ($notificationStream) return $notificationStream;

  $notificationStream = instantiateNotificationSubject(initialValue);

  return $notificationStream;
}

export function sendNotification({
  id = uniqueId(),
  type = NotificationType.Change,
  ...rest
}: NotificationEvent): string {
  const $notificationSubject = getNotificationsSubject();

  $notificationSubject.next({ ...rest, id, type });

  return id;
}

function createToastNotificationStream(
  stream: NotificationSubject,
): ToastNotificationStream {
  const $toastNotificationStream = stream.pipe(
    filter(isToastNotification),
    shareReplay(1),
  );

  setNotificationState({ $toastNotificationStream });

  return $toastNotificationStream;
}

export function getToastNotificationsStream(): ToastNotificationStream {
  let { $toastNotificationStream } = notificationState;
  if ($toastNotificationStream) return $toastNotificationStream;

  const $notificationStream = getNotificationsSubject();

  $toastNotificationStream = createToastNotificationStream($notificationStream);

  return $toastNotificationStream;
}

function instantiateToastNotificationDismissalStream(): ToastNotificationDismissalStream {
  const $toastNotificationDismissalStream =
    new Subject<ToastNotificationDismissal>().pipe(
      shareReplay(1),
    ) as ToastNotificationDismissalStream;

  setNotificationState({ $toastNotificationDismissalStream });

  return $toastNotificationDismissalStream;
}

export function getToastNotificationDismissalStream(): ToastNotificationDismissalStream {
  let { $toastNotificationDismissalStream } = notificationState;
  if ($toastNotificationDismissalStream)
    return $toastNotificationDismissalStream;

  $toastNotificationDismissalStream =
    instantiateToastNotificationDismissalStream();

  return $toastNotificationDismissalStream;
}

export function dismissToastNotification(toastId: string): void {
  const stream = getToastNotificationDismissalStream();

  stream.next({ toastId });
}
