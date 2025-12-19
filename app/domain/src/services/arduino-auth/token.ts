import { GetTokenSilentlyOptions } from '@bcmi-labs/art-auth';
import { BehaviorSubject } from 'rxjs';

import { getAuthAccessToken } from './arduinoAuthService';
import { NO_AUTH_TOKEN_PLACEHOLDER } from './arduinoAuthUtils';

export let getExternalAccessToken:
  | ((options?: GetTokenSilentlyOptions) => Promise<string>)
  | null = null;

export function setGetAccessToken(
  fn: ((options?: GetTokenSilentlyOptions) => Promise<string>) | null,
): void {
  getExternalAccessToken = fn;
}

export let tokenNotRequired = false;
export function setTokenNotRequired(value: boolean): void {
  tokenNotRequired = value;
}

let isUnauthorizedEvents$: BehaviorSubject<boolean> | null = null;

export function resetIsUnauthorizedEvents(): void {
  isUnauthorizedEvents$ = null;
}

function initIsUnauthorizedEvents(): BehaviorSubject<boolean> {
  isUnauthorizedEvents$ = new BehaviorSubject<boolean>(false);

  return isUnauthorizedEvents$;
}

export function getIsUnauthorizedEvents$(): BehaviorSubject<boolean> {
  return isUnauthorizedEvents$ || initIsUnauthorizedEvents();
}

export function isUnauthorizedEventsNext(value: boolean): void {
  const subject = getIsUnauthorizedEvents$();
  subject.next(value);
}

export function getAccessToken(
  options?: GetTokenSilentlyOptions,
  ignoreTokenNotRequired = false,
  doNotForceLogin = false,
): Promise<string> {
  if (
    !ignoreTokenNotRequired &&
    tokenNotRequired &&
    !getIsUnauthorizedEvents$().getValue()
  ) {
    return Promise.resolve(NO_AUTH_TOKEN_PLACEHOLDER);
  }

  if (getExternalAccessToken) {
    return getExternalAccessToken(options);
  }

  return getAuthAccessToken(options, doNotForceLogin);
}
