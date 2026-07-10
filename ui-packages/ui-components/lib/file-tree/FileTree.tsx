import * as ContextMenu from '@radix-ui/react-context-menu';
import clsx from 'clsx';
import {
  createContext,
  forwardRef,
  memo,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  NodeApi,
  NodeRendererProps,
  RowRendererProps,
  Tree,
  TreeApi,
} from 'react-arborist';

import {
  DuplicateFileDialogLogic,
  OnDuplicateConflictParams,
} from '../dialogs/app-lab/duplicate-file-dialog/types';
import { Skeleton } from '../skeleton';
import styles from './file-tree.module.scss';
import FileNode from './FileNode';
import FileRow from './FileRow';
import { FileTreeApi, TreeNode } from './fileTree.type';
import { TreeContextMenu } from './TreeContextMenu';
import {
  canBeDragged,
  canBeMoved,
  checkForDuplicates,
  insertNewNode,
  isFileNode,
} from './utils';

const TEMP_CREATED_NODE_NAME = '__CREATE__';

interface FileTreeRenderContextValue {
  isReadOnly: boolean;
  isBricksSelected: boolean;
  selectedNode: TreeNode | undefined;
  selectedFolder: TreeNode | undefined;
  dragOverZone: 'root' | string | null;
  lastSelectedNodeId: string | undefined;
  multiSelectedIds: Set<string>;
  isCreating: { path: string; type: TreeNode['type'] } | null;
  isEditingAt: string | null;
  renderNodeIcon: (node: TreeNode) => JSX.Element;
  onDragOverChange: (zone: 'root' | string | null) => void;
  onRowDragStart: (node: NodeApi<TreeNode>) => void;
  onNodeSelect: (node: NodeApi<TreeNode>, isPreview?: boolean) => void;
  onNodeDelete: (node: NodeApi<TreeNode>) => Promise<void>;
  onNodeCreate: (type: TreeNode['type'], path: string) => void;
  onRenameStart: (node: NodeApi<TreeNode>) => void;
  onResourceImport: (params: { path?: string; isFolder?: boolean }) => void;
  onLastSelectedNodeChange: (nodeId: string) => void;
  onMultiSelectedIdsChange: (ids: Set<string>) => void;
  onEditSubmit: (newName: string) => Promise<void>;
  onEditCancel: () => void;
}

const FileTreeRenderContext = createContext<FileTreeRenderContextValue | null>(
  null,
);

const useFileTreeRenderContext = (): FileTreeRenderContextValue => {
  const ctx = useContext(FileTreeRenderContext);
  if (ctx === null) {
    throw new Error('FileTreeRenderContext is not provided');
  }
  return ctx;
};

/**
 * The row/node renderers below are passed to react-arborist, which uses
 * them as JSX element types. A new function identity therefore remounts
 * every row, and remounting the row being dragged detaches the drag
 * source from the DOM mid-drag. On WebKitGTK (SBC devices) that makes
 * react-dnd end the drag prematurely and the drop is lost with
 * "Invariant Violation: Cannot call hover while not dragging". All
 * changing values are delivered through FileTreeRenderContext instead of
 * render-prop closures so these components stay referentially stable.
 */
const FileTreeRow = (rowProps: RowRendererProps<TreeNode>): JSX.Element => {
  const ctx = useFileTreeRenderContext();
  const { node } = rowProps;

  return (
    <FileRow
      {...rowProps}
      selectedNode={ctx.selectedNode}
      selectedFolder={ctx.selectedFolder}
      dragOverZone={ctx.dragOverZone}
      onDragOverChange={ctx.onDragOverChange}
      onDragStart={(): void => ctx.onRowDragStart(node)}
      onSelect={(isPreview?: boolean): void =>
        ctx.onNodeSelect(node, isPreview)
      }
      onDelete={(): Promise<void> => ctx.onNodeDelete(node)}
      onCreate={ctx.onNodeCreate}
      onRename={(): void => ctx.onRenameStart(node)}
      onResourceImport={ctx.onResourceImport}
      isProjectReadOnly={ctx.isReadOnly}
      isBricksSelected={ctx.isBricksSelected}
      lastSelectedNodeId={ctx.lastSelectedNodeId}
      onLastSelectedNodeChange={ctx.onLastSelectedNodeChange}
      multiSelectedIds={ctx.multiSelectedIds}
      onMultiSelectedIdsChange={ctx.onMultiSelectedIdsChange}
    />
  );
};

const FileTreeNode = (nodeProps: NodeRendererProps<TreeNode>): JSX.Element => {
  const ctx = useFileTreeRenderContext();
  const { node } = nodeProps;

  return (
    <FileNode
      {...nodeProps}
      isEditing={
        node.data.path === ctx.isEditingAt ||
        node.data.path === `${ctx.isCreating?.path}/${TEMP_CREATED_NODE_NAME}`
      }
      isReadOnly={ctx.isReadOnly}
      onEditSubmit={ctx.onEditSubmit}
      onEditCancel={ctx.onEditCancel}
      onDelete={(): Promise<void> => ctx.onNodeDelete(node)}
      renderNodeIcon={ctx.renderNodeIcon}
    />
  );
};

const renderEmptyDragPreview = (): ReactElement | null => null;
const renderEmptyCursor = (): null => null;
const idAccessor = (node: TreeNode): string => node.path;

interface FileTreeProps {
  height: number | undefined;
  nodes: TreeNode[] | undefined;
  selectedNode: TreeNode | undefined;
  selectedFolder?: TreeNode | undefined;
  isReadOnly?: boolean;
  defaultOpenFoldersState?: { [key: string]: boolean };
  selectedFileChange: (node: TreeNode, isPreview?: boolean) => void;
  onFolderSelect: (node: TreeNode | undefined) => void; // New prop for folder selection
  renderNodeIcon: (node: TreeNode) => JSX.Element;
  onFileCreate: (path: string) => Promise<void>;
  onFileRename: (
    path: string,
    newName: string,
    nodeType?: TreeNode['type'],
  ) => Promise<void>;
  onFileDelete: (path: string, nodeType?: TreeNode['type']) => Promise<void>;
  onFileMove: (
    fromPath: string,
    toPath: string,
    filesToUpdate?: Array<{ oldPath: string; newPath: string }>,
  ) => Promise<void>;
  onFolderCreate: (path: string) => Promise<void>;
  onResourceImport: (params: { path?: string; isFolder?: boolean }) => void;
  isBricksSelected: boolean;
  openFiles?: { fileId: string }[];
  updateOpenFile?: (currFileId: string, nextFileId: string) => void;
  onDuplicateConflict?: (params: OnDuplicateConflictParams) => void;
  duplicateFileDialogLogic?: DuplicateFileDialogLogic;
  onAddBrick: () => void;
  onAddSketchLibrary: () => void;
  onFileDragStart?: (nodes: TreeNode[]) => void;
  /**
   * Called when the user attempts to move a node within the tree that
   * the app specification protects against renaming/relocation (e.g.
   * `app.yaml`, `sketch/sketch.ino`, the `python` folder). The drop is
   * bailed and the consumer is expected to surface a notification.
   * Drag-to-editor opens still work because drags are no longer
   * disabled outright for these nodes.
   */
  onMoveBlocked?: (node: TreeNode) => void;
  onDragOverFolderChange?: (path: string) => void;
}

const FileTree = forwardRef<FileTreeApi, FileTreeProps>((props, ref) => {
  const {
    height = 500,
    nodes,
    selectedNode,
    selectedFolder,
    isReadOnly = false,
    selectedFileChange,
    onFolderSelect,
    onFileCreate,
    onFileRename,
    onFileDelete,
    onFileMove,
    onFolderCreate,
    onResourceImport,
    defaultOpenFoldersState,
    isBricksSelected,
    renderNodeIcon,
    openFiles,
    updateOpenFile,
    onDuplicateConflict,
    onAddBrick,
    onAddSketchLibrary,
    onFileDragStart,
    onMoveBlocked,
    onDragOverFolderChange,
  } = props;

  const treeApiRef = useRef<TreeApi<TreeNode>>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  const [isCreating, setIsCreating] = useState<{
    path: string;
    type: TreeNode['type'];
  } | null>(null);
  const [isEditingAt, setIsEditingAt] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<'root' | string | null>(
    null,
  );
  const [lastSelectedNodeId, setLastSelectedNodeId] = useState<
    string | undefined
  >(undefined);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(
    new Set(),
  );
  const dragOverZoneRef = useRef<'root' | string | null>(null);
  const draggingNodeRef = useRef<NodeApi<TreeNode> | null>(null);
  const draggingNodesRef = useRef<NodeApi<TreeNode>[]>([]);
  const [isInternalDragging, setIsInternalDragging] = useState(false);

  // Clear multi-selection when clicking outside the file tree
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (
        treeContainerRef.current &&
        !treeContainerRef.current.contains(e.target as Node) &&
        multiSelectedIds.size > 0
      ) {
        setMultiSelectedIds(new Set());
        setLastSelectedNodeId(undefined);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return (): void => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [multiSelectedIds.size]);

  const handleDragOverZoneChange = useCallback(
    (zone: 'root' | string | null): void => {
      dragOverZoneRef.current = zone;
      setDragOverZone(zone);

      if (onDragOverFolderChange) {
        let dragZone = zone;
        if (zone && zone !== 'root' && treeApiRef.current) {
          const node = treeApiRef.current.get(zone);
          if (node && node.data.type === 'file') {
            const parts = zone.split('/');
            parts.pop();
            dragZone = parts.length > 0 ? parts.join('/') : 'root';
          }
        }
        onDragOverFolderChange(
          dragZone === 'root' || !dragZone ? '' : dragZone,
        );
      }
    },
    [onDragOverFolderChange],
  );

  const scrollToNode = (nodeId: string): void => {
    treeApiRef.current!.scrollTo(nodeId, 'smart');
  };

  useEffect(() => {
    const handleDragEnd = (): void => {
      setIsInternalDragging(false);
      handleDragOverZoneChange(null);
      dragOverZoneRef.current = null;
      draggingNodeRef.current = null;
      draggingNodesRef.current = [];
    };

    const handleGlobalDragOver = (e: DragEvent): void => {
      // Check if the mouse is over a FileTree element
      const target = e.target as HTMLElement;
      const isOverFileTree = target.closest(`.${styles['tree-container']}`);

      if (!isOverFileTree && dragOverZoneRef.current !== null) {
        handleDragOverZoneChange(null);
        dragOverZoneRef.current = null;
      }
    };

    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('dragover', handleGlobalDragOver, true);

    return (): void => {
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('dragover', handleGlobalDragOver, true);
    };
  }, [handleDragOverZoneChange]);

  // automatically scroll to selected node and open parent folders when node is auto-selected
  useEffect(() => {
    if (!treeApiRef.current || !selectedNode) {
      return;
    }

    treeApiRef.current.openParents(selectedNode.path);

    setTimeout(() => {
      scrollToNode(selectedNode.path);
    }, 100);
  }, [selectedNode]);

  const data = useMemo(() => {
    return nodes && isCreating !== null
      ? insertNewNode(
          nodes,
          isCreating.path,
          isCreating.type,
          TEMP_CREATED_NODE_NAME,
        )
      : nodes;
  }, [isCreating, nodes]);

  const handleNodeSelect = useCallback(
    (node: NodeApi<TreeNode>, isPreview?: boolean): void => {
      // Only handle selection if not using multi-selection shortcuts
      if (multiSelectedIds.size > 1) {
        // If multiple nodes are selected, don't trigger file change
        return;
      }

      if (node.isLeaf) {
        // File selection - folder clearing is handled by parent setSelectedFile logic
        selectedFileChange(node.data, isPreview);
      } else if (node.isInternal) {
        // Folder selection should not interfere with file selection
        // This fixes the bug where clicking a folder would cause file selection conflicts
        onFolderSelect(node.data);
        node.toggle();
      }
    },
    [multiSelectedIds.size, selectedFileChange, onFolderSelect],
  );

  const handleNodeCreation = useCallback(
    (
      nodeType: TreeNode['type'],
      isReadOnly: boolean,
      path?: string,
      selectedNode?: TreeNode,
      selectedFolder?: TreeNode,
    ): void => {
      if (isReadOnly) {
        console.warn('File tree is read-only. Cannot create new folders.');
        return;
      }

      let createAtPath = path || '';

      if (path === undefined) {
        const treeApi = treeApiRef.current;
        // Use selectedFolder for file creation when present, otherwise use selectedNode
        // This ensures files are created in the right location without affecting open files
        if (selectedFolder && treeApi?.get(selectedFolder.path)) {
          createAtPath = selectedFolder.path;
        } else if (selectedNode && treeApi?.get(selectedNode.path)) {
          createAtPath = selectedNode.path;
          if (isFileNode(selectedNode)) {
            // If a file is selected, get its parent folder path
            const parts = selectedNode.path.split('/');
            parts.pop();
            createAtPath = parts.join('/');
          }
        }
      }

      setIsCreating({
        path: createAtPath,
        type: nodeType,
      });

      scrollToNode(`${createAtPath}/${TEMP_CREATED_NODE_NAME}`);
      if (treeApiRef.current && createAtPath) {
        treeApiRef.current.openParents(createAtPath);
      }
    },
    [],
  );

  const handleFileCreate = useCallback(
    (path?: string): void =>
      handleNodeCreation(
        'file',
        isReadOnly,
        path,
        selectedNode,
        selectedFolder,
      ),
    [handleNodeCreation, isReadOnly, selectedNode, selectedFolder],
  );

  const handleFolderCreate = useCallback(
    (path?: string): void =>
      handleNodeCreation(
        'folder',
        isReadOnly,
        path,
        selectedNode,
        selectedFolder,
      ),
    [handleNodeCreation, isReadOnly, selectedNode, selectedFolder],
  );

  const handleDrop = useCallback(
    (args: {
      dragNodes: NodeApi<TreeNode>[];
      parentNode: NodeApi<TreeNode> | null;
    }) => {
      const { dragNodes } = args;
      // Use draggingNodesRef if available (multi-selection), otherwise fall back to single node
      const authoritative =
        draggingNodesRef.current && draggingNodesRef.current.length > 0
          ? draggingNodesRef.current
          : draggingNodeRef.current
          ? [draggingNodeRef.current]
          : dragNodes;

      if (!onFileMove || authoritative.length === 0) {
        handleDragOverZoneChange(null);
        return;
      }

      // Bail (with notification) if any selected node is protected from
      // moving within the tree (e.g. `app.yaml`, `sketch/sketch.ino`, the
      // `python` folder). Drag-to-editor opens are unaffected because they
      // go through a different drop target.
      const blockedNode = authoritative.find((n) => !canBeMoved(n.data));
      if (blockedNode) {
        handleDragOverZoneChange(null);
        onMoveBlocked?.(blockedNode.data);
        return;
      }
      const validNodes = authoritative;

      const arboristParent = args.parentNode;
      let parentPath: string;

      if (
        arboristParent === null ||
        arboristParent.id === '__REACT_ARBORIST_INTERNAL_ROOT__'
      ) {
        // Dropping at root level
        parentPath = '';
      } else {
        // Dropping inside a folder
        parentPath = arboristParent.data.path;

        // Auto-open the target folder
        if (!arboristParent.isOpen) {
          arboristParent.open();
        }
      }

      // Process each dragged node
      const movePromises: Promise<void>[] = [];

      for (const draggedNode of validNodes) {
        const fromPath = draggedNode.data.path;
        const fileName = fromPath.split('/').pop() || '';
        const toPath = parentPath ? `${parentPath}/${fileName}` : fileName;

        // Only proceed if path actually changed
        if (fromPath === toPath) {
          continue;
        }

        // Block operations that can cause path duplication cascade
        const folderName = fromPath.split('/').pop() || '';
        const hasSelfDuplication = toPath.includes(fromPath + '/' + folderName);

        if (
          !toPath ||
          toPath.trim() === '' ||
          fromPath === toPath ||
          toPath.startsWith(fromPath + '/') ||
          hasSelfDuplication
        ) {
          continue;
        }

        // Check for duplicate files/folders at destination
        const { hasDuplicate, conflictType } = checkForDuplicates(
          nodes,
          toPath,
          draggedNode.data.type,
        );

        if (hasDuplicate) {
          // Show dialog for all conflict types to let user decide
          if (onDuplicateConflict) {
            onDuplicateConflict({
              fileName,
              sourcePath: fromPath,
              targetPath: toPath,
              conflictType,
            });
          }

          continue;
        }

        // For folders, track files that will need path updates after the move
        const filesToUpdate: Array<{ oldPath: string; newPath: string }> = [];
        if (draggedNode.data.type === 'folder' && openFiles) {
          openFiles.forEach((openFile) => {
            if (openFile.fileId.startsWith(fromPath + '/')) {
              // This file was inside the moved folder, calculate its new path
              const relativePath = openFile.fileId.substring(fromPath.length);
              const newFilePath = toPath + relativePath;

              filesToUpdate.push({
                oldPath: openFile.fileId,
                newPath: newFilePath,
              });
            }
          });
        }

        // Call onFileMove with files to update if it's a folder move
        const movePromise =
          draggedNode.data.type === 'folder' && filesToUpdate.length > 0
            ? onFileMove(fromPath, toPath, filesToUpdate)
            : onFileMove(fromPath, toPath);

        movePromises.push(
          movePromise
            .catch(() => {
              // If the move failed, rollback the file path updates
              if (filesToUpdate.length > 0 && updateOpenFile) {
                filesToUpdate.forEach(({ oldPath, newPath }) => {
                  updateOpenFile(newPath, oldPath);
                });
              }
            })
            .then(() => {
              // Select the moved item using the data we already have
              if (draggedNode.data.type === 'file') {
                selectedFileChange({ ...draggedNode.data, path: toPath });
              } else if (draggedNode.data.type === 'folder') {
                onFolderSelect({ ...draggedNode.data, path: toPath });
              }
            })
            .finally(() => {
              setIsInternalDragging(false);
            }),
        );
      }

      // Execute all move operations
      Promise.all(movePromises).then(() => {
        // Reset after handling the drop
        handleDragOverZoneChange(null);
        draggingNodeRef.current = null;
        draggingNodesRef.current = [];
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      onFileMove,
      openFiles,
      nodes,
      updateOpenFile,
      selectedFileChange,
      onFolderSelect,
      handleDragOverZoneChange,
    ],
  );

  const handleResourceImport = useCallback(
    (params: { isFolder?: boolean }): void => {
      const { isFolder = false } = params;

      if (isReadOnly) {
        console.warn('File tree is read-only. Cannot import.');
        return;
      }

      let importAtPath = '';
      const treeApi = treeApiRef.current;

      if (selectedFolder && treeApi?.get(selectedFolder.path)) {
        importAtPath = selectedFolder.path;
      } else if (selectedNode && treeApi?.get(selectedNode.path)) {
        importAtPath = selectedNode.path;
        if (isFileNode(selectedNode)) {
          const parts = selectedNode.path.split('/');
          parts.pop();
          importAtPath = parts.join('/');
        }
      }

      onResourceImport({ path: importAtPath, isFolder });
    },
    [isReadOnly, selectedNode, selectedFolder, onResourceImport],
  );

  useImperativeHandle(ref, () => ({
    handleFileCreate,
    handleFolderCreate,
    handleDrop,
    handleResourceImport,
  }));

  const handleEditSubmit = useCallback(
    async (newName: string): Promise<void> => {
      if (isCreating !== null) {
        const path = isCreating.path
          ? `${isCreating.path}/${newName}`
          : newName;
        if (isCreating.type === 'file') {
          await onFileCreate(path);
        } else {
          await onFolderCreate(path);
        }
        setIsCreating(null);
      }
      if (isEditingAt !== null) {
        // Use treeApi to find the node in the complete tree (need this to nested folders)
        const foundNode = treeApiRef.current?.get(isEditingAt);
        const nodeType = foundNode?.data?.type ?? 'file';
        await onFileRename(isEditingAt, newName, nodeType);
        setIsEditingAt(null);
      }
    },
    [isCreating, isEditingAt, onFileCreate, onFolderCreate, onFileRename],
  );

  const handleEditCancel = useCallback((): void => {
    setIsCreating(null);
    setIsEditingAt(null);
  }, []);

  const handleNodeDelete = useCallback(
    (node: NodeApi<TreeNode>): Promise<void> =>
      onFileDelete(node.data.path, node.data.type),
    [onFileDelete],
  );

  const disableDropNode = useCallback(
    (args: {
      parentNode: NodeApi<TreeNode>;
      dragNodes: NodeApi<TreeNode>[];
      index: number;
    }): boolean => {
      const { dragNodes } = args;

      if (dragNodes.length === 0) {
        return true; // Disable drop if no nodes
      }

      // Protected (non-movable) nodes are *not* short-circuited here so
      // the drop event still fires and `handleDrop` can surface the
      // "file cannot be moved" notification via `onMoveBlocked`.
      return false;
    },
    [],
  );

  const handleRowDragStart = useCallback(
    (node: NodeApi<TreeNode>): void => {
      setIsInternalDragging(true);
      draggingNodeRef.current = node;
      // Drag the whole selection only when the grabbed node is part of an
      // actual multi-selection (cmd/shift click). Grabbing any other node —
      // including when a single node is selected elsewhere — drags just
      // that node.
      const isPartOfMultiSelection =
        multiSelectedIds.size > 1 && multiSelectedIds.has(node.id);
      const treeApi = treeApiRef.current;
      if (isPartOfMultiSelection && treeApi) {
        const draggedNodes: NodeApi<TreeNode>[] = [];
        multiSelectedIds.forEach((id) => {
          const selected = treeApi.get(id);
          if (selected) {
            draggedNodes.push(selected);
          }
        });
        draggingNodesRef.current = draggedNodes;
        if (onFileDragStart) {
          onFileDragStart(draggedNodes.map((n) => n.data));
        }
      } else {
        // Only drag the grabbed node
        draggingNodesRef.current = [node];
        if (onFileDragStart) {
          onFileDragStart([node.data]);
        }
      }
    },
    [multiSelectedIds, onFileDragStart],
  );

  const handleNodeCreate = useCallback(
    (type: TreeNode['type'], path: string): void => {
      if (type === 'file') {
        handleFileCreate(path);
      } else if (type === 'folder') {
        handleFolderCreate(path);
      }
    },
    [handleFileCreate, handleFolderCreate],
  );

  const handleRenameStart = useCallback(
    (node: NodeApi<TreeNode>): void => setIsEditingAt(node.data.path),
    [],
  );

  // Recreated on every render on purpose: the context update is what
  // re-renders the (identity-stable) rows when any of these values change.
  const renderContextValue: FileTreeRenderContextValue = {
    isReadOnly,
    isBricksSelected,
    selectedNode,
    selectedFolder,
    dragOverZone,
    lastSelectedNodeId,
    multiSelectedIds,
    isCreating,
    isEditingAt,
    renderNodeIcon,
    onDragOverChange: handleDragOverZoneChange,
    onRowDragStart: handleRowDragStart,
    onNodeSelect: handleNodeSelect,
    onNodeDelete: handleNodeDelete,
    onNodeCreate: handleNodeCreate,
    onRenameStart: handleRenameStart,
    onResourceImport,
    onLastSelectedNodeChange: setLastSelectedNodeId,
    onMultiSelectedIdsChange: setMultiSelectedIds,
    onEditSubmit: handleEditSubmit,
    onEditCancel: handleEditCancel,
  };

  return (
    <div
      ref={treeContainerRef}
      className={clsx(styles['tree-container'], {
        [styles['tree-container--drag-over']]: dragOverZone === 'root',
      })}
      style={{ height }}
      onMouseLeave={(): void => {
        handleDragOverZoneChange(null);
      }}
    >
      {nodes && nodes.length > 0 ? (
        <ContextMenu.Root>
          <ContextMenu.Trigger
            onContextMenu={(e): false | void =>
              isReadOnly && e.preventDefault()
            } // disable native context menu
            disabled={isReadOnly}
          >
            <div
              data-native-dropzone={!isInternalDragging ? true : undefined}
              onDragOver={(e): void => {
                e.preventDefault();
                const target = e.target as HTMLElement;
                const isOverRow = target.closest(
                  `.${styles['tree-row-container']}`,
                );
                if (!isOverRow) {
                  handleDragOverZoneChange('root');
                }
              }}
              onDrop={(e): void => {
                if (e.dataTransfer.types.includes('Files')) {
                  e.preventDefault();
                  handleDragOverZoneChange(null);
                  return;
                }

                if (dragOverZoneRef.current !== 'root') return;
                const dragNode = draggingNodeRef.current;
                if (!dragNode || !canBeDragged(dragNode.data)) return;
                e.stopPropagation();
                handleDrop({ dragNodes: [dragNode], parentNode: null });
                draggingNodeRef.current = null;
              }}
            >
              <FileTreeRenderContext.Provider value={renderContextValue}>
                <Tree
                  ref={treeApiRef}
                  className={styles['tree']}
                  data={data}
                  idAccessor={idAccessor}
                  width={'100%'}
                  height={height}
                  openByDefault={false}
                  disableMultiSelection={false}
                  initialOpenState={defaultOpenFoldersState}
                  disableDrag={isReadOnly}
                  disableDrop={isReadOnly || disableDropNode}
                  onMove={handleDrop}
                  renderDragPreview={renderEmptyDragPreview}
                  renderCursor={renderEmptyCursor}
                  rowHeight={22}
                  renderRow={FileTreeRow}
                >
                  {FileTreeNode}
                </Tree>
              </FileTreeRenderContext.Provider>
            </div>
          </ContextMenu.Trigger>
          <TreeContextMenu
            onCreate={(type) => (): void => {
              if (type === 'file') {
                handleFileCreate('');
              } else if (type === 'folder') {
                handleFolderCreate('');
              }
            }}
            onAddBrick={onAddBrick}
            onAddSketchLibrary={onAddSketchLibrary}
            onResourceImport={onResourceImport}
          />
        </ContextMenu.Root>
      ) : (
        <div className={clsx(styles['file-tree-skeleton'])}>
          <Skeleton variant="rounded" count={5} />
        </div>
      )}
    </div>
  );
});

FileTree.displayName = 'FileTree';
export default memo(FileTree);
