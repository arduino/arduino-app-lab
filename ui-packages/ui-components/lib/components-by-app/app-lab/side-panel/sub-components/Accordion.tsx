import { IconNavigationArrowCaretNormalDown } from '@arduino/react-icons';
import clsx from 'clsx';
import { useId, useState } from 'react';

import { XXXSmall } from '../../../../typography';
import styles from './accordion.module.scss';

export interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const Accordion = ({
  title,
  children,
  defaultOpen = true,
}: AccordionProps): JSX.Element => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const headerId = useId();
  const contentId = useId();

  return (
    <div className={styles['accordion']}>
      <button
        type="button"
        id={headerId}
        className={styles['accordion-header']}
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={(): void => setIsOpen((prev) => !prev)}
      >
        <XXXSmall bold className={styles['accordion-label']}>
          {title}
        </XXXSmall>
        <IconNavigationArrowCaretNormalDown
          className={clsx(styles['accordion-caret'], {
            [styles['accordion-caret-collapsed']]: !isOpen,
          })}
        />
      </button>
      {isOpen && (
        <div
          id={contentId}
          role="region"
          aria-labelledby={headerId}
          className={styles['accordion-items']}
        >
          {children}
        </div>
      )}
    </div>
  );
};
