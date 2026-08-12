/* eslint-disable @typescript-eslint/no-explicit-any */
import { Auth0Client } from '@auth0/auth0-spa-js';
import { type JwtPayload, jwtDecode } from 'jwt-decode';

import { checkResponse, unauthenticatedUser } from './provider/provider';
import { ArduinoUser, AuthClientOptions, Customization } from './types';

declare module '@auth0/auth0-spa-js' {
  export interface Auth0Client {
    getUser<TUser extends ArduinoUser = ArduinoUser>(): Promise<
      TUser | undefined
    >;
  }
}

type CustomizationData = {
  customization: Customization;
  env: { API_URL: string };
  remoteConfKey: string;
};

export function deepEqual(obj1: unknown, obj2: unknown): boolean {
  // Base case: If both objects are identical, return true.
  if (obj1 === obj2) {
    return true;
  }
  // Check if both objects are objects and not null.
  if (
    typeof obj1 !== 'object' ||
    typeof obj2 !== 'object' ||
    obj1 === null ||
    obj2 === null
  ) {
    return false;
  }

  // Get the keys of both objects.
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  // Check if the number of keys is the same.
  if (keys1.length !== keys2.length) {
    return false;
  }
  // Iterate through the keys and compare their values recursively.
  for (const key of keys1) {
    if (
      !keys2.includes(key) ||
      !deepEqual(obj1[key as keyof typeof obj1], obj2[key as keyof typeof obj2])
    ) {
      return false;
    }
  }
  // If all checks pass, the objects are deep equal.
  return true;
}

class AuthClient extends Auth0Client {
  private customConfig: CustomizationData | undefined;
  private _store: {
    user: ArduinoUser;
    isAuthenticated: boolean;
  };
  private _subscribers: Array<() => void> = [];

  private constructor(
    options: AuthClientOptions,
    customConfig?: CustomizationData,
  ) {
    super(options.config);
    this.customConfig = customConfig;

    this._store = {
      user: unauthenticatedUser,
      isAuthenticated: false,
    };

    this._subscribers = [];

    // Try to pre-fill token cache as soon as possible (and ignore errors)
    this.checkSession().catch(() => {});
  }

  static async createCloudClient(
    options: AuthClientOptions,
    remoteConfKey: string,
    env: {
      /** The base URL of the API where customization-api is hosted. */
      API_URL: string;
    },
  ): Promise<any> {
    try {
      const customization = await checkResponse<Customization>(
        await fetch(
          `${env.API_URL}/customization/v1/customizable/${remoteConfKey}`,
        ),
      );

      // If customization is not enabled, return the base configuration
      if (!customization.url_enabled) {
        console.error('[AuthClient] Customization is not enabled.');
        // Redirect to the failed auth page
        const failedAuthPage = `${customization.url}/auth-failed`;
        if (!window.location.href.includes(failedAuthPage)) {
          window.location.href = failedAuthPage;
        }
      }

      // Enrich the configuration with the custom data
      const { config } = options;
      config.clientId = customization.auth0_id;

      // Add the company url authparam...
      config.authorizationParams = {
        ...config.authorizationParams,
        company_url: remoteConfKey,
      };

      return new AuthClient(
        { ...options, config },
        { customization, env, remoteConfKey },
      );
    } catch (e) {
      console.error('[AuthClient] Failed to load custom configuration.');
      // Bubble up the error, not much we can do here
      throw e;
    }
  }

  static create(options: AuthClientOptions): AuthClient {
    return new AuthClient(options);
  }

  public getCustomization(): Customization | undefined {
    return this.customConfig?.customization;
  }

  public async checkTosAcceptance(): Promise<boolean> {
    if (!this.customConfig) {
      console.warn('[AuthClient] Custom configuration not available.');
      return true;
    }

    // Get JWT token and parse it. Will throw an error if the token is not available/user is not authenticated.
    const decodedToken = jwtDecode<JwtPayload & { tos_accepted?: boolean }>(
      await this.getTokenSilently(),
    );
    return Boolean(decodedToken.tos_accepted);
  }

  private async validateTos(): Promise<void> {
    if (!this.customConfig) {
      console.warn('[AuthClient] Custom configuration not available.');
      return;
    }

    const isTosAccepted = await this.checkTosAcceptance();
    const cloudTosPage = `${this.customConfig.customization.url}/tos-acceptance`;

    // Check that the user has accepted the TOS. If not, redirect to the TOS page on CloudHome (skip if we're on the TOS page).
    if (!isTosAccepted && !window.location.href.includes(cloudTosPage)) {
      console.warn(
        '[AuthClient] User has not accepted the TOS. Redirecting to TOS page...',
      );
      window.location.href = cloudTosPage;
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  public override async handleRedirectCallback<TAppState = any>(
    ...args: Parameters<Auth0Client['handleRedirectCallback']>
  ) {
    const res = await super.handleRedirectCallback<TAppState>(...args);
    if (this.customConfig && (await this.isAuthenticated())) {
      await this.validateTos();
    }
    return res;
  }


  public override async getUser(
    ...args: Parameters<Auth0Client['getUser']>
  ): Promise<ArduinoUser | undefined> {
    const res = await super.getUser(...args);
    this.store = {
      user: res || unauthenticatedUser,
      isAuthenticated: !!res,
    };
    return res;
  }

  public subscribe(callback: () => void): void {
    if (typeof callback === 'function') {
      this._subscribers.push(callback);
    }
  }

  /**
   * Unsubscribe from store changes.
   */
  public unsubscribe(callback: () => void): void {
    this._subscribers = this._subscribers.filter((sub) => sub !== callback);
  }

  private set store(value) {
    //  Avoid updating the store if the value is the sames
    if (deepEqual(this._store, value)) {
      return;
    }

    this._store = value;
    // Notify subscribers
    for (const subscriber of this._subscribers) {
      subscriber();
    }
  }

  get store(): {
    user: ArduinoUser;
    isAuthenticated: boolean;
  } {
    return this._store;
  }
}

export { AuthClient };
