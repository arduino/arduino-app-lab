import { Checkmark } from '@cloud-editor-mono/images/assets/icons';
import { TextSize } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';

import { ChecklistItem, ChecklistItemStatus } from '../../services';
import { Text } from '../Text/Text';
import styles from './checklist.module.scss';

const StatusIcon: React.FC<{ status: ChecklistItemStatus }> = ({
  status,
}: {
  status: ChecklistItemStatus;
}) => {
  if (status === 'completed') {
    return (
      <span
        className={clsx(
          styles['checklist-icon'],
          styles['checklist-icon--completed'],
        )}
        aria-hidden="true"
      >
        <Checkmark />
      </span>
    );
  }

  if (status === 'in_progress') {
    return (
      <span
        className={clsx(
          styles['checklist-icon'],
          styles['checklist-spinner'],
        )}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={clsx(styles['checklist-icon'], styles['checklist-circle'])}
      aria-hidden="true"
    />
  );
};

interface ChecklistProps {
  title: string;
  items: ChecklistItem[];
  className?: string;
}

export const Checklist: React.FC<ChecklistProps> = ({
  title,
  items,
  className,
}) => {
  const done = items.filter((item) => item.status === 'completed').length;

  return (
    <section className={clsx(styles['checklist'], className)}>
      <header className={styles['checklist-header']}>
        <Text className={styles['checklist-title']}>{title}</Text>
        <Text size={TextSize.XXSmall} className={styles['checklist-counter']}>
          {done} / {items.length}
        </Text>
      </header>
      <ul className={styles['checklist-items']}>
        {items.map((item, index) => (
          <li key={index} className={styles['checklist-item']}>
            <StatusIcon status={item.status} />
            <Text
              className={clsx(styles['checklist-label'], {
                [styles['checklist-label--pending']]:
                  item.status === 'pending',
              })}
            >
              {item.label}
            </Text>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default Checklist;
