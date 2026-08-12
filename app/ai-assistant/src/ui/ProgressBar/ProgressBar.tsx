import clsx from 'clsx';

import styles from './progress-bar.module.scss';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  className,
}) => {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.max(0, Math.min(safeMax, value));
  const pct = (clamped / safeMax) * 100;

  return (
    <div
      className={clsx(styles['progress-bar'], className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
    >
      <span
        className={styles['progress-bar-fill']}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

export default ProgressBar;
