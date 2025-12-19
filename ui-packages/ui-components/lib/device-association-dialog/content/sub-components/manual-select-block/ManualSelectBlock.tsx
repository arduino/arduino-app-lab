import { ManualSelectBoard } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import { Button } from '../../../../essential/button/Button';
import { ButtonType } from '../../../../essential/button/button.type';
import { useI18n } from '../../../../i18n/useI18n';
import { TextSize, XXSmall } from '../../../../typography';
import { messages } from '../../messages';
import styles from './manual-select-block.module.scss';

interface ManualSelectBlockProps {
  onClick: (...args: any) => void;
  classes?: { container: string };
}

const ManualSelectBlock: React.FC<ManualSelectBlockProps> = (
  props: ManualSelectBlockProps,
) => {
  const { onClick, classes } = props;
  const { formatMessage } = useI18n();
  return (
    <div className={clsx(styles.container, classes?.container)}>
      <div className={styles.content}>
        <div className={styles['icon-container']}>
          <ManualSelectBoard />
        </div>
        <hr className={styles.divider} />
        <XXSmall>{formatMessage(messages.manualSelectionMessage)}</XXSmall>
        <Button
          type={ButtonType.Tertiary}
          onClick={onClick}
          size={TextSize.XSmall}
        >
          {formatMessage(messages.manualSelectionButton)}
        </Button>
      </div>
    </div>
  );
};

export default ManualSelectBlock;
