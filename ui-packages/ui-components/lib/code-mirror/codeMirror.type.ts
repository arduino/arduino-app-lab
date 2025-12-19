import { Annotation, Extension } from '@codemirror/state';
import { Text } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { GutterData, ViewInstances } from './codeMirrorViewInstances';
import { KeywordMap } from './extensions/keywords/keywords.type';
import { CodeEditorOnChangeType } from './utils';

export type GetCode = () => string | undefined;

export type GetCodeExt = () => string | undefined;

export type GetFileId = () => string | undefined;

export type GetCodeInstanceId = GetCode;

export type GetCodeLastInjectionLine = () => number | undefined;

export type CodeEditorText = Text;

export type GutterDataWithFontSize = GutterData & { fontSize: number };

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
