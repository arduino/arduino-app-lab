import clsx from 'clsx';
import { isUndefined } from 'lodash';
import { IntRange } from 'type-fest';

import styles from './progress-bar.module.scss';

interface ProgressBarProps {
  active: boolean; //If active is true, the progress bar with the busy state will show
  progress?: IntRange<0, 101>; //Progress number from 0 to 100
  classes?: {
    progressBar?: string;
  };
}

const ProgressBar: React.FC<ProgressBarProps> = (props: ProgressBarProps) => {
  const { active, progress, classes } = props;

  return active ? (
    <div className={clsx(styles['progress-bar'], classes?.progressBar)}>
      {!isUndefined(progress) && progress >= 0 ? (
        <div
          key="progress"
          className={styles['progress-fill']}
          style={{ width: `${progress}%` }}
        />
      ) : (
        <>
          <div className={clsx(styles.segment, styles.slow)} />
          <div className={clsx(styles.segment, styles.fast)} />
        </>
      )}
    </div>
  ) : null;
};

export default ProgressBar;
