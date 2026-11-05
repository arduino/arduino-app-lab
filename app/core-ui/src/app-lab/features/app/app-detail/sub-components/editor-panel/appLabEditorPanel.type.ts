import {
  AppBrickListItem,
  BrickCreateUpdateRequest,
} from '@cloud-editor-mono/infrastructure';
import {
  CodeEditorLogic,
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
  appBricks?: AppBrickListItem[];
  selectedFile?: SelectableFileData;
  selectFile: (params: {
    fileId?: string;
    openAtIndex?: number;
    isPreview?: boolean;
  }) => void;
  selectableMainFile?: SelectableFileData;
  previewFileId?: string;
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
   * routing a file-tree drop into panel B for a file that isn't yet open
   * in either panel. Optional for backwards compatibility — when omitted,
   * panel-B opens only work for files already present in one of the panels'
   * tab lists.
   */
  allFiles?: SelectableFileData[];
  readOnly: boolean;
  /**
   * Ensures a file's content is loaded into the editor's content store.
   * Called when a tab is opened or dragged into a panel before its content
   * has been fetched. No-op if the content is already cached.
   */
  fetchFile?: (fileId: string) => Promise<unknown>;
  /** The file of panel B's selected tab could not be read. */
  onFileLoadError?: (fileId: string, error: unknown) => void;
  /** Whether a tab names a file to read; without it, every tab but a brick does. */
  canReadTab?: (fileId: string) => boolean;
  /**
   * Persisted per-app open-files record. Used (alongside `tabsHydrated`) by
   * the split-view hydration effect to restore panel B tabs/selection, both
   * panels' per-file markdown render modes, `isSplit`, and the split width on
   * app load.
   */
  openFilesStore?: OpenFilesStoreItem | null;
  /**
   * Panel A's stored tabs are in place. The split view is restored from the
   * same record after them, and reset when they reset.
   */
  tabsHydrated?: boolean;
  /**
   * Patches split-related fields onto the per-app store record. Shallow
   * merges so callers can update one panel (or one field) without
   * clobbering the rest. Called from the split-view mirror effect and
   * the panel-resize handler.
   */
  storeSplitState?: (patch: OpenFilesStorePatch) => Promise<void>;
  onLspStateChange?: (lspId: LspId, state: LspState) => void;
  onToggleAgentPanel?: VoidFunction;
  agentPanelOpen?: boolean;
} & Pick<
  UseLSP,
  | 'isLspEnabled'
  | 'lspWorkspaceDir'
  | 'lspClients'
  | 'startLSP'
  | 'sendLspMessage'
  | 'subscribeLspMessages'
  | 'getLspWorkspaceFile'
> &
  Pick<ReturnType<CodeEditorLogic>, 'showLspReferences' | 'closeLspReferences'>;
