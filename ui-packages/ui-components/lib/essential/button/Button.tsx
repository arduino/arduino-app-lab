import clsx from 'clsx';
import React, {
  forwardRef,
  ReactNode,
  useImperativeHandle,
  useRef,
} from 'react';

import { Text, TextProps, TextSize } from '../../typography';
import { Loader } from '../loader';
import styles from './button.module.scss';
import { ButtonType } from './button.type';

type ButtonProps = Pick<TextProps, 'size'> & {
  id?: string;
  children?: ReactNode;
  type?: ButtonType;
  Icon?: React.FC;
  iconPosition?: 'left' | 'right';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClick?: (...args: any) => any;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  classes?: { button?: string; textButtonText?: string };
  disabled?: boolean;
  loading?: boolean;
  uppercase?: boolean;
  bold?: boolean;
};

export const Button = forwardRef(
  (props: ButtonProps, ref: React.ForwardedRef<Partial<HTMLButtonElement>>) => {
    const {
      id,
      children,
      Icon,
      iconPosition,
      onClick,
      onMouseEnter,
      onMouseLeave,
      classes,
      type = ButtonType.Primary,
      size = TextSize.Small,
      disabled = false,
      loading = false,
      uppercase = true,
      bold = true,
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
        ref={buttonRef}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={clsx(
          styles.button,
          {
            [styles['primary']]: type === ButtonType.Primary,
            [styles['secondary']]: type === ButtonType.Secondary,
            [styles['tertiary']]: type === ButtonType.Tertiary,
            [styles['warning']]: type === ButtonType.Warning,
            [styles['button-icon-left']]: iconPosition === 'left',
            [styles['button-icon-right']]: iconPosition === 'right',
            [styles['x-small']]: size === TextSize.XSmall,
            [styles['disabled']]: disabled,
          },
          classes?.button,
        )}
      >
        {loading && <Loader tiny className={styles.loader} />}
        {iconPosition === 'left' ? WrappedIcon : null}
        {children && (
          <Text
            size={size}
            bold={bold}
            uppercase={uppercase}
            className={clsx(classes?.textButtonText)}
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
