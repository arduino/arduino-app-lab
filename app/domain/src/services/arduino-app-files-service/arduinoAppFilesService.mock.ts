import {
  FileNode,
  FolderNode,
  ImportResourceResult,
  TreeNode,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { ArduinoAppFilesService } from './arduinoAppFilesService.type';

const APP_ROOT = '/myapp';

const mockRoot: FolderNode = {
  name: 'myapp',
  path: '', // root
  type: 'folder',
  createdAt: '2023-01-01T10:00:00Z',
  modifiedAt: '2024-05-01T12:00:00Z',
  children: [
    {
      name: 'README.md',
      path: 'README.md',
      type: 'file',
      extension: '.md',
      mimeType: 'text/markdown',
      size: 2048,
      createdAt: '2023-01-02T09:00:00Z',
      modifiedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      name: 'python',
      path: 'python',
      type: 'folder',
      createdAt: '2023-02-01T11:00:00Z',
      modifiedAt: '2024-03-15T14:00:00Z',
      children: [
        {
          name: 'main.py',
          path: 'python/main.py',
          type: 'file',
          extension: '.py',
          mimeType: 'text/x-python',
          size: 1024,
          createdAt: '2023-02-02T10:00:00Z',
          modifiedAt: '2024-03-10T16:00:00Z',
        },
        {
          name: 'requirements.txt',
          path: 'python/requirements.txt',
          type: 'file',
          extension: '.txt',
          mimeType: 'text/plain',
          size: 512,
          createdAt: '2023-02-03T12:00:00Z',
          modifiedAt: '2024-03-12T09:00:00Z',
        },
      ],
    },
    {
      name: 'sketch',
      path: 'sketch',
      type: 'folder',
      createdAt: '2023-03-01T08:00:00Z',
      modifiedAt: new Date().toISOString(),
      children: [
        {
          name: 'sketch.ino',
          path: 'sketch/sketch.ino',
          type: 'file',
          extension: '.ino',
          mimeType: 'text/ino',
          size: 3072,
          createdAt: '2023-03-02T07:00:00Z',
          modifiedAt: new Date().toISOString(),
        },
        {
          name: 'utils.h',
          path: 'sketch/utils.h',
          type: 'file',
          extension: '.h',
          mimeType: 'text/x-chdr',
          size: 768,
          createdAt: '2023-03-03T10:00:00Z',
          modifiedAt: '2024-05-08T11:00:00Z',
        },
      ],
    },
    {
      name: 'data',
      path: 'data',
      type: 'folder',
      createdAt: '2023-04-01T09:00:00Z',
      modifiedAt: '2024-04-20T10:00:00Z',
      children: [
        {
          name: 'image.png',
          path: 'data/image.png',
          type: 'file',
          extension: '.png',
          mimeType: 'image/png',
          size: 4096,
          createdAt: '2023-04-02T08:00:00Z',
          modifiedAt: '2025-04-18T13:00:00Z',
        },
        {
          name: 'data.json',
          path: 'data/data.json',
          type: 'file',
          extension: '.json',
          mimeType: 'application/json',
          size: 1536,
          createdAt: '2023-04-03T11:00:00Z',
          modifiedAt: '2025-04-19T14:00:00Z',
        },
      ],
    },
    {
      name: 'app.yaml',
      path: 'app.yaml',
      type: 'file',
      extension: '.yaml',
      mimeType: 'text/yaml',
      size: 256,
      createdAt: '2023-01-05T13:00:00Z',
      modifiedAt: '2024-05-01T12:30:00Z',
    },
  ],
};

// contenuti file (chiave = full path includendo app root)
const initialFileContents: Record<string, string> = {
  [`${APP_ROOT}/README.md`]: `# My App

README mock dell'app.`,
  [`${APP_ROOT}/python/main.py`]: `def main():
    print("hello from mock app")

if __name__ == "__main__":
    main()
`,
  [`${APP_ROOT}/python/requirements.txt`]: `# requirements mock
numpy
opencv-python
`,
  [`${APP_ROOT}/sketch/sketch.ino`]: `void setup() {
  Serial.begin(9600);
}

void loop() {
  Serial.println("Hello from mock sketch");
  delay(1000);
}
`,
  [`${APP_ROOT}/sketch/utils.h`]: `#pragma once

void doSomething();`,
  [`${APP_ROOT}/data/data.json`]: `{"value": 42}`,
};

const fileContents = new Map<string, string>(
  Object.entries(initialFileContents),
);

// ------------------ HELPERS ------------------

const stripAppRoot = (fullPath: string): string => {
  // /myapp/sketch/a.ino -> sketch/a.ino
  return fullPath.replace(new RegExp(`^${APP_ROOT}/?`), '');
};

const getNowIso = (): string => new Date().toISOString();

const flattenTreeToFiles = (nodes: TreeNode[]): FileNode[] => {
  const files: FileNode[] = [];

  const visit = (node: TreeNode): void => {
    if (node.type === 'file') {
      files.push(node);
      return;
    }
    node.children.forEach(visit);
  };

  nodes.forEach(visit);
  return files;
};

const findFolderNode = (
  root: FolderNode,
  folderPath: string,
): FolderNode | null => {
  if (!folderPath) return root;

  const segments = folderPath.split('/');
  let current: FolderNode = root;
  let currentPath = '';

  for (const segment of segments) {
    if (!segment) continue;
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    const child = current.children.find(
      (n) => n.type === 'folder' && n.path === currentPath,
    ) as FolderNode | undefined;
    if (!child) return null;
    current = child;
  }

  return current;
};

const removeNodeByPath = (root: FolderNode, relativePath: string): void => {
  const segments = relativePath.split('/');
  const name = segments.pop();
  const folderPath = segments.join('/');
  const parent = findFolderNode(root, folderPath);

  if (!parent || !name) return;

  parent.children = parent.children.filter((n) => n.path !== relativePath);
  parent.modifiedAt = getNowIso();
};

const findNodeByPath = (
  root: FolderNode,
  relativePath: string,
): TreeNode | null => {
  const segments = relativePath.split('/');
  const name = segments.pop();
  const folderPath = segments.join('/');
  const parent = findFolderNode(root, folderPath);

  if (!parent || !name) return null;

  return parent.children.find((n) => n.path === relativePath) || null;
};

const addNodeToPath = (
  root: FolderNode,
  relativePath: string,
  node: TreeNode,
): void => {
  const segments = relativePath.split('/');
  const name = segments.pop();
  const folderPath = segments.join('/');
  const parent = findFolderNode(root, folderPath);

  if (!parent || !name) return;

  // Update the node's path and name
  node.path = relativePath;
  node.name = name;

  parent.children.push(node);
  parent.modifiedAt = getNowIso();
};

const renameNodePath = (node: TreeNode, from: string, to: string): void => {
  if (node.type === 'file') {
    if (node.path === from) {
      node.path = to;
      node.name = to.split('/').pop() ?? node.name;
      node.modifiedAt = getNowIso();
    }
    return;
  }

  // folder
  if (node.path === from) {
    node.path = to;
    node.name = to.split('/').pop() ?? node.name;
    node.modifiedAt = getNowIso();
  }

  node.children.forEach((child) => {
    if (child.path.startsWith(from + '/')) {
      const suffix = child.path.slice(from.length + 1);
      const newChildPath = `${to}/${suffix}`;
      renameNodePath(child, child.path, newChildPath);
    } else {
      renameNodePath(child, from, to);
    }
  });
};

// ------------------ MOCK SERVICE ------------------

export const MockArduinoAppFilesService: ArduinoAppFilesService = {
  async getAppFileTree(_path: string): Promise<TreeNode[]> {
    return [mockRoot];
  },

  async getAppFiles(_path: string): Promise<{
    filesList: FileNode[];
    fileTree: TreeNode[];
  }> {
    const fileTree: TreeNode[] = [mockRoot];
    const filesList = flattenTreeToFiles(fileTree);
    return { filesList, fileTree };
  },

  async getAppFileContent(path: string): Promise<string> {
    // path like /myapp/sketch/sketch.ino
    return fileContents.get(path) ?? '';
  },

  async saveAppFile(path: string, content: string): Promise<void> {
    fileContents.set(path, content);
  },

  async createAppFile(path: string, content: string = ''): Promise<void> {
    // path is /myapp/<relative>
    const relative = stripAppRoot(path); // es: sketch/newFile.ino
    const segments = relative.split('/');
    const name = segments.pop();
    const folderPath = segments.join('/');
    if (!name) return;

    const parent = findFolderNode(mockRoot, folderPath);
    if (!parent) {
      console.warn('[MockArduinoAppFilesService] parent folder not found', {
        folderPath,
      });
      return;
    }

    const ext = name.includes('.') ? `.${name.split('.').pop()}` : '';
    const newNode: FileNode = {
      name,
      path: relative,
      type: 'file',
      extension: ext,
      mimeType: '',
      size: content.length,
      createdAt: getNowIso(),
      modifiedAt: getNowIso(),
    };

    parent.children.push(newNode);
    parent.modifiedAt = getNowIso();

    fileContents.set(path, content);
  },

  async renameAppFile(
    path: string,
    newName: string,
    _nodeType?: 'file' | 'folder',
  ): Promise<void> {
    const fromRelative = stripAppRoot(path);
    const toRelative = stripAppRoot(newName);
    renameNodePath(mockRoot, fromRelative, toRelative);
    const content = fileContents.get(path);
    if (content !== undefined) {
      fileContents.delete(path);
      fileContents.set(newName, content);
    }
    const pathPrefix = path.endsWith('/') ? path : `${path}/`;
    const newNamePrefix = newName.endsWith('/') ? newName : `${newName}/`;

    const keysToUpdate: Array<[string, string]> = [];
    fileContents.forEach((_, key) => {
      if (key.startsWith(pathPrefix)) {
        const suffix = key.slice(pathPrefix.length);
        const newKey = `${newNamePrefix}${suffix}`;
        keysToUpdate.push([key, newKey]);
      }
    });

    keysToUpdate.forEach(([oldKey, newKey]) => {
      const content = fileContents.get(oldKey);
      if (content !== undefined) {
        fileContents.delete(oldKey);
        fileContents.set(newKey, content);
      }
    });
  },

  async moveAppFile(fromPath: string, toPath: string): Promise<void> {
    const fromRelative = stripAppRoot(fromPath);
    const toRelative = stripAppRoot(toPath);

    // Move the file/folder in the tree structure
    const nodeToMove = findNodeByPath(mockRoot, fromRelative);
    if (!nodeToMove) {
      throw new Error(`File or folder not found: ${fromPath}`);
    }

    removeNodeByPath(mockRoot, fromRelative);
    addNodeToPath(mockRoot, toRelative, nodeToMove);

    // Move file content if it's a file
    if (nodeToMove.type === 'file') {
      const content = fileContents.get(fromPath);
      if (content !== undefined) {
        fileContents.delete(fromPath);
        fileContents.set(toPath, content);
      }
    }
  },

  async removeAppFile(path: string): Promise<void> {
    const relative = stripAppRoot(path);
    removeNodeByPath(mockRoot, relative);

    fileContents.delete(path);
  },

  async createAppFolder(path: string): Promise<void> {
    // path is /myapp/<relativeFolder>
    const relative = stripAppRoot(path);
    const segments = relative.split('/');
    const name = segments.pop();
    const folderPath = segments.join('/');
    if (!name) return;

    const parent = findFolderNode(mockRoot, folderPath);
    if (!parent) {
      console.warn('[MockArduinoAppFilesService] parent folder not found', {
        folderPath,
      });
      return;
    }

    const folderRelative = folderPath ? `${folderPath}/${name}` : name;

    const newFolder: FolderNode = {
      name,
      path: folderRelative,
      type: 'folder',
      createdAt: getNowIso(),
      modifiedAt: getNowIso(),
      children: [],
    };

    parent.children.push(newFolder);
    parent.modifiedAt = getNowIso();
  },

  async importResourceToAppFromPath(
    remoteDir: string,
    filePath: string,
    isFolder?: boolean,
    customName?: string,
  ): Promise<ImportResourceResult> {
    const originalName =
      filePath.split(/[/\\]/).pop() ||
      (isFolder ? 'imported_folder' : 'imported_file.txt');
    const finalName = customName || originalName;

    const relativeTargetDir = stripAppRoot(remoteDir);
    const targetRelativePath = relativeTargetDir
      ? `${relativeTargetDir}/${finalName}`
      : finalName;
    const targetFullPath = `${APP_ROOT}/${targetRelativePath}`;

    const parent = findFolderNode(mockRoot, relativeTargetDir);
    if (!parent) {
      console.warn('[MockArduinoAppFilesService] parent folder not found', {
        remoteDir,
      });
      return { id: targetFullPath, name: finalName };
    }

    if (isFolder) {
      const newNode: FolderNode = {
        name: finalName,
        path: targetRelativePath,
        type: 'folder',
        createdAt: getNowIso(),
        modifiedAt: getNowIso(),
        children: [],
      };
      parent.children.push(newNode);
    } else {
      const ext = finalName.includes('.')
        ? `.${finalName.split('.').pop()}`
        : '';
      const newNode: FileNode = {
        name: finalName,
        path: targetRelativePath,
        type: 'file',
        extension: ext,
        mimeType: 'text/plain',
        size: 2048,
        createdAt: getNowIso(),
        modifiedAt: getNowIso(),
      };
      parent.children.push(newNode);
      fileContents.set(
        targetFullPath,
        `Mock content imported from path: ${filePath}`,
      );
    }

    parent.modifiedAt = getNowIso();
    return { id: targetFullPath, name: finalName };
  },

  importDroppedResourceToApp: function (
    callback: (items: { path: string; isFolder: boolean }[]) => void,
  ): () => void {
    const timer = setTimeout(() => {
      callback([
        { path: '/Users/mock/Desktop/MockFile1.txt', isFolder: false },
        { path: '/Users/mock/Desktop/README.md', isFolder: false },
      ]);
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  },

  async selectResourcePathToImport(
    _remoteDir,
    isFolder = false,
  ): Promise<string[] | null> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (isFolder) {
          resolve(['/Users/mock/Desktop/MyImportedFolder']);
        } else {
          resolve([
            '/Users/mock/Desktop/MockFile1.txt',
            '/Users/mock/Desktop/MockFile2.csv',
          ]);
        }
      }, 300);
    });
  },
};
