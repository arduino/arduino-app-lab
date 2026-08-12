import { Annotation, Extension } from '@codemirror/state';
import { Text } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { FileNode } from '../file-tree';
import { GutterData, ViewInstances } from './codeMirrorViewInstances';
import { KeywordMap } from './extensions/keywords/keywords.type';
import { LspClientRef } from './extensions/lsp/lsp-client/lsp-client-types';
import { LspId, LspMessage } from './extensions/lsp/lsp-types';
import { CodeEditorOnChangeType } from './utils';

export type GetCode = () => string | undefined;

export type GetCodeExt = () => string | undefined;

export type GetFileId = () => string | undefined;

export type GetCodeInstanceId = GetCode;

export type GetCodeLastInjectionLine = () => number | undefined;

export type CodeEditorText = Text;

export type GutterDataWithFontSize = GutterData & { fontSize: number };

export type LspState =
  | {
      type: 'idle' | 'initializing' | 'ready';
    }
  | {
      // `message` carries the backend's reason verbatim so remediation text
      // lives in one place (the Go error) rather than being duplicated here.
      // Absent when the failure has no reason we can show.
      type: 'error';
      message?: string;
    }
  | {
      type: 'progress';
      progress?: number;
    };

export interface UseCodeEditorParams {
  viewInstanceId: ViewInstances;
  getValueInstanceId?: GetCodeInstanceId;
  getExt?: GetCodeExt;
  getValue?: GetCode;
  getCodeLastInjectionLine?: GetCodeLastInjectionLine;
  getFileId?: () => string | undefined;
  onChange?: CodeEditorOnChangeType;
  errorLines?: number[];
  highlightLines?: number[];
  extensions?: Extension[];
  keywords?: KeywordMap;
  keywordsExt?: string;
  onReceiveViewInstance?: (viewInstance: EditorView | null) => void;
  hasHeader?: boolean;
  readOnly?: boolean;
  gutter?: GutterDataWithFontSize;
  useScrollPastEnd?: boolean;
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
  /**
   * Write a file's full content to the app's content store, keyed by its
   * workspace-relative id. Used to apply a server-initiated edit (cross-file
   * rename, code action) to a file that is not open, without forcing it open.
   */
  setLspFileValue?: (fileId: string, value: string) => boolean;
  /**
   * Create and populate a file's content subject without selecting it, resolving
   * to the content it now holds. Lets a server-initiated edit reach a file that
   * was never opened, which is otherwise impossible: the store creates subjects
   * lazily on first open.
   */
  ensureLspFileValue?: (fileId: string) => Promise<string | undefined>;
  getActivePane?: () => 'A' | 'B';
  onLspStateChange?: (lspId: LspId, state: LspState) => void;
}

export enum CodeMirrorEventAnnotation {
  FileTabLoaded = 'fileTabLoaded',
  ContextMenuAction = 'contextMenuAction',
  OutputPanelUpdate = 'outputPanelUpdate',
  SearchPanelUpdate = 'searchPanelUpdate',
}

export type CodeMirrorEventAnnotationMap = {
  [K in CodeMirrorEventAnnotation]: Annotation<CodeMirrorEventAnnotation>;
};

export type CodeMirrorViewInstanceAnnotationMap = {
  [K in ViewInstances]: Annotation<CodeMirrorEventAnnotation>;
};

export type CodeMirrorEventAnnotationSideEffects = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in CodeMirrorEventAnnotation]: (...args: any) => any;
};
