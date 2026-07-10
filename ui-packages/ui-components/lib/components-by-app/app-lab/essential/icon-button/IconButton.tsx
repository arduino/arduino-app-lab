import clsx from 'clsx';
import React from 'react';

import buttonStyles from '../button/button.module.scss';
import {
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
} from '../button/Button.type';
import { useTooltip } from '../tooltip';
import styles from './icon-button.module.scss';

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  variant?: ButtonVariant;
  appearance?: ButtonAppearance;
  size?: ButtonSize;
  classes?: {
    container?: string;
    button?: string;
    icon?: string;
  };
  hideTooltip?: boolean;
};

export const IconButton = React.forwardRef(
  (
    props: IconButtonProps,
    ref: React.ForwardedRef<HTMLButtonElement | null>,
  ) => {
    const {
      label,
      Icon,
      classes,
      variant = ButtonVariant.Primary,
      appearance = ButtonAppearance.Action,
      size = ButtonSize.Small,
      hideTooltip = false,
      ...buttonProps
    } = props;

    const buttonRef = React.useRef<HTMLButtonElement | null>(null);

    const {
      props: tooltipProps,
      renderTooltip,
      setShowTooltip,
    } = useTooltip({
      content: label,
      timeout: 0,
      renderDelay: 500,
    });

    React.useImperativeHandle(ref, () => buttonRef.current!);

    const renderIconButton = (): JSX.Element => (
      <button
        {...buttonProps}
        type={buttonProps.type || 'button'}
        ref={buttonRef}
        className={clsx(
          buttonStyles['button'], // Base button styling
          styles['icon-button'], // Overrides for Icon Button specifics
          {
            [buttonStyles['primary']]: variant === ButtonVariant.Primary,
            [buttonStyles['secondary']]: variant === ButtonVariant.Secondary,
            [buttonStyles['tertiary']]: variant === ButtonVariant.Tertiary,
            [buttonStyles['destructive']]:
              appearance === ButtonAppearance.Destructive,
            [buttonStyles['action']]: appearance === ButtonAppearance.Action,
            [buttonStyles['low-contrast']]:
              appearance === ButtonAppearance.LowContrast,
            [styles['xx-small']]: size === ButtonSize.XXSmall,
            [styles['x-small']]: size === ButtonSize.XSmall,
            [styles['small']]: size === ButtonSize.Small,
            [styles['large']]: size === ButtonSize.Large,
            [buttonStyles['disabled']]: buttonProps.disabled,
          },
          classes?.button,
        )}
        aria-label={label}
        aria-describedby={label}
        onClick={(e): void => {
          buttonProps?.onClick?.(e);
          setShowTooltip(false);
        }}
      >
        <Icon aria-hidden="true" focusable="false" className={classes?.icon} />
        <span className="visually-hidden">{label}</span>
      </button>
    );

    return (
      <div {...tooltipProps} className={classes?.container}>
        {renderIconButton()}
        {!hideTooltip && renderTooltip()}
      </div>
    );
  },
);

IconButton.displayName = 'IconButton';
