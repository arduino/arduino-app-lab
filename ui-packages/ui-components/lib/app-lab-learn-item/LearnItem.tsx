import { LearnListItemWithColors } from '../app-lab-learn';
import { Skeleton } from '../skeleton';
import styles from './learn-item.module.scss';
import { LearnItemProps } from './LearnItem.type';
import { TutorialFooter, TutorialIcon } from './tutorial';

const LearnItem: React.FC<LearnItemProps> = (props: LearnItemProps) => {
  const {
    icon,
    name,
    description,
    variant = 'default',
    date,
    category,
  } = props;

  return (
    <div className={styles['container']}>
      {/* Header */}
      <TutorialIcon variant={variant} icon={icon} />

      {/* Content */}
      {variant === 'default' && (
        <div className={styles['content']}>
          <div className={styles['content-title']}>{name}</div>
          <div className={styles['content-description']}>{description}</div>
          <TutorialFooter
            categories={(category as LearnListItemWithColors['tags']) || []}
            maxVisibleCategories={2}
            date={date}
          />
        </div>
      )}
      {variant === 'skeleton' && (
        <div className={styles['content']}>
          <div className={styles['content-title-skeleton']}>
            <Skeleton variant="rounded" count={1} />
          </div>
          <div className={styles['content-description-skeleton']}>
            <Skeleton variant="rounded" count={2} />
          </div>
        </div>
      )}
    </div>
  );
};

export default LearnItem;
