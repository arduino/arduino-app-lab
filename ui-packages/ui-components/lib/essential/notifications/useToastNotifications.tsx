import clsx from 'clsx';
import { uniqueId } from 'lodash';
import { useEffect } from 'react';
import { toast, ToastOptions } from 'react-toastify';

import styles from './notifications.module.scss';
import { ToastNotification, ToastSize, ToastType } from './notifications.type';
import Notification from './sub-components/Notification';

type UseToastNotifications = (toastNotification: ToastNotification) => void;

const TOAST_TIMEOUT = 5000;
export const useToastNotifications = function (
  toastNotification: ToastNotification | null,
): ReturnType<UseToastNotifications> {
  useEffect(() => {
    if (toastNotification) {
      const {
        message,
        toastId,
        toastType,
        toastIcon,
        toastOnClose,
        toastActions,
        toastOptions,
        toastSize,
        onUnmount,
      } = toastNotification;

      const id = toastId || uniqueId();

      const defaultOptions: ToastOptions<any> = {
        toastId: id,
        autoClose: toastType === ToastType.Passive ? TOAST_TIMEOUT : undefined,
        className: clsx(styles.toast, {
          [styles.toastSmall]: toastSize === ToastSize.Small,
        }),
        bodyClassName: clsx({
          [styles.toastBodySmall]: toastSize === ToastSize.Small,
        }),
      };

      const onChangeUnsub = toast.onChange((payload) => {
        switch (payload.status) {
          case 'removed':
            if (onUnmount && payload.id === id) {
              onUnmount();
            }
            break;
        }
      });

      toast(
        <Notification
          key={id}
          id={id}
          message={message}
          type={toastType}
          toastIcon={toastIcon}
          onClose={toastOnClose}
          actionItems={toastActions}
        />,
        toastOptions
          ? {
              ...defaultOptions,
              ...toastOptions,
            }
          : defaultOptions,
      );

      return () => {
        onChangeUnsub();
      };
    }
  }, [toastNotification]);
};
