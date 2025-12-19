import {
  Bin,
  FileAdd as FileAddIcon,
  FolderAdd as FolderAddIcon,
  Pencil,
} from '@cloud-editor-mono/images/assets/icons';
import * as ContextMenu from '@radix-ui/react-context-menu';
import clsx from 'clsx';

import { XXSmall } from '../typography';
import styles from './file-tree.module.scss';
import { TreeNode } from './fileTree.type';
import { canBeDeleted, canBeRenamed, isFolderNode } from './utils';

type FileContextMenuProps = {
  node: TreeNode;
  onRename: () => void;
  onCreate: (type: TreeNode['type'], path: string) => () => void;
  onDelete: () => void;
};

const FileContextMenu: React.FC<FileContextMenuProps> = ({
  node,
  onRename,
  onCreate,
  onDelete,
}: FileContextMenuProps) => {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Content className={styles['tree-row-context-menu']}>
        {isFolderNode(node) && (
          <>
            <ContextMenu.Item
              className={styles['tree-row-context-menu-item']}
              onSelect={onCreate('file', node.path)}
            >
              <span className={styles['tree-row-context-icon-container']}>
                <FileAddIcon />
              </span>
              Create file
            </ContextMenu.Item>
            <ContextMenu.Item
              className={styles['tree-row-context-menu-item']}
              onSelect={onCreate('folder', node.path)}
            >
              <span className={styles['tree-row-context-icon-container']}>
                <FolderAddIcon />
              </span>
              Create new folder
            </ContextMenu.Item>
          </>
        )}
        {canBeRenamed(node) && (
          <ContextMenu.Item
            className={styles['tree-row-context-menu-item']}
            onSelect={onRename}
          >
            <span className={styles['tree-row-context-icon-container']}>
              <Pencil style={{ width: 10 }} />
            </span>
            <XXSmall>Rename</XXSmall>
          </ContextMenu.Item>
        )}
        {canBeDeleted(node) && (
          <ContextMenu.Item
            className={clsx(
              styles['tree-row-context-menu-item'],
              styles['danger'],
            )}
            onSelect={onDelete}
          >
            <span className={styles['tree-row-context-icon-container']}>
              <Bin style={{ width: 10 }} />
            </span>
            <XXSmall>Delete</XXSmall>
          </ContextMenu.Item>
        )}
      </ContextMenu.Content>
    </ContextMenu.Portal>
  );
};

export { FileContextMenu };
