import {
  AppDetailedInfo,
  BrickCreateUpdateRequest,
  BrickInstance,
  BrickListItem,
} from '@cloud-editor-mono/infrastructure';
import {
  AddSketchLibraryDialogLogic,
  FileNode,
  SelectableFileData,
  TreeNode,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { EditorLogicParams } from '../editor/editor.type';

export interface UseAppDetailLogic {
  appId: string;
  app: AppDetailedInfo | undefined;
  appBricks: BrickInstance[] | undefined;
  appLibraries?: Array<{ id: string; version: string }>;
  bricks: BrickListItem[] | undefined;
  fileTree?: TreeNode[];
  appIsLoading: boolean;
  appBricksAreLoading: boolean;
  bricksAreLoading: boolean;
  filesAreLoading: boolean;
  selectedFile: SelectableFileData | undefined;
  selectedNode: FileNode | undefined;
  defaultOpenFoldersState: { [key: string]: boolean } | undefined;
  reloadApp: () => void;
  setSelectedFile: (id: string | TreeNode | undefined) => void;
  openFilesFolder: () => void;
  openExternal: () => void;
  openExternalLink: (url: string) => void;
  addAppBrick: (brickId: string) => Promise<boolean>;
  loadAppBrick: (brickId: string) => Promise<BrickInstance>;
  removeAppBrick: (brickId: string) => Promise<boolean>;
  updateAppBrick: (
    brickId: string,
    params: BrickCreateUpdateRequest,
  ) => Promise<boolean>;
  updateAppBricks: (
    bricks: Record<string, BrickCreateUpdateRequest>,
  ) => Promise<boolean>;
  editorLogicParams: EditorLogicParams;
  addFileHandler: (path: string) => Promise<void>;
  renameFileHandler: (path: string, newName: string) => Promise<void>;
  deleteFileHandler: (path: string) => Promise<void>;
  addSketchLibraryDialogLogic: AddSketchLibraryDialogLogic;
  openAddSketchLibraryDialog: () => void;
  deleteSketchLibrary: (libRef: string) => Promise<void>;
  addFolderHandler: (path: string) => Promise<void>;
}
