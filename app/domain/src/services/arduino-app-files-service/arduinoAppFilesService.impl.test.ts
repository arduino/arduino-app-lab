import {
  FolderNode,
  isFolderNode,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  codeSubjectNext,
  createAppFile,
  createAppFolder,
  getAppFileContent,
  getAppFiles,
  getAppFileTree,
  getCodeReloadSubject,
  getCodeSubjects,
  reloadCodeSubject,
  removeAppFile,
  renameAppFile,
  renameCodeSubject,
  resetAppFilesState,
  saveAppFile,
  setArduinoAppFilesService,
  setCodeSubjects,
} from './arduinoAppFilesService.impl';
import { MockArduinoAppFilesService } from './arduinoAppFilesService.mock';

const APP_ROOT = '/myapp';

beforeAll(() => {
  setArduinoAppFilesService(MockArduinoAppFilesService);
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('arduinoAppFilesService.impl + MockArduinoAppFilesService - getAppFileTree', () => {
  it('getAppFileTree returns the root "myapp" and its children', async () => {
    const tree = await getAppFileTree(APP_ROOT);

    expect(Array.isArray(tree)).toBe(true);
    expect(tree.length).toBe(1);

    const root = tree[0];
    expect(root.type).toBe('folder');

    if (!isFolderNode(root)) {
      expect.fail('Expected root node to be a folder');
    }
    const rootFolder: FolderNode = root;

    expect(rootFolder.name).toBe('myapp');
    expect(rootFolder.children.length).toBeGreaterThan(0);

    const childNames = rootFolder.children.map((c) => c.name);
    expect(childNames).toEqual(
      expect.arrayContaining(['README.md', 'python', 'sketch', 'data']),
    );
  });

  it('getAppFileTree returns nodes with all properties', async () => {
    const tree = await getAppFileTree(APP_ROOT);
    const root = tree[0];

    if (!isFolderNode(root)) {
      expect.fail('Expected root node to be a folder');
    }

    expect(root).toHaveProperty('name');
    expect(root).toHaveProperty('path');
    expect(root).toHaveProperty('type');
    expect(root).toHaveProperty('createdAt');
    expect(root).toHaveProperty('modifiedAt');
    expect(root).toHaveProperty('children');
  });

  it('getAppFileTree contains folders and files with the right structure', async () => {
    const tree = await getAppFileTree(APP_ROOT);
    const root = tree[0];

    if (!isFolderNode(root)) {
      expect.fail('Expected root node to be a folder');
    }

    const pythonFolder = root.children.find(
      (c) => c.type === 'folder' && c.name === 'python',
    );

    expect(pythonFolder).toBeDefined();
    expect(pythonFolder!.type).toBe('folder');

    if (pythonFolder!.type === 'folder') {
      expect(pythonFolder!.children.length).toBeGreaterThan(0);
      const mainPy = pythonFolder!.children.find(
        (f) => f.type === 'file' && f.name === 'main.py',
      );
      expect(mainPy).toBeDefined();
    }
  });
});

describe('arduinoAppFilesService.impl + MockArduinoAppFilesService - getAppFiles', () => {
  it('getAppFiles returns a flat list of files and the corresponding tree', async () => {
    const { filesList, fileTree } = await getAppFiles(APP_ROOT);

    expect(Array.isArray(fileTree)).toBe(true);
    expect(fileTree.length).toBe(1);
    expect(Array.isArray(filesList)).toBe(true);
    expect(filesList.length).toBeGreaterThan(0);

    const paths = filesList.map((f) => f.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'README.md',
        'python/main.py',
        'python/requirements.txt',
        'sketch/sketch.ino',
        'sketch/utils.h',
        'data/data.json',
      ]),
    );
  });

  it('getAppFiles filesList contains only file nodes', async () => {
    const { filesList } = await getAppFiles(APP_ROOT);

    expect(filesList.every((node) => node.type === 'file')).toBe(true);
  });

  it('getAppFiles filesList includes files from all nested folders', async () => {
    const { filesList } = await getAppFiles(APP_ROOT);

    const pythonFiles = filesList.filter((f) => f.path.startsWith('python/'));
    const sketchFiles = filesList.filter((f) => f.path.startsWith('sketch/'));
    const dataFiles = filesList.filter((f) => f.path.startsWith('data/'));

    expect(pythonFiles.length).toBeGreaterThan(0);
    expect(sketchFiles.length).toBeGreaterThan(0);
    expect(dataFiles.length).toBeGreaterThan(0);
  });

  it('getAppFiles fileTree e filesList sono coerenti', async () => {
    const { filesList, fileTree } = await getAppFiles(APP_ROOT);

    expect(fileTree.length).toBe(1);
    expect(fileTree[0].type).toBe('folder');

    const pathsInList = new Set(filesList.map((f) => f.path));

    expect(pathsInList.has('README.md')).toBe(true);
    expect(pathsInList.has('python/main.py')).toBe(true);
  });
});

describe('arduinoAppFilesService.impl + MockArduinoAppFilesService - getAppFileContent', () => {
  it('getAppFileContent legge il contenuto iniziale del README', async () => {
    const content = await getAppFileContent(`${APP_ROOT}/README.md`);

    expect(content).toContain('# My App');
    expect(content).toContain("README mock dell'app");
  });

  it('getAppFileContent legge contenuto Python corretto', async () => {
    const content = await getAppFileContent(`${APP_ROOT}/python/main.py`);

    expect(content).toContain('def main()');
    expect(content).toContain('hello from mock app');
  });

  it('getAppFileContent legge contenuto requirements.txt', async () => {
    const content = await getAppFileContent(
      `${APP_ROOT}/python/requirements.txt`,
    );

    expect(content).toContain('numpy');
    expect(content).toContain('opencv-python');
  });

  it('getAppFileContent legge contenuto sketch Arduino', async () => {
    const content = await getAppFileContent(`${APP_ROOT}/sketch/sketch.ino`);

    expect(content).toContain('void setup()');
    expect(content).toContain('void loop()');
    expect(content).toContain('Serial.begin');
  });

  it('getAppFileContent legge contenuto header C', async () => {
    const content = await getAppFileContent(`${APP_ROOT}/sketch/utils.h`);

    expect(content).toContain('#pragma once');
    expect(content).toContain('void doSomething()');
  });

  it('getAppFileContent legge contenuto JSON', async () => {
    const content = await getAppFileContent(`${APP_ROOT}/data/data.json`);

    expect(content).toContain('{"value": 42}');
  });

  it('getAppFileContent ritorna stringa vuota per file non esistente', async () => {
    const content = await getAppFileContent(`${APP_ROOT}/nonexistent/file.txt`);

    expect(content).toBe('');
  });
});

describe('arduinoAppFilesService.impl + MockArduinoAppFilesService - saveAppFile', () => {
  it('saveAppFile sovrascrive il contenuto del file', async () => {
    const path = `${APP_ROOT}/README.md`;

    await saveAppFile(path, 'NEW CONTENT');

    const updated = await getAppFileContent(path);
    expect(updated).toBe('NEW CONTENT');
  });

  it('saveAppFile salva contenuto multilinea', async () => {
    const path = `${APP_ROOT}/python/main.py`;
    const newContent = `def hello():
    print("line 1")
    print("line 2")
    print("line 3")`;

    await saveAppFile(path, newContent);

    const updated = await getAppFileContent(path);
    expect(updated).toBe(newContent);
  });

  it('saveAppFile può essere chiamato multiple volte sullo stesso file', async () => {
    const path = `${APP_ROOT}/sketch/sketch.ino`;

    await saveAppFile(path, 'First save');
    let content = await getAppFileContent(path);
    expect(content).toBe('First save');

    await saveAppFile(path, 'Second save');
    content = await getAppFileContent(path);
    expect(content).toBe('Second save');

    await saveAppFile(path, 'Third save');
    content = await getAppFileContent(path);
    expect(content).toBe('Third save');
  });

  it('saveAppFile gestisce contenuto vuoto', async () => {
    const path = `${APP_ROOT}/data/data.json`;

    await saveAppFile(path, '');

    const content = await getAppFileContent(path);
    expect(content).toBe('');
  });

  it('saveAppFile preserva caratteri speciali', async () => {
    const path = `${APP_ROOT}/README.md`;
    const specialContent = 'Special chars: €£¥ àèéìòù ñ 中文 🚀';

    await saveAppFile(path, specialContent);

    const content = await getAppFileContent(path);
    expect(content).toBe(specialContent);
  });
});

describe('arduinoAppFilesService.impl + MockArduinoAppFilesService - createAppFile', () => {
  it('createAppFile crea un nuovo file dentro sketch con il contenuto dato', async () => {
    const path = `${APP_ROOT}/sketch/newFile.ino`;

    await createAppFile(path, 'void loop() {}\n');

    const content = await getAppFileContent(path);
    expect(content).toBe('void loop() {}\n');

    const { filesList } = await getAppFiles(APP_ROOT);
    const created = filesList.find((f) => f.path === 'sketch/newFile.ino');
    expect(created).toBeDefined();
    expect(created!.type).toBe('file');
  });

  it('createAppFile crea file con contenuto vuoto se non specificato', async () => {
    const path = `${APP_ROOT}/python/empty.py`;

    await createAppFile(path);

    const content = await getAppFileContent(path);
    expect(content).toBe('');

    const { filesList } = await getAppFiles(APP_ROOT);
    const created = filesList.find((f) => f.path === 'python/empty.py');
    expect(created).toBeDefined();
  });

  it('createAppFile imposta correttamente le proprietà del file', async () => {
    const path = `${APP_ROOT}/data/new.json`;

    await createAppFile(path, '{"test": true}');

    const { filesList } = await getAppFiles(APP_ROOT);
    const created = filesList.find((f) => f.path === 'data/new.json');

    expect(created).toBeDefined();
    expect(created!.name).toBe('new.json');
    expect(created!.type).toBe('file');
    expect(created!.extension).toBe('.json');
    expect(created).toHaveProperty('createdAt');
    expect(created).toHaveProperty('modifiedAt');
  });

  it('createAppFile crea file in root', async () => {
    const path = `${APP_ROOT}/newfile.txt`;

    await createAppFile(path, 'Root file content');

    const content = await getAppFileContent(path);
    expect(content).toBe('Root file content');

    const { filesList } = await getAppFiles(APP_ROOT);
    const created = filesList.find((f) => f.path === 'newfile.txt');
    expect(created).toBeDefined();
  });

  it('createAppFile gestisce estensioni diverse correttamente', async () => {
    const files = [
      { path: `${APP_ROOT}/test.cpp`, ext: '.cpp' },
      { path: `${APP_ROOT}/test.h`, ext: '.h' },
      { path: `${APP_ROOT}/test.txt`, ext: '.txt' },
      { path: `${APP_ROOT}/test.md`, ext: '.md' },
    ];

    for (const file of files) {
      await createAppFile(file.path, 'content');

      const { filesList } = await getAppFiles(APP_ROOT);
      const created = filesList.find(
        (f) => f.path === file.path.replace(`${APP_ROOT}/`, ''),
      );
      expect(created?.extension).toBe(file.ext);
    }
  });

  it('createAppFile aggiorna modifiedAt della cartella parent', async () => {
    const tree = await getAppFileTree(APP_ROOT);
    const root = tree[0];

    if (!isFolderNode(root)) {
      expect.fail('Expected root node to be a folder');
    }

    const pythonFolder = root.children.find(
      (c) => c.type === 'folder' && c.name === 'python',
    );

    const modifiedBefore = pythonFolder?.modifiedAt;

    await new Promise((resolve) => setTimeout(resolve, 10));

    await createAppFile(`${APP_ROOT}/python/test.py`, 'test');

    const treeAfter = await getAppFileTree(APP_ROOT);
    const rootAfter = treeAfter[0];

    if (!isFolderNode(rootAfter)) {
      expect.fail('Expected root node to be a folder');
    }

    const pythonFolderAfter = rootAfter.children.find(
      (c) => c.type === 'folder' && c.name === 'python',
    );

    expect(pythonFolderAfter?.modifiedAt).not.toBe(modifiedBefore);
  });
});

describe('arduinoAppFilesService.impl + MockArduinoAppFilesService - renameAppFile', () => {
  it('renameAppFile sposta il file e mantiene il contenuto', async () => {
    const from = `${APP_ROOT}/sketch/temp.ino`;
    const to = `${APP_ROOT}/sketch/renamed.ino`;

    await createAppFile(from, 'int x = 1;');

    const before = await getAppFileContent(from);
    expect(before).toBe('int x = 1;');

    await renameAppFile(from, to);

    const oldContent = await getAppFileContent(from);
    const newContent = await getAppFileContent(to);

    expect(oldContent).toBe('');
    expect(newContent).toBe('int x = 1;');

    const { filesList } = await getAppFiles(APP_ROOT);
    const oldNode = filesList.find((f) => f.path === 'sketch/temp.ino');
    const newNode = filesList.find((f) => f.path === 'sketch/renamed.ino');

    expect(oldNode).toBeUndefined();
    expect(newNode).toBeDefined();
  });

  it('renameAppFile cambia il nome del file mantenendo il path', async () => {
    const from = `${APP_ROOT}/python/old.py`;
    const to = `${APP_ROOT}/python/new.py`;

    await createAppFile(from, 'print("test")');
    await renameAppFile(from, to);

    const { filesList } = await getAppFiles(APP_ROOT);
    const renamed = filesList.find((f) => f.path === 'python/new.py');

    expect(renamed).toBeDefined();
    expect(renamed!.name).toBe('new.py');
    expect(renamed!.path).toBe('python/new.py');
  });

  it('renameAppFile può spostare file tra cartelle', async () => {
    const from = `${APP_ROOT}/python/moveme.py`;
    const to = `${APP_ROOT}/sketch/moved.py`;

    await createAppFile(from, 'moved content');
    await renameAppFile(from, to);

    const content = await getAppFileContent(to);
    expect(content).toBe('moved content');

    const { filesList } = await getAppFiles(APP_ROOT);
    const moved = filesList.find((f) => f.path === 'sketch/moved.py');
    expect(moved).toBeDefined();
  });

  it('renameAppFile aggiorna modifiedAt del nodo', async () => {
    const from = `${APP_ROOT}/test-rename.txt`;
    const to = `${APP_ROOT}/test-renamed.txt`;

    await createAppFile(from, 'content');

    const { filesList: before } = await getAppFiles(APP_ROOT);
    const nodeBefore = before.find((f) => f.path === 'test-rename.txt');
    const modifiedBefore = nodeBefore?.modifiedAt;

    await new Promise((resolve) => setTimeout(resolve, 10));

    await renameAppFile(from, to);

    const { filesList: after } = await getAppFiles(APP_ROOT);
    const nodeAfter = after.find((f) => f.path === 'test-renamed.txt');

    expect(nodeAfter?.modifiedAt).not.toBe(modifiedBefore);
  });

  it('renameAppFile rinomina cartelle e aggiorna tutti i path figli', async () => {
    await createAppFolder(`${APP_ROOT}/oldfolder`);
    await createAppFile(`${APP_ROOT}/oldfolder/file1.txt`, 'content1');
    await createAppFile(`${APP_ROOT}/oldfolder/file2.txt`, 'content2');

    await renameAppFile(`${APP_ROOT}/oldfolder`, `${APP_ROOT}/newfolder`);

    const { filesList } = await getAppFiles(APP_ROOT);

    const file1 = filesList.find((f) => f.path === 'newfolder/file1.txt');
    const file2 = filesList.find((f) => f.path === 'newfolder/file2.txt');

    expect(file1).toBeDefined();
    expect(file2).toBeDefined();

    const content1 = await getAppFileContent(`${APP_ROOT}/newfolder/file1.txt`);
    const content2 = await getAppFileContent(`${APP_ROOT}/newfolder/file2.txt`);

    expect(content1).toBe('content1');
    expect(content2).toBe('content2');
  });
});

describe('arduinoAppFilesService.impl + MockArduinoAppFilesService - removeAppFile', () => {
  it("removeAppFile elimina il file dall'albero e dalla mappa contenuti", async () => {
    const path = `${APP_ROOT}/data/to-delete.json`;

    await createAppFile(path, '{"ok": true}');

    let content = await getAppFileContent(path);
    expect(content).toBe('{"ok": true}');

    await removeAppFile(path);

    content = await getAppFileContent(path);
    expect(content).toBe('');

    const { filesList } = await getAppFiles(APP_ROOT);
    const removed = filesList.find((f) => f.path === 'data/to-delete.json');
    expect(removed).toBeUndefined();
  });

  it('removeAppFile elimina file dalla root', async () => {
    const path = `${APP_ROOT}/deleteme.txt`;

    await createAppFile(path, 'delete this');
    await removeAppFile(path);

    const { filesList } = await getAppFiles(APP_ROOT);
    const removed = filesList.find((f) => f.path === 'deleteme.txt');
    expect(removed).toBeUndefined();
  });

  it('removeAppFile aggiorna modifiedAt della cartella parent', async () => {
    await createAppFile(`${APP_ROOT}/python/todelete.py`, 'content');

    const tree = await getAppFileTree(APP_ROOT);
    const root = tree[0];

    if (!isFolderNode(root)) {
      expect.fail('Expected root node to be a folder');
    }

    const pythonFolder = root.children.find(
      (c) => c.type === 'folder' && c.name === 'python',
    );

    const modifiedBefore = pythonFolder?.modifiedAt;

    await new Promise((resolve) => setTimeout(resolve, 10));

    await removeAppFile(`${APP_ROOT}/python/todelete.py`);

    const treeAfter = await getAppFileTree(APP_ROOT);
    const rootAfter = treeAfter[0];

    if (!isFolderNode(rootAfter)) {
      expect.fail('Expected root node to be a folder');
    }

    const pythonFolderAfter = rootAfter.children.find(
      (c) => c.type === 'folder' && c.name === 'python',
    );

    expect(pythonFolderAfter?.modifiedAt).not.toBe(modifiedBefore);
  });

  it('removeAppFile non causa errori per file già eliminato', async () => {
    const path = `${APP_ROOT}/already-deleted.txt`;

    await removeAppFile(path);

    const { filesList } = await getAppFiles(APP_ROOT);
    const removed = filesList.find((f) => f.path === 'already-deleted.txt');
    expect(removed).toBeUndefined();
  });

  it('removeAppFile può eliminare file esistenti predefiniti', async () => {
    const path = `${APP_ROOT}/README.md`;

    const { filesList: before } = await getAppFiles(APP_ROOT);
    const exists = before.find((f) => f.path === 'README.md');
    expect(exists).toBeDefined();

    await removeAppFile(path);

    const { filesList: after } = await getAppFiles(APP_ROOT);
    const removed = after.find((f) => f.path === 'README.md');
    expect(removed).toBeUndefined();
  });
});

describe('arduinoAppFilesService.impl + MockArduinoAppFilesService - createAppFolder', () => {
  it("createAppFolder crea una nuova cartella e la aggiunge all'albero", async () => {
    const folderPath = `${APP_ROOT}/new-folder`;

    await createAppFolder(folderPath);

    const tree = await getAppFileTree(APP_ROOT);
    const root = tree[0];

    if (!isFolderNode(root)) {
      expect.fail('Expected root node to be a folder');
    }
    const folderNode = root.children.find(
      (c) => c.type === 'folder' && c.name === 'new-folder',
    );

    expect(folderNode).toBeDefined();
    expect(folderNode!.type).toBe('folder');
    expect(folderNode!.path).toBe('new-folder');
  });

  it('createAppFolder crea cartella con proprietà corrette', async () => {
    const folderPath = `${APP_ROOT}/testfolder`;

    await createAppFolder(folderPath);

    const tree = await getAppFileTree(APP_ROOT);
    const root = tree[0];

    if (!isFolderNode(root)) {
      expect.fail('Expected root node to be a folder');
    }

    const folder = root.children.find(
      (c) => c.type === 'folder' && c.name === 'testfolder',
    );

    expect(folder).toBeDefined();
    expect(folder).toHaveProperty('name');
    expect(folder).toHaveProperty('path');
    expect(folder).toHaveProperty('createdAt');
    expect(folder).toHaveProperty('modifiedAt');

    if (folder!.type === 'folder') {
      expect(folder!.children).toEqual([]);
    }
  });

  it('createAppFolder crea cartella annidata', async () => {
    const folderPath = `${APP_ROOT}/python/subfolder`;

    await createAppFolder(folderPath);

    const tree = await getAppFileTree(APP_ROOT);
    const root = tree[0];

    if (!isFolderNode(root)) {
      expect.fail('Expected root node to be a folder');
    }

    const pythonFolder = root.children.find(
      (c) => c.type === 'folder' && c.name === 'python',
    );

    expect(pythonFolder).toBeDefined();

    if (pythonFolder!.type === 'folder') {
      const subfolder = pythonFolder!.children.find(
        (c) => c.type === 'folder' && c.name === 'subfolder',
      );
      expect(subfolder).toBeDefined();
      expect(subfolder!.path).toBe('python/subfolder');
    }
  });

  it('createAppFolder aggiorna modifiedAt della cartella parent', async () => {
    const tree = await getAppFileTree(APP_ROOT);
    const root = tree[0];

    if (!isFolderNode(root)) {
      expect.fail('Expected root node to be a folder');
    }

    const sketchFolder = root.children.find(
      (c) => c.type === 'folder' && c.name === 'sketch',
    );

    const modifiedBefore = sketchFolder?.modifiedAt;

    await new Promise((resolve) => setTimeout(resolve, 10));

    await createAppFolder(`${APP_ROOT}/sketch/libs`);

    const treeAfter = await getAppFileTree(APP_ROOT);
    const rootAfter = treeAfter[0];

    if (!isFolderNode(rootAfter)) {
      expect.fail('Expected root node to be a folder');
    }

    const sketchFolderAfter = rootAfter.children.find(
      (c) => c.type === 'folder' && c.name === 'sketch',
    );

    expect(sketchFolderAfter?.modifiedAt).not.toBe(modifiedBefore);
  });

  it('createAppFolder permette creazione di file dentro cartella nuova', async () => {
    await createAppFolder(`${APP_ROOT}/newdir`);
    await createAppFile(`${APP_ROOT}/newdir/file.txt`, 'content in new dir');

    const content = await getAppFileContent(`${APP_ROOT}/newdir/file.txt`);
    expect(content).toBe('content in new dir');

    const { filesList } = await getAppFiles(APP_ROOT);
    const file = filesList.find((f) => f.path === 'newdir/file.txt');
    expect(file).toBeDefined();
  });
});

describe('arduinoAppFilesService.impl + MockArduinoAppFilesService - Operazioni combinate', () => {
  it('Workflow completo: crea cartella, crea file, modifica, rinomina, elimina', async () => {
    await createAppFolder(`${APP_ROOT}/workflow`);

    const tree = await getAppFileTree(APP_ROOT);
    const root = tree[0];
    if (!isFolderNode(root)) throw new Error('Expected folder');

    const folder = root.children.find(
      (c) => c.type === 'folder' && c.name === 'workflow',
    );
    expect(folder).toBeDefined();

    await createAppFile(`${APP_ROOT}/workflow/test.txt`, 'initial content');

    let content = await getAppFileContent(`${APP_ROOT}/workflow/test.txt`);
    expect(content).toBe('initial content');

    await saveAppFile(`${APP_ROOT}/workflow/test.txt`, 'modified content');

    content = await getAppFileContent(`${APP_ROOT}/workflow/test.txt`);
    expect(content).toBe('modified content');

    await renameAppFile(
      `${APP_ROOT}/workflow/test.txt`,
      `${APP_ROOT}/workflow/renamed.txt`,
    );

    content = await getAppFileContent(`${APP_ROOT}/workflow/renamed.txt`);
    expect(content).toBe('modified content');

    await removeAppFile(`${APP_ROOT}/workflow/renamed.txt`);

    content = await getAppFileContent(`${APP_ROOT}/workflow/renamed.txt`);
    expect(content).toBe('');
  });

  it('Può gestire multiple operazioni su file diversi contemporaneamente', async () => {
    await createAppFile(`${APP_ROOT}/file1.txt`, 'content1');
    await createAppFile(`${APP_ROOT}/file2.txt`, 'content2');
    await createAppFile(`${APP_ROOT}/file3.txt`, 'content3');

    const content1 = await getAppFileContent(`${APP_ROOT}/file1.txt`);
    const content2 = await getAppFileContent(`${APP_ROOT}/file2.txt`);
    const content3 = await getAppFileContent(`${APP_ROOT}/file3.txt`);

    expect(content1).toBe('content1');
    expect(content2).toBe('content2');
    expect(content3).toBe('content3');

    await saveAppFile(`${APP_ROOT}/file1.txt`, 'updated1');
    await removeAppFile(`${APP_ROOT}/file2.txt`);
    await renameAppFile(
      `${APP_ROOT}/file3.txt`,
      `${APP_ROOT}/file3-renamed.txt`,
    );

    const { filesList } = await getAppFiles(APP_ROOT);

    const file1 = filesList.find((f) => f.path === 'file1.txt');
    const file2 = filesList.find((f) => f.path === 'file2.txt');
    const file3renamed = filesList.find((f) => f.path === 'file3-renamed.txt');

    expect(file1).toBeDefined();
    expect(file2).toBeUndefined();
    expect(file3renamed).toBeDefined();

    const updatedContent1 = await getAppFileContent(`${APP_ROOT}/file1.txt`);
    expect(updatedContent1).toBe('updated1');
  });

  it('Struttura cartelle complessa con operazioni multiple', async () => {
    await createAppFolder(`${APP_ROOT}/level1`);
    await createAppFolder(`${APP_ROOT}/level1/level2`);
    await createAppFolder(`${APP_ROOT}/level1/level2/level3`);

    await createAppFile(`${APP_ROOT}/level1/file1.txt`, 'level1 content');
    await createAppFile(
      `${APP_ROOT}/level1/level2/file2.txt`,
      'level2 content',
    );
    await createAppFile(
      `${APP_ROOT}/level1/level2/level3/file3.txt`,
      'level3 content',
    );

    const tree = await getAppFileTree(APP_ROOT);
    const root = tree[0];
    if (!isFolderNode(root)) throw new Error('Expected folder');

    const level1 = root.children.find(
      (c) => c.type === 'folder' && c.name === 'level1',
    );
    expect(level1).toBeDefined();

    if (level1!.type === 'folder') {
      const level2 = level1!.children.find(
        (c) => c.type === 'folder' && c.name === 'level2',
      );
      expect(level2).toBeDefined();

      if (level2!.type === 'folder') {
        const level3 = level2!.children.find(
          (c) => c.type === 'folder' && c.name === 'level3',
        );
        expect(level3).toBeDefined();
      }
    }

    const content1 = await getAppFileContent(`${APP_ROOT}/level1/file1.txt`);
    const content2 = await getAppFileContent(
      `${APP_ROOT}/level1/level2/file2.txt`,
    );
    const content3 = await getAppFileContent(
      `${APP_ROOT}/level1/level2/level3/file3.txt`,
    );

    expect(content1).toBe('level1 content');
    expect(content2).toBe('level2 content');
    expect(content3).toBe('level3 content');
  });
});

describe('arduinoAppFilesService.impl - code subject rename + save', () => {
  const flush = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, 20));

  beforeEach(() => {
    resetAppFilesState();
  });

  it('autosaves edits to the renamed path, not the original path', async () => {
    const saveCode = vi.fn().mockResolvedValue(undefined);

    // Seed a buffer and prime its save context, mirroring an initial edit.
    setCodeSubjects({ path: 'test1.py', content: 'initial' }, 0);
    codeSubjectNext('test1.py', 'first edit', saveCode);
    await flush();

    expect(saveCode).toHaveBeenCalledWith('test1.py', 'first edit', undefined);

    // Rename the buffer, then edit the renamed file.
    renameCodeSubject('test1.py', 'test2.py');
    codeSubjectNext('test2.py', 'second edit', saveCode);
    await flush();

    const savedPaths = saveCode.mock.calls.map(([path]) => path);
    expect(savedPaths).toContain('test2.py');
    // Regression: after rename, autosave must not write back to the old path.
    expect(saveCode).not.toHaveBeenCalledWith(
      'test1.py',
      'second edit',
      undefined,
    );
    expect(saveCode).toHaveBeenLastCalledWith(
      'test2.py',
      'second edit',
      undefined,
    );
  });
});

describe('arduinoAppFilesService.impl - reloadCodeSubject', () => {
  beforeEach(() => {
    resetAppFilesState();
  });

  it('skips the reload when the fetched content matches the buffer', () => {
    setCodeSubjects({ path: 'main.py', content: 'same content' });
    const subject$ = getCodeSubjects().get('main.py')!;
    const before = subject$.getValue();
    const reloadEvents: unknown[] = [];
    getCodeReloadSubject().subscribe((e) => e && reloadEvents.push(e));

    reloadCodeSubject('main.py', 'same content', 'refetch');

    // Same emission object, same instanceId: no editor state rebuild is
    // triggered. Regression: the selection-driven refetch on every file
    // switch used to mint a new instanceId even for identical content,
    // rebuilding the editor state and wiping the cursor position the LSP
    // reference panel had just dispatched.
    expect(subject$.getValue()).toBe(before);
    expect(subject$.getValue().meta.instanceId).toBe(before.meta.instanceId);
    expect(reloadEvents).toHaveLength(0);
  });

  it('reloads in place when the content actually changed', () => {
    setCodeSubjects({ path: 'main.py', content: 'old content' });
    const subject$ = getCodeSubjects().get('main.py')!;
    const before = subject$.getValue();
    const reloadEvents: { fileId: string; cause: string }[] = [];
    getCodeReloadSubject().subscribe(
      (e) => e && reloadEvents.push(e as { fileId: string; cause: string }),
    );

    reloadCodeSubject('main.py', 'new content', 'external-change');

    const after = subject$.getValue();
    expect(after.value).toBe('new content');
    expect(after.meta.instanceId).not.toBe(before.meta.instanceId);
    expect(after.meta.initialChange).toBe(true);
    expect(reloadEvents).toEqual([
      expect.objectContaining({ fileId: 'main.py', cause: 'external-change' }),
    ]);
  });

  it('is a no-op for a file with no subject', () => {
    expect(() =>
      reloadCodeSubject('unknown.py', 'content', 'refetch'),
    ).not.toThrow();
  });
});
