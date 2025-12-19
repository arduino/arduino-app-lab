import { Bin } from '@cloud-editor-mono/images/assets/icons';
import * as ContextMenu from '@radix-ui/react-context-menu';
import clsx from 'clsx';

import BrickIcon from '../app-lab-brick-icon/BrickIcon';
import { XXSmall } from '../typography';
import styles from './brick-item.module.scss';
import { BrickItemProps } from './BrickItem.type';

const BrickItem: React.FC<BrickItemProps> = (props: BrickItemProps) => {
  const { brick, selected, onClick, onDelete } = props;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        className={styles['brick-item-context-menu-trigger']}
      >
        <div
          role="button"
          tabIndex={0}
          className={clsx(styles['brick-item'], {
            [styles['brick-item-selected']]: selected,
          })}
          onClick={onClick}
          onFocus={(e): void => e.stopPropagation()}
          onKeyDown={(e): void => {
            if (e.key === 'Enter') {
              onClick?.();
            }
          }}
        >
          <BrickIcon category={brick.category} size="xsmall" />
          <XXSmall className={styles['brick-item-name']}>{brick.name}</XXSmall>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={styles['brick-item-context-menu']}>
          <ContextMenu.Item
            className={styles['brick-item-context-menu-delete-item']}
            onSelect={onDelete}
          >
            <Bin />
            <XXSmall>Remove</XXSmall>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

export default BrickItem;
