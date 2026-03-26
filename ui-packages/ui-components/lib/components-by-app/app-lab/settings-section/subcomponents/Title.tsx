import clsx from 'clsx';
import React from 'react';

import styles from '../settings-section.module.scss';

export interface TitleProps {
  title: string;
  variant?: 'primary' | 'secondary';
  icon?: React.ReactNode;
  className?: string;
}

export const Title = ({
  title,
  icon,
  className,
  variant = 'primary',
}: TitleProps): JSX.Element => {
  return (
    <div
      className={clsx(
        styles['settings-section-title'],
        className,
        styles[`settings-section-title--${variant}`],
      )}
    >
      {icon && (
        <div className={styles['settings-section-title-icon']}>{icon}</div>
      )}
      <span>{title}</span>
    </div>
  );
};
