import {
  CreateSketch_Response,
  EditSketchesV2Payload_CreateApi,
  GetCustomLibrary_Response,
  GetFile_ResponseWithContents,
  GetFile_ResponseWithName,
  GetFilesList_Response,
  GetSketch_Params,
  GetSketch_Response,
} from '@cloud-editor-mono/infrastructure';
import { CodeEditorText } from '@cloud-editor-mono/ui-components/lib/components-by-app/shared';
import { BehaviorSubject, Observable } from 'rxjs';

export type GetSketchResult = { owner: string } & GetSketch_Response;

export type GetSketchesResult = GetSketchResult[];

export type CreateSketchResult = { owner: string } & CreateSketch_Response;

export type RetrieveFileContentsResult = Pick<
  GetFile_ResponseWithName & GetFile_ResponseWithContents,
  'mimetype' | 'path' | 'data' | 'href'
> & {
  name: string;
  fullName: string;
  content: string;
  scopedContent?: string;
  extension: string;
  hash?: string;
  modifiedAt?: string;
};

export type RetrieveFileContentsResultWithData = Omit<
  RetrieveFileContentsResult,
  'data'
> & { data: string };

export type RetrieveFilesListResult = GetFilesList_Response;

export type SketchUserId = 'me';
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

export type AssociateSketchWithDevicePayload = GetSketch_Params &
  Required<
    Pick<
      EditSketchesV2Payload_CreateApi,
      'board_fqbn' | 'board_name' | 'board_type'
    >
  >;

export type MarkSketchVisibilityPayload = GetSketch_Params &
  Required<Pick<EditSketchesV2Payload_CreateApi, 'is_public'>>;

export type AssociateSketchWithLibrariesPayload = GetSketch_Params &
  Required<Pick<EditSketchesV2Payload_CreateApi, 'libraries'>>;

export type GetCustomLibraryResult = {
  owner?: string;
} & GetCustomLibrary_Response;

export type GetLibrariesListResult = GetCustomLibraryResult[];
