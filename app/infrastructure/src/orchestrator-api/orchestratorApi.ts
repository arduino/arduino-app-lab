import { Config } from '@cloud-editor-mono/common';

import {
  httpDelete,
  httpDeleteRaw,
  httpGet,
  httpGetRaw,
  httpPatch,
  httpPatchRaw,
  httpPost,
  httpPut,
  httpPutRaw,
} from '../fetch/fetch';
import {
  EventSourceHandlers,
  getEventSource,
  postEventSource,
} from '../fetch-event-source';
import { getWebSocket, WebSocketHandlers } from '../websocket';
import {
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

export async function getAppsV1Request(
  params: ListAppParams,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<ListAppResult> {
  const endpoint = `/v1/apps`;

  const response = await httpGet<ListAppResult>(
    origin,
    undefined,
    endpoint,
    undefined,
    params.query,
  );

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

  const response = await httpGet<AppDetailedInfo>(origin, undefined, endpoint);

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

  const response = await httpPost<CreateAppResult>(
    origin,
    undefined,
    endpoint,
    body,
  );

  return response?.id;
}

export async function getAppBricksV1Request(
  id: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<ListAppBrickInstancesResult> {
  const endpoint = `/v1/apps/${id}/bricks`;

  const response = await httpGet<ListAppBrickInstancesResult>(
    origin,
    undefined,
    endpoint,
  );

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

  const response = await httpGet<ListAppPortsResult>(
    origin,
    undefined,
    endpoint,
  );

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

  const response = await httpPatch<AppDetailedInfo>(
    origin,
    undefined,
    endpoint,
    body,
  );

  return response?.id;
}

export async function deleteAppV1Request(
  id: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<boolean> {
  const endpoint = `/v1/apps/${id}`;

  const response = await httpDeleteRaw(origin, endpoint);

  return response?.status === 200;
}

export async function getAppBrickInstanceV1Request(
  appId: string,
  brickId: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<BrickInstance> {
  const endpoint = `/v1/apps/${appId}/bricks/${brickId}`;

  const response = await httpGet<BrickInstance>(origin, undefined, endpoint);

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

  const response = await httpPutRaw(origin, endpoint, params);

  return response?.status === 200;
}

export async function deleteAppBrickV1Request(
  appId: string,
  brickId: string,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<boolean> {
  const endpoint = `/v1/apps/${appId}/bricks/${brickId}`;

  const response = await httpDeleteRaw(origin, endpoint);

  return response?.status === 200;
}

export async function updateAppBrickV1Request(
  appId: string,
  brickId: string,
  params: BrickCreateUpdateRequest,
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<boolean> {
  const endpoint = `/v1/apps/${appId}/bricks/${brickId}`;

  const response = await httpPatchRaw(origin, endpoint, params);

  return response?.status === 200;
}

export async function cloneAppV1Request(
  id: string,
  body: CloneAppRequest = {},
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<string | undefined> {
  const endpoint = `/v1/apps/${id}/clone`;

  const response = await httpPost<CloneAppResult>(
    origin,
    undefined,
    endpoint,
    body,
  );

  return response?.id;
}

export async function getBricksV1Request(
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<ListBrickResult> {
  const endpoint = `/v1/bricks`;

  const response = await httpGet<ListBrickResult>(origin, undefined, endpoint);

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

  const response = await httpGet<BrickDetails>(origin, undefined, endpoint);

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

  const response = await httpGet<GetConfigResult>(origin, undefined, endpoint);

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
  const endpoint = `/v1/apps/${id}/logs`;
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

  const response = await httpGetRaw(origin, endpoint, undefined, (error) => {
    throw error;
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

  const response = await httpPutRaw(
    origin,
    endpoint,
    undefined,
    undefined,
    undefined,
    (error) => {
      throw error;
    },
  );

  return response?.status === 204 ? null : true;
}

export async function getVersionV1Request(
  origin: string = Config.ORCHESTRATOR_API_URL,
): Promise<string> {
  const endpoint = `/v1/version`;

  const response = await httpGet<Version>(origin, undefined, endpoint);

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

  const response = await httpGet<SystemPropertyKeysResponse>(
    origin,
    undefined,
    endpoint,
  );

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

  const response = await httpGetRaw(origin, endpoint);

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

  const response = await httpPutRaw(origin, endpoint, body);

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

  const response = await httpDeleteRaw(origin, endpoint);

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

  const response = await httpGet<LibraryListResponse>(
    origin,
    undefined,
    endpoint,
    undefined,
    params.query,
  );

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

  const response = await httpGet<{ libraries: string[] }>(
    origin,
    undefined,
    endpoint,
  );

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

  const response = await httpPut(origin, undefined, endpoint, {}, undefined, {
    add_deps: 'true',
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

  const response = await httpDelete(origin, undefined, endpoint, undefined, {
    remove_deps: 'true',
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }
}
