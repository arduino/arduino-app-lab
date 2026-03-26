import { Success } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import styles from '../settings-section.module.scss';

export interface UpToDateBadgeProps {
  className?: string;
  label: string;
}

export const UpToDateBadge = ({
  className,
  label,
}: UpToDateBadgeProps): JSX.Element => {
  return (
    <div className={clsx(styles['settings-section-uptodate-badge'], className)}>
      <Success />
      {label}
    </div>
  );
};
