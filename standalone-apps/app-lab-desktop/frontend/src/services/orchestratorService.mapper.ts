import {
  BaseNode,
  FileNode,
  isFolderNode,
  TreeNode,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { fs } from '../../wailsjs/go/models';

export const mapFSNode = (fsNode: fs.FSNode): TreeNode => {
  const node: BaseNode = {
    name: fsNode.name,
    path: fsNode.path,
    size: fsNode.size,
    modifiedAt: fsNode.modifiedAt,
    createdAt: fsNode.createdAt,
  };
  if (fsNode.isDir) {
    return {
      ...node,
      type: 'folder',
      children: fsNode.children ? fsNode.children.map(mapFSNode) : [],
    };
  } else {
    return {
      ...node,
      type: 'file',
      extension: fsNode.extension || '',
      mimeType: fsNode.mimeType || '',
    };
  }
};

export const mapFSNodeToFlat = (fsNode: fs.FSNode): FileNode[] => {
  if (fsNode.isDir) {
    return mapFSNodeToFlatRecursive([], fsNode);
  } else {
    throw new Error('Expected a directory node');
  }
};

const mapFSNodeToFlatRecursive = (
  currList: TreeNode[],
  currFolder: fs.FSNode,
): FileNode[] => {
  if (!currFolder.isDir) {
    throw new Error('Expected a directory node');
  }

  let filesFound: TreeNode[] = [];
  currFolder.children?.forEach((child) => {
    const mappedNode = mapFSNode(child);
    if (isFolderNode(mappedNode)) {
      const files = mapFSNodeToFlatRecursive([], child);
      filesFound = [...filesFound, ...files];
    } else {
      filesFound.push(mappedNode);
    }
  });
  return [...currList, ...filesFound] as FileNode[];
};
