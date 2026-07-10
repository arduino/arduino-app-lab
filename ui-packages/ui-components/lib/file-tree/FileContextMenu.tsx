import {
  Bin,
  FileAdd as FileAddIcon,
  FolderAdd as FolderAddIcon,
  Pencil,
  UploadFolder,
  UploadLight,
} from '@cloud-editor-mono/images/assets/icons';
import * as ContextMenu from '@radix-ui/react-context-menu';
import clsx from 'clsx';

import { useI18n } from '../i18n/useI18n';
import { XXSmall } from '../typography';
import styles from './file-tree.module.scss';
import { TreeNode } from './fileTree.type';
import { messages } from './messages';
import { canBeDeleted, canBeRenamed, isFolderNode } from './utils';

type FileContextMenuProps = {
  node: TreeNode;
  onRename: () => void;
  onCreate: (type: TreeNode['type'], path: string) => () => void;
  onDelete: () => void;
  onResourceImport: (params: { path?: string; isFolder?: boolean }) => void;
};

const FileContextMenu: React.FC<FileContextMenuProps> = ({
  node,
  onRename,
  onCreate,
  onDelete,
  onResourceImport,
}: FileContextMenuProps) => {
  const { formatMessage } = useI18n();

  return (
    <ContextMenu.Portal>
      <ContextMenu.Content
        className={styles['tree-row-context-menu']}
        onContextMenu={(e): void => e.stopPropagation()}
      >
        {isFolderNode(node) && (
          <>
            <ContextMenu.Item
              className={styles['tree-row-context-menu-item']}
              onSelect={onCreate('file', node.path)}
            >
              <span className={styles['tree-row-context-icon-container']}>
                <FileAddIcon />
              </span>

              {formatMessage(messages.createFile)}
            </ContextMenu.Item>
            <ContextMenu.Item
              className={styles['tree-row-context-menu-item']}
              onSelect={onCreate('folder', node.path)}
            >
              <span className={styles['tree-row-context-icon-container']}>
                <FolderAddIcon />
              </span>

              {formatMessage(messages.createFolder)}
            </ContextMenu.Item>
            <ContextMenu.Item
              className={styles['tree-row-context-menu-item']}
              onSelect={(): void => onResourceImport({ path: node.path })}
            >
              <span className={styles['tree-row-context-icon-container']}>
                <UploadLight />
              </span>

              {formatMessage(messages.importFile)}
            </ContextMenu.Item>
            <ContextMenu.Item
              className={styles['tree-row-context-menu-item']}
              onSelect={(): void =>
                onResourceImport({ path: node.path, isFolder: true })
              }
            >
              <span className={styles['tree-row-context-icon-container']}>
                <UploadFolder />
              </span>

              {formatMessage(messages.importFolder)}
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
            <XXSmall>{formatMessage(messages.rename)}</XXSmall>
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
            <XXSmall>{formatMessage(messages.delete)}</XXSmall>
          </ContextMenu.Item>
        )}
      </ContextMenu.Content>
    </ContextMenu.Portal>
  );
};

export { FileContextMenu };
