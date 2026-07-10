import { ConflictType } from '../dialogs/app-lab/duplicate-file-dialog/types';
import { FileNode, FolderNode, TreeNode } from './fileTree.type';

/**
 * Determines if the context menu must be hidden for a node in the file tree
 * Context menu must be hidden if:
 * 1. the project is readonly (e.g. examples)
 * 2. it's a file and it's readonly (e.g. app.yaml)
 *
 * Note: all folders in not-readonly projects can have files added,
 * so folders must show the context menu, with "add new..." items
 */
export const mustHideContextMenu = (
  isProjectReadOnly: boolean,
  node: TreeNode,
): boolean => {
  if (isProjectReadOnly) {
    return true;
  }
  if (isFileNode(node)) {
    return !canEditFile(node);
  }
  return false;
};

export const isFileNode = (node: TreeNode): node is FileNode => {
  return node.type === 'file';
};

export const isFolderNode = (node: TreeNode): node is FolderNode => {
  return node.type === 'folder';
};

export const canBeRenamed = (node: TreeNode): boolean => {
  if (isFileNode(node)) {
    return canEditNode(node);
  } else if (isFolderNode(node)) {
    // Enable rename for user-created folders - backend now has extended support
    const isMainPythonFolder = node.path === 'python';
    return !isMainPythonFolder;
  }
  return false;
};

export const canBeDeleted = (node: TreeNode): boolean => {
  if (isFileNode(node)) {
    return canEditNode(node);
  } else if (isFolderNode(node)) {
    // Enable delete for user-created folders - only python folder is protected
    const isMainPythonFolder = node.path === 'python';
    return !isMainPythonFolder;
  }
  return false;
};

export const canEditNode = (node: TreeNode): boolean => {
  if (isFileNode(node)) {
    return canEditFile(node);
  } else if (isFolderNode(node)) {
    // Enable editing for user-created folders - only python folder is protected
    const isMainPythonFolder = node.path === 'python';
    return !isMainPythonFolder;
  }
  return false;
};

export const canBeDragged = (node: TreeNode): boolean => {
  // All files and folders can be dragged so they may be dropped onto the
  // editor panes for viewing. Whether the drop is allowed to perform a
  // *move* within the tree is decided by `canBeMoved`; protected entries
  // surface a notification instead.
  void node;
  return true;
};

export const canBeMoved = (node: TreeNode): boolean => {
  if (isFileNode(node)) {
    return canEditFile(node);
  } else if (isFolderNode(node)) {
    // Folders can be moved - only python folder is protected
    const isMainPythonFolder = node.path === 'python';
    return !isMainPythonFolder;
  }
  return false;
};

export const canEditFile = (node: FileNode): boolean => {
  const isAppYaml = /^app.ya?ml$/.test(node.path);
  const isSketchYaml = /^sketch\/sketch.ya?ml$/.test(node.path);
  const isSketchIno = /^sketch\/sketch.ino$/.test(node.path);
  const isMainPy = /^python\/main.py$/.test(node.path);

  return !isMainPy && !isAppYaml && !isSketchYaml && !isSketchIno;
};

export const countNodes = (node?: TreeNode): number => {
  if (!node) {
    return 0;
  }

  if (node.type === 'file' || !node.children) {
    return 1;
  }

  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
};

export function insertNewNode(
  tree: TreeNode[],
  path: string,
  type: TreeNode['type'],
  nodeName: string,
): TreeNode[] {
  const parts = path ? path.split('/') : [];
  const clone = JSON.parse(JSON.stringify(tree)) as TreeNode[];
  let current: TreeNode[] = clone;

  for (const part of parts) {
    if (!part) {
      break;
    }
    const folder = current.find((n) => n.name === part);
    if (!folder || isFileNode(folder)) {
      break;
    }
    if (isFolderNode(folder)) {
      if (!folder.children) {
        folder.children = [];
      }
      current = folder.children;
    }
  }

  current.push({
    path: `${path}/${nodeName}`,
    name: '',
    type,
    ...(type === 'file'
      ? {
          mimeType: '',
          extension: '',
        }
      : { children: [] }),
  } as TreeNode);

  return clone;
}

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;

  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();

  return `${day} ${month} ${year}, ${time}`;
};

export const checkForDuplicates = (
  nodes: TreeNode[] | undefined,
  toPath: string,
  draggedNodeType: 'file' | 'folder',
): {
  hasDuplicate: boolean;
  conflictType: ConflictType;
} => {
  const targetFileName = toPath.split('/').pop() || '';
  const targetParentPath = toPath.split('/').slice(0, -1).join('/');

  const findDuplicate = (
    nodes: TreeNode[] | undefined,
    targetPath: string,
    fileName: string,
  ): {
    hasDuplicate: boolean;
    conflictType: ConflictType;
  } => {
    if (!nodes) return { hasDuplicate: false, conflictType: null };

    for (const node of nodes) {
      const nodePath = node.path;
      const nodeParentPath = nodePath.split('/').slice(0, -1).join('/');
      const nodeFileName = nodePath.split('/').pop() || '';

      // Check if this node is at the target location with the same name
      if (nodeParentPath === targetPath && nodeFileName === fileName) {
        // Determine conflict type based on dragged node and existing node types
        const conflictType = `${draggedNodeType}-${node.type}` as ConflictType;
        return { hasDuplicate: true, conflictType };
      }

      // Recursively check children for folders
      if (node.type === 'folder' && node.children) {
        const childResult = findDuplicate(node.children, targetPath, fileName);
        if (childResult.hasDuplicate) {
          return childResult;
        }
      }
    }

    return { hasDuplicate: false, conflictType: null };
  };

  return findDuplicate(nodes, targetParentPath, targetFileName);
};
