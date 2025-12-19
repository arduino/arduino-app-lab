import * as ContextMenu from '@radix-ui/react-context-menu';
import clsx from 'clsx';
import { RowRendererProps } from 'react-arborist';

import styles from './file-tree.module.scss';
import { FileContextMenu } from './FileContextMenu';
import { TreeNode } from './fileTree.type';
import { mustHideContextMenu } from './utils';

type FileRowProps = RowRendererProps<TreeNode> & {
  selectedNode: TreeNode | undefined;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCreate: (type: TreeNode['type'], path: string) => void;
  isProjectReadOnly: boolean;
  isBricksSelected?: boolean;
};

const FileRow: React.FC<FileRowProps> = ({
  selectedNode,
  onSelect,
  onRename,
  onDelete,
  isProjectReadOnly,
  onCreate,
  isBricksSelected = false,
  ...rowProps
}: FileRowProps) => {
  const { node } = rowProps;

  const openFolderAndCreate = (type: TreeNode['type'], path: string) => () => {
    node.open();
    onCreate(type, path);
  };

  return (
    <div {...rowProps.attrs} className={styles['tree-row-container']}>
      <ContextMenu.Root>
        <ContextMenu.Trigger
          onContextMenu={(e): false | void =>
            mustHideContextMenu(isProjectReadOnly, node.data) &&
            e.preventDefault()
          } // disable native context menu
          disabled={mustHideContextMenu(isProjectReadOnly, node.data)}
          className={styles['tree-row-context-menu-trigger']}
        >
          <div
            role="button"
            tabIndex={0}
            className={clsx(styles['tree-row'], {
              [styles['tree-row-selected']]:
                // isFileNode(node.data) &&
                selectedNode &&
                node.data.path === selectedNode.path &&
                !isBricksSelected,
            })}
            ref={rowProps.innerRef}
            onFocus={(e): void => e.stopPropagation()}
            onKeyDown={(e): void => {
              if (e.key === 'Enter') {
                onSelect();
              }
            }}
            onClick={(): void => onSelect()}
          >
            {rowProps.children}
          </div>
        </ContextMenu.Trigger>
        <FileContextMenu
          node={node.data}
          onRename={onRename}
          onDelete={onDelete}
          onCreate={openFolderAndCreate}
        />
      </ContextMenu.Root>
    </div>
  );
};

export default FileRow;
