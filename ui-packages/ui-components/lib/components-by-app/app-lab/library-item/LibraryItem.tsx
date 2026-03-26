import { Bin, Library } from '@cloud-editor-mono/images/assets/icons';
import { XXSmall } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import * as ContextMenu from '@radix-ui/react-context-menu';

import styles from './library-item.module.scss';

export interface LibraryItemProps {
  name: string;
  version: string;
  onDelete?: () => void;
}

const LibraryItem: React.FC<LibraryItemProps> = (props: LibraryItemProps) => {
  const { name, version, onDelete } = props;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        className={styles['library-item-context-menu-trigger']}
      >
        <div
          role="button"
          tabIndex={0}
          className={styles['library-item']}
          onFocus={(e): void => e.stopPropagation()}
        >
          <Library className={styles['library-item-icon']} />
          <div className={styles['library-item-text']}>
            <XXSmall>{name}</XXSmall>
            &nbsp;
            <XXSmall className={styles['library-item-text-version']}>
              {version}
            </XXSmall>
          </div>
        </div>
      </ContextMenu.Trigger>
      {onDelete && (
        <ContextMenu.Portal>
          <ContextMenu.Content className={styles['library-item-context-menu']}>
            <ContextMenu.Item
              className={styles['library-item-context-menu-delete-item']}
              onSelect={onDelete}
            >
              <Bin />
              <XXSmall>Remove</XXSmall>
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      )}
    </ContextMenu.Root>
  );
};

export default LibraryItem;
