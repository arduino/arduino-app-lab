import {
  BrickCreateUpdateRequest,
  BrickInstance,
} from '@cloud-editor-mono/infrastructure';
import { SelectableFileData } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import {
  OpenFilesStoreItem,
  OpenFilesStorePatch,
} from '../../../../../../common/hooks/files';

export interface EditorPanelLogicParams {
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
  sketchDataIsLoading: boolean;
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
   * Called by the editor panel when a file needs to be loaded into the
   * batch file-contents query (eg. when a never-selected tab is dragged
   * into the split pane). Removes the file from the pending list so its
   * code subject is instantiated and the editor can render its contents.
   */
  removeFileFromPending?: (fileId: string) => void;
  /**
   * Persisted per-app open-files record. Used (alongside
   * `filesContentLoaded`) by the split-view hydration effect to restore
   * pane B tabs/selection, both panes' per-file markdown render modes,
   * `isSplit`, and the split width on app load.
   */
  openFilesStore?: OpenFilesStoreItem | null;
  /**
   * True once `filesContents` are fully loaded. Hydration of split-view
   * state is gated on this so we resolve file ids against the real
   * `allFiles` catalogue (dropping entries that no longer exist).
   */
  filesContentLoaded?: boolean;
  /**
   * Patches split-related fields onto the per-app store record. Shallow
   * merges so callers can update one pane (or one field) without
   * clobbering the rest. Called from the split-view mirror effect and
   * the panel-resize handler.
   */
  storeSplitState?: (patch: OpenFilesStorePatch) => Promise<void>;
}
