import { UploadStatus } from '@cloud-editor-mono/board-communication-tools';
import { FileLineScope } from '@cloud-editor-mono/common';
import { UploadToAgentPortPayload } from '@cloud-editor-mono/create-agent-client-ts';
import {
  CompileErrors,
  CompileSketch_Body_WithCompleteSketch,
  CompileSketch_Result,
  CompleteExample,
  CompleteExampleFileRef,
  CompleteLibraryDetailsResult,
  GetUploadInfoPayload,
  RetrieveExampleFileContentsResult,
  RetrieveLibraryFileContentsResult,
} from '@cloud-editor-mono/domain';
import {
  ArduinoBuilderV2CompilationsResponse_BuilderApi,
  GetBoardByFqbn_Response,
  GetBoards_Response,
  GetFavoriteLibraries_Response,
  GetLibraries_Params,
  GetLibraries_Response,
  GetLibrary_Params,
  LibrariesItem_Response,
} from '@cloud-editor-mono/infrastructure';
import { SetFavoriteLibrary } from '@cloud-editor-mono/ui-components';
import {
  UploadToWebSerialPortPayload,
  WebSerialPortName,
} from '@cloud-editor-mono/web-board-communication';
import {
  FetchNextPageOptions,
  InfiniteQueryObserverResult,
} from '@tanstack/react-query';

import { CoreCommandType } from '../../../cloud-editor/features/main/main.type';
import { Progression } from './iot.type';

export type UseGetBoardByFqbn = (
  enabled: boolean,
  fqbn?: string,
) => {
  board?: GetBoardByFqbn_Response;
  isLoading: boolean;
};

export interface UseVerifyVariables {
  compilePayload: CompilePayload;
  computePayload?: GetUploadInfoPayload;
  partialUploadPayload?: Partial<UploadToPortPayload>;
}

export type UseVerifySketch = (
  onSuccess?: (
    data: CompileSketch_Result,
    variables?: UseVerifyVariables,
    context?: void | undefined,
  ) => void,
  onError?: (
    error: unknown,
    variables?: UseVerifyVariables,
    context?: void | undefined,
  ) => void,
) => {
  isVerifying: boolean;
  compileHasFailed: boolean;
  continuePreviousCompilationById: (
    data: ArduinoBuilderV2CompilationsResponse_BuilderApi,
  ) => void;
  compileSketchResponseData?: CompileSketch_Result;
  reset: (notify?: boolean, sketchId?: string) => void;
  createCompilation: (payload: CompilePayload) => void;
  createdSketchCompilation?: ArduinoBuilderV2CompilationsResponse_BuilderApi;
  compileProgress?: Progression;
  compileResultMessages?: string;
  errorFiles?: string[];
};
export type UseCompileComputeUpload = (
  agentEnabled: boolean,
  onUploadStart?: () => void,
) => {
  isCompiling: boolean;
  isComputing: boolean;
  isUploading: boolean;
  compileHasFailed: boolean;
  compilationProgress?: Progression;
  compileOutput?: string;
  compileErrors?: CompileErrors;
  compileWarnLineStart?: number;
  compileWarnLineEnd?: number;
  uploadOutputLineStart?: number;
  uploadOutput?: UploadStatus;
  compileComputeAndUpload: (
    payload: CompileComputeAndUploadPayload,
    existingCompilation?: ArduinoBuilderV2CompilationsResponse_BuilderApi,
  ) => void;
  reset: (notify?: boolean) => void;
  compileResultMessages?: string;
  errorFiles?: string[];
};

export type CompilePayload = CompileSketch_Body_WithCompleteSketch & {
  hasSecretsIncludeInjected: boolean;
  commandType?: CoreCommandType;
  shouldCache?: boolean;
};

type UploadToPortPayload = Omit<UploadToAgentPortPayload, 'port'> & {
  port: string | WebSerialPortName;
};

export interface CompileComputeAndUploadPayload {
  compilePayload: CompilePayload;
  computePayload: GetUploadInfoPayload;
  partialUploadPayload: Partial<UploadToPortPayload>;
}

export type ComputeAndUploadPayload = Omit<
  CompileComputeAndUploadPayload,
  'compilePayload'
>;

export const uploadAgentPayloadIsComplete = (
  payload: Partial<UploadToPortPayload>,
): payload is UploadToAgentPortPayload => {
  return Boolean(
    payload.compileData && payload.fqbn && payload.port && payload.sketchName,
  );
};

export const uploadWebSerialPayloadIsComplete = (
  payload: Partial<UploadToPortPayload>,
): payload is UploadToWebSerialPortPayload => {
  return Boolean(
    payload.compileData && payload.fqbn && payload.port && payload.sketchName,
  );
};

export type UseGetBoardsList = (enabled?: boolean) => {
  data?: GetBoards_Response;
  isLoading: boolean;
};

export type UseGetLibraries = (
  params: GetLibraries_Params,
  enabled?: boolean,
) => {
  libraries?: LibrariesItem_Response[];
  isLoading: boolean;
  setFavorite: SetFavoriteLibrary;
  isFetchingNextPage: boolean;
  fetchNextPage: (
    options?: FetchNextPageOptions | undefined,
  ) => Promise<InfiniteQueryObserverResult<GetLibraries_Response, unknown>>;
  hasNextPage?: boolean;
  fromParams?: string;
};

export interface SetFavouriteLibraryPayload {
  library: LibrariesItem_Response;
  asFavorite: boolean;
}

export interface SetFavouriteLibraryContext {
  previousLibraries: GetFavoriteLibraries_Response;
}

export type UseGetFavoriteLibraries = (enabled?: boolean) => {
  data?: GetFavoriteLibraries_Response;
  isLoading: boolean;
  isError: boolean;
  setFavorite: SetFavoriteLibrary;
};

export type UseGetLibrary = (
  params: GetLibrary_Params | { id: undefined; isLatest?: boolean },
  enabled: boolean,
) => {
  library?: CompleteLibraryDetailsResult;
  isLoading: boolean;
  refetch: () => void;
  isError: boolean;
};

export type UseGetExamples = (enableGetExamples?: boolean) => {
  examples: CompleteExample[];
  isLoading: boolean;
  isError: boolean;
};

export type UseRetrieveExampleInoContents = <T extends CompleteExampleFileRef>(
  enabled: boolean,
  exampleIno?: T,
  scope?: FileLineScope,
) => {
  isLoading: boolean;
  exampleInoContents?: RetrieveExampleFileContentsResult;
};

export type UseRetrieveExampleFileContents = <T extends CompleteExampleFileRef>(
  enabled: boolean,
  onSuccess?: (data: RetrieveExampleFileContentsResult) => void,
  exampleInoPath?: string,
  exampleFiles?: (T | undefined)[],
) => {
  exampleFileContents: RetrieveExampleFileContentsResult[];
  allContentsRetrieved: boolean;
  refetchAll: () => void;
};

export type UseRetrieveLibraryFileContents = <
  F extends { path: string; name: string; href: string },
  L extends { path?: string; files?: F[] },
>(
  enabled: boolean,
  library?: L,
  onAllSuccess?: (files: RetrieveLibraryFileContentsResult[]) => void,
) => {
  isLoading: boolean;
  libraryFilesContents?: RetrieveLibraryFileContentsResult[];
};
