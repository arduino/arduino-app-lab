import {
  CodeEditorText,
  FileNode,
  TreeNode,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ArduinoAppFilesService {
  getAppFileTree(path: string): Promise<TreeNode[]>;
  getAppFiles: (path: string) => Promise<{
    filesList: FileNode[];
    fileTree: TreeNode[];
  }>;
  getAppFileContent(path: string): Promise<string>;
  saveAppFile: (path: string, content: string) => Promise<void>;
  createAppFile: (path: string, content?: string) => Promise<void>;
  renameAppFile: (path: string, newName: string) => Promise<void>;
  removeAppFile: (path: string) => Promise<void>;
  createAppFolder: (path: string) => Promise<void>;
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

export type ArduinoAppFile = FileNode & {
  id: string;
  content: string;
  hash?: string;
};
