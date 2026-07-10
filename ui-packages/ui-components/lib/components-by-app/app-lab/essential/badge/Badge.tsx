import clsx from 'clsx';
import { PropsWithChildren } from 'react';

import { XXXSmall } from '../../../shared';
import styles from './badge.module.scss';
import { BadgeSize, BadgeStyle, BadgeVariant } from './Badge.type';

type BadgeProps = PropsWithChildren<{
  icon?: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: BadgeStyle;
  classes?: { container?: string; text?: string };
  uppercase?: boolean;
}>;

export const Badge: React.FC<BadgeProps> = ({
  children,
  classes,
  icon,
  variant = BadgeVariant.Neutral,
  style = BadgeStyle.Solid,
  size = BadgeSize.Default,
  uppercase = true,
}: BadgeProps) => {
  return (
    <div
      className={clsx(styles['badge'], classes?.container, {
        // Sizes
        [styles['default']]: size === BadgeSize.Default,
        [styles['small']]: size === BadgeSize.Small,
        // Styles
        [styles['solid']]: style === BadgeStyle.Solid,
        [styles['light']]: style === BadgeStyle.Light,
        [styles['ghost']]: style === BadgeStyle.Ghost,
        // Variants
        [styles['neutral']]: variant === BadgeVariant.Neutral,
        [styles['positive']]: variant === BadgeVariant.Positive,
        [styles['warning']]: variant === BadgeVariant.Warning,
        [styles['error']]: variant === BadgeVariant.Error,
        [styles['accent']]: variant === BadgeVariant.Accent,
        [styles['alert']]: variant === BadgeVariant.Alert,
      })}
    >
      {icon}
      <XXXSmall
        className={clsx(styles['badge-text'], classes?.text, {
          [styles['uppercase']]: uppercase,
        })}
      >
        {children}
      </XXXSmall>
    </div>
  );
};
