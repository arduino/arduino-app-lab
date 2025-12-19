export interface BaseNode {
  name: string;
  path: string;
  size?: number;
  createdAt?: string;
  modifiedAt?: string;
}

export interface FileNode extends BaseNode {
  type: 'file';
  extension: string;
  mimeType: string;
}

export interface FolderNode extends BaseNode {
  type: 'folder';
  children: TreeNode[];
}

export type TreeNode = FileNode | FolderNode;

export type FileTreeApi = {
  handleFileCreate: (path?: string) => void;
  handleFolderCreate: (path?: string) => void;
};
