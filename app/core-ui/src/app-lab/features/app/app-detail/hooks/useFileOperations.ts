import {
  createAppFile,
  createAppFolder,
  getCodeSubjectById,
  getCodeSubjects,
  isUnsavedFile,
  removeAppFile,
  removeCodeSubject,
  renameAppFile,
  renameCodeSubject,
  setCodeSubjects,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { NodeType } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

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
  openFile: (path: string, opts?: OpenFileOptions) => Promise<void>;
};

type UseFileOperationsParams = {
  appId?: string;
  appPath?: string;
  // All three take app-relative paths; the file tree hook owns what that
  // invalidates.
  invalidateDirs: (paths: string[]) => void;
  unlistDir: (folder: string) => void;
  renameDir: (from: string, to: string) => void;
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
};

const prefix = (appPath: string | undefined, path: string): string =>
  `${appPath ?? ''}/${path}`;

// Paths beneath `folder` whose local state we hold
function pathsUnder(folder: string): string[] {
  const prefix = `${folder}/`;
  return Array.from(getCodeSubjects().keys()).filter((path) =>
    path.startsWith(prefix),
  );
}

function snapshotSubjectValue(path: string): string | undefined {
  try {
    return getCodeSubjectById(path).getValue().value;
  } catch {
    return undefined;
  }
}

function isNotFound(error: unknown): boolean {
  return (error as { cause?: number }).cause === 404;
}

// Buffers a stream rename moved with unsaved typing: the move kept the content, so until it is saved a refetch of the new id must not reload it.
const movedFiles = new Set<string>();

// Not consumed on read: both panels may refetch the one buffer.
export const keepMovedBuffer = (path: string): boolean => {
  if (!movedFiles.has(path)) return false;
  if (getCodeSubjects().has(path) && isUnsavedFile(path)) return true;
  movedFiles.delete(path);
  return false;
};

export function useFileOperations({
  appId,
  appPath,
  invalidateDirs,
  unlistDir,
  renameDir,
  fetchFile,
  selectFile,
  closeFile,
  updateOpenFile,
  createLspNode,
  deleteLspNode,
  renameLspNode,
}: UseFileOperationsParams): UseFileOperationsReturn {
  const queryClient = useQueryClient();

  // Local-only fan-out used by both `user` and `stream` paths.
  const applyRenameLocal = useCallback(
    (from: string, to: string, markMoved = false) => {
      const descendants = pathsUnder(from);
      const rekey = (oldPath: string, newPath: string): void => {
        // A buffer with nothing unsaved is reloaded as usual: an agent edit flushed just before the move is what the board has.
        if (
          markMoved &&
          getCodeSubjects().has(oldPath) &&
          isUnsavedFile(oldPath)
        ) {
          movedFiles.add(newPath);
        }
        renameCodeSubject(oldPath, newPath);
        updateOpenFile?.(oldPath, newPath);
      };

      rekey(from, to);
      descendants.forEach((path) =>
        rekey(path, to + path.substring(from.length)),
      );
    },
    [updateOpenFile],
  );

  const renameFile = useCallback<UseFileOperationsReturn['renameFile']>(
    async (from, to, opts) => {
      if (!from || !to || from === to) return;
      const { nodeType, source = 'user' } = opts ?? {};

      // Only a stream rename lands after the board moved the file, so only its refetch could reload the buffer.
      applyRenameLocal(from, to, source === 'stream');

      if (source === 'stream') {
        renameLspNode?.(from, to, nodeType);
        if (nodeType === 'folder') renameDir(from, to);
        invalidateDirs([from, to]);
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
        applyRenameLocal(to, from);
        throw error;
      }
      // The folder's listing is keyed by its old path: move the expansion
      // across, or the new folder shows unlisted and the old key survives to
      // furnish whatever next takes that name.
      if (nodeType === 'folder') renameDir(from, to);
      invalidateDirs([from, to]);
    },
    [appPath, applyRenameLocal, invalidateDirs, renameDir, renameLspNode],
  );

  const deleteFile = useCallback<UseFileOperationsReturn['deleteFile']>(
    async (path, opts) => {
      if (!path) return;
      const { source = 'user', nodeType } = opts ?? {};

      const subjectSnapshot = snapshotSubjectValue(path);

      closeFile(path);
      removeCodeSubject(path);

      if (source === 'stream') {
        // No deleteLspNode here: a stream delete comes from the file watcher,
        // whose handler already reconciles every LS via syncLspWatchedChange
        // (useFileWatch `dir` remove) — notifying again would double-send the
        // Deleted watched-files event.
        invalidateDirs([path]);
        return;
      }

      try {
        await removeAppFile(prefix(appPath, path));

        deleteLspNode?.(path, nodeType);
      } catch (error) {
        // Restore the subject and reopen the tab so unsaved edits and the open
        // file aren't lost.
        if (!isNotFound(error) && subjectSnapshot !== undefined) {
          setCodeSubjects({ path, content: subjectSnapshot });
          selectFile({ fileId: path });
        }
        throw error;
      }
      invalidateDirs([path]);
      if (appId) {
        queryClient.invalidateQueries({
          queryKey: [BoardScopedQuery.APP_BRICKS, appId],
        });
      }
    },
    [
      appId,
      appPath,
      closeFile,
      selectFile,
      invalidateDirs,
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

      const affected = [path, ...pathsUnder(path)];

      // Snapshot buffers so a failed backend delete can restore unsaved edits.
      const snapshots = affected.map((p) => ({
        path: p,
        content: snapshotSubjectValue(p),
      }));

      affected.forEach((p) => {
        closeFile(p);
        removeCodeSubject(p);
      });

      if (source === 'stream') {
        deleteLspNode?.(path, 'folder');
        unlistDir(path);
        invalidateDirs([path]);
        return;
      }

      try {
        await removeAppFile(prefix(appPath, path));

        deleteLspNode?.(path, 'folder');
      } catch (error) {
        if (!isNotFound(error)) {
          snapshots.forEach(({ path: p, content }) => {
            if (content !== undefined) setCodeSubjects({ path: p, content });
          });
        }
        throw error;
      }
      unlistDir(path);
      invalidateDirs([path]);
      if (appId) {
        queryClient.invalidateQueries({
          queryKey: [BoardScopedQuery.APP_BRICKS, appId],
        });
      }
    },
    [
      appId,
      appPath,
      closeFile,
      unlistDir,
      invalidateDirs,
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
        invalidateDirs([path]);
        return;
      }

      try {
        // Write exactly what was seeded into the buffer, so the editor and the
        // file on disk can't start out of sync.
        await createAppFile(prefix(appPath, path), fileContent);

        createLspNode?.(path);
      } catch (error) {
        removeCodeSubject(path);
        closeFile(path);
        throw error;
      }
      invalidateDirs([path]);
    },
    [appPath, closeFile, invalidateDirs, createLspNode],
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
        invalidateDirs([path]);
        return;
      }

      await createAppFolder(prefix(appPath, path));
      invalidateDirs([path]);
    },
    [appPath, invalidateDirs],
  );

  return {
    renameFile,
    deleteFile,
    removeFolder,
    addFile,
    addFolder,
    openFile,
  };
}
