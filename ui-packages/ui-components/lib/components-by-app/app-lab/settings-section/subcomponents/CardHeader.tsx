import clsx from 'clsx';
import React from 'react';

import styles from '../settings-section.module.scss';

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader = ({
  children,
  className,
}: CardHeaderProps): JSX.Element => {
  return (
    <div className={clsx(styles['settings-section-card-header'], className)}>
      {children}
    </div>
  );
};
