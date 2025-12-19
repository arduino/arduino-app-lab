import {
  CodeSubjectById,
  CodeSubjectInjection,
  CompileErrors,
  FileId,
  GetSketchesResult,
  ParsedError,
  RetrieveExampleFileContentsResult,
  RetrieveFileContentsResult,
  SaveCode,
} from '@cloud-editor-mono/domain/src/services/services-by-app/shared';
import {
  ApplyPatchAvailability,
  CodeEditorText,
  OnChangeHandlerSetCode,
  OnClickApplyFixToSketch,
  OnClickApplySketch,
  OnClickInclude,
  SelectableFileData,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/shared';
import { Subject } from 'rxjs';

import { UseCodeFormatter } from './queries/codeFormatter';
import {
  SaveSketchFileMutation,
  UseCreateSketchFromExisting,
} from './queries/create.type';

export type UseCodeChange = (
  saveSketchFileQuery: SaveSketchFileMutation,
  selectFile: (fileId?: string) => void,
  codeInjectionsSubjectNext: (
    fileId: CodeSubjectInjection['fileId'],
    value: CodeSubjectInjection['value'],
    initialContext: CodeSubjectInjection['initialContext'],
    isLibrary: boolean,
    lineToScroll?: number,
    fromAssist?: boolean,
  ) => boolean | undefined,
  getCodeSubjectById: <T>(id: T) => CodeSubjectById<T>,
  codeSubjectNext: (
    fileId: FileId,
    value: string,
    saveCode: SaveCode,
    doc?: CodeEditorText,
    shouldUpdate?: boolean,
    newHash?: string,
    lineToScroll?: number,
    fromAssist?: boolean,
  ) => void,
  getUnsavedFilesSubject: () => Subject<Set<FileId>>,
  updateCodeSubjectHash: (
    fileId: FileId,
    value: string,
    saveCode: SaveCode,
    newHash?: string,
  ) => void,
  useCreateSketchFromExisting: UseCreateSketchFromExisting,
  retrieveSketches: (search?: string) => Promise<GetSketchesResult>,
  isLibraryRoute: boolean,
  isExampleSketchRoute: boolean,
  isReadOnly: boolean,
  selectedFile?: SelectableFileData,
  mainFile?: SelectableFileData,
  compileErrors?: CompileErrors,
  compileErrorsTimestamp?: React.MutableRefObject<number | undefined>,
  tabs?: SelectableFileData[],
  exampleInoData?: RetrieveExampleFileContentsResult,
  exampleFilesData?: RetrieveExampleFileContentsResult[],
  customLibraryFiles?: RetrieveFileContentsResult[],
) => {
  setCode: OnChangeHandlerSetCode;
  formatCode: ReturnType<UseCodeFormatter>['formatCode'];
  codeIsFormatting: boolean;
  handleLibraryIncludeCode: OnClickInclude;
  handleGenAiApplyCode: OnClickApplySketch;
  handleGenAiApplyFixToCode: OnClickApplyFixToSketch;
  handleApplyPatchAvailability: ApplyPatchAvailability;
  errorLineData?: ParsedError;
  saveAllFiles: () => void;
  saveFile: (fileId: string) => Promise<void>;
  saveCode: SaveCode;
};
