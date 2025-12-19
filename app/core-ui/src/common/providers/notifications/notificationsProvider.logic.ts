import {
  dismissToastNotification,
  NotificationMode,
  NotificationType,
  sendNotification,
} from '@cloud-editor-mono/domain';
import { ToastType } from '@cloud-editor-mono/ui-components';
import { uniqueId } from 'lodash';
import { useCallback, useContext } from 'react';
import { defineMessages, IntlContext, MessageDescriptor } from 'react-intl';

import { NotificationsContextValue } from './notificationsContext';

type UseActionNotification = () => {
  sendErrorNotification: NotificationsContextValue['sendErrorNotification'];
  sendSuccessNotification: NotificationsContextValue['sendSuccessNotification'];
};

export function useActionNotification(): ReturnType<UseActionNotification> {
  const { formatMessage } = useContext(IntlContext);

  const sendErrorNotification = useCallback(
    (
      handler?: (...args: any) => any,
      toastIdToDismiss?: string,
      message?: MessageDescriptor,
      messageArgs?: Record<string, any>,
    ): ReturnType<NotificationsContextValue['sendErrorNotification']> => {
      if (toastIdToDismiss) dismissToastNotification(toastIdToDismiss);

      const toastId = uniqueId();
      const id = sendNotification({
        message: message
          ? formatMessage(message, messageArgs)
          : formatMessage(messages.anyErrorAdvisory),
        mode: NotificationMode.Toast,
        type: NotificationType.Error,
        modeOptions: {
          toastId,
          toastType: ToastType.Persistent,
          ...(!message &&
            handler && {
              toastActions: [
                {
                  id: uniqueId(),
                  label: formatMessage(messages.tryAgain),
                  handler: () => handler(toastId),
                },
              ],
            }),
        },
      });

      return { id, toastId };
    },
    [formatMessage],
  );

  const sendSuccessNotification = useCallback(
    (
      messageDescriptor: MessageDescriptor,
      toastIdToDismiss?: string,
    ): string => {
      if (toastIdToDismiss) dismissToastNotification(toastIdToDismiss);

      return sendNotification({
        message: formatMessage(messageDescriptor),
        mode: NotificationMode.Toast,
        type: NotificationType.Success,
        modeOptions: {
          toastType: ToastType.Passive,
        },
      });
    },
    [formatMessage],
  );

  return {
    sendErrorNotification,
    sendSuccessNotification,
  };
}

const messages = defineMessages({
  anyErrorAdvisory: {
    id: 'errornotification.advisory',
    defaultMessage:
      'Sorry, an error occurred, we are unable to perform this action.',
    description: 'An error occurred of any type.',
  },
  tryAgain: {
    id: 'errornotification.tryagain',
    defaultMessage: 'Try again',
    description: 'Try again CTA',
  },
});
