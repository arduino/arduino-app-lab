import { Bin, Library } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { MouseEvent as ReactMouseEvent, useEffect, useState } from 'react';

import { XXSmall } from '../typography';
import styles from './library-item.module.scss';

export interface LibraryItemProps {
  name: string;
  version: string;
  selected?: boolean;
  onDelete?: () => void;
}

const LibraryItem: React.FC<LibraryItemProps> = (props: LibraryItemProps) => {
  const { name, version, selected, onDelete } = props;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (
        !(e.target as HTMLElement).closest(
          `.${styles['library-item-context-menu']}`,
        )
      ) {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleContextMenu = onDelete
    ? (e: ReactMouseEvent): void => {
        e.preventDefault();
        setOpen(true);
      }
    : undefined;

  const handleDelete = (e: ReactMouseEvent): void => {
    e.stopPropagation();
    setOpen(false);
    onDelete?.();
  };

  return (
    <div
      className={clsx(styles['library-item'], {
        [styles['active']]: open || selected,
      })}
      onContextMenu={handleContextMenu}
    >
      <div className={styles['library-item-icon']}>
        <Library />
      </div>
      <div className={styles['library-item-text']}>
        <XXSmall className={styles['library-item-name']}>{name}</XXSmall>&nbsp;
        <XXSmall className={styles['library-item-version']}>{version}</XXSmall>
      </div>
      {open && (
        <div className={styles['library-item-context-menu']}>
          <button
            className={styles['library-item-delete-button']}
            onClick={handleDelete}
          >
            <Bin />
            <XXSmall>Remove</XXSmall>
          </button>
        </div>
      )}
    </div>
  );
};

export default LibraryItem;
