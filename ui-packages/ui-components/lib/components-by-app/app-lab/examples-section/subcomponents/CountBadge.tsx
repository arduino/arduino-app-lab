import { XXXSmall } from '../../../shared';
import styles from '../examples-section.module.scss';

export interface CountBadgeProps {
  label: string;
}

export const CountBadge = ({ label }: CountBadgeProps): JSX.Element => {
  return (
    <span className={styles['examples-section-badge']}>
      <XXXSmall semibold className={styles['examples-section-badge-text']}>
        {label}
      </XXXSmall>
    </span>
  );
};
