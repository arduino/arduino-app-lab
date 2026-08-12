import { ChevronDown } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { ReactNode, useEffect, useId, useRef, useState } from 'react';

import { usePauseAutoScroll } from '../AutoScroll/AutoScrollContext';
import styles from './expandable-card.module.scss';

interface ExpandableCardProps {
  title: ReactNode;
  children?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}

export const ExpandableCard: React.FC<ExpandableCardProps> = ({
  title,
  children,
  leading,
  trailing,
  defaultExpanded = false,
  className,
  headerClassName,
  bodyClassName,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const pauseAutoScroll = usePauseAutoScroll();
  const panelId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) {
      return;
    }

    const onDocumentClick = (event: MouseEvent): void => {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (bodyRef.current?.contains(event.target)) {
        setExpanded(false);
      }
    };

    document.addEventListener('click', onDocumentClick);
    return () => {
      document.removeEventListener('click', onDocumentClick);
    };
  }, [expanded]);

  return (
    <section className={clsx(styles['expandable-card'], className)}>
      <button
        type="button"
        className={clsx(styles['expandable-card-header'], headerClassName)}
        onClick={(): void => {
          if (!expanded) {
            pauseAutoScroll();
          }
          setExpanded((current) => !current);
        }}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        {leading}
        <span className={styles['expandable-card-title']}>{title}</span>
        {trailing}
        {children && (
          <ChevronDown
            className={clsx(styles['expandable-card-chevron'], {
              [styles['expandable-card-chevron--expanded']]: expanded,
            })}
            aria-hidden="true"
          />
        )}
      </button>
      {expanded && children && (
        <div
          ref={bodyRef}
          id={panelId}
          className={clsx(styles['expandable-card-body'], bodyClassName)}
        >
          {children}
        </div>
      )}
    </section>
  );
};

export default ExpandableCard;
