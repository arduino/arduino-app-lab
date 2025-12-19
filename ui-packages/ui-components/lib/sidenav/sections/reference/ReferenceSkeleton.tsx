import { Skeleton } from '../../../skeleton';
import styles from './reference.module.scss';

export function ReferenceSkeleton(): JSX.Element {
  return (
    <>
      {[...Array(3)].map((_, i) => (
        <div key={i} className={styles['reference-skeleton']}>
          <Skeleton variant="rounded" count={3} />
        </div>
      ))}
    </>
  );
}
