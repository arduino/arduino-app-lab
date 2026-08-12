import { ReactNode } from 'react';

import { ExpandableCard } from '../ExpandableCard/ExpandableCard';
import styles from './thinking.module.scss';

interface ThinkingProps {
  label: string;
  children?: ReactNode;
  defaultExpanded?: boolean;
}

export const Thinking: React.FC<ThinkingProps> = ({
  label,
  children,
  defaultExpanded = false,
}) => {
  return (
    <ExpandableCard
      defaultExpanded={defaultExpanded}
      leading={
        <span className={styles['thinking-sparkle']} aria-hidden="true">
          ✦
        </span>
      }
      title={label}
    >
      {children && <div className={styles['thinking-details']}>{children}</div>}
    </ExpandableCard>
  );
};

export default Thinking;
