import { Config } from '@cloud-editor-mono/common';

import {
  httpDelete,
  httpGet,
  httpGetRaw,
  httpPost,
  httpPut,
} from '../fetch/fetch';
import { EventSourceHandlers, getEventSource } from '../fetch-event-source';
import {
  ArduinoBuilderBoard_BuilderApi,
  ArduinoBuilderBoardscomputev3_BuilderApi,
  ArduinoBuilderBoardsv3_BuilderApi,
  ArduinoBuilderBoardv3Full_BuilderApi,
  BoardsCompute_Body,
  BoardsCompute_Params,
  Compute_Response,
  GetBoardByFqbn_Params,
  GetBoardByFqbn_Response,
  GetBoards_Response,
  GetBoardsByVidPid_Params,
  GetBoardsByVidPid_Response,
} from './builderApi.boards.type';
import {
  ArduinoBuilderV2CancelCompilation_Params,
  ArduinoBuilderV2CompilationOutput_Params,
  ArduinoBuilderV2CompilationOutputResponse_BuilderApi,
  ArduinoBuilderV2CompilationsResponse_BuilderApi,
  ArduinoBuilderV2CompilationStream_Params,
  CompileSketch_Body,
  CompileSketch_Response,
} from './builderApi.compilations.type';
import {
  ArduinoBuilderExampleFile_BuilderApi,
  BuiltinExampleDetailResponse,
  BuiltinExampleFile,
  GetExampleFileContents_Params,
  GetExampleFileContents_Response,
  GetExamples_Params,
  GetExamples_Response,
} from './builderApi.examples.type';
import {
  FavoriteLibrary_Params,
  GetFavoriteLibraries_Response,
  GetLibraries_Params,
  GetLibraries_Response,
  GetLibraries_Response_New,
  GetLibrary_Params,
  IsFavoriteLibrary,
  Library,
  LibraryDetails_Response,
  ReleaseFilesResponse,
} from './builderApi.libraries.type';
import {
  mapBuilderCompilationOutputNormalizeV2toV1Response,
  mapComputeUploadToBoardByFqbn,
  mapGetBoardByFqbn,
  mapGetBoards,
  mapGetBoardsByVidPid,
  mapGetExampleFileContentsResponse,
  mapGetExamplesDataResponse,
  mapGetLibrariesNewToLegacy,
  mapSketchCompilationResponse,
} from './mapper';

// const BOARDS_ENDPOINT = '/boards/v1/boards';

export function builderAliveRequest(token: string): Promise<Response | void> {
  const endpoint = '/alive';
  return httpGetRaw(Config.BUILDER_API_V2_URL, endpoint, token);
}

export async function getBoardsRequest(): Promise<GetBoards_Response> {
  const response = await httpGet<ArduinoBuilderBoardsv3_BuilderApi>(
    Config.BOARDS_API_URL,
    undefined,
    '',
  );

  if (!response) {
    throw new Error(
      `Call to "${Config.BUILDER_API_URL}" did not respond with the expected result`,
    );
  }

  return mapGetBoards(response);
}

export async function getBoardsByVidPidRequest(
  params: GetBoardsByVidPid_Params,
): Promise<GetBoardsByVidPid_Response> {
  const endpoint = '';
  const vidPid = `${params.vid}-${params.pid}`;
  const requestParams = { 'vid-pid': vidPid };
  const response = await httpGet<ArduinoBuilderBoard_BuilderApi>(
    Config.BOARDS_API_URL,
    undefined,
    endpoint,
    undefined,
    requestParams,
  );

  if (!response) {
    throw new Error(
      `Call to "${Config.API_URL}" with params "${vidPid}" did not respond with the expected result`,
    );
  }

  return mapGetBoardsByVidPid(response);
}

export async function getBoardByFqbnRequest(
  params: GetBoardByFqbn_Params,
): Promise<GetBoardByFqbn_Response> {
  const endpoint = `/${params.fqbn}`;
  const response = await httpGet<ArduinoBuilderBoardv3Full_BuilderApi>(
    Config.BOARDS_API_URL,
    undefined,
    endpoint,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return mapGetBoardByFqbn(response);
}

export async function computeActionByFqbnRequest(
  params: BoardsCompute_Params,
  payload: BoardsCompute_Body,
): Promise<Compute_Response> {
  const endpoint = `/${params.fqbn}/upload-command`;
  const response = await httpGet<ArduinoBuilderBoardscomputev3_BuilderApi>(
    Config.BOARDS_API_URL,
    undefined,
    endpoint,
    undefined,
    payload,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return mapComputeUploadToBoardByFqbn(response);
}

export async function getLibrariesRequest(
  params: GetLibraries_Params,
): Promise<GetLibraries_Response> {
  try {
    const newBase = Config.LIBRARIES_API_URL_NEW;
    const newEndpoint = '/v1/libraries';
    const qp: GetLibraries_Params & { per_page?: number } = { ...params };
    if (qp.limit && !qp.per_page) qp.per_page = qp.limit;

    const newRes = await httpGet<unknown>(
      newBase,
      undefined,
      newEndpoint,
      undefined,
      qp,
    );

    if (newRes && typeof newRes === 'object' && 'pagination' in newRes) {
      return mapGetLibrariesNewToLegacy(newRes as GetLibraries_Response_New);
    }

    // If we reach here, the response didn't match our expectations
    throw new Error('Invalid response format from libraries API');
  } catch (error) {
    console.error('Error fetching libraries:', error);
    throw error; // Re-throw to let the caller handle it
  }
}

export async function getLibraryRequest(
  params: GetLibrary_Params,
): Promise<LibraryDetails_Response> {
  // releases (nuova API)
  const newBase = Config.LIBRARIES_API_URL_NEW;

  // Version specifica: /v1/releases/{name@x.y.z}
  const endpoint = `/v1/releases/${params.id}`;
  const res = await httpGet<Library>(newBase, undefined, endpoint, undefined);
  if (!res) {
    throw new Error('Failed to fetch library details');
  }
  const { mapReleaseNewToLibraryDetailsLegacy } = await import('./mapper');
  return mapReleaseNewToLibraryDetailsLegacy(res);
}

export async function getReleaseLibraryFilesRequest(params: {
  id: string;
}): Promise<ReleaseFilesResponse> {
  const base = Config.LIBRARIES_API_URL_NEW;
  const endpoint = `/v1/releases/${params.id}/files`;
  const response = await httpGet<ReleaseFilesResponse>(
    base,
    undefined,
    endpoint,
    undefined,
  );

  if (!response) {
    throw new Error('Failed to fetch release library files');
  }

  return response;
}

export async function getReleaseExampleFilesRequest(params: {
  id: string;
  path: string;
}): Promise<ReleaseFilesResponse> {
  const base = Config.LIBRARIES_API_URL_NEW;
  const endpoint = `/v1/releases/${params.id}/examples/${encodeURIComponent(
    params.path,
  )}`;
  const response = await httpGet<ReleaseFilesResponse>(
    base,
    undefined,
    endpoint,
    undefined,
  );
  if (!response) {
    throw new Error(
      `Failed to fetch release example files for ${params.id}/${params.path}`,
    );
  }
  return response;
}
export async function getExamplesRequest(
  params: GetExamples_Params,
): Promise<GetExamples_Response> {
  const endpoint = '/v1/builtin/examples';

  const response = await httpGet<GetExamples_Response>(
    Config.LIBRARIES_API_URL_NEW,
    undefined,
    endpoint,
    undefined,
    params,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }
  return mapGetExamplesDataResponse(response.examples);
}

export async function getBuiltinExampleDetailRequest(
  path: string,
): Promise<BuiltinExampleFile[]> {
  const endpoint = `/v1/builtin/examples/${encodeURIComponent(path)}`;
  const res = await httpGet<BuiltinExampleDetailResponse>(
    Config.LIBRARIES_API_URL_NEW,
    undefined,
    endpoint,
    undefined,
  );
  if (!res) throw new Error(`Failed to fetch example details for ${path}`);
  return res.files ?? [];
}

export async function getFavoriteLibrariesRequest(
  token: string,
): Promise<GetFavoriteLibraries_Response> {
  const newBase = Config.CREATE_FAVORITE_NEW;
  const newEndpoint = '/v1/favorites';

  const res = await httpGet<unknown>(newBase, undefined, newEndpoint, token);

  // Type guard to check if an item has an 'id' property
  const hasId = (item: unknown): item is { id: unknown } => {
    return typeof item === 'object' && item !== null && 'id' in item;
  };

  const toLegacyArray = async (
    items: unknown[],
  ): Promise<GetFavoriteLibraries_Response> => {
    if (!Array.isArray(items)) return [];

    if (items.length > 0 && hasId(items[0])) {
      const { mapLibraryNewToLegacy } = await import('./mapper');
      return items.map((item) => ({
        ...mapLibraryNewToLegacy(
          item as Parameters<typeof mapLibraryNewToLegacy>[0],
        ),
        isFavorite: IsFavoriteLibrary.Yes,
      }));
    }

    return items
      .filter((v): v is string => typeof v === 'string')
      .map((id) => ({
        id,
        name: id,
        isFavorite: IsFavoriteLibrary.Yes,
      })) as unknown as GetFavoriteLibraries_Response;
  };

  // Type guard to check if the response has an items array
  const isResponseWithItems = (obj: unknown): obj is { items: unknown[] } => {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'items' in obj &&
      Array.isArray((obj as { items: unknown }).items)
    );
  };

  if (res && isResponseWithItems(res)) {
    return toLegacyArray(res.items);
  }
  if (Array.isArray(res)) {
    return toLegacyArray(res);
  }
  return [];
}

export function addFavoriteLibraryRequest(
  params: FavoriteLibrary_Params,
  token: string,
): Promise<void> {
  const endpoint = `/v1/favorites/${params.id}`;
  return httpPut(
    Config.CREATE_FAVORITE_NEW,
    undefined,
    endpoint,
    undefined,
    token,
  );
}

export function removeFavoriteLibraryRequest(
  params: FavoriteLibrary_Params,
  token: string,
): Promise<void> {
  const endpoint = `/v1/favorites/${params.id}`;
  return httpDelete(Config.CREATE_FAVORITE_NEW, undefined, endpoint, token);
}

export async function getBuilderFileContentsRequest(
  params: GetExampleFileContents_Params,
): Promise<GetExampleFileContents_Response> {
  const endpoint = `/v1/files/${params.path}`;
  const response = await httpGet<ArduinoBuilderExampleFile_BuilderApi>(
    Config.BUILDER_API_URL,
    undefined,
    endpoint,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return mapGetExampleFileContentsResponse(response);
}

const builderV2CFHeaders = undefined;

const BASE_COMPILATION_URL = '/v1/compilations';
export async function postCreateSketchCompilationRequest(
  body: CompileSketch_Body,
  token: string,
  abortController?: AbortController,
): Promise<ArduinoBuilderV2CompilationsResponse_BuilderApi> {
  const endpoint = BASE_COMPILATION_URL;
  const response =
    await httpPost<ArduinoBuilderV2CompilationsResponse_BuilderApi>(
      Config.BUILDER_API_V2_URL,
      undefined,
      endpoint,
      body,
      token,
      abortController,
      builderV2CFHeaders,
    );

  if (response) {
    return mapSketchCompilationResponse(response);
  } else {
    if (abortController?.signal.aborted) {
      throw new Error('Create Sketch compilation Aborted');
    }
    throw new Error('Create Sketch compilation Error');
  }
}

export async function getCreatedSketchCompilationRequest(
  params: ArduinoBuilderV2CompilationStream_Params,
  token: string,
): Promise<ArduinoBuilderV2CompilationsResponse_BuilderApi> {
  const endpoint = `${BASE_COMPILATION_URL}/${params.id}`;
  const response =
    await httpGet<ArduinoBuilderV2CompilationsResponse_BuilderApi>(
      Config.BUILDER_API_V2_URL,
      undefined,
      endpoint,
      token,
      undefined,
      builderV2CFHeaders,
    );

  if (response) {
    return mapSketchCompilationResponse(response);
  } else {
    throw new Error('Get Create Sketch compilation Error');
  }
}

export async function postCancelSketchCompilationRequest(
  params: ArduinoBuilderV2CancelCompilation_Params,
  token: string,
): Promise<ArduinoBuilderV2CompilationsResponse_BuilderApi> {
  const endpoint = `${BASE_COMPILATION_URL}/${params.id}/cancel`;
  const response =
    await httpPost<ArduinoBuilderV2CompilationsResponse_BuilderApi>(
      Config.BUILDER_API_V2_URL,
      undefined,
      endpoint,
      undefined,
      token,
      undefined,
      builderV2CFHeaders,
    );

  if (response && response.status === 'cancelled') {
    return mapSketchCompilationResponse(response);
  } else {
    throw new Error('Cancel Sketch compilation Error');
  }
}

export async function getBuilderCompilationOutputRequest(
  params: ArduinoBuilderV2CompilationOutput_Params,
  token: string,
): Promise<CompileSketch_Response & { name: string }> {
  const endpoint = `${BASE_COMPILATION_URL}/${params.id}/artifacts`;
  const response =
    await httpGet<ArduinoBuilderV2CompilationOutputResponse_BuilderApi>(
      Config.BUILDER_API_V2_URL,
      undefined,
      endpoint,
      token,
      params.type
        ? {
            type: params.type,
          }
        : undefined,
      builderV2CFHeaders,
    );

  if (response) {
    return mapBuilderCompilationOutputNormalizeV2toV1Response(response);
  } else {
    throw new Error('Compilation output Error');
  }
}

export async function getCompilationStreamRequest(
  params: ArduinoBuilderV2CompilationStream_Params,
  handlers: EventSourceHandlers,
  token: string,
  abortController?: AbortController,
): Promise<void> {
  const endpoint = `${BASE_COMPILATION_URL}/${params.id}/events`;
  const sseUrl = `${Config.BUILDER_API_V2_URL}${endpoint}`;

  return getEventSource(
    sseUrl,
    handlers,
    token,
    abortController,
    builderV2CFHeaders,
  );
}
