import React from 'react';

import { XXSmall } from '../../../shared';
import styles from '../examples-section.module.scss';

export interface HeaderProps {
  title: string;
  description?: React.ReactNode;
  // Optional trailing node in the title row, typically the examples count badge
  badge?: React.ReactNode;
  className?: string;
}

// Section header: title (with optional badge) above an optional description
export const Header = ({
  title,
  description,
  badge,
  className,
}: HeaderProps): JSX.Element => {
  return (
    <div className={className}>
      <div className={styles['examples-section-title']}>
        <XXSmall bold className={styles['examples-section-title-text']}>
          {title}
        </XXSmall>
        {badge}
      </div>
      {description && (
        <XXSmall className={styles['examples-section-description']}>
          {description}
        </XXSmall>
      )}
    </div>
  );
};
