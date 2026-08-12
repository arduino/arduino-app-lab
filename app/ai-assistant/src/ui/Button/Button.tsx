import {
  Button as BaseButton,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';

import styles from './button.module.scss';

type ButtonUiSize = 'small' | 'medium';

interface ButtonProps {
  variant?: ButtonVariant;
  appearance?: ButtonAppearance;
  size?: ButtonUiSize;
  disabled?: boolean;
  loading?: boolean;
  Icon?: React.FC;
  iconPosition?: 'left' | 'right';
  className?: string;
  onClick?: VoidFunction;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = ButtonVariant.Primary,
  appearance = ButtonAppearance.Action,
  // Keep medium as the default while still mapping to compact app-lab sizes.
  size = 'medium',
  disabled,
  loading,
  Icon,
  iconPosition,
  className,
  onClick,
  children,
}) => {
  return (
    <BaseButton
      variant={variant}
      appearance={appearance}
      size={size === 'small' ? ButtonSize.XSmall : ButtonSize.Small}
      disabled={disabled}
      loading={loading}
      Icon={Icon}
      iconPosition={iconPosition}
      onClick={onClick}
      classes={{
        button: clsx(
          styles['button'],
          styles[size === 'small' ? ButtonSize.XSmall : ButtonSize.Small],
          className,
        ),
        textButtonText: styles['button-text'],
      }}
    >
      {children}
    </BaseButton>
  );
};

export default Button;
