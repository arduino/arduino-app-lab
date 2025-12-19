import clsx from 'clsx';
import { forwardRef } from 'react';

import { Skeleton } from '../../../skeleton';
import styles from './libraries.module.scss';

const skeletonChildren = Number(styles.skeletonChildren);

interface LibrariesListItemSkeletonProps {
  style?: React.CSSProperties;
}

const LibrariesListItemSkeleton = forwardRef(
  (props: LibrariesListItemSkeletonProps, ref) => {
    const { style } = props;
    return (
      <div style={style} ref={ref as (instance: HTMLDivElement | null) => void}>
        <li
          className={clsx(
            styles['libraries-list-item-skeleton'],
            styles['libraries-list-item'],
          )}
        >
          <div className={styles['library-name-container']}>
            <div className={styles['library-maintainer-icon']}>
              <Skeleton variant="circular" />
            </div>
            <div className={styles['library-name']}>
              <Skeleton variant="rounded" />
            </div>
          </div>
          <div className={styles['library-maintainer']}>
            <Skeleton variant="rounded" />
          </div>
          <div className={styles['library-description']}>
            <Skeleton variant="rounded" count={skeletonChildren} />
          </div>
          <div className={styles['library-more-info-skeleton']}>
            <Skeleton variant="rounded" />
          </div>
          <div className={styles['library-skeleton-lower-portion-container']}>
            <div className={styles['library-examples-summary-skeleton']}>
              <Skeleton variant="rounded" />
            </div>
            <div className={styles['include-button']}>
              <Skeleton variant="rounded" />
            </div>
          </div>
        </li>
      </div>
    );
  },
);

LibrariesListItemSkeleton.displayName = 'LibrariesListItemSkeleton';
export default LibrariesListItemSkeleton;
