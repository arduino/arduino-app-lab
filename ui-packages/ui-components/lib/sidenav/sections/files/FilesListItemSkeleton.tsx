import { forwardRef } from 'react';

import { Skeleton } from '../../../skeleton';
import styles from './files.module.scss';

interface FilesListItemSkeletonProps {
  count?: number;
  style?: React.CSSProperties;
}

const FilesListItemSkeleton = forwardRef(
  (props: FilesListItemSkeletonProps, ref) => {
    const { count, style } = props;

    return (
      <div
        style={style}
        ref={ref as (instance: HTMLDivElement | null) => void}
        className={styles['files-list-item--skeleton']}
      >
        <Skeleton variant="rounded" count={count} />
      </div>
    );
  },
);

FilesListItemSkeleton.displayName = 'FilesListItemSkeleton';
export default FilesListItemSkeleton;
