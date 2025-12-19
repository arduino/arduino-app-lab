import { useEffect } from 'react';
import { toast } from 'react-toastify';

import { ToastDismissal } from './notifications.type';

type UseToastNotificationDismissal = () => any;

export function useToastNotificationDismissal(
  dismissal?: ToastDismissal,
): ReturnType<UseToastNotificationDismissal> {
  useEffect(() => {
    if (dismissal) {
      toast.dismiss(dismissal.toastId);
    }
  }, [dismissal]);
}
