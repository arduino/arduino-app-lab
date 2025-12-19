import clsx from 'clsx';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { NodeApi, RowRendererProps, Tree, TreeApi } from 'react-arborist';

import { Skeleton } from '../skeleton';
import styles from './file-tree.module.scss';
import FileNode from './FileNode';
import FileRow from './FileRow';
import { FileTreeApi, TreeNode } from './fileTree.type';
import { insertNewNode, isFileNode } from './utils';

interface FileTreeProps {
  height: number | undefined;
  nodes: TreeNode[] | undefined;
  selectedNode: TreeNode | undefined;
  isReadOnly?: boolean;
  defaultOpenFoldersState?: { [key: string]: boolean };
  selectedFileChange: (node: TreeNode) => void;
  renderNodeIcon: (node: TreeNode) => JSX.Element;
  onFileCreate: (path: string) => Promise<void>;
  onFileRename: (path: string, newName: string) => Promise<void>;
  onFileDelete: (path: string) => Promise<void>;
  onFolderCreate: (path: string) => Promise<void>;
  isBricksSelected: boolean;
}

const FileTree = forwardRef<FileTreeApi, FileTreeProps>((props, ref) => {
  const {
    height = 500,
    nodes,
    selectedNode,
    isReadOnly = false,
    selectedFileChange,
    onFileCreate,
    onFileRename,
    onFileDelete,
    onFolderCreate,
    defaultOpenFoldersState,
    isBricksSelected,
    renderNodeIcon,
  } = props;

  const treeApiRef = useRef<TreeApi<TreeNode>>(null);

  const [isCreating, setIsCreating] = useState<{
    path: string;
    type: TreeNode['type'];
  } | null>(null);
  const [isEditingAt, setIsEditingAt] = useState<string | null>(null);

  const data = useMemo(() => {
    return nodes && isCreating !== null
      ? insertNewNode(nodes, isCreating.path, isCreating.type)
      : nodes;
  }, [isCreating, nodes]);

  const handleNodeSelect = (node: NodeApi<TreeNode>): void => {
    if (node.isLeaf) {
      selectedFileChange(node.data);
    } else if (node.isInternal) {
      node.toggle();
    }
  };

  const handleNodeCreation = (
    nodeType: TreeNode['type'],
    isReadOnly: boolean,
    path?: string,
    selectedNode?: TreeNode,
  ): void => {
    if (isReadOnly) {
      console.warn('File tree is read-only. Cannot create new folders.');
      return;
    }
    let createAtPath = path || '';
    if (!path) {
      createAtPath = selectedNode?.path || '';
      if (selectedNode && isFileNode(selectedNode)) {
        // If a file is selected, get its parent folder path
        const parts = selectedNode.path.split('/');
        parts.pop();
        createAtPath = parts.join('/');
      }
    }
    setIsCreating({
      path: createAtPath,
      type: nodeType,
    });
  };

  const handleFileCreate = useCallback(
    (path?: string): void =>
      handleNodeCreation('file', isReadOnly, path, selectedNode),
    [isReadOnly, selectedNode],
  );

  const handleFolderCreate = useCallback(
    (path?: string): void =>
      handleNodeCreation('folder', isReadOnly, path, selectedNode),
    [isReadOnly, selectedNode],
  );

  useImperativeHandle(ref, () => ({
    handleFileCreate,
    handleFolderCreate,
  }));

  return (
    <>
      <div className={styles['tree-container']} style={{ height }}>
        {nodes && nodes.length > 0 ? (
          <Tree
            ref={treeApiRef}
            className={styles['tree']}
            data={data}
            idAccessor={(node): string => node.path}
            width={'100%'}
            height={height}
            openByDefault={false}
            disableMultiSelection={true}
            initialOpenState={defaultOpenFoldersState}
            disableDrag={true}
            disableDrop={true}
            rowHeight={22}
            renderRow={(rowProps: RowRendererProps<TreeNode>): JSX.Element => {
              return (
                <FileRow
                  {...rowProps}
                  selectedNode={selectedNode}
                  onSelect={(): void => handleNodeSelect(rowProps.node)}
                  onDelete={(): void => {
                    onFileDelete(rowProps.node.data.path);
                  }}
                  onCreate={(type, path): void => {
                    if (type === 'file') {
                      handleFileCreate(path);
                    } else if (type === 'folder') {
                      handleFolderCreate(path);
                    }
                  }}
                  onRename={(): void => setIsEditingAt(rowProps.node.data.path)}
                  isProjectReadOnly={isReadOnly}
                  isBricksSelected={isBricksSelected}
                ></FileRow>
              );
            }}
          >
            {(nodeProps): JSX.Element => (
              <FileNode
                {...nodeProps}
                isEditing={
                  nodeProps.node.data.path === isEditingAt ||
                  nodeProps.node.data.path === `${isCreating?.path}/__CREATE__`
                }
                isReadOnly={isReadOnly}
                onEditStart={(): void => {
                  setIsEditingAt(nodeProps.node.data.path);
                }}
                onEditSubmit={async (newName): Promise<void> => {
                  if (isCreating !== null) {
                    const path = isCreating?.path
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
                    await onFileRename(isEditingAt, newName);
                    setIsEditingAt(null);
                  }
                }}
                onEditCancel={(): void => {
                  setIsCreating(null);
                  setIsEditingAt(null);
                }}
                onDelete={(): Promise<void> =>
                  onFileDelete(nodeProps.node.data.path)
                }
                renderNodeIcon={renderNodeIcon}
              />
            )}
          </Tree>
        ) : (
          <div className={clsx(styles['code-editor-skeleton'])}>
            <Skeleton variant="rounded" count={5} />
          </div>
        )}
      </div>
    </>
  );
});

FileTree.displayName = 'FileTree';
export default FileTree;
