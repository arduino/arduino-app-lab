import clsx from 'clsx';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';

import { Text, TextSize } from '../../typography';
import { Loader } from '../loader';
import { ButtonSize, ButtonType, ButtonVariant } from './appLabButton.type';
import styles from './button.module.scss';

type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'type'
> & {
  type?: ButtonType;
  variant?: ButtonVariant;
  size?: ButtonSize;
  Icon?: React.FC;
  iconPosition?: 'left' | 'right';
  classes?: { button?: string; textButtonText?: string };
  loading?: boolean;
  bold?: boolean;
  uppercase?: boolean;
  isSubmit?: boolean;
};

export const AppLabButton = forwardRef(
  (props: ButtonProps, ref: React.ForwardedRef<HTMLButtonElement | null>) => {
    const {
      children,
      Icon,
      iconPosition = 'right',
      classes,
      type = ButtonType.Primary,
      variant = ButtonVariant.Action,
      size = ButtonSize.Small,
      loading = false,
      bold = false,
      uppercase = false,
      isSubmit = false,
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
        tabIndex={0}
        type={isSubmit ? 'submit' : 'button'}
        className={clsx(
          styles.button,
          {
            //Types
            [styles['primary']]: type === ButtonType.Primary,
            [styles['secondary']]: type === ButtonType.Secondary,
            [styles['tertiary']]: type === ButtonType.Tertiary,
            //Variants
            [styles['destructive']]: variant === ButtonVariant.Destructive,
            [styles['action']]: variant === ButtonVariant.Action,
            [styles['low-contrast']]: variant === ButtonVariant.LowContrast,
            //Icon Position
            [styles['button-icon-left']]: iconPosition === 'left',
            [styles['button-icon-right']]: iconPosition === 'right',
            //Sizes
            [styles['xx-small']]: size === ButtonSize.XXSmall,
            [styles['x-small']]: size === ButtonSize.XSmall,
            [styles['small']]: size === ButtonSize.Small,
            [styles['large']]: size === ButtonSize.Large,

            [styles['disabled']]: buttonProps.disabled,
          },
          classes?.button,
        )}
      >
        {loading && <Loader tiny className={styles.loader} />}
        {iconPosition === 'left' ? WrappedIcon : null}
        {children && (
          <Text
            size={
              size === ButtonSize.XXSmall
                ? TextSize.XXSmall
                : size === ButtonSize.XSmall
                ? TextSize.XSmall
                : TextSize.Small
            }
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

AppLabButton.displayName = 'Button';
