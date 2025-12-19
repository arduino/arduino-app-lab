import clsx from 'clsx';

import { XXSmall } from '../../../../typography';
import styles from './labeled-divider.module.scss';

interface LabeledDividerProps {
  label: string;
  classes?: { container: string };
}

const LabeledDivider: React.FC<LabeledDividerProps> = (
  props: LabeledDividerProps,
) => {
  const { label: text, classes } = props;

  return (
    <div className={clsx(styles.container, classes?.container)}>
      <hr className={styles.divider} />
      <XXSmall bold className={styles.label}>
        {text}
      </XXSmall>
      <hr className={styles.divider} />
    </div>
  );
};

export default LabeledDivider;
