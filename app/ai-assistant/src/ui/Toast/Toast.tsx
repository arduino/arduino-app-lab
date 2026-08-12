import {
  StatusError,
  StatusSuccess,
} from '@cloud-editor-mono/images/assets/icons';
import { TextSize } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { ReactNode, useEffect, useRef } from 'react';

import { Text } from '../Text/Text';
import styles from './toast.module.scss';

export type ToastVariant = 'error' | 'success';

const AUTO_DISMISS_MS = 6000;

interface ToastProps {
  children: ReactNode;
  variant?: ToastVariant;
  onDismiss?: VoidFunction;
  dismissLabel?: string;
  floating?: boolean;
  // Dismiss the toast on its own after AUTO_DISMISS_MS (requires onDismiss).
  autoDismiss?: boolean;
}

export const Toast: React.FC<ToastProps> = ({
  children,
  variant = 'error',
  onDismiss,
  dismissLabel,
  floating,
  autoDismiss,
}) => {
  const Icon = variant === 'success' ? StatusSuccess : StatusError;

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  useEffect(() => {
    if (!autoDismiss) {
      return undefined;
    }

    const timer = setTimeout(() => onDismissRef.current?.(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [autoDismiss]);

  return (
    <div
      className={clsx(
        styles['toast'],
        styles[`toast--${variant}`],
        floating && styles['toast--floating'],
      )}
      role="alert"
    >
      <Icon className={styles['icon']} aria-hidden="true" />
      <Text size={TextSize.XXSmall} className={styles['text']}>
        {children}
      </Text>
      {onDismiss && (
        <button
          type="button"
          className={styles['close']}
          aria-label={dismissLabel}
          onClick={onDismiss}
        >
          ×
        </button>
      )}
    </div>
  );
};

export default Toast;
