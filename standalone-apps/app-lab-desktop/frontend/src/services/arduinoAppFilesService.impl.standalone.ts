import { ArduinoAppFilesService } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';

import {
  CreateFolder,
  GetFileContent,
  GetFileTree,
  RemoveFile,
  RenameFile,
  WriteFileContent,
} from '../../wailsjs/go/app/App';
import { mapFSNode, mapFSNodeToFlat } from './orchestratorService.mapper';

export const getAppFileTree: ArduinoAppFilesService['getAppFileTree'] =
  async function (id: string) {
    const file = await GetFileTree(id);
    return [mapFSNode(file)];
  };

export const getAppFiles: ArduinoAppFilesService['getAppFiles'] =
  async function (id: string) {
    const fileTree = await GetFileTree(id);

    const flatFiles = mapFSNodeToFlat(fileTree);

    return {
      filesList: flatFiles,
      fileTree: [mapFSNode(fileTree)],
    };
  };

export const getAppFileContent: ArduinoAppFilesService['getAppFileContent'] =
  async function (id: string) {
    return GetFileContent(id);
  };

export const saveAppFile: ArduinoAppFilesService['saveAppFile'] =
  async function (path: string, content: string) {
    return WriteFileContent(path, content);
  };

export const createAppFile: ArduinoAppFilesService['createAppFile'] =
  async function (path: string, content: string = '') {
    return WriteFileContent(path, content);
  };

export const renameAppFile: ArduinoAppFilesService['renameAppFile'] =
  async function (path: string, newName: string) {
    return RenameFile(path, newName);
  };

export const removeAppFile: ArduinoAppFilesService['removeAppFile'] =
  async function (path: string) {
    return RemoveFile(path);
  };

export const createAppFolder: ArduinoAppFilesService['createAppFolder'] =
  async function (path: string) {
    return CreateFolder(path);
  };
