import {
  CodeEditorText,
  FileNode,
  ImportResourceResult,
  TreeNode,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ArduinoAppFilesService {
  getAppFiles: (path: string) => Promise<{
    filesList: FileNode[];
    fileTree: TreeNode[];
  }>;
  // `suppressWatch` (defaults to true at the desktop impl) tells the backend to
  // ignore the filesystem events this mutation produces, so UI edits — which
  // already update state optimistically — don't trigger a self-refresh. Pass
  // false to let the watcher fire (e.g. the integrated agent writing files that
  // must refresh the editor).
  saveAppFile: (
    path: string,
    content: string,
    suppressWatch?: boolean,
  ) => Promise<void>;
  createAppFile: (
    path: string,
    content?: string,
    suppressWatch?: boolean,
  ) => Promise<void>;
  renameAppFile: (
    path: string,
    newName: string,
    nodeType?: 'file' | 'folder',
    suppressWatch?: boolean,
  ) => Promise<void>;
  moveAppFile: (
    fromPath: string,
    toPath: string,
    suppressWatch?: boolean,
  ) => Promise<void>;
  removeAppFile: (path: string, suppressWatch?: boolean) => Promise<void>;
  createAppFolder: (path: string, suppressWatch?: boolean) => Promise<void>;

  getAppFileTree(path: string): Promise<TreeNode[]>;
  getAppFileContent(path: string): Promise<string>;
  selectResourcePathToImport: (
    remoteDir: string,
    isFolder?: boolean,
  ) => Promise<string | string[] | null>;
  importResourceToAppFromPath(
    remoteDir: string,
    filePath: string,
    isFolder?: boolean,
    newFileName?: string,
    suppressWatch?: boolean,
  ): Promise<ImportResourceResult>;
  importDroppedResourceToApp: (
    callback: (items: { path: string; isFolder: boolean }[]) => void,
  ) => () => void;

  // Filesystem watching. Backends emit a "refresh" event (via WailsService)
  // when a watched surface changes; the frontend invalidates the related
  // queries. On non-desktop platforms these are no-ops.
  //
  // watchApp watches an open app recursively (content + tree + manifest);
  // watchAppsDir watches the apps root for apps added/removed/renamed.
  watchApp(path: string): Promise<void>;
  unwatchApp(path: string): Promise<void>;
  watchAppsDir(path: string): Promise<void>;
  unwatchAppsDir(path: string): Promise<void>;
  unwatchAll(): Promise<void>;
}

export interface BaseCodeChange {
  fileId: string;
  value: string;
  meta: {
    instanceId: string;
    initialChange: boolean;
    doc?: CodeEditorText;
    ext?: string;
    hash?: string;
    lineToScroll?: number;
  };
}

export type FileId = string;

export type SaveCode = (
  id: FileId,
  code: string,
  hash?: string,
) => Promise<
  { isUnsaved: true } | { newHash: string } | { errStatus: number } | void
>;

export interface CodeChangeWithCtx extends BaseCodeChange {
  context: {
    saveCode: SaveCode;
  };
}

export type CodeChange = BaseCodeChange | CodeChangeWithCtx;

export type CodeSubject = BehaviorSubject<CodeChange>;

export type CodeSubjectById<T> = T extends FileId
  ? BehaviorSubject<CodeChange>
  : Observable<never>;
export type CodeSubjectIdParam = FileId | undefined;

export type SetUnsavedFileTuple = [FileId, boolean];

export const isCodeChangeWithCtx = (
  change: CodeChange,
): change is CodeChangeWithCtx => {
  return !change.meta.initialChange && 'context' in change;
};

export const isEffectualEmission = (
  pair: [CodeChange, CodeChange],
): pair is [CodeChange, CodeChangeWithCtx] => {
  const [prev, curr] = pair;

  return valueHasChanged(prev, curr);
};

export const valueHasChanged = <
  X extends { value: string; meta: { doc?: CodeEditorText } },
  Y extends CodeChange,
>(
  prev: X,
  curr: Y,
): boolean => {
  // prefer comparison with CodeMirror Text.eq, it should be more robust
  // https://discuss.codemirror.net/t/editorview-updatelistener-efficient-way-to-check-of-editorview-state-doc-tostring-changed/5337/2
  return prev.meta.doc && curr.meta.doc
    ? !prev.meta.doc.eq(curr.meta.doc)
    : prev.value !== curr.value;
};

export type CodeSubjectInjection = Pick<CodeChange, 'fileId' | 'value'> & {
  initialContext: CodeChangeWithCtx['context'];
  isLibrary: boolean;
  lineToScroll?: number;
  fromAssist?: boolean;
};

// Why an open file's buffer was reloaded from disk. Kept intentionally coarse;
// extend as new triggers appear (consumers can act per cause — e.g. surface a
// "file changed on disk" hint for `external-change`).
export type CodeReloadCause = 'external-change' | 'refetch';

// Emitted when an open file's buffer is replaced from disk. The editor observes
// it to re-render (CodeMirror then reconciles the new instanceId); other
// consumers can react to specific causes. `id` is unique per emission, so two
// otherwise-identical events (same file, same cause) are distinguishable.
export type CodeReloadEvent = {
  id: string;
  fileId: string;
  cause: CodeReloadCause;
};

export type CodeSubjectSeed = {
  path: string;
  content: string;
  hash?: string;
};

// The single event the desktop backend emits when a watched surface changes.
// Its `kind` tells the frontend which queries/buffers to refresh. This is the
// canonical contract shared by every consumer (see `onWatcherRefresh`); the Go side's
// `RefreshPayload` (watcher.go) is the source of truth these mirror.
export const REFRESH_EVENT = 'refresh';

export type RefreshKind = 'file' | 'dir' | 'manifest' | 'apps';

// What happened to `path`. Lets consumers route a `dir` change to the matching
// file operation: `remove` closes the tab / prunes the folder, `create`/`write`
// just refetch the tree. A move/rename arrives as `remove` of the old path plus
// `create` of the new one — the backends can't correlate the two halves.
export type RefreshOp = 'create' | 'remove' | 'write';

export type RefreshEvent = {
  kind: RefreshKind;
  path: string;
  // Optional for backward compatibility with payloads emitted before ops were
  // added; treat a missing op as a non-specific change (refetch the tree).
  op?: RefreshOp;
};
