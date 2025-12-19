/* eslint-disable no-empty */
import { assertNonNull, Config } from '@cloud-editor-mono/common';
import {
  applyBoardUpdateWailsFallback,
  checkBoardUpdateWailsFallback,
  getBoardUpdateLogsWailsFallback,
  OrchestratorService,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  addAppBrickV1Request,
  addAppSketchLibraryV1Request,
  applyBoardUpdateV1Request,
  BrickCreateUpdateRequest,
  checkBoardUpdateV1Request,
  cloneAppV1Request,
  createAppV1Request,
  deleteAppBrickV1Request,
  deleteAppSketchLibraryV1Request,
  deleteAppV1Request,
  deleteSystemPropertyV1Request,
  EventSourceHandlers,
  getAppBrickInstanceV1Request,
  getAppBricksV1Request,
  getAppDetailV1Request,
  getAppLogsStreamV1Request,
  getAppPortsV1Request,
  getAppSketchLibrariesV1Request,
  getAppStatusStreamV1Request,
  getAppsV1Request,
  getBoardUpdateLogsStreamV1Request,
  getBrickDetailsV1Request,
  getBricksV1Request,
  getConfigV1Request,
  getSerialMonitorLogsStreamV1Request,
  getSketchLibrariesV1Request,
  getSystemPropertyKeysV1Request,
  getSystemPropertyV1Request,
  getSystemResourcesStreamV1Request,
  getVersionV1Request,
  ListAppParams,
  ListLibrariesParams,
  postAppStartStreamV1Request,
  postAppStopStreamV1Request,
  updateAppBrickV1Request,
  updateAppDetailV1Request,
  upsertSystemPropertyV1Request,
  WebSocketHandlers,
} from '@cloud-editor-mono/infrastructure';

import {
  GetFileContent,
  GetFileTree,
  GetOrchestratorURL,
} from '../../wailsjs/go/app/App';
import { mapFSNode } from './orchestratorService.mapper';

const getOrchestratorURL = async (): Promise<string | undefined> => {
  try {
    // Board and desktop use case
    if (Config.FORCE_IS_BOARD) {
      return Config.ORCHESTRATOR_API_URL;
    }

    return await GetOrchestratorURL();
  } catch {
    // Local development use case or fallback
    // (use default params in orchestratorApi.ts)
    return undefined;
  }
};

export const getApps: OrchestratorService['getApps'] = async function (
  req: ListAppParams,
) {
  const origin = await getOrchestratorURL();

  const response = await getAppsV1Request(req, origin);
  return response.apps || [];
};

export const getAppDetail: OrchestratorService['getAppDetail'] =
  async function (id: string) {
    const origin = await getOrchestratorURL();

    return getAppDetailV1Request(id, origin);
  };

export const updateAppDetail: OrchestratorService['updateAppDetail'] =
  async function (id: string, body) {
    const origin = await getOrchestratorURL();
    return updateAppDetailV1Request(id, body, origin);
  };

export const createApp: OrchestratorService['createApp'] = async function (
  body,
) {
  const origin = await getOrchestratorURL();
  return createAppV1Request(body, origin);
};

export const cloneApp: OrchestratorService['cloneApp'] = async function (
  id: string,
  body,
) {
  const origin = await getOrchestratorURL();
  return cloneAppV1Request(id, body, origin);
};

export const deleteApp: OrchestratorService['deleteApp'] = async function (
  id: string,
) {
  const origin = await getOrchestratorURL();
  return deleteAppV1Request(id, origin);
};

export const getFiles: OrchestratorService['getFiles'] = async function (
  id: string,
) {
  const file = await GetFileTree(id);
  return [mapFSNode(file)];
};

export const getFileContent: OrchestratorService['getFileContent'] =
  async function (path: string) {
    return GetFileContent(path);
  };

export const getConfig: OrchestratorService['getConfig'] = async function () {
  const origin = await getOrchestratorURL();
  return getConfigV1Request(origin);
};

export const getAppsStatus: OrchestratorService['getAppsStatus'] =
  async function (
    handlers: EventSourceHandlers,
    abortController?: AbortController,
  ) {
    const origin = await getOrchestratorURL();
    return getAppStatusStreamV1Request(handlers, abortController, origin);
  };

export const getAppBricks: OrchestratorService['getAppBricks'] =
  async function (id: string, _params?: never) {
    const origin = await getOrchestratorURL();

    const response = await getAppBricksV1Request(id, origin);
    return response.bricks || [];
  };

export const getAppBrickInstance: OrchestratorService['getAppBrickInstance'] =
  async function (appId: string, brickId: string) {
    const origin = await getOrchestratorURL();

    return getAppBrickInstanceV1Request(appId, brickId, origin);
  };

export const addAppBrick: OrchestratorService['addAppBrick'] = async function (
  appId: string,
  brickId: string,
  params: BrickCreateUpdateRequest,
) {
  const origin = await getOrchestratorURL();
  return addAppBrickV1Request(appId, brickId, params, origin);
};

export const deleteAppBrick: OrchestratorService['deleteAppBrick'] =
  async function (appId: string, brickId: string) {
    const origin = await getOrchestratorURL();
    return deleteAppBrickV1Request(appId, brickId, origin);
  };

export const updateAppBrick: OrchestratorService['updateAppBrick'] =
  async function (
    appId: string,
    brickId: string,
    params: BrickCreateUpdateRequest,
  ) {
    const origin = await getOrchestratorURL();
    return updateAppBrickV1Request(appId, brickId, params, origin);
  };

export const getBricks: OrchestratorService['getBricks'] = async function () {
  const origin = await getOrchestratorURL();

  const response = await getBricksV1Request(origin);
  return response.bricks || [];
};

export const getBrickDetails: OrchestratorService['getBrickDetails'] =
  async function (id: string) {
    const origin = await getOrchestratorURL();

    return getBrickDetailsV1Request(id, origin);
  };

export const startApp: OrchestratorService['startApp'] = async function (
  id: string,
  handlers: EventSourceHandlers,
  abortController?: AbortController,
) {
  const origin = await getOrchestratorURL();
  return postAppStartStreamV1Request(id, handlers, abortController, origin);
};

export const stopApp: OrchestratorService['stopApp'] = async function (
  id: string,
  handlers: EventSourceHandlers,
  abortController?: AbortController,
) {
  const origin = await getOrchestratorURL();
  return postAppStopStreamV1Request(id, handlers, abortController, origin);
};

export const getAppPorts: OrchestratorService['getAppPorts'] = async function (
  id: string,
) {
  const origin = await getOrchestratorURL();
  return getAppPortsV1Request(id, origin);
};

export const getAppLogs: OrchestratorService['getAppLogs'] = async function (
  id: string,
  handlers: EventSourceHandlers,
  abortController?: AbortController,
) {
  const origin = await getOrchestratorURL();
  return getAppLogsStreamV1Request(id, handlers, abortController, origin);
};

export const getSerialMonitorLogs: OrchestratorService['getSerialMonitorLogs'] =
  async function (handlers: WebSocketHandlers) {
    const origin = await getOrchestratorURL();
    return getSerialMonitorLogsStreamV1Request(handlers, origin);
  };

export const getSystemResources: OrchestratorService['getSystemResources'] =
  async function (
    handlers: EventSourceHandlers,
    abortController?: AbortController,
  ) {
    const origin = await getOrchestratorURL();
    return getSystemResourcesStreamV1Request(handlers, abortController, origin);
  };

export const checkBoardUpdate: OrchestratorService['checkBoardUpdate'] =
  async function (arduinoOnly: boolean) {
    const origin = await getOrchestratorURL();

    try {
      const response = await checkBoardUpdateV1Request(arduinoOnly, origin);
      return response;
    } catch (err) {
      if (err instanceof TypeError) {
        // CORS error, fallback to Wails implementation
        console.debug('Using checkBoardUpdate wails fallback');
        assertNonNull(origin);
        return checkBoardUpdateWailsFallback(origin);
      }
      if (typeof err === 'string') {
        throw new Error(err);
      }
      if (!(err instanceof Error)) {
        console.error('Check for update unknown error:', err);
        throw new Error('Unknown error');
      }
      // Check for custom error from orchestrator
      const customError = err as Error;
      try {
        const { code, details } = JSON.parse(err.message) as {
          code: number;
          details: string;
        };
        if (details) {
          const message = details || 'Unknown error';
          customError.message = `${code} - ${message}`;
        }
      } catch {}

      throw customError;
    }
  };

export const getBoardUpdateLogs: OrchestratorService['getBoardUpdateLogs'] =
  async function (
    handlers: EventSourceHandlers,
    abortController?: AbortController,
  ) {
    const origin = await getOrchestratorURL();

    try {
      // Test if the V1 endpoint is reachable
      await fetch(`${origin}/v1/version`, { method: 'HEAD' });
      await getBoardUpdateLogsStreamV1Request(
        handlers,
        abortController,
        origin,
      );
    } catch (err) {
      if (err instanceof TypeError) {
        // CORS error, fallback to Wails implementation
        console.debug('Using getBoardUpdateLogs wails fallback');
        assertNonNull(origin);
        getBoardUpdateLogsWailsFallback(origin, handlers, abortController);
      }
      throw err;
    }
  };

export const applyBoardUpdate: OrchestratorService['applyBoardUpdate'] =
  async function (arduinoOnly: boolean) {
    const origin = await getOrchestratorURL();

    try {
      const response = await applyBoardUpdateV1Request(arduinoOnly, origin);
      return response;
    } catch (err) {
      if (err instanceof TypeError) {
        // CORS error, fallback to Wails implementation
        console.debug('Using applyBoardUpdate wails fallback');
        assertNonNull(origin);
        return applyBoardUpdateWailsFallback(origin);
      }
      throw err;
    }
  };

export const getVersion: OrchestratorService['getVersion'] = async function () {
  const origin = await getOrchestratorURL();
  return getVersionV1Request(origin);
};

export const getSystemPropertyKeys: OrchestratorService['getSystemPropertyKeys'] =
  async function () {
    const origin = await getOrchestratorURL();
    const response = await getSystemPropertyKeysV1Request(origin);
    return response.keys || [];
  };

export const getSystemProperty: OrchestratorService['getSystemProperty'] =
  async function (key: string) {
    const origin = await getOrchestratorURL();
    return getSystemPropertyV1Request(key, origin);
  };

export const upsertSystemProperty: OrchestratorService['upsertSystemProperty'] =
  async function (key: string, value: string) {
    const origin = await getOrchestratorURL();
    return upsertSystemPropertyV1Request(key, value, origin);
  };

export const deleteSystemProperty: OrchestratorService['deleteSystemProperty'] =
  async function (key: string) {
    const origin = await getOrchestratorURL();
    return deleteSystemPropertyV1Request(key, origin);
  };

export const getSketchLibraries: OrchestratorService['getSketchLibraries'] =
  async function (params: ListLibrariesParams) {
    const origin = await getOrchestratorURL();
    return getSketchLibrariesV1Request(params, origin);
  };

export const getAppSketchLibraries: OrchestratorService['getAppSketchLibraries'] =
  async function (appId: string) {
    const origin = await getOrchestratorURL();
    return getAppSketchLibrariesV1Request(appId, origin);
  };

export const addAppSketchLibrary: OrchestratorService['addAppSketchLibrary'] =
  async function (appId: string, libRef: string) {
    const origin = await getOrchestratorURL();
    return addAppSketchLibraryV1Request(appId, libRef, origin);
  };

export const deleteAppSketchLibrary: OrchestratorService['deleteAppSketchLibrary'] =
  async function (appId: string, libRef: string) {
    const origin = await getOrchestratorURL();
    return deleteAppSketchLibraryV1Request(appId, libRef, origin);
  };
