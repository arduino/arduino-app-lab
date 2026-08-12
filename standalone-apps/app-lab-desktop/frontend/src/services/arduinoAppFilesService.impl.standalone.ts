import { ArduinoAppFilesService } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';

import {
  CreateFolder,
  GetFileContent,
  GetFileTree,
  ImportFileToAppFromPath,
  ImportFolderToAppFromPath,
  IsDirectory,
  IsLocalDirectory,
  RemoveFile,
  RenameFile,
  RenameFolder,
  SelectFilesDialog,
  SelectFolderDialog,
  UnwatchAll,
  UnwatchApp,
  UnwatchAppsDir,
  WatchApp,
  WatchAppsDir,
  WriteFileContent,
} from '../../wailsjs/go/app/App';
import { EventsOn, OnFileDrop } from '../../wailsjs/runtime';
import { mapFSNode, mapFSNodeToFlat } from './orchestratorService.mapper';

type DroppedItem = { path: string; isFolder: boolean };
type DropHandler = (items: DroppedItem[]) => void;

/**
 * Native file drops, kept deliberately off the Wails `wails:file-drop` event.
 *
 * The backend subscribes to that event to record the dropped paths as readable
 * for this session (see `internal/app/lifecycle.go`), and re-emits them under
 * `host-file-drop`. Two rules follow, and both are why this is a module-level
 * singleton rather than a per-caller subscription:
 *
 *  - Never unsubscribe from `wails:file-drop`. `EventsOff` (which
 *    `OnFileDropOff` calls, and which the last listener's own unsubscribe also
 *    triggers) is forwarded to the Go event bus, where it deletes *every*
 *    listener for that name - the backend's included. The backend registers
 *    once at startup, so losing it means every later drop is refused as a path
 *    the session never saw.
 *  - Listening to `host-file-drop` also means the paths cannot arrive before
 *    the backend has recorded them.
 *
 * One consumer is active at a time, first to subscribe: `OnFileDrop` behaved
 * that way already, and letting every subscriber see the same drop would run
 * two imports for it.
 */
const HOST_FILE_DROP_EVENT = 'host-file-drop';

let activeDropHandler: DropHandler | null = null;
let dropBridgeInstalled = false;

const installDropBridge = (): void => {
  if (dropBridgeInstalled) {
    return;
  }
  dropBridgeInstalled = true;

  // Registered for its side effects only, and never turned off: it installs the
  // dragover/drop DOM handlers that let a drop through, and on Windows the
  // WebView2 bridge that resolves the dropped items to real paths. The paths
  // themselves come from the backend, on HOST_FILE_DROP_EVENT.
  OnFileDrop(() => undefined, false);

  EventsOn(
    HOST_FILE_DROP_EVENT,
    async (x: number, y: number, paths: string[]) => {
      const handler = activeDropHandler;
      if (!handler) {
        return;
      }

      const element = document.elementFromPoint(x, y);
      if (!element || !element.closest('[data-native-dropzone="true"]')) {
        return;
      }

      const items = await Promise.all(
        paths.map(async (path) => {
          let isFolder = false;
          try {
            isFolder = await IsLocalDirectory(path);
          } catch {
            isFolder = false;
          }
          return { path, isFolder };
        }),
      );

      handler(items);
    },
  );
};

export const getAppFileTree: ArduinoAppFilesService['getAppFileTree'] =
  async function (id: string) {
    console.log('getAppFileTree');

    const file = await GetFileTree(id);
    return [mapFSNode(file)];
  };

export const getAppFiles: ArduinoAppFilesService['getAppFiles'] =
  async function (path: string) {
    const fileTree = await GetFileTree(path);

    const flatFiles = mapFSNodeToFlat(fileTree);

    return {
      filesList: flatFiles,
      fileTree: [mapFSNode(fileTree)],
    };
  };

export const getAppFileContent: ArduinoAppFilesService['getAppFileContent'] =
  async function (path: string) {
    return GetFileContent(path);
  };

export const saveAppFile: ArduinoAppFilesService['saveAppFile'] =
  async function (path: string, content: string, suppressWatch = true) {
    return WriteFileContent(path, content, suppressWatch);
  };

export const createAppFile: ArduinoAppFilesService['createAppFile'] =
  async function (path: string, content: string = '', suppressWatch = true) {
    return WriteFileContent(path, content, suppressWatch);
  };

export const renameAppFile: ArduinoAppFilesService['renameAppFile'] =
  async function (
    path: string,
    newName: string,
    nodeType?: 'file' | 'folder',
    suppressWatch = true,
  ) {
    if (nodeType === 'folder') {
      return RenameFolder(path, newName, suppressWatch);
    } else {
      return RenameFile(path, newName, suppressWatch);
    }
  };

const directoryCache = new Map<string, boolean>();

export const moveAppFile: ArduinoAppFilesService['moveAppFile'] =
  async function (fromPath: string, toPath: string, suppressWatch = true) {
    // Check cache first
    let isDirectory = directoryCache.get(fromPath);

    if (isDirectory === undefined) {
      try {
        isDirectory = await IsDirectory(fromPath);
        // Cache the result for future use
        directoryCache.set(fromPath, isDirectory);
      } catch (error) {
        console.error('Error determining file type:', error);
      }
    }

    return isDirectory
      ? RenameFolder(fromPath, toPath, suppressWatch)
      : RenameFile(fromPath, toPath, suppressWatch);
  };

export const removeAppFile: ArduinoAppFilesService['removeAppFile'] =
  async function (path: string, suppressWatch = true) {
    return RemoveFile(path, suppressWatch);
  };

export const createAppFolder: ArduinoAppFilesService['createAppFolder'] =
  async function (path: string, suppressWatch = true) {
    return CreateFolder(path, suppressWatch);
  };

export const importResourceToAppFromPath: ArduinoAppFilesService['importResourceToAppFromPath'] =
  async function (
    remoteDir: string,
    filePath: string,
    isFolder?: boolean,
    newFileName?: string,
    suppressWatch = true,
  ) {
    let result;

    if (isFolder) {
      result = await ImportFolderToAppFromPath(
        remoteDir,
        filePath,
        newFileName ?? '',
        suppressWatch,
      );
    } else {
      result = await ImportFileToAppFromPath(
        remoteDir,
        filePath,
        newFileName ?? '',
        suppressWatch,
      );
    }

    const name = result.split('/').pop() ?? '';
    return { id: result, name };
  };

export const importDroppedResourceToApp: ArduinoAppFilesService['importDroppedResourceToApp'] =
  function (callback) {
    installDropBridge();

    if (activeDropHandler) {
      return () => undefined;
    }
    activeDropHandler = callback;

    return () => {
      if (activeDropHandler === callback) {
        activeDropHandler = null;
      }
    };
  };

export const watchApp: ArduinoAppFilesService['watchApp'] = (path) =>
  WatchApp(path);

export const unwatchApp: ArduinoAppFilesService['unwatchApp'] = (path) =>
  UnwatchApp(path);

export const watchAppsDir: ArduinoAppFilesService['watchAppsDir'] = (path) =>
  WatchAppsDir(path);

export const unwatchAppsDir: ArduinoAppFilesService['unwatchAppsDir'] = (
  path,
) => UnwatchAppsDir(path);

export const unwatchAll: ArduinoAppFilesService['unwatchAll'] = () =>
  UnwatchAll();

export const selectResourcePathToImport: ArduinoAppFilesService['selectResourcePathToImport'] =
  async function (remoteDir, isFolder = false) {
    try {
      if (isFolder) {
        const result = await SelectFolderDialog(remoteDir);
        return result || null;
      } else {
        const result = await SelectFilesDialog(remoteDir);
        return result && result.length > 0 ? result : null;
      }
    } catch (error) {
      console.error('Error opening dialog:', error);
      return null;
    }
  };
