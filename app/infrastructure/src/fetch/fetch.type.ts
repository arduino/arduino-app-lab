import { Wretch } from 'wretch';
import { AbortResolver, AbortWretch } from 'wretch/addons/abort';
import { QueryStringAddon } from 'wretch/addons/queryString';
import { WretchError } from 'wretch/resolver';

export type WretchQueryParams = string | object;

export type BaseRequest<T> = AbortWretch &
  Wretch<AbortWretch, AbortResolver, Promise<Awaited<T>>>;

export type QueriedRequest<T> = QueryStringAddon &
  AbortWretch &
  Wretch<AbortWretch & QueryStringAddon, AbortResolver, Promise<Awaited<T>>>;

export type RawResponse = Response;

export type FetchError = WretchError;
