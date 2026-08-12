import { AddBrick, AddLibrary } from '@cloud-editor-mono/images/assets/icons';
import * as ContextMenu from '@radix-ui/react-context-menu';

import styles from '../app-lab-edit-section.module.scss';

type FilesManagerContextMenuProps = {
  onAddBrick?: () => void;
  onAddSketchLibrary?: () => void;
};

const FilesManagerContextMenu: React.FC<FilesManagerContextMenuProps> = ({
  onAddBrick,
  onAddSketchLibrary,
}: FilesManagerContextMenuProps) => {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Content className={styles['files-manager-context-menu']}>
        {onAddBrick && (
          <ContextMenu.Item
            className={styles['files-manager-context-menu-item']}
            onSelect={onAddBrick}
          >
            <span className={styles['files-manager-context-icon-container']}>
              <AddBrick />
            </span>
            Add Brick
          </ContextMenu.Item>
        )}
        {onAddSketchLibrary && (
          <ContextMenu.Item
            className={styles['files-manager-context-menu-item']}
            onSelect={onAddSketchLibrary}
          >
            <span className={styles['files-manager-context-icon-container']}>
              <AddLibrary />
            </span>
            Add Sketch library
          </ContextMenu.Item>
        )}
      </ContextMenu.Content>
    </ContextMenu.Portal>
  );
};

export { FilesManagerContextMenu };
