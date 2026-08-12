import {
  BrickCreateUpdateRequest,
  BrickInstance,
} from '@cloud-editor-mono/infrastructure';
import {
  FileNode,
  LspId,
  LspState,
  SelectableFileData,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import {
  OpenFilesStoreItem,
  OpenFilesStorePatch,
} from '../../../../../../common/hooks/files';
import { UseLSP } from '../../hooks/useLSP';

export type EditorPanelLogicParams = {
  appId?: string;
  appPath?: string;
  appBricks?: BrickInstance[];
  selectedFile?: SelectableFileData;
  selectFile: (params: {
    fileId?: string;
    openAtIndex?: number;
    isPreview?: boolean;
  }) => void;
  selectableMainFile?: SelectableFileData;
  previewFileId?: string;
  unsavedFileIds?: Set<string>;
  closeFile: (fileId: string) => void;
  updateOpenFilesOrder: (fileIds: string[], draggedFileId?: string) => void;
  deleteAppFile: (path: string, nodeType?: 'file' | 'folder') => Promise<void>;
  renameAppFile: (
    path: string,
    newName: string,
    nodeType?: 'file' | 'folder',
  ) => Promise<void>;
  addAppFile: (
    path: string,
    fileName: string,
    fileExtension: string,
  ) => Promise<void>;
  initialAppBrickTab?: string;
  updateAppBrick: (
    brickId: string,
    params: BrickCreateUpdateRequest,
  ) => Promise<boolean>;
  openFiles: SelectableFileData[];
  /**
   * Full catalogue of files that can be opened in the editor (project
   * files + sketch secrets + bricks). Used as a fallback resolver when
   * routing a file-tree drop into pane B for a file that isn't yet open
   * in either pane. Optional for backwards compatibility — when omitted,
   * pane-B opens only work for files already present in one of the panes'
   * tab lists.
   */
  allFiles?: SelectableFileData[];
  readOnly: boolean;
  /**
   * Ensures a file's content is loaded into the editor's content store.
   * Called when a tab is opened or dragged into a pane before its content
   * has been fetched. No-op if the content is already cached.
   */
  fetchFile?: (fileId: string) => Promise<unknown>;
  /**
   * Persisted per-app open-files record. Used (alongside
   * `filesContentLoaded`) by the split-view hydration effect to restore
   * pane B tabs/selection, both panes' per-file markdown render modes,
   * `isSplit`, and the split width on app load.
   */
  openFilesStore?: OpenFilesStoreItem | null;
  /**
   * True once the file tree (catalogue) is known. Gates split-view
   * hydration so persisted pane references can be pruned against the
   * current `allFiles` catalogue.
   */
  filesContentLoaded?: boolean;
  /**
   * Patches split-related fields onto the per-app store record. Shallow
   * merges so callers can update one pane (or one field) without
   * clobbering the rest. Called from the split-view mirror effect and
   * the panel-resize handler.
   */
  storeSplitState?: (patch: OpenFilesStorePatch) => Promise<void>;
  filesList?: FileNode[];
  onLspStateChange?: (lspId: LspId, state: LspState) => void;
} & Pick<
  UseLSP,
  | 'isLspEnabled'
  | 'lspWorkspaceDir'
  | 'lspClients'
  | 'startLSP'
  | 'sendLspMessage'
  | 'subscribeLspMessages'
  | 'getLspWorkspaceFile'
>;
