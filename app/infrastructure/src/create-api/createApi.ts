import { Config } from '@cloud-editor-mono/common';
import { WretchError } from 'wretch/resolver';

import {
  httpDelete,
  httpFormDataPost,
  httpGet,
  httpGetRaw,
  httpPost,
  httpPostRaw,
  httpPut,
} from '../fetch/fetch';
import { FetchError } from '../fetch/fetch.type';
import { ORGANIZATION_HEADER } from '../utils';
import {
  ArduinoCreateSketchesV2_CreateApi,
  ArduinoCreateSketchV2_CreateApi,
  CreateSketch_Body,
  CreateSketch_Response,
  CreateUser_Response,
  DeleteSketch_Params,
  DeleteSketchFile_Response,
  EditSketchesV2Payload_CreateApi,
  FileChange_Params,
  FileContentV2_CreateApi,
  FileContentV2Write_CreateApi,
  FileV2Delete_CreateApi,
  FileV2List_CreateApi,
  GetFileContents_Response,
  GetFileHash_CreateApi,
  GetFileHash_Params,
  GetFileHash_Response,
  GetFilesList_Response,
  GetLibrariesList_Response,
  GetLibrary_Response,
  GetLibraryCode_Params,
  GetLibraryCode_Response,
  GetSketch_Params,
  GetSketch_Response,
  GetSketches_Params,
  GetSketches_Response,
  Libs_CreateApi,
  PostLibrary_Body,
  PostSketchFile_Body,
  PostSketchFile_Response,
  RenameSketch_Body,
} from './createApi.type';
import {
  mapCreateSketchResponse,
  mapDeleteFileResponse,
  mapGetCurrentSketchEditorsResponse,
  mapGetCustomLibrariesResponse,
  mapGetFileContentsResponse,
  mapGetFilesListResponse,
  mapGetSketchesResponse,
  mapGetSketchResponse,
  mapPostFileResponse,
} from './mapper';

export async function createAliveRequest(
  token: string,
): Promise<Response | void> {
  const endpoint = '/alive';

  return httpGetRaw(Config.CREATE_API_URL, endpoint, token);
}

export async function getFileHash(
  params: GetFileHash_Params,
  token: string,
  space?: string,
): Promise<GetFileHash_Response | void> {
  const endpoint = `/v2/files/f/revision/${params.path}`;

  const response = await httpGet<GetFileHash_CreateApi>(
    Config.CREATE_API_URL,
    undefined,
    endpoint,
    token,
    undefined,
    space
      ? {
          [ORGANIZATION_HEADER]: space,
        }
      : undefined,
  );

  if (response) {
    return mapGetCurrentSketchEditorsResponse(response);
  }
}

export async function putSketchRequest(
  body: CreateSketch_Body,
  token: string,
  space?: string,
): Promise<CreateSketch_Response> {
  const endpoint = '/v2/sketches';

  const response = await httpPut<ArduinoCreateSketchV2_CreateApi>(
    Config.CREATE_API_URL,
    undefined,
    endpoint,
    body,
    token,
    space
      ? {
          [ORGANIZATION_HEADER]: space,
        }
      : undefined,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return mapCreateSketchResponse(response);
}

export async function postSketchRequest(
  params: GetSketch_Params,
  payload: Partial<EditSketchesV2Payload_CreateApi>,
  token: string,
  space?: string,
): Promise<CreateSketch_Response> {
  const endpoint = `/v2/sketches/${params.id}`;
  const response = await httpPost<ArduinoCreateSketchV2_CreateApi>(
    Config.CREATE_API_URL,
    undefined,
    endpoint,
    payload,
    token,
    undefined,
    space
      ? {
          [ORGANIZATION_HEADER]: space,
        }
      : undefined,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return mapCreateSketchResponse(response);
}

export async function getSketchRequest(
  params: GetSketch_Params,
  token?: string,
  space?: string,
): Promise<GetSketch_Response | undefined> {
  const endpoint = `/v2/sketches/byID/${params.id}`;
  const response = await httpGet<ArduinoCreateSketchV2_CreateApi>(
    Config.CREATE_API_URL,
    undefined,
    endpoint,
    token,
    undefined,
    space
      ? {
          [ORGANIZATION_HEADER]: space,
        }
      : undefined,
  );

  if (response) {
    return mapGetSketchResponse(response);
  }
}

export async function deleteSketchRequest(
  params: DeleteSketch_Params,
  token: string,
  space?: string,
): Promise<void> {
  const endpoint = `/v2/sketches/byID/${params.id}`;
  await httpDelete<void>(
    Config.CREATE_API_URL,
    undefined,
    endpoint,
    token,
    space
      ? {
          [ORGANIZATION_HEADER]: space,
        }
      : undefined,
  );
}

export async function getSketchesRequest(
  params: GetSketches_Params,
  token: string,
  space?: string,
): Promise<GetSketches_Response> {
  let endpoint = `/v2/sketches?user_id=${params.user_id}&limit=200`;
  endpoint = params.name_like
    ? `${endpoint}&name_like=${params.name_like}`
    : endpoint;
  const response = await httpGet<ArduinoCreateSketchesV2_CreateApi>(
    Config.CREATE_API_URL,
    undefined,
    endpoint,
    token,
    undefined,
    space
      ? {
          [ORGANIZATION_HEADER]: space,
        }
      : undefined,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return mapGetSketchesResponse(response);
}

export async function getFileContentsRequest(
  path: string,
  token?: string,
  space?: string,
): Promise<GetFileContents_Response> {
  const endpoint = `/v2/files/f/${path}`;

  let error: WretchError | undefined = undefined;
  const response = await httpGet<FileContentV2_CreateApi>(
    Config.CREATE_API_URL,
    undefined,
    endpoint,
    token,
    undefined,
    space
      ? {
          [ORGANIZATION_HEADER]: space,
        }
      : undefined,
    (err) => {
      error = err;
    },
  );

  if (!response || error) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
      error
        ? {
            cause: error,
          }
        : undefined,
    );
  }

  return mapGetFileContentsResponse(response);
}

export async function getFilesListRequest(
  path: string,
  token?: string,
  space?: string,
): Promise<GetFilesList_Response> {
  const endpoint = `/v2/files/d/${path}`;

  let error: WretchError | undefined = undefined;
  const response = await httpGet<FileV2List_CreateApi>(
    Config.CREATE_API_URL,
    undefined,
    endpoint,
    token,
    undefined,
    space
      ? {
          [ORGANIZATION_HEADER]: space,
        }
      : undefined,
    (err) => {
      error = err;
    },
  );

  if (!response || error) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
      error
        ? {
            cause: { path: path, status: (error as WretchError).status },
          }
        : undefined,
    );
  }

  return mapGetFilesListResponse(response);
}

export async function postSketchFileRequest(
  file: FileChange_Params,
  body: PostSketchFile_Body,
  token: string,
  space?: string,
): Promise<PostSketchFile_Response> {
  const { path } = file;
  const endpoint = `/v2/files/f/${path}`;
  let err;
  const handleError = (error: FetchError): void => {
    err = { errStatus: error.status };
  };

  const response = await httpPost<FileContentV2Write_CreateApi>(
    Config.CREATE_API_URL,
    undefined,
    endpoint,
    body,
    token,
    undefined,
    space
      ? {
          [ORGANIZATION_HEADER]: space,
        }
      : undefined,
    handleError,
  );

  if (err) return err;

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return mapPostFileResponse(response);
}

export async function moveSketchRequest(
  body: RenameSketch_Body,
  token: string,
  space?: string,
): ReturnType<typeof httpPostRaw> {
  const endpoint = `/v3/files/mv`;
  const response = await httpPostRaw(
    Config.CREATE_API_URL,
    endpoint,
    body,
    token,
    space
      ? {
          [ORGANIZATION_HEADER]: space,
        }
      : undefined,
    (err) => {
      throw err;
    },
  );

  return response;
}

export async function deleteSketchFileRequest(
  file: FileChange_Params,
  token: string,
  space?: string,
): Promise<DeleteSketchFile_Response> {
  const { path } = file;
  const endpoint = `/v2/files/f/${path}`;

  let error: WretchError | undefined = undefined;
  const response = await httpDelete<FileV2Delete_CreateApi>(
    Config.CREATE_API_URL,
    undefined,
    endpoint,
    token,
    space
      ? {
          [ORGANIZATION_HEADER]: space,
        }
      : undefined,
    undefined,
    (err) => {
      error = err;
    },
  );

  if (!response || error) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
      error
        ? {
            cause: (error as WretchError).status,
          }
        : undefined,
    );
  }

  return mapDeleteFileResponse(response);
}

export async function getCustomLibraries(
  token: string,
): Promise<GetLibrariesList_Response> {
  const endpoint = `/v2/libraries`;

  let error;
  const response = await httpGet<Libs_CreateApi>(
    Config.CREATE_API_URL,
    undefined,
    endpoint,
    token,
    {
      user_id: 'me',
    },
    undefined,
    (err) => {
      error = err;
    },
  );

  if (!response || error) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
      error
        ? {
            cause: error,
          }
        : undefined,
    );
  }

  return mapGetCustomLibrariesResponse(response);
}

export async function getCustomLibraryCode(
  params: GetLibraryCode_Params,
  token: string,
): Promise<GetLibraryCode_Response> {
  const endpoint = `/v2/libraries/${params.id}/code`;

  const response = await httpGet<GetLibraryCode_Response>(
    Config.CREATE_API_URL,
    undefined,
    endpoint,
    token,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function saveLibraryRequest(
  body: PostLibrary_Body,
  token: string,
): Promise<{
  error?: string;
  response: GetLibrary_Response | void;
}> {
  const endpoint = `/v2/libraries`;

  let errorText;
  const handleError = (error: FetchError): void => {
    if (error.json?.detail) {
      errorText = error.json?.detail;
    }
  };

  const response = await httpFormDataPost<GetLibrary_Response>(
    Config.CREATE_API_URL,
    undefined,
    endpoint,
    {
      archive: body,
      user_id: 'me',
    },
    token,
    handleError,
  );

  if (errorText) {
    return {
      error: errorText,
      response: undefined,
    };
  }

  return {
    error: undefined,
    response,
  };
}

export async function deleteLibraryRequest(
  { id }: { id: string },
  token: string,
): Promise<void> {
  const endpoint = `/v2/libraries/${id}`;
  const response = await httpDelete<void>(
    Config.CREATE_API_URL,
    undefined,
    endpoint,
    token,
  );

  return response;
}

export async function getUserRequest(
  { id }: { id: string },
  token: string,
): Promise<CreateUser_Response> {
  const endpoint = `/v1/users/${id}`;
  const response = await httpGet<CreateUser_Response>(
    Config.CREATE_API_URL,
    undefined,
    endpoint,
    token,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}
