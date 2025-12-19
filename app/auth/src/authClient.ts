/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  AuthClientOptions,
  GetTokenSilentlyOptions,
  LogoutOptions,
  RedirectLoginOptions,
} from './types';

class AuthClient extends Object {
  static async createCloudClient(
    options: AuthClientOptions,
    remoteConfKey: string,
    env: {
      /** The base URL of the API where customization-api is hosted. */
      API_URL: string;
    },
  ): Promise<any> {
    console.log(options);
    console.log(remoteConfKey);
    console.log(env);
    return {};
  }
  static async create(options: AuthClientOptions): Promise<any> {
    console.log(options);
    return {};
  }
  getCustomization(): any {
    return {};
  }

  handleRedirectCallback(): any {
    return {};
  }

  loginWithRedirect(options: RedirectLoginOptions<any>): any {
    console.log(options);
    return {};
  }

  logout(options: LogoutOptions): any {
    console.log(options);
    return {};
  }

  getUser(): any {
    return {};
  }

  async isAuthenticated(): Promise<boolean> {
    return true;
  }

  getTokenSilently(options?: GetTokenSilentlyOptions): any {
    console.log(options);
    return {};
  }
}

export { AuthClient };
