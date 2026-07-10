import { Config } from '@cloud-editor-mono/common';
import { WretchError } from 'wretch/resolver';

import {
  httpDelete,
  httpDeleteRaw,
  httpGet,
  httpGetRaw,
  httpPatch,
  httpPatchRaw,
  httpPost,
  httpPostRaw,
  httpPut,
  httpPutRaw,
} from '../fetch';
import {
  EventSourceHandlers,
  getEventSource,
  postEventSource,
  putEventSource,
} from '../fetch-event-source';
import { getWebSocket, WebSocketHandlers } from '../websocket';
import {
  AIModelItem,
  AIModelsListResult,
  AppDetailedInfo,
  AppPort,
  BrickCreateUpdateRequest,
  BrickDetails,
  BrickInstance,
  CloneAppRequest,
  CloneAppResult,
  CreateAppRequest,
  CreateAppResult,
  GetConfigResult,
  LibraryListResponse,
  ListAppBrickInstancesResult,
  ListAppParams,
  ListAppPortsResult,
  ListAppResult,
  ListBrickResult,
  ListLibrariesParams,
  SystemPropertyKeysResponse,
  SystemPropertyValue,
  UpdateAppDetailRequest,
  UpdateCheckResult,
  Version,
} from './orchestratorApi.type';

export const APP_NAME_IN_USE_ERROR = 'APP_NAME_IN_USE';
export const BOARD_STORAGE_FULL_ERROR = 'BOARD_STORAGE_FULL';

function handleOrchestratorError(error: WretchError): never {
  if (error.status === 507) {
    throw new Error(BOARD_STORAGE_FULL_ERROR);
  }
  if (error.status === 409) {
    throw new Error(APP_NAME_IN_USE_ERROR);
  }
  if (error.json && error.json.details) {
    throw new Error(error.json.details);
  }
  throw error;
}

export async function getAppsV1Request(
  params: ListAppParams,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<ListAppResult> {
  const endpoint = `/v1/apps`;

  const response = await httpGet<ListAppResult>({
    url: origin,
    endpoint,
    params: params.query,
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function getAppDetailV1Request(
  id: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<AppDetailedInfo> {
  const endpoint = `/v1/apps/${id}`;

  const response = await httpGet<AppDetailedInfo>({ url: origin, endpoint });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function createAppV1Request(
  body: CreateAppRequest,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<string | undefined> {
  const endpoint = `/v1/apps`;

  const response = await httpPost<CreateAppResult>({
    url: origin,
    endpoint,
    body,
    handleError: handleOrchestratorError,
  });

  return response?.id;
}

export async function getAppBricksV1Request(
  id: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<ListAppBrickInstancesResult> {
  const endpoint = `/v1/apps/${id}/bricks`;

  const response = await httpGet<ListAppBrickInstancesResult>({
    url: origin,
    endpoint,
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function getAppPortsV1Request(
  id: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<AppPort[]> {
  const endpoint = `/v1/apps/${id}/exposed-ports`;

  const response = await httpGet<ListAppPortsResult>({ url: origin, endpoint });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response.ports || [];
}

export async function updateAppDetailV1Request(
  id: string,
  body: UpdateAppDetailRequest,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<string | undefined> {
  const endpoint = `/v1/apps/${id}`;

  const response = await httpPatch<AppDetailedInfo>({
    url: origin,
    endpoint,
    body,
  });

  return response?.id;
}

export async function deleteAppV1Request(
  id: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<boolean> {
  const endpoint = `/v1/apps/${id}`;

  const response = await httpDeleteRaw({ url: origin, endpoint });

  return response?.status === 200;
}

export async function getAppBrickInstanceV1Request(
  appId: string,
  brickId: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<BrickInstance> {
  const endpoint = `/v1/apps/${appId}/bricks/${brickId}`;

  const response = await httpGet<BrickInstance>({ url: origin, endpoint });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function addAppBrickV1Request(
  appId: string,
  brickId: string,
  params: BrickCreateUpdateRequest,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<boolean> {
  const endpoint = `/v1/apps/${appId}/bricks/${brickId}`;

  const response = await httpPutRaw({ url: origin, endpoint, body: params });

  return response?.status === 200;
}

export async function deleteAppBrickV1Request(
  appId: string,
  brickId: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<boolean> {
  const endpoint = `/v1/apps/${appId}/bricks/${brickId}`;

  const response = await httpDeleteRaw({ url: origin, endpoint });

  return response?.status === 200;
}

export async function updateAppBrickV1Request(
  appId: string,
  brickId: string,
  params: BrickCreateUpdateRequest,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<boolean> {
  const endpoint = `/v1/apps/${appId}/bricks/${brickId}`;

  const response = await httpPatchRaw({ url: origin, endpoint, body: params });

  return response?.status === 200;
}

export async function addAppCustomBrickV1Request(
  appId: string,
  body: { name: string; description?: string },
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<{ id: string }> {
  const endpoint = `/v1/apps/${appId}/bricks`;

  const response = await httpPost<{
    id: string;
  }>({
    url: origin,
    endpoint,
    body,
    params: { skip_compose: 'true' },
    handleError: (error) => {
      throw error;
    },
    errorType: 'text',
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function renameAppCustomBrickV1Request(
  appId: string,
  brickId: string,
  params: { name: string },
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<boolean> {
  const endpoint = `/v1/apps/${appId}/bricks/${brickId}/rename`;

  const response = await httpPostRaw({ url: origin, endpoint, body: params });

  return response?.status === 200;
}

export async function cloneAppV1Request(
  id: string,
  body: CloneAppRequest = {},
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<string | undefined> {
  const endpoint = `/v1/apps/${id}/clone`;

  const response = await httpPost<CloneAppResult>({
    url: origin,
    endpoint,
    body,
    handleError: handleOrchestratorError,
  });

  return response?.id;
}

export async function getBricksV1Request(
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<ListBrickResult> {
  const endpoint = `/v1/bricks`;

  const response = await httpGet<ListBrickResult>({ url: origin, endpoint });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function getBrickDetailsV1Request(
  id: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<BrickDetails> {
  const endpoint = `/v1/bricks/${id}`;

  const response = await httpGet<BrickDetails>({ url: origin, endpoint });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function getConfigV1Request(
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<GetConfigResult> {
  const endpoint = `/v1/config`;

  const response = await httpGet<GetConfigResult>({ url: origin, endpoint });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function postAppStartStreamV1Request(
  id: string,
  handlers: EventSourceHandlers,
  abortController?: AbortController,
  origin = Config.ORCHESTRATOR_API_URL,
): Promise<void> {
  const endpoint = `/v1/apps/${id}/start`;
  const sseUrl = `${origin}${endpoint}`;

  return postEventSource(
    sseUrl,
    handlers,
    undefined,
    undefined,
    abortController,
  );
}

export async function postAppStopStreamV1Request(
  id: string,
  handlers: EventSourceHandlers,
  abortController?: AbortController,
  origin = Config.ORCHESTRATOR_API_URL,
): Promise<void> {
  const endpoint = `/v1/apps/${id}/stop`;
  const sseUrl = `${origin}${endpoint}`;

  return postEventSource(
    sseUrl,
    handlers,
    undefined,
    undefined,
    abortController,
  );
}

export async function getAppStatusStreamV1Request(
  handlers: EventSourceHandlers,
  abortController?: AbortController,
  origin = Config.ORCHESTRATOR_API_URL,
): Promise<void> {
  const endpoint = `/v1/apps/events`;
  const sseUrl = `${origin}${endpoint}`;

  return getEventSource(sseUrl, handlers, undefined, abortController);
}

export async function getAppLogsStreamV1Request(
  id: string,
  handlers: EventSourceHandlers,
  abortController?: AbortController,
  origin = Config.ORCHESTRATOR_API_URL,
): Promise<void> {
  const endpoint = `/v1/apps/${id}/logs?tail=0`;
  const sseUrl = `${origin}${endpoint}`;

  return getEventSource(sseUrl, handlers, undefined, abortController);
}

export async function getSerialMonitorLogsStreamV1Request(
  handlers: WebSocketHandlers,
  origin = Config.ORCHESTRATOR_API_URL,
): Promise<WebSocket> {
  const endpoint = `/v1/monitor/ws`;
  const url = `${origin}${endpoint}`;

  return getWebSocket(url, handlers);
}

export async function getSystemResourcesStreamV1Request(
  handlers: EventSourceHandlers,
  abortController?: AbortController,
  origin = Config.ORCHESTRATOR_API_URL,
): Promise<void> {
  const endpoint = '/v1/system/resources';
  const sseUrl = `${origin}${endpoint}`;

  return getEventSource(sseUrl, handlers, undefined, abortController);
}

export async function checkBoardUpdateV1Request(
  onlyArduino = true,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<UpdateCheckResult> {
  let endpoint = `/v1/system/update/check`;
  if (onlyArduino) {
    endpoint += '?only-arduino=true';
  }

  const response = await httpGetRaw({
    url: origin,
    endpoint,
    handleError: (error) => {
      throw error;
    },
  });

  if (response?.status === 204) {
    // No updatable packages found
    return { updates: null };
  }

  return response?.json() as UpdateCheckResult;
}

export async function getBoardUpdateLogsStreamV1Request(
  handlers: EventSourceHandlers,
  abortController?: AbortController,
  origin = Config.ORCHESTRATOR_API_URL,
): Promise<void> {
  const endpoint = `/v1/system/update/events`;
  const sseUrl = `${origin}${endpoint}`;

  return getEventSource(sseUrl, handlers, undefined, abortController);
}

/**
 * @returns true if call is successful
 * false if call is request is failed
 * null if no packages updated
 */
export async function applyBoardUpdateV1Request(
  onlyArduino = true,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<boolean | null> {
  let endpoint = `/v1/system/update/apply`;
  if (onlyArduino) {
    endpoint += '?only-arduino=true';
  }

  const response = await httpPutRaw({
    url: origin,
    endpoint,
    handleError: (error: WretchError) => {
      throw error;
    },
  });

  return response?.status === 204 ? null : true;
}

export async function getVersionV1Request(
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<string> {
  const endpoint = `/v1/version`;

  const response = await httpGet<Version>({ url: origin, endpoint });

  if (!response || !response.version) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response.version;
}

export async function getSystemPropertyKeysV1Request(
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<SystemPropertyKeysResponse> {
  const endpoint = `/v1/properties`;

  const response = await httpGet<SystemPropertyKeysResponse>({
    url: origin,
    endpoint,
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  // TODO: remove before merging, simulating R0/R1
  // if (JSON.parse('true')) {
  //   throw new Error(`Simulated error getProperties`);
  // }

  return response;
}

export async function getSystemPropertyV1Request(
  key: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<SystemPropertyValue> {
  const endpoint = `/v1/properties/${key}`;

  const response = await httpGetRaw({ url: origin, endpoint });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  const result = await response.text();
  return result;
}

export async function upsertSystemPropertyV1Request(
  key: string,
  body: SystemPropertyValue,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<SystemPropertyValue> {
  const endpoint = `/v1/properties/${key}`;

  const response = await httpPutRaw({ url: origin, endpoint, body });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  const result = await response.text();
  return result;
}

export async function deleteSystemPropertyV1Request(
  key: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<SystemPropertyValue> {
  const endpoint = `/v1/properties/${key}`;

  const response = await httpDeleteRaw({ url: origin, endpoint });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function getSketchLibrariesV1Request(
  params: ListLibrariesParams,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<LibraryListResponse> {
  const endpoint = `/v1/libraries`;

  const response = await httpGet<LibraryListResponse>({
    url: origin,
    endpoint,
    params: params.query,
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function getAppSketchLibrariesV1Request(
  appId: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<{ libraries: string[] }> {
  const endpoint = `/v1/apps/${appId}/sketch/libraries`;

  const response = await httpGet<{ libraries: string[] }>({
    url: origin,
    endpoint,
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function addAppSketchLibraryV1Request(
  appId: string,
  libRef: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<void> {
  const endpoint = `/v1/apps/${appId}/sketch/libraries/${libRef}`;

  const response = await httpPut({
    url: origin,
    endpoint,
    body: {},
    params: {
      add_deps: 'true',
    },
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }
}

export async function deleteAppSketchLibraryV1Request(
  appId: string,
  libRef: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<void> {
  const endpoint = `/v1/apps/${appId}/sketch/libraries/${libRef}`;

  const response = await httpDelete({
    url: origin,
    endpoint,
    params: {
      remove_deps: 'true',
    },
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }
}

export async function getAIModelsV1Request(
  source?: 'arduino' | 'edgeimpulse',
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<AIModelsListResult> {
  const qs = source ? `?source=${source}` : '';
  const endpoint = `/v1/models${qs}`;

  const response = await httpGet<AIModelsListResult>({
    url: origin,
    endpoint,
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function installEIModelV1Request(
  apiKey: string,
  projectId: string,
  impulseId: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<AIModelItem> {
  const endpoint = `/v1/models/ei/projects/${projectId}`;
  const body = {
    impulse_id: parseInt(impulseId),
  };

  const response = await httpPut<AIModelItem>({
    url: origin,
    endpoint,
    body,
    headers: { 'x-api-key': apiKey },
    handleError: (error) => {
      if (error.status === 507) {
        throw new Error('Insufficient space on the board.');
      }
      if (error.json && error.json.details) {
        throw new Error(error.json.details);
      }
      throw error;
    },
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function deleteAIModelV1Request(
  id: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
  isForced?: boolean,
): Promise<void> {
  const endpoint = `/v1/models/${id}`;

  const response = await httpDelete({
    url: origin,
    endpoint,
    handleError: (error) => {
      if (error.json && error.json.details) {
        throw new Error(error.json.details);
      }
      throw error;
    },
    params: isForced ? { force: 'true' } : undefined,
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }
}

export async function uploadAIModelV1Request(
  id: string,
  handlers: EventSourceHandlers,
  abortController?: AbortController,
  origin = Config.ORCHESTRATOR_API_URL,
): Promise<void> {
  const endpoint = `/v1/models/${id}`;
  const sseUrl = `${origin}${endpoint}`;

  return putEventSource(
    sseUrl,
    handlers,
    undefined,
    undefined,
    abortController,
  );
}
