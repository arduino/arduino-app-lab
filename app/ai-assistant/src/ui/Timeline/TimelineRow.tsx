import {
  Checkmark,
  ChevronDown,
  CloseX,
  FileOutline,
  Run,
  Sparkle,
  Terminal,
  Tools,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useState } from 'react';

import { usePauseAutoScroll } from '../AutoScroll/AutoScrollContext';
import { Link } from '../Link/Link';
import type { TimelineItem, TimelineItemType } from './Timeline';
import styles from './timeline-row.module.scss';

type IconComponent = React.ComponentType<{ className?: string }>;

const ICON_BY_TYPE: Record<
  Exclude<TimelineItemType, 'other'>,
  IconComponent
> = {
  thinking: Sparkle,
  read: FileOutline,
  execute: Terminal,
  task: Run,
  done: Checkmark,
};

const iconByType = (
  type: TimelineItemType,
  status?: TimelineItem['status'],
): IconComponent | undefined => {
  if (status === 'failed') {
    return CloseX;
  }

  if (type === 'other') {
    return Tools;
  }

  return ICON_BY_TYPE[type];
};

interface TimelineRowProps {
  item: TimelineItem;
}

export const TimelineRow: React.FC<TimelineRowProps> = ({
  item,
}: TimelineRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const pauseAutoScroll = usePauseAutoScroll();
  const Icon = iconByType(item.type, item.status);
  const expandable = item.type !== 'read' && item.details != null;

  // The file reads as part of the title ("Read python/main.py"), so nothing is listed under the row.
  const title = (
    <span className={styles['timeline-title']}>
      {item.title}
      {item.file && (
        <>
          {' '}
          <Link href={item.file.path} className={styles['timeline-file-link']}>
            {item.file.label}
          </Link>
        </>
      )}
    </span>
  );

  return (
    <li className={styles['timeline-row']}>
      <span
        className={clsx(styles['timeline-marker'], {
          [styles['timeline-marker--thinking']]: item.type === 'thinking',
          [styles['timeline-marker--done']]: item.type === 'done',
          [styles['timeline-marker--failed']]: item.status === 'failed',
        })}
        aria-hidden="true"
      >
        {Icon ? (
          <Icon
            className={clsx(styles['timeline-icon'], {
              [styles['timeline-icon--done']]: item.type === 'done',
              [styles['timeline-icon--read']]:
                item.type === 'read' && item.status !== 'failed',
              [styles['timeline-icon--task']]:
                item.type === 'task' && item.status !== 'failed',
            })}
          />
        ) : (
          <span className={styles['timeline-dot']} />
        )}
      </span>
      <div className={styles['timeline-content']}>
        {expandable ? (
          <div className={styles['timeline-row-header']}>
            {title}
            <button
              type="button"
              className={styles['timeline-toggle']}
              onClick={(): void => {
                if (!expanded) {
                  pauseAutoScroll();
                }
                setExpanded((v) => !v);
              }}
              aria-expanded={expanded}
              aria-label={
                item.file ? `${item.title} ${item.file.label}` : item.title
              }
            >
              <ChevronDown
                className={clsx(styles['timeline-chevron'], {
                  [styles['timeline-chevron--expanded']]: expanded,
                })}
                aria-hidden="true"
              />
            </button>
          </div>
        ) : (
          <div
            className={clsx(
              styles['timeline-row-header'],
              styles['timeline-row-header--static'],
            )}
          >
            {title}
          </div>
        )}
        {expandable && expanded && (
          <div className={styles['timeline-details']}>{item.details}</div>
        )}
      </div>
    </li>
  );
};

export default TimelineRow;
