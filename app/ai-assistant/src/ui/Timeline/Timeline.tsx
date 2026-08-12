import { ChevronDown } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { ReactNode, useState } from 'react';

import { usePauseAutoScroll } from '../AutoScroll/AutoScrollContext';
import styles from './timeline.module.scss';
import { TimelineRow } from './TimelineRow';

export type TimelineItemType =
  | 'thinking'
  | 'read'
  | 'execute'
  | 'task'
  | 'done'
  | 'other';

export type TimelineItemStatus = 'completed' | 'failed';

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  title: string;
  status?: TimelineItemStatus;
  // The single file this row acted on: `label` is shown after the title, `path` is what opens.
  file?: { path: string; label: string };
  // expandable body (thinking reasoning, tool output); makes the row a disclosure
  details?: ReactNode;
}

interface TimelineProps {
  // header line, e.g. "Edited 2 files, read 3 files"
  summary: string;
  items: TimelineItem[];
  defaultExpanded?: boolean;
}

export const Timeline: React.FC<TimelineProps> = ({
  summary,
  items,
  defaultExpanded = false,
}: TimelineProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const pauseAutoScroll = usePauseAutoScroll();

  return (
    <section className={styles['timeline']}>
      <button
        type="button"
        className={styles['timeline-header']}
        onClick={(): void => {
          if (!expanded) {
            pauseAutoScroll();
          }
          setExpanded((v) => !v);
        }}
        aria-expanded={expanded}
      >
        <span className={styles['timeline-summary']}>{summary}</span>
        <ChevronDown
          className={clsx(styles['timeline-chevron'], {
            [styles['timeline-chevron--expanded']]: expanded,
          })}
          aria-hidden="true"
        />
      </button>
      {expanded && (
        <ul className={styles['timeline-list']}>
          {items.map((item) => (
            <TimelineRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
};

export default Timeline;
