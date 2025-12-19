import wretch, { WretchOptions } from 'wretch';
import AbortAddon from 'wretch/addons/abort';
import FormDataAddon from 'wretch/addons/formData';
import QueryAddon from 'wretch/addons/queryString';
import { WretchError } from 'wretch/resolver';

import {
  BaseRequest,
  QueriedRequest,
  RawResponse,
  WretchQueryParams,
} from './fetch.type';

function defaultHandleError(error: WretchError): void {
  console.error(error);
}

function createRequest<T>(
  url: string,
  options: WretchOptions,
  token?: string,
  abortController?: AbortController,
  headers?: HeadersInit,
): BaseRequest<T> {
  let base = (
    token ? wretch(url, options).auth(`Bearer ${token}`) : wretch(url, options)
  ).addon(AbortAddon());

  if (headers) {
    base = base.headers(headers);
  }

  const request = !abortController ? base : base.signal(abortController);

  return request.errorType('json').resolve((r) => {
    return r.json<T>().catch(() => {
      return r.res<T>(); // manage unexpected error in `.json()`
    });
  });
}

function queryRequest<T>(
  baseRequest: BaseRequest<T>,
  params: WretchQueryParams,
): QueriedRequest<T> {
  return baseRequest.addon(QueryAddon).query(params);
}

export async function httpGet<T>(
  url: string,
  wretchOptions: WretchOptions = {},
  endpoint: string,
  token?: string,
  params?: WretchQueryParams,
  headers?: HeadersInit,
  handleError = defaultHandleError,
): Promise<T | void> {
  const api = createRequest<T>(url, wretchOptions, token, undefined, headers);

  try {
    const response = await (params
      ? queryRequest(api, params).get(endpoint)
      : api.get(endpoint));
    return response;
  } catch (error) {
    handleError(error as WretchError);
  }
}

export async function httpPut<T>(
  url: string,
  wretchOptions: WretchOptions = {},
  endpoint: string,
  body = {},
  token?: string,
  params?: WretchQueryParams,
  headers?: HeadersInit,
  handleError = defaultHandleError,
): Promise<T | void> {
  const api = createRequest<T>(url, wretchOptions, token, undefined, headers);

  try {
    const response = await (params
      ? queryRequest(api, params).put(body, endpoint)
      : api.put(body, endpoint));
    return response;
  } catch (error) {
    handleError(error as WretchError);
  }
}

export async function httpPost<T>(
  url: string,
  wretchOptions = {},
  endpoint: string,
  body = {},
  token?: string,
  abortController?: AbortController,
  headers?: HeadersInit,
  handleError = defaultHandleError,
): Promise<T | void> {
  const api = createRequest<T>(
    url,
    wretchOptions,
    token,
    abortController,
    headers,
  );

  try {
    const response = await api.post(body, endpoint);
    return response;
  } catch (error) {
    handleError(error as WretchError);
  }
}

export async function httpDelete<T>(
  url: string,
  wretchOptions = {},
  endpoint: string,
  token?: string,
  params?: WretchQueryParams,
  headers?: HeadersInit,
  handleError = defaultHandleError,
): Promise<T | void> {
  const api = createRequest<T>(url, wretchOptions, token, undefined, headers);

  try {
    const response = await (params
      ? queryRequest(api, params).delete(endpoint)
      : api.delete(endpoint));
    return response;
  } catch (error) {
    handleError(error as WretchError);
  }
}

export async function httpPatch<T>(
  url: string,
  wretchOptions: WretchOptions = {},
  endpoint: string,
  body = {},
  token?: string,
  headers?: HeadersInit,
  handleError = defaultHandleError,
): Promise<T | void> {
  const api = createRequest<T>(url, wretchOptions, token, undefined, headers);

  try {
    const response = await api.patch(body, endpoint);
    return response;
  } catch (error) {
    handleError(error as WretchError);
  }
}

function createRawRequest(
  url: string,
  token?: string,
  headers?: HeadersInit,
): BaseRequest<RawResponse> {
  let base = (token ? wretch(url).auth(`Bearer ${token}`) : wretch(url))
    .addon(AbortAddon())
    .resolve((r) => r.res());

  if (headers) {
    base = base.headers(headers);
  }

  return base;
}

export async function httpGetRaw(
  url: string,
  endpoint: string,
  token?: string,
  handleError = defaultHandleError,
): Promise<RawResponse | void> {
  const api = createRawRequest(url, token);

  try {
    const response = await api.get(endpoint);
    return response;
  } catch (error) {
    handleError(error as WretchError);
  }
}

export async function httpPostRaw(
  url: string,
  endpoint: string,
  body = {},
  token?: string,
  headers?: HeadersInit,
  handleError = defaultHandleError,
): Promise<RawResponse | void> {
  const api = createRawRequest(url, token, headers);

  try {
    const response = await api.post(body, endpoint);
    return response;
  } catch (error) {
    handleError(error as WretchError);
  }
}

export async function httpPutRaw(
  url: string,
  endpoint: string,
  body = {},
  token?: string,
  headers?: HeadersInit,
  handleError = defaultHandleError,
): Promise<RawResponse | void> {
  const api = createRawRequest(url, token, headers);

  try {
    const response = await api.put(body, endpoint);
    return response;
  } catch (error) {
    handleError(error as WretchError);
  }
}

export async function httpPatchRaw(
  url: string,
  endpoint: string,
  body = {},
  token?: string,
  headers?: HeadersInit,
  handleError = defaultHandleError,
): Promise<RawResponse | void> {
  const api = createRawRequest(url, token, headers);

  try {
    const response = await api.patch(body, endpoint);
    return response;
  } catch (error) {
    handleError(error as WretchError);
  }
}

export async function httpDeleteRaw(
  url: string,
  endpoint: string,
  token?: string,
  headers?: HeadersInit,
  handleError = defaultHandleError,
): Promise<RawResponse | void> {
  const api = createRawRequest(url, token, headers);

  try {
    const response = await api.delete(endpoint);
    return response;
  } catch (error) {
    handleError(error as WretchError);
  }
}

export async function httpHeadRaw(
  url: string,
  endpoint: string,
  token?: string,
): Promise<RawResponse | void> {
  const api = createRawRequest(url, token);

  try {
    const response = await api.head(endpoint);
    return response;
  } catch (error) {
    defaultHandleError(error as WretchError);
  }
}

export async function httpFormDataPost<T>(
  url: string,
  wretchOptions: WretchOptions = {},
  endpoint: string,
  body = {},
  token?: string,
  handleError = defaultHandleError,
): Promise<T | void> {
  const api = createRequest<T>(url + endpoint, wretchOptions, token);

  try {
    const response = await api.addon(FormDataAddon).formData(body).post();
    return response;
  } catch (error) {
    handleError(error as WretchError);
  }
}

export async function httpJsonDelete<T>(
  url: string,
  wretchOptions: WretchOptions = {},
  endpoint: string,
  body = {},
  token?: string,
): Promise<T | void> {
  const api = createRequest<T>(url, wretchOptions, token);

  try {
    const response = await api.json(body).delete(endpoint);
    return response;
  } catch (error) {
    defaultHandleError(error as WretchError);
  }
}
