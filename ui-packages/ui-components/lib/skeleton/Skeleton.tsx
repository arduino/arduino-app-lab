import clsx from 'clsx';

import styles from './skeleton.module.scss';

interface SkeletonProps {
  variant: 'rect' | 'circular' | 'rounded';
  count?: number;
}

const Skeleton: React.FC<SkeletonProps> = (props: SkeletonProps) => {
  const { count = 1, variant } = props;

  return count === 1 ? (
    <div className={clsx(styles.skeleton, styles[variant])}></div>
  ) : (
    <>
      {[...Array(count)].map((element, index) => (
        <div
          key={index}
          className={clsx(styles.skeleton, styles[variant])}
        ></div>
      ))}
    </>
  );
};

export default Skeleton;
