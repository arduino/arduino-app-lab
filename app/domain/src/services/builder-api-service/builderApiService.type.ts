import { AgentPort } from '@cloud-editor-mono/create-agent-client-ts';
import {
  ArduinoBuilderExample_BuilderApi,
  ArduinoBuilderExampleFile_BuilderApi,
  ArduinoBuilderLibraryFile_BuilderApi,
  CompileSketch_Body,
  CompileSketch_Response,
  GetLibraries_Response,
  LibraryDetails_Response,
} from '@cloud-editor-mono/infrastructure';
import { FlavourOptions } from '@cloud-editor-mono/ui-components';
import { WebSerialPort } from '@cloud-editor-mono/web-board-communication';

export interface SelectableBoardInfo {
  id: string;
  name?: string;
  fqbn?: string;
  architecture?: string;
  isUnknownBoard?: boolean;
}

export type AddBoardInfoToPortResult = SelectableBoardInfo &
  (AgentPort | WebSerialPort);

export type MappedPort = AddBoardInfoToPortResult & { portBoardId: string };

export type CompileSketch_Body_WithCompleteSketch = Omit<
  CompileSketch_Body,
  'sketch'
> & {
  sketch: Exclude<CompileSketch_Body['sketch'], undefined>;
};

export const errorRegExGroupLiterals = ['filefullname', 'row', 'col'] as const;
export type ErrorRegExGroup = typeof errorRegExGroupLiterals[number];

export type ErrorRegExGroups_Result = {
  [K in ErrorRegExGroup]?: string;
};

export type ParsedError = Required<ErrorRegExGroups_Result>;

export const isCompleteParsedError = (
  groups: ErrorRegExGroups_Result,
): groups is ParsedError => {
  return (
    errorRegExGroupLiterals.every((property) => property in groups) &&
    Object.keys(groups).length === errorRegExGroupLiterals.length
  );
};

export type CompileErrors = ParsedError[];

export interface CompileSketch_ResponseDiagnostic {
  severity: string;
  message: string;
  file: string;
  line: number;
  column: number;
  context: {
    message: string;
    file: string;
  }[];
}
export interface CompileSketch_ResponseDerivatives {
  output: string;
  errors?: CompileErrors;
  warnLineStart?: number;
  warnLineEnd?: number;
  failed: boolean;
  settled: boolean;
  outputLineEnd: number;
}

export interface UnexpectedErrorBuildParams {
  errorMessage?: string;
  stdout?: string;
  stderr?: string;
}

export type CompileSketch_Result = CompileSketch_Response &
  CompileSketch_ResponseDerivatives;

export interface GetUploadInfoPayload {
  fqbn: string;
  agentOS: string;
}

export type RetrieveExampleFileContentsResult = Omit<
  ArduinoBuilderExampleFile_BuilderApi,
  'name' | 'data' | 'path'
> & {
  name: string;
  fullName: string;
  data: string;
  path: string;
  href: string;
  content: string;
  scopedContent?: string;
  extension: string;
  exampleInoPath?: string;
};

// A reference to an example to fetch contents
export type CompleteExampleFileRef = Required<
  Omit<ArduinoBuilderExampleFile_BuilderApi, 'mimetype' | 'href' | 'data'>
>;

const isCompleteExampleFileRef = (
  data: ArduinoBuilderExampleFile_BuilderApi,
): data is CompleteExampleFileRef => {
  return Boolean(data.name && data.path);
};

export type CompleteExample = Required<
  Omit<ArduinoBuilderExample_BuilderApi, 'files'>
> & {
  ino: CompleteExampleFileRef;
  files?: CompleteExampleFileRef[];
};

export const isCompleteExample = (
  data: ArduinoBuilderExample_BuilderApi,
): data is CompleteExample => {
  return isCompleteExampleFileRef(data);
};

export type GetLibrariesResult = GetLibraries_Response & {
  fromParams: string;
};

export type CompleteLibraryDetailsResult = Omit<
  LibraryDetails_Response,
  'examples'
> & { examples?: CompleteExample[] };

export type RetrieveLibraryFileContentsResult = Omit<
  ArduinoBuilderLibraryFile_BuilderApi,
  'name' | 'data' | 'path' | 'href'
> & {
  name: string;
  fullName: string;
  data: string;
  path: string;
  content: string;
  extension: string;
};

export type BoardFlavourOptions = FlavourOptions;

export type OnStreamStdMsg = (
  type: 'out' | 'err',
  timestamp: string,
  line: string,
) => void;
export type OnStreamStatus = (status: string) => void;
export type OnStreamProgress = (progress: number) => void;
export type OnStreamResult = (
  diagnostics: CompileSketch_ResponseDiagnostic[] | undefined,
  builderError: string | undefined,
) => void;
