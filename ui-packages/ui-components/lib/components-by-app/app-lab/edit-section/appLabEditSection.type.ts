import {
  AppDetailedInfo,
  BrickCreateUpdateRequest,
  BrickInstance,
  BrickListItem,
} from '@cloud-editor-mono/infrastructure';

import {
  AddSketchLibraryDialogLogic,
  ConfigureAppBrickDialogLogic,
  ImportResourceLogic,
} from '../../../dialogs';
import {
  DuplicateFileDialogLogic,
  OnDuplicateConflictParams,
} from '../../../dialogs/app-lab/duplicate-file-dialog/types';
import { TreeNode } from '../../../file-tree';
import { SelectableFileData } from '../../shared';
import { AppsSection } from '../app-detail';
import { BrickDetailLogic } from '../brick-detail';
import { AppLabEditorPanelLogic } from '../editor-panel';
import { MultipleConsolePanelLogic } from '../multiple-console-panel';

export type AppLabEditSectionLogic = () => {
  app: AppDetailedInfo | undefined;
  appBricks: BrickInstance[] | undefined;
  bricks: BrickListItem[] | undefined;
  appLibraries?: Array<{ id: string; version: string }>;
  section: AppsSection;
  fileTree?: TreeNode[];
  selectedFile?: SelectableFileData;
  selectedNode?: TreeNode;
  selectedFolder?: TreeNode;
  defaultOpenFoldersState: { [key: string]: boolean } | undefined;
  setSelectedFile: (
    id: string | TreeNode | undefined,
    isPreview?: boolean,
    targetPane?: 'A' | 'B',
  ) => void;
  setSelectedFolder: (node: TreeNode | undefined) => void;
  openFilesFolder: () => void;
  openExternal: () => void;
  openExternalLink: (url: string) => void;
  addFileHandler: (path: string) => Promise<void>;
  renameFileHandler: (
    path: string,
    newName: string,
    appendExt?: boolean,
    nodeType?: 'file' | 'folder',
  ) => Promise<void>;
  deleteFileHandler: (
    path: string,
    nodeType?: 'file' | 'folder',
  ) => Promise<void>;
  moveFileHandler: (fromPath: string, toPath: string) => Promise<void>;
  addSketchLibraryDialogLogic: AddSketchLibraryDialogLogic;
  openAddSketchLibraryDialog: () => void;
  deleteSketchLibrary: (libRef: string) => Promise<void>;
  addFolderHandler: (path: string) => Promise<void>;
  addAppBrick(brickId: string): Promise<boolean>;
  deleteAppBrick(brickId: string): Promise<boolean>;
  updateAppBrick(
    brickId: string,
    params: BrickCreateUpdateRequest,
  ): Promise<boolean>;
  addAppCustomBrick: (
    appId: string,
    params: {
      name: string;
      description?: string;
    },
  ) => Promise<{ id: string } | undefined>;
  renameAppCustomBrick(
    brickId: string,
    params: { name: string },
  ): Promise<boolean>;
  renderIcon: (node: TreeNode) => JSX.Element;
  appLabEditorPanelLogic: AppLabEditorPanelLogic;
  brickDetailLogic: BrickDetailLogic;
  configureAppBrickDialogLogic: ConfigureAppBrickDialogLogic;
  updateOpenFile?: (currFileId: string, nextFileId: string) => void;
  multipleConsolePanelLogic: MultipleConsolePanelLogic;
  onDuplicateConflict?: (params: OnDuplicateConflictParams) => void;
  duplicateFileDialogLogic?: DuplicateFileDialogLogic;
  importFileDialogLogic: ImportResourceLogic;
  openImportFileDialog: (params: { path?: string; isFolder?: boolean }) => void;
  /**
   * Called when the user attempts to move (within the file tree) a node
   * that the Arduino App specification protects. Consumers wire this to
   * a notification (“file cannot be moved…”). The drop is bailed before
   * any rename request reaches the backend.
   */
  onMoveBlocked?: (node: TreeNode) => void;
  onDragOverFolderChange: (path: string) => void;
};

export type FilesManagerSectionLogic = () => {
  app: AppDetailedInfo | undefined;
  appBricks: BrickInstance[] | undefined;
  bricks: BrickListItem[] | undefined;
  appLibraries?: Array<{ id: string; version: string }>;
  section: AppsSection;
  fileTree?: TreeNode[];
  selectedFile?: SelectableFileData;
  selectedNode?: TreeNode;
  selectedFolder?: TreeNode;
  defaultOpenFoldersState: { [key: string]: boolean } | undefined;
  setSelectedFile: (
    id: string | TreeNode | undefined,
    isPreview?: boolean,
    targetPane?: 'A' | 'B',
  ) => void;
  setSelectedFolder: (node: TreeNode | undefined) => void;
  openExternalLink: (url: string) => void;
  addFileHandler: (path: string) => Promise<void>;
  renameFileHandler: (
    path: string,
    newName: string,
    appendExt?: boolean,
    nodeType?: 'file' | 'folder',
  ) => Promise<void>;
  deleteFileHandler: (path: string) => Promise<void>;
  addSketchLibraryDialogLogic: AddSketchLibraryDialogLogic;
  openAddSketchLibraryDialog: () => void;
  deleteSketchLibrary: (libRef: string) => Promise<void>;
  addFolderHandler: (path: string) => Promise<void>;
  addAppBrick(brickId: string): Promise<boolean>;
  deleteAppBrick(brickId: string): Promise<boolean>;
  updateAppBrick(
    brickId: string,
    params: BrickCreateUpdateRequest,
  ): Promise<boolean>;
  renderIcon: (node: TreeNode) => JSX.Element;
  brickDetailLogic: BrickDetailLogic;
  configureAppBrickDialogLogic: ConfigureAppBrickDialogLogic;
  addAppCustomBrick: (
    appId: string,
    params: {
      name: string;
      description?: string;
    },
  ) => Promise<{ id: string } | undefined>;
  renameAppCustomBrick: (
    brickId: string,
    params: { name: string },
  ) => Promise<boolean>;
  moveFileHandler: (fromPath: string, toPath: string) => Promise<void>;
  updateOpenFile?: (currFileId: string, nextFileId: string) => void;
  appLabEditorPanelLogic: AppLabEditorPanelLogic;
  onDuplicateConflict?: (params: OnDuplicateConflictParams) => void;
  duplicateFileDialogLogic?: DuplicateFileDialogLogic;
  importFileDialogLogic: ImportResourceLogic;
  openImportFileDialog: (params: { path?: string; isFolder?: boolean }) => void;
  /** See `AppLabEditSectionLogic.onMoveBlocked`. */
  onMoveBlocked?: (node: TreeNode) => void;
  onFileDragStart?: (nodes: TreeNode[]) => void;
  /**
   * Called when the user starts dragging a brick from the sidebar's
   * `BrickItem`. The drop pipeline in `AppLabEditSection` reads this to
   * route brick drops to pane A / B (same hit-test as file-tree drops).
   */
  onBrickDragStart?: (brick: BrickInstance) => void;
  onBrickDragEnd?: () => void;
  onDragOverFolderChange: (path: string) => void;
};
