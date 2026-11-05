import clsx from 'clsx';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';

import { Loader } from '../../../../essential/loader';
import { Text, TextSize } from '../../../../typography';
import styles from './button.module.scss';
import { ButtonAppearance, ButtonSize, ButtonVariant } from './Button.type';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  appearance?: ButtonAppearance;
  size?: ButtonSize;
  Icon?: React.FC;
  iconPosition?: 'left' | 'right';
  classes?: { button?: string; textButtonText?: string };
  loading?: boolean;
  bold?: boolean;
  uppercase?: boolean;
  disableInteractive?: boolean;
};

const TEXT_SIZE_BY_BUTTON_SIZE: Record<ButtonSize, TextSize> = {
  [ButtonSize.XXSmall]: TextSize.XXXSmall,
  [ButtonSize.XSmall]: TextSize.XXSmall,
  [ButtonSize.Small]: TextSize.XSmall,
  [ButtonSize.Large]: TextSize.Small,
};

export const Button = forwardRef(
  (props: ButtonProps, ref: React.ForwardedRef<HTMLButtonElement | null>) => {
    const {
      children,
      Icon,
      iconPosition = 'right',
      classes,
      variant = ButtonVariant.Primary,
      appearance = ButtonAppearance.Action,
      size = ButtonSize.Small,
      loading = false,
      bold = false,
      uppercase = false,
      disableInteractive = false,
      ...buttonProps
    } = props;

    const buttonRef = useRef<HTMLButtonElement | null>(null);

    useImperativeHandle(ref, () => buttonRef.current!);

    const WrappedIcon = Icon ? (
      <>
        {/* for browser compatibility?
        eslint-disable-next-line @typescript-eslint/ban-ts-comment
        @ts-ignore */}
        <Icon aria-hidden="true" focusable="false" />
        <span className="visually-hidden">{children}</span>
      </>
    ) : null;

    return (
      <button
        {...buttonProps}
        ref={buttonRef}
        type={buttonProps.type || 'button'}
        disabled={buttonProps.disabled || loading}
        aria-busy={loading || undefined}
        tabIndex={0}
        className={clsx(
          styles.button,
          {
            //Types
            [styles['primary']]: variant === ButtonVariant.Primary,
            [styles['secondary']]: variant === ButtonVariant.Secondary,
            [styles['tertiary']]: variant === ButtonVariant.Tertiary,
            //Variants
            [styles['destructive']]:
              appearance === ButtonAppearance.Destructive,
            [styles['action']]: appearance === ButtonAppearance.Action,
            [styles['low-contrast']]:
              appearance === ButtonAppearance.LowContrast,
            //Sizes
            [styles['xx-small']]: size === ButtonSize.XXSmall,
            [styles['x-small']]: size === ButtonSize.XSmall,
            [styles['small']]: size === ButtonSize.Small,
            [styles['large']]: size === ButtonSize.Large,

            [styles['disabled']]: buttonProps.disabled || loading,
            [styles['disable-interactive']]: disableInteractive,
          },
          classes?.button,
        )}
      >
        {loading && <Loader tiny className={styles.loader} />}
        {iconPosition === 'left' ? WrappedIcon : null}
        {children && (
          <Text
            size={TEXT_SIZE_BY_BUTTON_SIZE[size]}
            className={clsx(
              styles['text-button-text'],
              classes?.textButtonText,
            )}
            bold={bold}
            uppercase={uppercase}
          >
            {children}
          </Text>
        )}
        {iconPosition === 'right' ? WrappedIcon : null}
      </button>
    );
  },
);

Button.displayName = 'Button';
