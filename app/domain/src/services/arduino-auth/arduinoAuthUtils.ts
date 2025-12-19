import { Auth0ClientOptions, AuthorizationParams } from '@bcmi-labs/art-auth';
import { Config } from '@cloud-editor-mono/common';
import { deploymentPath } from '@cloud-editor-mono/infrastructure';

function uriWithKey(uri: string): string {
  if (deploymentPath.customKey) {
    return uri.replace('https://', `https://${deploymentPath.customKey}.`);
  }
  return uri;
}

const { APP_URL, CLOUD_HOME_URL } = Config;

const redirect_uri = `${APP_URL}/redirect`;
const logout_uri = `${CLOUD_HOME_URL}/sketches`;

export const defaultAuth0Options: Auth0ClientOptions & {
  authorizationParams: AuthorizationParams & {
    state: string;
  };
} = {
  domain: Config.AUTH_URL,
  clientId: Config.AUTH_ID,
  authorizationParams: {
    redirect_uri: uriWithKey(redirect_uri),
    logout_uri: uriWithKey(logout_uri),
    audience: Config.AUTH_AUDIENCE,
    scope: Config.AUTH_SCOPE,
    state: generateDefaultStateOption(),
  },
  cacheLocation: 'memory',
};

export const SILENT_AUTHENTICATION_TIMEOUT = 5;

export function generateDefaultStateOption(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export function noTokenReject(): Promise<never> {
  return Promise.reject(new Error('User not authorized to perform request'));
}

export const NOT_ADULT_TYPES = ['coppa', 'edu'];

export const AUTH_COOKIE_SUBSTRING = `; auth0.${defaultAuth0Options.authorizationParams.client_id}.is.authenticated=`;
export const EXPIRED_COOKIE = `auth0.${defaultAuth0Options.authorizationParams.client_id}.is.authenticated=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;

export const AUTH_REDIRECT_TO_STORAGE_KEY = 'authRedirectTo';

export const NO_AUTH_TOKEN_PLACEHOLDER = 'token-placeholder';
