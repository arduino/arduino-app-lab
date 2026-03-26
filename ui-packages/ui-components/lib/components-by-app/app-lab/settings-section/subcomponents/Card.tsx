import clsx from 'clsx';
import React from 'react';

import styles from '../settings-section.module.scss';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card = ({ children, className }: CardProps): JSX.Element => {
  return (
    <div className={clsx(styles['settings-section-card'], className)}>
      {children}
    </div>
  );
};
