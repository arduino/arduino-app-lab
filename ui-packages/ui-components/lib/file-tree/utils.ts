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
  isProjectReadonly: boolean,
  node: TreeNode,
): boolean => {
  if (isProjectReadonly) {
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
  return canEditNode(node);
};

export const canBeDeleted = (node: TreeNode): boolean => {
  return canEditNode(node);
};

export const canEditNode = (node: TreeNode): boolean => {
  if (isFileNode(node)) {
    return canEditFile(node);
  } else if (isFolderNode(node)) {
    return canEditFolder(node);
  }
  return false;
};

export const canEditFile = (node: FileNode): boolean => {
  const isAppYaml = /^app.ya?ml$/.test(node.path);
  const isSketchYaml = /^sketch\/sketch.ya?ml$/.test(node.path);
  const isMainPy = /^python\/main.py$/.test(node.path);

  return !isMainPy && !isAppYaml && !isSketchYaml;
};

const canEditFolder = (_node: FolderNode): boolean => {
  // const isSketchFolder = node.path === 'sketch';
  // const isMainPythonFolder = node.path === 'python';

  // return !isMainPythonFolder && !isSketchFolder;
  return false;
};

export const countAllNodes = (nodes?: TreeNode[]): number => {
  if (!nodes) {
    return 0;
  }

  return nodes.reduce((total, node) => total + countNodes(node), 0);
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
    path: `${path}/__CREATE__`,
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

export const formatBytes = (
  bytes: number | undefined,
  decimals = 1,
): string => {
  if (bytes === undefined || bytes < 0) return 'N/A';
  if (bytes === 0) return '0 bytes';
  if (bytes < 1024) return `${bytes} byte${bytes === 1 ? '' : 's'}`;

  const k = 1024;
  const sizes = ['KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${parseFloat(value.toFixed(decimals))} ${sizes[i - 1]}`;
};

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
