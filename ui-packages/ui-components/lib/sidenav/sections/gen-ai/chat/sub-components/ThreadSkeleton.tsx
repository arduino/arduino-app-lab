import { Skeleton } from '../../../../../skeleton';
import styles from './thread-skeleton.module.scss';

const ThreadSkeleton: React.FC = () => {
  const messageSkeletons = Array.from({ length: 4 }).map((_, index) => (
    <div key={index} className={styles['message-skeleton-container']}>
      <Skeleton variant="rounded" />
    </div>
  ));

  return (
    <div className={styles['thread-skeleton-container']}>
      {messageSkeletons}
    </div>
  );
};

export default ThreadSkeleton;
