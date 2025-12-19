import {
  snackbar,
  SnackbarProps,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import styles from './notifications.module.scss';

export const sendAppLabNotification = (
  props: Omit<SnackbarProps, 'onClose' | 'toastId'>,
): void => {
  snackbar({ ...props, className: styles['snackbar'] });
};
