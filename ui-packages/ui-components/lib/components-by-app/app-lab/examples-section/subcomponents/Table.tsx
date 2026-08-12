import { IconNavigationArrowChevronNormalUp } from '@arduino/react-icons';
import clsx from 'clsx';
import React, { useId, useState } from 'react';

import { XXSmall } from '../../../shared';
import styles from '../examples-section.module.scss';

export interface TableProps {
  title: string;
  count: number;
  icon?: React.ReactNode;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export const Table = ({
  title,
  count,
  icon,
  defaultExpanded = false,
  children,
}: TableProps): JSX.Element => {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const contentId = useId();

  return (
    <div className={styles['examples-table']}>
      <button
        type="button"
        className={styles['examples-table-header']}
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={(): void => setIsOpen((prev) => !prev)}
      >
        <span className={styles['examples-table-header-content']}>
          {icon && (
            <span className={styles['examples-table-header-icon']}>{icon}</span>
          )}
          <XXSmall bold className={styles['examples-table-header-title']}>
            {title}
          </XXSmall>
          <XXSmall bold className={styles['examples-table-header-count']}>
            ({count})
          </XXSmall>
        </span>
        <span className={styles['examples-table-header-chevron']}>
          <IconNavigationArrowChevronNormalUp
            className={clsx(styles['chevron'], {
              [styles['chevron-collapsed']]: !isOpen,
            })}
          />
        </span>
      </button>
      {isOpen && (
        <div id={contentId} className={styles['examples-table-rows']}>
          {children}
        </div>
      )}
    </div>
  );
};
