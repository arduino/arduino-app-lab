import { Config } from '@cloud-editor-mono/common';
import { WretchError } from 'wretch/resolver';

import { httpGet, httpPost, httpPut } from '../fetch/fetch';
import { FetchError } from '../fetch/fetch.type';
import {
  mapCreateOtaV1Response,
  mapListOtaV1Response,
  mapShowOtaV1Response,
} from './mapper';
import {
  CreateOtaV1_Response,
  CreateOtaV1Body_OtaApi,
  ListOtaParams_OtaApi,
  ListOtaV1_OtaApi,
  ListOtaV1_Response,
  ShowOtaV1_Response,
  ShowOtaV1Params_OtaApi,
} from './otaApi.type';

//List all ota's for a device_id
export async function listOtaV1Request(
  token: string,
  headers?: HeadersInit,
  query?: ListOtaParams_OtaApi['query'],
): Promise<ListOtaV1_Response> {
  const endpoint = '/v1/ota';

  const response = await httpGet<ListOtaV1_OtaApi>(
    Config.OTA_API_URL,
    undefined,
    endpoint,
    token,
    query,
    headers,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return mapListOtaV1Response(response);
}

//Get single ota by ota_id
export async function showOtaV1Request(
  token: string,
  otaId: ShowOtaV1Params_OtaApi['path']['ota_id'],
  headers?: HeadersInit,
  params?: { all_progress?: boolean },
): Promise<ShowOtaV1_Response> {
  const endpoint = `/v1/ota/${otaId}`;

  const response = await httpGet<ShowOtaV1_Response>(
    Config.OTA_API_URL,
    undefined,
    endpoint,
    token,
    params,
    headers,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }
  return mapShowOtaV1Response(response);
}

//Cancel pending OTA
export async function abortPendingOtaV1Request(
  token: string,
  otaId: ShowOtaV1Params_OtaApi['path']['ota_id'],
  headers?: HeadersInit,
): Promise<CreateOtaV1_Response> {
  const endpoint = `/v1/ota/${otaId}/cancel`;

  let error: WretchError | undefined = undefined;
  const response = await httpPut<CreateOtaV1_Response>(
    Config.OTA_API_URL,
    undefined,
    endpoint,
    undefined,
    token,
    headers,
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

  return mapCreateOtaV1Response(response);
}

//Create an OTA for a device, returns the Ota
export async function createOtaV1Request(
  body: CreateOtaV1Body_OtaApi,
  token: string,
  headers?: HeadersInit,
): Promise<CreateOtaV1_Response | { errStatus: number }> {
  const endpoint = '/v1/ota';
  let err;
  const handleError = (error: FetchError): void => {
    err = { errStatus: error.status };
  };

  const response = await httpPost<CreateOtaV1_Response>(
    Config.OTA_API_URL,
    undefined,
    endpoint,
    body,
    token,
    undefined,
    headers,
    handleError,
  );

  if (err) {
    return err;
  }

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return mapCreateOtaV1Response(response);
}
