import { EditorView } from '@codemirror/view';

import { LspClientRef, LspId, LspMessage } from '../code-mirror';
import {
  CodeEditorText,
  GetCode,
  GetCodeExt,
  GetCodeInstanceId,
  GetCodeLastInjectionLine,
  GetFileId,
  LspState,
} from '../code-mirror/codeMirror.type';
import { GutterData } from '../code-mirror/codeMirrorViewInstances';
import { FileNode } from '../file-tree';

export type OnChangeHandlerSetCode = (newDoc: CodeEditorText) => void;
export type SaveCodeHandler = (newCode: string) => void;

/**
 * Identifies which notice to float over the editor. The editor is a
 * single-slot surface, so the host picks one kind at a time and supplies the
 * matching contents through `renderBanner`.
 *
 * Deliberately an open string: the vocabulary belongs to the host, not to the
 * editor, so a new notice needs no change here. `CodeEditor` renders whatever
 * `renderBanner` returns for the current kind and nothing when it returns
 * `undefined`, which also lets a host ignore kinds it doesn't handle.
 *
 * App Lab currently uses `'read-only'`.
 */
export type EditorBannerKind = string;

export type CodeEditorLogic = () => {
  getCodeInstanceId?: GetCodeInstanceId;
  getCode?: GetCode;
  getCodeExt?: GetCodeExt;
  getCodeLastInjectionLine?: GetCodeLastInjectionLine;
  getFileId?: GetFileId;
  setCode: OnChangeHandlerSetCode;
  sketchDataIsLoading?: boolean;
  codeInstanceIds: string[];
  errorLines?: number[];
  highlightLines?: number[];
  onReceiveViewInstance?: (viewInstance: EditorView | null) => void;
  fontSize: number;
  gutter?: GutterData;
  readOnly: boolean; // no code editing and no context menu
  /**
   * Which notice, if any, to float over the editor. The host supplies the
   * matching contents via `renderBanner` — see `EditorBannerKind`.
   *
   * Only for notices that must stay on screen as long as the condition holds.
   * A one-off "heads up" about the file you just opened belongs in a snackbar
   * instead, so it doesn't permanently consume editor space.
   */
  banner?: EditorBannerKind;
  hasHeader?: boolean;
  hasTabs?: boolean;
  useScrollPastEnd?: boolean;
  fileError?: Error;
  isLspEnabled?: boolean;
  lspWorkspaceDir?: string;
  lspClients?: Map<LspId, LspClientRef>;
  filesList?: FileNode[];
  selectFile?: (params: {
    fileId?: string;
    openAtIndex?: number;
    isPreview?: boolean;
  }) => void;
  startLSP?: (lspId: LspId, workspaceDir: string) => Promise<void>;
  sendLspMessage?: (lspId: LspId, message: LspMessage) => Promise<void>;
  subscribeLspMessages?: (
    lspId: LspId,
    onMessage: (message: LspMessage) => void,
  ) => () => void;
  getLspWorkspaceFile?: (fileUri: string) => Promise<string>;
  setLspFileValue?: (fileId: string, value: string) => boolean;
  ensureLspFileValue?: (fileId: string) => Promise<string | undefined>;
  getActivePane?: () => 'A' | 'B';
  onLspStateChange?: (lspId: LspId, state: LspState) => void;
};

export type SelectedStrings = {
  label?: string;
  from: number;
  to: number;
};
