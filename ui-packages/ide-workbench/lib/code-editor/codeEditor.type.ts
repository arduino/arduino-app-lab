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
import { LspReferencesPanelActions } from '../code-mirror/extensions/lsp/lsp-references/lsp-references-types';

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

/**
 * The host's clipboard. Injected rather than imported: the editor runs in a
 * browser tab, in a desktop shell with a native clipboard bridge, and (soon) in
 * hosts outside this repo, and it must not know which.
 *
 * When no clipboard is injected the editor falls back to `navigator.clipboard`
 * (see `browserClipboard`).
 */
export type EditorClipboard = {
  /** Resolves to `null` when there is nothing to paste, or on failure. */
  readText: () => Promise<string | null>;
  writeText: (text: string) => Promise<void>;
  /**
   * Set when `readText` is not a trustworthy paste source — a desktop shell
   * whose system-clipboard read can prompt the user or come back empty. The
   * editor then mirrors every copy and cut (from its menu and from the
   * browser's own copy/cut events) into an in-memory clipboard, pastes from
   * that mirror, and calls `readText` only to refresh it when the menu opens.
   */
  preferInMemoryPaste?: boolean;
};

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
   * The host's clipboard, used by the editor's context menu. Defaults to
   * `navigator.clipboard` when omitted.
   */
  clipboard?: EditorClipboard;
  /**
   * Open a URL outside the editor — used by the Language Server's hover links,
   * which point at vendor documentation. Hosts that cannot leave the current
   * surface omit it and the links stay inert.
   */
  openExternalLink?: (url: string) => void;
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
  getActiveEditorPanel?: () => 'A' | 'B';
  onLspStateChange?: (lspId: LspId, state: LspState) => void;
} & LspReferencesPanelActions;

export type SelectedStrings = {
  label?: string;
  from: number;
  to: number;
};
