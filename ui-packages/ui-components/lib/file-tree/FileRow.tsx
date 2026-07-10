import * as ContextMenu from '@radix-ui/react-context-menu';
import clsx from 'clsx';
import type React from 'react';
import { useCallback, useRef } from 'react';
import { NodeApi, RowRendererProps } from 'react-arborist';

import styles from './file-tree.module.scss';
import { FileContextMenu } from './FileContextMenu';
import { TreeNode } from './fileTree.type';
import { useKeyboardSelection } from './hooks/useKeyboardSelection';
import { mustHideContextMenu } from './utils';

type FileRowProps = RowRendererProps<TreeNode> & {
  selectedNode: TreeNode | undefined;
  selectedFolder: TreeNode | undefined;
  dragOverZone: 'root' | string | null;
  onDragOverChange: (zone: 'root' | string | null) => void;
  onSelect: (isPreview?: boolean) => void;
  onRename: () => void;
  onDelete: () => void;
  onCreate: (type: TreeNode['type'], path: string) => void;
  onResourceImport: (params: { path?: string; isFolder?: boolean }) => void;
  isProjectReadOnly: boolean;
  isBricksSelected?: boolean;
  onDragStart?: () => void;
  lastSelectedNodeId?: string;
  onLastSelectedNodeChange?: (nodeId: string) => void;
  multiSelectedIds?: Set<string>;
  onMultiSelectedIdsChange?: (ids: Set<string>) => void;
};

const FileRow: React.FC<FileRowProps> = ({
  selectedNode,
  selectedFolder,
  dragOverZone,
  onDragOverChange,
  onSelect,
  onRename,
  onDelete,
  onResourceImport,
  isProjectReadOnly,
  onCreate,
  isBricksSelected = false,
  onDragStart,
  lastSelectedNodeId,
  onLastSelectedNodeChange,
  multiSelectedIds,
  onMultiSelectedIdsChange,
  ...rowProps
}: FileRowProps) => {
  const { node } = rowProps;

  const committedOnMouseDownRef = useRef(false);

  const { handleKeyDown } = useKeyboardSelection({
    node,
    lastSelectedNodeId,
    onLastSelectedNodeChange,
    multiSelectedIds,
    onMultiSelectedIdsChange,
  });

  const checkSelected = useCallback(
    (node: NodeApi<TreeNode>) => {
      if (multiSelectedIds && multiSelectedIds.size > 0) {
        return multiSelectedIds.has(node.id);
      }
      return (
        (selectedFolder && node.data.path === selectedFolder.path) ||
        (selectedNode &&
          !selectedFolder &&
          node.data.path === selectedNode.path &&
          !isBricksSelected)
      );
    },
    [isBricksSelected, multiSelectedIds, selectedFolder, selectedNode],
  );

  const openFolderAndCreate = (type: TreeNode['type'], path: string) => () => {
    node.open();
    onCreate(type, path);
  };

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      onDragOverChange(node.data.path);
    },
    [node, onDragOverChange],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      if (isCtrlOrCmd) {
        // Multi-selection with ctrl/cmd + click
        e.stopPropagation();
        e.preventDefault();

        if (!onMultiSelectedIdsChange) {
          return;
        }

        const newSelectedIds = multiSelectedIds
          ? new Set(multiSelectedIds)
          : new Set<string>();
        if (selectedNode && !newSelectedIds.has(selectedNode.path)) {
          newSelectedIds.add(selectedNode.path);
        }
        if (newSelectedIds.has(node.id)) {
          newSelectedIds.delete(node.id);
        } else {
          newSelectedIds.add(node.id);
        }
        onMultiSelectedIdsChange(newSelectedIds);

        if (onLastSelectedNodeChange) {
          onLastSelectedNodeChange(node.id);
        }
      } else if (isShift) {
        // Range selection with shift + click
        e.stopPropagation();
        e.preventDefault();

        if (!onMultiSelectedIdsChange) {
          return;
        }

        const treeApi = node.tree;
        const newSelectedIds = new Set<string>();

        if (lastSelectedNodeId) {
          const lastNode = treeApi.get(lastSelectedNodeId);

          if (lastNode) {
            // Get all visible nodes in the tree
            const allNodes = treeApi.visibleNodes;
            const lastNodeIndex = allNodes.findIndex(
              (n) => n.id === lastSelectedNodeId,
            );
            const currentNodeIndex = allNodes.findIndex(
              (n) => n.id === node.id,
            );

            if (lastNodeIndex !== -1 && currentNodeIndex !== -1) {
              const startIndex = Math.min(lastNodeIndex, currentNodeIndex);
              const endIndex = Math.max(lastNodeIndex, currentNodeIndex);

              // Select all nodes in the range
              for (let i = startIndex; i <= endIndex; i++) {
                const nodeToSelect = allNodes[i];
                newSelectedIds.add(nodeToSelect.id);
              }
            }
          }
        } else {
          // If no last selected node, just select this one
          newSelectedIds.add(node.id);
        }

        onMultiSelectedIdsChange(newSelectedIds);

        if (onLastSelectedNodeChange) {
          onLastSelectedNodeChange(node.id);
        }
      } else {
        if (committedOnMouseDownRef.current) {
          committedOnMouseDownRef.current = false;
          return;
        }
        // Normal selection - start new multi-selection with this node
        if (onMultiSelectedIdsChange) {
          onMultiSelectedIdsChange(new Set([node.id]));
        }
        onSelect(true);
        if (onLastSelectedNodeChange) {
          onLastSelectedNodeChange(node.id);
        }
      }
    },
    [
      node,
      onSelect,
      selectedNode,
      lastSelectedNodeId,
      onLastSelectedNodeChange,
      multiSelectedIds,
      onMultiSelectedIdsChange,
    ],
  );

  return (
    <div
      {...rowProps.attrs}
      className={clsx(styles['tree-row-container'], {
        [styles['tree-row-container--drag-over']]:
          dragOverZone === node.data.path,
      })}
      onDragStart={onDragStart}
      onDragOver={handleDragOver}
    >
      <ContextMenu.Root>
        <ContextMenu.Trigger
          onContextMenu={(e): false | void => {
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;
            const isShift = e.shiftKey;
            if (isCtrlOrCmd || isShift) {
              e.preventDefault();
              return;
            }
            mustHideContextMenu(isProjectReadOnly, node.data) &&
              e.preventDefault();
          }} // disable native context menu
          disabled={mustHideContextMenu(isProjectReadOnly, node.data)}
          className={styles['tree-row-context-menu-trigger']}
        >
          <div
            role="button"
            tabIndex={0}
            className={clsx(styles['tree-row'], {
              [styles['tree-row-selected']]: checkSelected(node),
              [styles['tree-row--no-border-top']]:
                checkSelected(node) && node.prev && checkSelected(node.prev),
              [styles['tree-row--no-border-bottom']]:
                checkSelected(node) && node.next && checkSelected(node.next),
            })}
            ref={rowProps.innerRef}
            onFocus={(e): void => e.stopPropagation()}
            onKeyDown={(e): void => {
              if (e.key === 'Enter') {
                onSelect();
              } else {
                handleKeyDown(e);
              }
            }}
            onMouseDown={(e): void => {
              if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) {
                committedOnMouseDownRef.current = false;
                return;
              }

              committedOnMouseDownRef.current = e.detail >= 2;
              if (committedOnMouseDownRef.current) {
                onSelect(false);
              }
            }}
            onClick={handleClick}
          >
            {rowProps.children}
          </div>
        </ContextMenu.Trigger>
        <FileContextMenu
          node={node.data}
          onRename={onRename}
          onDelete={onDelete}
          onCreate={openFolderAndCreate}
          onResourceImport={onResourceImport}
        />
      </ContextMenu.Root>
    </div>
  );
};

export default FileRow;
