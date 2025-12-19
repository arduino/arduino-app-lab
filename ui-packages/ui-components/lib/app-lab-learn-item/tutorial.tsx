import { ArduinoLogo } from '@cloud-editor-mono/images/assets/icons';
import {
  AI,
  Brick,
  Computer,
  Group,
  Settings,
  UNO,
} from '@cloud-editor-mono/images/assets/learn';
import clsx from 'clsx';

import { LearnListItemWithColors } from '../app-lab-learn';
import styles from './learn-item.module.scss';

const getIcon = (icon: string | undefined): JSX.Element => {
  switch (icon) {
    case 'AI':
      return <AI />;
    case 'Brick':
      return <Brick />;

    case 'Computer':
      return <Computer />;
    case 'Group':
      return <Group />;
    case 'Settings':
      return <Settings />;
    case 'UNO':
      return <UNO />;
    default:
      return <ArduinoLogo />;
  }
};

interface TutorialIconProps {
  icon: string | undefined;
  variant?: 'default' | 'skeleton' | 'self-aligned';
}

export const TutorialIcon: React.FC<TutorialIconProps> = (
  props: TutorialIconProps,
) => {
  const { icon, variant } = props;
  return (
    <div
      className={clsx(
        styles['tutorial-header-icon'],
        variant === 'skeleton' && styles['tutorial-header-icon-skeleton'],
        variant === 'self-aligned' &&
          styles['tutorial-header-icon-self-aligned'],
      )}
    >
      {variant === 'skeleton' ? <UNO /> : getIcon(icon)}
    </div>
  );
};

interface TutorialFooterProps {
  categories: LearnListItemWithColors['tags'];
  maxVisibleCategories: number;
  date?: Date;
}

export const TutorialFooter: React.FC<TutorialFooterProps> = (
  props: TutorialFooterProps,
) => {
  const { categories, maxVisibleCategories, date } = props;
  const hiddenCount = Math.max(0, categories.length - maxVisibleCategories);
  const visibleCategories = categories.slice(0, maxVisibleCategories);
  // const categoryPills = props.categories;

  return (
    <div className={styles['content-footer']}>
      <div className={styles['content-categories']}>
        {visibleCategories.map((item, index) => {
          // const categoryItem = categoryItems[item.id];
          return (
            <span
              key={index}
              className={styles['category']}
              style={{
                color: 'white', // item.color,
                border: `1px solid ${item.color}`,
                backgroundColor: item.bgColor,
              }}
            >
              {item.label}
            </span>
          );
        })}

        {hiddenCount > 0 && (
          <span className={styles['category-others']}>+{hiddenCount}</span>
        )}
      </div>
      {date && (
        <div className={styles['date']}>{date.toLocaleDateString()}</div>
      )}
    </div>
  );
};
