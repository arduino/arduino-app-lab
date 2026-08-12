import {
  ApplyWorkspaceEditParams,
  ClientCapabilities,
  CodeAction,
  CodeActionParams,
  Command,
  CompletionList,
  DefinitionParams,
  Diagnostic,
  DidChangeTextDocumentParams,
  DidChangeWatchedFilesParams,
  DocumentFormattingParams,
  DocumentHighlight,
  DocumentHighlightParams,
  DocumentRangeFormattingParams,
  ExecuteCommandParams,
  FileEvent,
  InitializeParams,
  Location,
  LogMessageParams,
  Position,
  ProgressToken,
  PublishDiagnosticsParams,
  Range,
  ReferenceParams,
  RenameParams,
  RequestMessage,
  ResponseMessage,
  ServerCapabilities,
  ShowMessageParams,
  ShowMessageRequestParams,
  TextDocumentContentChangeEvent,
  TextDocumentEdit,
  TextEdit,
  WorkDoneProgressBegin,
  WorkDoneProgressEnd,
  WorkDoneProgressReport,
  WorkspaceEdit,
} from 'vscode-languageserver-protocol';

import { LSP_LANGS } from './lsp-consts';
export type LspId =
  | 'arduino'
  | 'python'
  | 'typescript'
  | 'html'
  | 'css'
  | 'yaml';

export type LspLang = keyof typeof LSP_LANGS;

export type NodeType = 'file' | 'folder';

/**
 * vscode-languageserver types
 */
export type LspRequestMessage = RequestMessage;
export type LspResponseMessage = ResponseMessage & { method?: string };
export type LspMessage = LspRequestMessage | LspResponseMessage;
export type LspLocation = Location;
export type LspPosition = Position;
export type LspRange = Range;
export type LspDefinitionParams = DefinitionParams;
export type LspReferenceParams = ReferenceParams;
export type LspRenameParams = RenameParams;
export type LspDocumentFormattingParams = DocumentFormattingParams;
export type LspDocumentRangeFormattingParams = DocumentRangeFormattingParams;
export type LspTextDocumentEdit = TextDocumentEdit;
export type LspTextEdit = TextEdit;
export type LspWorkspaceEdit = WorkspaceEdit;
export type LspDidChangeTextDocumentParams = DidChangeTextDocumentParams;
export type LspDidChangeWatchedFilesParams = DidChangeWatchedFilesParams;
export type LspFileEvent = FileEvent;
export type LspTextDocumentContentChangeEvent = TextDocumentContentChangeEvent;
export type LspDiagnostic = Diagnostic;
export type LspPublishDiagnosticsParams = PublishDiagnosticsParams;
export type LspCodeAction = CodeAction;
export type LspCodeActionParams = CodeActionParams;
export type LspCommand = Command;
export type LspExecuteCommandParams = ExecuteCommandParams;
export type LspApplyWorkspaceEditParams = ApplyWorkspaceEditParams;
export type LspCompletionList = CompletionList;
export type LspDocumentHighlight = DocumentHighlight;
export type LspDocumentHighlightParams = DocumentHighlightParams;
export type LspServerCapabilities = ServerCapabilities;
export type LspClientCapabilities = ClientCapabilities;
export type LspShowMessageParams = ShowMessageParams;
export type LspShowMessageRequestParams = ShowMessageRequestParams;
export type LspLogMessageParams = LogMessageParams;
export type LspInitializeParams = InitializeParams;
export type LspWorkDoneProgress =
  | WorkDoneProgressBegin
  | WorkDoneProgressReport
  | WorkDoneProgressEnd;
export type LspProgressParams = {
  token: ProgressToken;
  value: LspWorkDoneProgress;
};
