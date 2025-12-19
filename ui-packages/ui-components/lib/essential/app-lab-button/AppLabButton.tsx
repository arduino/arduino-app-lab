import clsx from 'clsx';
import React, {
  forwardRef,
  ReactNode,
  useImperativeHandle,
  useRef,
} from 'react';

import { Text, TextSize } from '../../typography';
import { Loader } from '../loader';
import { ButtonSize, ButtonType, ButtonVariant } from './appLabButton.type';
import styles from './button.module.scss';

type ButtonProps = {
  id?: string;
  children?: ReactNode;
  type?: ButtonType;
  variant?: ButtonVariant;
  size?: ButtonSize;
  Icon?: React.FC;
  iconPosition?: 'left' | 'right';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClick?: (...args: any) => any;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  classes?: { button?: string; textButtonText?: string };
  disabled?: boolean;
  loading?: boolean;
  bold?: boolean;
  uppercase?: boolean;
  title?: string;
};

export const AppLabButton = forwardRef(
  (props: ButtonProps, ref: React.ForwardedRef<Partial<HTMLButtonElement>>) => {
    const {
      id,
      children,
      Icon,
      iconPosition = 'right',
      onClick,
      onMouseEnter,
      onMouseLeave,
      classes,
      type = ButtonType.Primary,
      variant = ButtonVariant.Action,
      size = ButtonSize.Small,
      disabled = false,
      loading = false,
      bold = false,
      uppercase = false,
      title,
    } = props;

    const buttonRef = useRef<HTMLButtonElement>(null);

    useImperativeHandle(ref, () => {
      return {
        id: buttonRef.current?.id,
        focus: (): void => {
          buttonRef.current?.focus();
        },
        blur: (): void => {
          buttonRef.current?.blur();
        },
        width: buttonRef.current?.offsetWidth,
      };
    });

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
        id={id}
        title={title}
        ref={buttonRef}
        disabled={disabled}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
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

            [styles['disabled']]: disabled,
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
