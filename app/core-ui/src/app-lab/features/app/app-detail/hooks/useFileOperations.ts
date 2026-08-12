import {
  createAppFile,
  createAppFolder,
  getCodeSubjectById,
  moveAppFile,
  removeAppFile,
  removeCodeSubject,
  renameAppFile,
  renameCodeSubject,
  setCodeSubjects,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  FileNode,
  NodeType,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { QueryKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { catchLogError } from '../../../../../common/utils';
import { BoardScopedQuery } from '../../../../boardScopedQuery';

export type FileMutationSource = 'user' | 'stream';

export type FileMutationOptions = {
  source?: FileMutationSource;
};

export type RenameOptions = FileMutationOptions & {
  nodeType?: 'file' | 'folder';
};

export type OpenFileOptions = {
  openAtIndex?: number;
  isPreview?: boolean;
};

export type UseFileOperationsReturn = {
  renameFile: (from: string, to: string, opts?: RenameOptions) => Promise<void>;
  deleteFile: (
    path: string,
    opts?: FileMutationOptions & { nodeType?: 'file' | 'folder' },
  ) => Promise<void>;
  removeFolder: (path: string, opts?: FileMutationOptions) => Promise<void>;
  addFile: (
    path: string,
    name: string,
    extension: string,
    content?: string,
    opts?: FileMutationOptions,
  ) => Promise<void>;
  addFolder: (path: string, opts?: FileMutationOptions) => Promise<void>;
  moveFile: (
    from: string,
    to: string,
    opts?: FileMutationOptions & { nodeType?: 'file' | 'folder' },
  ) => Promise<void>;
  openFile: (path: string, opts?: OpenFileOptions) => Promise<void>;
};

type UseFileOperationsParams = {
  appId?: string;
  appPath?: string;
  filesListKey: QueryKey;
  files?: FileNode[];
  fetchFile: (path: string) => Promise<void>;
  selectFile: (params: {
    fileId?: string;
    openAtIndex?: number;
    isPreview?: boolean;
  }) => void;
  closeFile: (fileId: string) => void;
  updateOpenFile?: (currFileId: string, nextFileId: string) => void;
  createLspNode?: (path: string, nodeType?: NodeType) => void;
  deleteLspNode?: (path: string, nodeType?: NodeType) => void;
  renameLspNode?: (
    oldPath: string,
    newPath: string,
    nodeType?: NodeType,
  ) => void;
  moveLspNode?: (oldPath: string, newPath: string, nodeType?: NodeType) => void;
};

const prefix = (appPath: string | undefined, path: string): string =>
  `${appPath ?? ''}/${path}`;

function collectFolderDescendants(
  files: FileNode[] | undefined,
  folder: string,
  newFolder: string,
): Array<{ oldPath: string; newPath: string }> {
  if (!files) return [];
  return files.reduce<Array<{ oldPath: string; newPath: string }>>(
    (acc, file) => {
      if (file.path.startsWith(folder + '/')) {
        acc.push({
          oldPath: file.path,
          newPath: newFolder + file.path.substring(folder.length),
        });
      }
      return acc;
    },
    [],
  );
}

function snapshotSubjectValue(path: string): string | undefined {
  try {
    return getCodeSubjectById(path).getValue().value;
  } catch {
    return undefined;
  }
}

export function useFileOperations({
  appId,
  appPath,
  filesListKey,
  files,
  fetchFile,
  selectFile,
  closeFile,
  updateOpenFile,
  createLspNode,
  deleteLspNode,
  renameLspNode,
  moveLspNode,
}: UseFileOperationsParams): UseFileOperationsReturn {
  const queryClient = useQueryClient();

  const invalidateFilesList = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: filesListKey, exact: true });
  }, [queryClient, filesListKey]);

  // Local-only fan-out used by both `user` and `stream` paths.
  const applyRenameLocal = useCallback(
    (
      from: string,
      to: string,
      pairs: Array<{ oldPath: string; newPath: string }>,
    ) => {
      renameCodeSubject(from, to);
      pairs.forEach(({ oldPath, newPath }) =>
        renameCodeSubject(oldPath, newPath),
      );

      if (updateOpenFile) {
        if (pairs.length > 0) {
          pairs.forEach(({ oldPath, newPath }) =>
            updateOpenFile(oldPath, newPath),
          );
        } else {
          updateOpenFile(from, to);
        }
      }
    },
    [updateOpenFile],
  );

  const renameFile = useCallback<UseFileOperationsReturn['renameFile']>(
    async (from, to, opts) => {
      if (!from || !to || from === to) return;
      const { nodeType, source = 'user' } = opts ?? {};

      const pairs =
        nodeType === 'folder' ? collectFolderDescendants(files, from, to) : [];

      applyRenameLocal(from, to, pairs);

      if (source === 'stream') {
        renameLspNode?.(from, to, nodeType);
        invalidateFilesList();
        return;
      }

      try {
        await renameAppFile(
          prefix(appPath, from),
          prefix(appPath, to),
          nodeType,
        );

        renameLspNode?.(from, to, nodeType);
      } catch (error) {
        const inversePairs = pairs.map(({ oldPath, newPath }) => ({
          oldPath: newPath,
          newPath: oldPath,
        }));
        applyRenameLocal(to, from, inversePairs);
        throw error;
      }
      invalidateFilesList();
    },
    [appPath, files, applyRenameLocal, invalidateFilesList, renameLspNode],
  );

  const moveFile = useCallback<UseFileOperationsReturn['moveFile']>(
    async (from, to, opts) => {
      if (!from || !to || from === to) return;
      const { source = 'user', nodeType } = opts ?? {};

      const pairs =
        nodeType === 'folder' ? collectFolderDescendants(files, from, to) : [];

      // Always rekey the subject: fixes the pre-existing bug where moving an
      // open file left its buffer keyed at the old path.
      applyRenameLocal(from, to, pairs);

      if (source === 'stream') {
        moveLspNode?.(from, to, nodeType);
        invalidateFilesList();
        return;
      }

      try {
        await moveAppFile(prefix(appPath, from), prefix(appPath, to));

        moveLspNode?.(from, to, nodeType);
      } catch (error) {
        const inversePairs = pairs.map(({ oldPath, newPath }) => ({
          oldPath: newPath,
          newPath: oldPath,
        }));
        applyRenameLocal(to, from, inversePairs);
        throw error;
      }
      invalidateFilesList();
    },
    [appPath, files, applyRenameLocal, invalidateFilesList, moveLspNode],
  );

  const deleteFile = useCallback<UseFileOperationsReturn['deleteFile']>(
    async (path, opts) => {
      if (!path) return;
      const { source = 'user', nodeType } = opts ?? {};

      const fileNode = files?.find((f) => f.path === path);
      const subjectSnapshot = snapshotSubjectValue(path);

      closeFile(path);
      try {
        removeCodeSubject(path);
      } catch (error) {
        console.error('Error removing code subject for path:', path, error);
      }

      if (source === 'stream') {
        // No deleteLspNode here: a stream delete comes from the file watcher,
        // whose handler already reconciles every LS via syncLspWatchedChange
        // (useFileWatch `dir` remove) — notifying again would double-send the
        // Deleted watched-files event.
        invalidateFilesList();
        return;
      }

      try {
        await removeAppFile(prefix(appPath, path));

        deleteLspNode?.(path, nodeType);
      } catch (error) {
        // 404 means the file was already gone server-side — accept the
        // local delete. Any other error: restore the subject and reopen the
        // tab so unsaved edits and the open file aren't lost.
        const cause = (error as { cause?: number }).cause;
        if (cause !== 404 && fileNode && subjectSnapshot !== undefined) {
          setCodeSubjects({ path, content: subjectSnapshot });
          selectFile({ fileId: path });
        }
        throw error;
      }
      invalidateFilesList();
      if (appId) {
        queryClient.invalidateQueries([BoardScopedQuery.APP_BRICKS, appId]);
      }
    },
    [
      appId,
      appPath,
      files,
      closeFile,
      selectFile,
      invalidateFilesList,
      queryClient,
      deleteLspNode,
    ],
  );

  // Remove a folder and everything under it. Unlike `deleteFile` (which only
  // touches the single node), this closes the tab and drops the seeded buffer
  // for the folder *and every descendant file*, so an external `rm -rf` (or a
  // UI folder delete) can't leave orphaned tabs whose ids linger after their
  // meta disappears from the tree. `source: 'stream'` skips the backend call
  // (the change already happened on disk) and just reconciles the UI.
  const removeFolder = useCallback<UseFileOperationsReturn['removeFolder']>(
    async (path, opts) => {
      if (!path) return;
      const { source = 'user' } = opts ?? {};

      const prefixSlash = `${path}/`;
      const affected = Array.from(
        new Set([
          path,
          ...(files ?? [])
            .map((f) => f.path)
            .filter((p) => p === path || p.startsWith(prefixSlash)),
        ]),
      );

      // Snapshot buffers so a failed backend delete can restore unsaved edits.
      const snapshots = affected.map((p) => ({
        path: p,
        content: snapshotSubjectValue(p),
      }));

      affected.forEach((p) => {
        closeFile(p);
        try {
          removeCodeSubject(p);
        } catch {
          // subject may not exist for this descendant; ignore
        }
      });

      if (source === 'stream') {
        deleteLspNode?.(path, 'folder');
        invalidateFilesList();
        return;
      }

      try {
        await removeAppFile(prefix(appPath, path));

        deleteLspNode?.(path, 'folder');
      } catch (error) {
        // 404 means it was already gone server-side — accept the local removal.
        const cause = (error as { cause?: number }).cause;
        if (cause !== 404) {
          snapshots.forEach(({ path: p, content }) => {
            if (content !== undefined) setCodeSubjects({ path: p, content });
          });
        }
        throw error;
      }
      invalidateFilesList();
      if (appId) {
        queryClient.invalidateQueries([BoardScopedQuery.APP_BRICKS, appId]);
      }
    },
    [
      appId,
      appPath,
      files,
      closeFile,
      invalidateFilesList,
      queryClient,
      deleteLspNode,
    ],
  );

  const addFile = useCallback<UseFileOperationsReturn['addFile']>(
    async (path, _name, _extension, content, opts) => {
      if (!path) return;
      const { source = 'user' } = opts ?? {};

      const fileContent = content ?? '';

      // Seed the subject so the editor has buffer to render immediately.
      setCodeSubjects({ path, content: fileContent });

      if (source === 'stream') {
        createLspNode?.(path);
        invalidateFilesList();
        return;
      }

      try {
        // Write exactly what was seeded into the buffer, so the editor and the
        // file on disk can't start out of sync.
        await createAppFile(prefix(appPath, path), fileContent);

        createLspNode?.(path);
      } catch (error) {
        try {
          removeCodeSubject(path);
        } catch {
          // ignore
        }
        closeFile(path);
        throw error;
      }
      invalidateFilesList();
    },
    [appPath, closeFile, invalidateFilesList, createLspNode],
  );

  const openFile = useCallback<UseFileOperationsReturn['openFile']>(
    async (path, opts) => {
      if (!path) return;
      // Fire-and-forget: selection updates synchronously so the tab strip
      // reacts immediately. A boot effect in appDetail.logic also refetches
      // on `selectedFile.fileId` change — this kicks the fetch early so
      // content lands in parallel with the re-render. Rejections are logged
      // rather than left unhandled.
      catchLogError('open file', fetchFile(path));
      selectFile({
        fileId: path,
        openAtIndex: opts?.openAtIndex,
        isPreview: opts?.isPreview,
      });
    },
    [fetchFile, selectFile],
  );

  const addFolder = useCallback<UseFileOperationsReturn['addFolder']>(
    async (path, opts) => {
      if (!path) return;
      const { source = 'user' } = opts ?? {};

      if (source === 'stream') {
        invalidateFilesList();
        return;
      }

      await createAppFolder(prefix(appPath, path));
      invalidateFilesList();
    },
    [appPath, invalidateFilesList],
  );

  return useMemo(
    () => ({
      renameFile,
      deleteFile,
      removeFolder,
      addFile,
      addFolder,
      moveFile,
      openFile,
    }),
    [
      renameFile,
      deleteFile,
      removeFolder,
      addFile,
      addFolder,
      moveFile,
      openFile,
    ],
  );
}
