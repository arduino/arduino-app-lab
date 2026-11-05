import { NodeApi } from 'react-arborist';

// The node data contract lives in the editor-panel package so the editor can
// consume it without importing ui-components (ADR-0002); the react-arborist-bound
// API type stays here with the tree UI.
export type {
  BaseNode,
  FileNode,
  FolderNode,
  TreeNode,
} from '@cloud-editor-mono/ide-workbench/lib/file-tree/fileTree.type';

import type { TreeNode } from '@cloud-editor-mono/ide-workbench/lib/file-tree/fileTree.type';

export type FileTreeApi = {
  handleFileCreate: (path?: string) => void;
  handleFolderCreate: (path?: string) => void;
  handleDrop: (args: {
    dragNodes: NodeApi<TreeNode>[];
    parentNode: NodeApi<TreeNode> | null;
    index: number;
  }) => void;
  handleResourceImport: (params: { isFolder?: boolean }) => void;
};
