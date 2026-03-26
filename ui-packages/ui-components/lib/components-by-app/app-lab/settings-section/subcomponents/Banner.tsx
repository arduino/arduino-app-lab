import clsx from 'clsx';
import React from 'react';

import styles from '../settings-section.module.scss';

export interface BannerProps {
  children: React.ReactNode;
  className?: string;
}

export const Banner = ({ children, className }: BannerProps): JSX.Element => {
  return (
    <div className={clsx(styles['settings-section-banner'], className)}>
      {children}
    </div>
  );
};
