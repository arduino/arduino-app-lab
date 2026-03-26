import clsx from 'clsx';
import React from 'react';

import styles from './settings-section.module.scss';

export interface SettingsSectionProps {
  children: React.ReactNode;
  className?: string;
}

export const SettingsSection = ({
  children,
  className,
}: SettingsSectionProps): JSX.Element => {
  return (
    <div className={clsx(styles['settings-section'], className)}>
      {children}
    </div>
  );
};
