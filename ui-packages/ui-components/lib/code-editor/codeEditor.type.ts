import { EditorView } from '@codemirror/view';

import {
  CodeEditorText,
  GetCode,
  GetCodeExt,
  GetCodeInstanceId,
  GetCodeLastInjectionLine,
  GetFileId,
} from '../code-mirror/codeMirror.type';
import { GutterData } from '../code-mirror/codeMirrorViewInstances';

export type OnChangeHandlerSetCode = (newDoc: CodeEditorText) => void;
export type SaveCodeHandler = (newCode: string) => void;

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
  showReadOnlyBanner?: boolean;
  hasHeader?: boolean;
  hasTabs?: boolean;
};

export type SelectedStrings = {
  label?: string;
  from: number;
  to: number;
};
