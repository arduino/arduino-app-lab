import {
  ArduinoUser,
  Auth0ClientOptions,
  AuthClient,
  GetTokenSilentlyOptions,
  LogoutOptions,
  RedirectLoginOptions,
} from '@bcmi-labs/art-auth';
import { Config } from '@cloud-editor-mono/common';

import { AppState } from './auth0.type';
import { deploymentPath } from './utils';

export async function createAuth0Instance(
  options: Auth0ClientOptions,
  timeout: number,
): Promise<AuthClient> {
  const config = {
    authorizeTimeoutInSeconds: timeout,
    useRefreshTokens: false,
    ...options,
  };

  const auth0 = deploymentPath.customKey
    ? await AuthClient.createCloudClient(
        {
          config,
        },
        deploymentPath.customKey,
        { API_URL: Config.WL_API_URL },
      ).catch(() => AuthClient.create({ config }))
    : AuthClient.create({
        config,
      });

  return auth0;
}

export async function getAuth0AppState(
  client: AuthClient,
): Promise<AppState | null> {
  try {
    const callbackResponse = await client.handleRedirectCallback();
    return callbackResponse.appState;
  } catch {
    return null;
  }
}

export async function loginAuth0WithRedirect(
  client: AuthClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: RedirectLoginOptions<any>,
): Promise<void> {
  client.loginWithRedirect(options);
}

export async function logoutAuth0(
  client: AuthClient,
  options: LogoutOptions,
): Promise<void> {
  client.logout(options);
}

export async function getAuth0User(
  client: AuthClient,
): Promise<ArduinoUser | null> {
  const user = await client.getUser();
  return user ? user : null;
}

export function auth0IsAuthenticated(client: AuthClient): Promise<boolean> {
  return client.isAuthenticated();
}

export function getAuth0TokenSilently(
  client: AuthClient,
  options?: GetTokenSilentlyOptions,
): Promise<string> {
  return client.getTokenSilently(options);
}
