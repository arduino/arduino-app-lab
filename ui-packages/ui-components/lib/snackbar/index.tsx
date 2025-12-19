// ----------------------------------------------------------------------
// IMPORTED FILE
//
// This code was imported from a external library to handle private
// dependencies required for the main application to run.
// ----------------------------------------------------------------------

import {
  IconNavigationCheckmarkOutlineFilled,
  IconNavigationCloseNormal,
  IconStatusAttentionErrorOutlineFilled,
  IconStatusAttentionWarningOutlineFilled,
  IconStatusInformationItalicOutlineFilled,
} from '@arduino/react-icons';
import * as DismissableLayer from '@radix-ui/react-dismissable-layer';
import { Portal } from '@radix-ui/react-portal';
import clsx from 'clsx';
import type React from 'react';
import {
  ComponentPropsWithRef,
  ForwardedRef,
  forwardRef,
  Ref,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import type { ExternalToast, ToasterProps } from 'sonner';
import { toast, Toaster } from 'sonner';

import { useWindowDimensions } from '../common/hooks/useWindowDimensions';
import { Small, XSmall } from '../typography';
import styles from './Snackbar.module.scss';

// Copied from utils
type Range<
  Min extends number,
  Max extends number,
  Acc extends number[] = [],
> = Acc['length'] extends Max
  ? Min | Max | Acc[number]
  : Range<Min, Max, [Acc['length'], ...Acc]>;

type SizedArray<
  TObject,
  TMin extends number,
  TMax extends number,
> = TObject[] & { length: Range<TMin, TMax> };

const variants = ['info', 'error', 'success', 'warning'] as const;
type Variants = typeof variants[number];

const icons: Record<Variants, React.ComponentType> = {
  info: IconStatusInformationItalicOutlineFilled,
  error: IconStatusAttentionErrorOutlineFilled,
  success: IconNavigationCheckmarkOutlineFilled,
  warning: IconStatusAttentionWarningOutlineFilled,
};

const variantStyles: Record<Variants, string> = {
  info: 'Snackbar--info',
  error: 'Snackbar--error',
  success: 'Snackbar--success',
  warning: 'Snackbar--warning',
};

export type SnackbarProps = ComponentPropsWithRef<'div'> & {
  message: string;
  toastId: string | number;
  title?: string;
  variant?: Variants;
  actions?: SizedArray<
    {
      text: string;
      onClick: ({ dismiss }: { dismiss: () => void }) => void;
    },
    1,
    2
  >;
  /**
   * Closeable snackbar. If a function is provided, it will be called when the snackbar is closed.
   * */
  onClose?: ({ dismiss }: { dismiss: () => void }) => void;
};

export const Snackbar = forwardRef<HTMLDivElement, SnackbarProps>(
  function Snackbar(
    props: SnackbarProps,
    ref: ForwardedRef<HTMLDivElement | null>,
  ) {
    const {
      title,
      message,
      variant = 'info',
      className,
      actions,
      onClose,
      toastId,
      ...rest
    } = props;

    const Icon = icons[variant];

    const mq = useWindowDimensions(480);

    const dismiss = useCallback(() => toast.dismiss(toastId), [toastId]);

    return (
      <div
        className={clsx(
          styles.Snackbar,
          styles['Snackbar--xl'],
          variantStyles[variant],
          className,
        )}
        {...rest}
        ref={ref as Ref<HTMLDivElement>}
      >
        <div className={styles.Snackbar_content}>
          <span className={styles['Snackbar_content-icon']}>
            <Icon />
          </span>
          <div className={clsx(styles['Snackbar_content-text'])}>
            {title ? (
              <Small bold truncate title={title}>
                {title}
              </Small>
            ) : null}
            <XSmall truncate title={message}>
              {message}
            </XSmall>
          </div>
          {onClose && mq ? (
            <button
              className={styles['Snackbar-close']}
              onClick={(): void => onClose({ dismiss })}
            >
              <IconNavigationCloseNormal />
            </button>
          ) : null}
        </div>
        {actions ? (
          <div className={styles.Snackbar_actions}>
            {actions.map((a, i) => (
              <>
                <div
                  className={styles['Snackbar-separator']}
                  style={{ display: 'block' }}
                />
                <Small key={`snackbar-action-${i}`} bold>
                  <button
                    className={styles['Snackbar-action']}
                    onClick={(): void => a.onClick({ dismiss })}
                  >
                    {a.text}
                  </button>
                </Small>
              </>
            ))}
          </div>
        ) : null}
        {onClose && !mq ? (
          <>
            <div
              className={styles['Snackbar-separator']}
              style={{ display: 'block' }}
            />
            <button
              className={styles['Snackbar-close']}
              onClick={(): void => onClose({ dismiss })}
            >
              <IconNavigationCloseNormal />
            </button>
          </>
        ) : null}
      </div>
    );
  },
);

/*
 * ====================
 * Snackbar Provider
 * ====================
 */

// Global reference to track if a SnackbarProvider is already mounted
let isSnackbarProviderMounted = false;

/**
 * Snackbar provider component that manages toast notifications.
 *
 * **Singleton behavior**: Only one SnackbarProvider can be mounted at a time
 * in the document. If multiple instances are rendered, only the first one
 * will actually mount the portal and display toasts. Additional instances
 * will log a warning and not render.
 *
 * This ensures that:
 * - Multiple portals don't conflict with each other
 * - Toast positioning and behavior remains consistent
 * - No duplicate toast containers are created
 */
export function SnackbarProvider({
  duration = 5000,
  expand = false,
  offset = 32,
  visibleToasts = 3,
  pauseWhenPageIsHidden = true,
}: Pick<
  ToasterProps,
  'duration' | 'expand' | 'offset' | 'visibleToasts' | 'pauseWhenPageIsHidden'
>): JSX.Element | null {
  const isMountedRef = useRef(false);

  useEffect(() => {
    // Check if another provider is already mounted
    if (isSnackbarProviderMounted && !isMountedRef.current) {
      console.warn(
        'SnackbarProvider: Another SnackbarProvider is already mounted. This instance will not render.',
      );
      return undefined;
    }

    // Mark this instance as mounted
    if (!isMountedRef.current) {
      isSnackbarProviderMounted = true;
      isMountedRef.current = true;
    }

    return () => {
      if (isMountedRef.current) {
        isSnackbarProviderMounted = false;
        isMountedRef.current = false;
      }
    };
  }, []);

  // Don't render if another provider is already mounted and this isn't the mounted one
  if (isSnackbarProviderMounted && !isMountedRef.current) {
    return null;
  }

  return (
    <Portal>
      {/* Allow composability within Radix portals. */}
      <DismissableLayer.Root asChild>
        <Toaster
          // ! Classname to overcome positioning issues. Only bottom-center is supported.
          // ! See: https://github.com/emilkowalski/sonner/issues/382
          className={styles.SnackbarProvider}
          position="bottom-center"
          duration={duration}
          expand={expand}
          offset={offset}
          visibleToasts={visibleToasts}
          pauseWhenPageIsHidden={pauseWhenPageIsHidden}
        />
      </DismissableLayer.Root>
    </Portal>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function snackbar({
  closeable = true,
  opts,
  ...rest
}: Omit<SnackbarProps, 'onClose' | 'toastId'> & {
  closeable?: (() => void) | boolean;
  opts?: Pick<ExternalToast, 'onDismiss' | 'onAutoClose' | 'duration'>;
}) {
  return toast.custom(
    (t) => (
      <DismissableLayer.Branch asChild>
        <Snackbar
          toastId={t}
          {...rest}
          onClose={
            closeable
              ? () => {
                  if (typeof closeable === 'function') closeable();
                  toast.dismiss(t);
                }
              : undefined
          }
        />
      </DismissableLayer.Branch>
    ),
    opts,
  );
}
