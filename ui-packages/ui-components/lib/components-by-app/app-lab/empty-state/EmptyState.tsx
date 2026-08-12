import clsx from 'clsx';
import React from 'react';

import styles from './empty-state.module.scss';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
}

// Shared centered empty state: icon badge + title + optional description.
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  className,
}: EmptyStateProps) => (
  <div className={clsx(styles['empty-state'], className)}>
    <div className={styles['empty-state-icon']}>{icon}</div>
    <span className={styles['empty-state-title']}>{title}</span>
    {description && (
      <p className={styles['empty-state-description']}>{description}</p>
    )}
  </div>
);

export default EmptyState;
