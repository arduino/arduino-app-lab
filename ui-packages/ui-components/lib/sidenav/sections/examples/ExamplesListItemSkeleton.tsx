import clsx from 'clsx';
import { forwardRef } from 'react';

import { Skeleton } from '../../../skeleton';
import styles from './examples.module.scss';

interface ExamplesListItemSkeletonProps {
  count?: number;
  style?: React.CSSProperties;
}

const ExamplesListItemSkeleton = forwardRef(
  (props: ExamplesListItemSkeletonProps, ref) => {
    const { count, style } = props;
    return (
      <div
        style={style}
        ref={ref as (instance: HTMLDivElement | null) => void}
        className={clsx(
          styles['library-examples-list-item--skeleton'],
          styles['examples-list-item'],
        )}
      >
        <Skeleton variant="rounded" count={count} />
      </div>
    );
  },
);

ExamplesListItemSkeleton.displayName = 'ExamplesListItemSkeleton';
export default ExamplesListItemSkeleton;
