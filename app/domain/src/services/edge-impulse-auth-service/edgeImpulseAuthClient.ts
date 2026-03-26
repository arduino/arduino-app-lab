/* eslint-disable @typescript-eslint/no-explicit-any */

import { Config } from '@cloud-editor-mono/common';

import { BackendAuthCache } from '../arduino-auth/arduinoAuthDesktopUtils';
import { EdgeImpulseUser, OAuthToken } from './edgeImpulseAuthService.type';
import {
  EI_KEYRING_USER,
  EI_STORAGE_KEYS,
  isRefreshTokenKey,
} from './edgeImpulseAuthUtils';

// Helper Deep Equal
function deepEqual(obj1: any, obj2: any) {
  if (obj1 === obj2) return true;
  if (
    typeof obj1 !== 'object' ||
    typeof obj2 !== 'object' ||
    obj1 === null ||
    obj2 === null
  )
    return false;
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  for (const key of keys1) {
    if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) return false;
  }
  return true;
}

function base64UrlEncode(arrayBuffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
export interface EdgeImpulseClientOptions {
  cache?: BackendAuthCache;
  domain?: string;
  clientId?: string;
}

export class EdgeImpulseClient {
  private studioHost: string;

  private cache: BackendAuthCache;
  private initializationPromise: Promise<void>;

  private _store: {
    user: EdgeImpulseUser | null;
    isAuthenticated: boolean;
  } = {
    user: null,
    isAuthenticated: false,
  };
  private _subscribers: Array<() => void> = [];
  private tokenCache: OAuthToken | null = null;
  private tokenExpiresAt: number = 0;
  private refreshPromise: Promise<string> | null = null;

  constructor(options: EdgeImpulseClientOptions) {
    this.studioHost = Config.EI_STUDIO_HOST;

    this.cache =
      options.cache || new BackendAuthCache(EI_KEYRING_USER, isRefreshTokenKey);

    this.initializationPromise = this.loadFromStorage();
  }

  public async waitForInitialization(): Promise<void> {
    await this.initializationPromise;
  }

  private generateRandomStateString(length: number): string {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    );
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return base64UrlEncode(array);
  }

  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(hashBuffer);
  }

  public async getAuthorizationUrl(): Promise<string> {
    const state = this.generateRandomStateString(16);
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    window.sessionStorage.setItem(EI_STORAGE_KEYS.VERIFIER, codeVerifier);
    window.sessionStorage.setItem(EI_STORAGE_KEYS.STATE, state);

    const params = new URLSearchParams({
      client_id: Config.EI_CLIENT_ID,
      redirect_uri: Config.EI_REDIRECT_URI,
      response_type: 'code',
      scope: Config.EI_SCOPE,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      defaultIdps: Config.EI_DEFAULT_IDPS,
    });

    return `${this.studioHost}/v1/oauth/authorize?${params.toString()}`;
  }

  public async handleRedirectCallback(url: string): Promise<void> {
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const state = urlObj.searchParams.get('state');

    if (!code) throw new Error('No code found in URL');

    const storedState = window.sessionStorage.getItem(EI_STORAGE_KEYS.STATE);

    if (!state || !storedState || state !== storedState) {
      window.sessionStorage.removeItem(EI_STORAGE_KEYS.STATE);
      window.sessionStorage.removeItem(EI_STORAGE_KEYS.VERIFIER);

      throw new Error('State mismatch or app reloaded during auth');
    }

    const codeVerifier = window.sessionStorage.getItem(
      EI_STORAGE_KEYS.VERIFIER,
    );
    if (!codeVerifier) {
      throw new Error('PKCE Code Verifier not found');
    }

    try {
      const token = await this.exchangeToken(code, codeVerifier);
      await this.setSession(token);
    } finally {
      window.sessionStorage.removeItem(EI_STORAGE_KEYS.VERIFIER);
      window.sessionStorage.removeItem(EI_STORAGE_KEYS.STATE);
    }
  }

  private async exchangeToken(
    code: string,
    verifier: string,
  ): Promise<OAuthToken> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: Config.EI_REDIRECT_URI,
      client_id: Config.EI_CLIENT_ID,
      code_verifier: verifier,
    });

    const response = await fetch(`${this.studioHost}/v1/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Token exchange failed: ${errText}`);
    }

    return response.json();
  }

  private async refreshToken(refreshToken: string): Promise<OAuthToken> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: Config.EI_CLIENT_ID,
    });

    const response = await fetch(`${this.studioHost}/v1/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token request failed: ${text}`);
    }
    return response.json();
  }

  private async setSession(token: OAuthToken) {
    this.tokenCache = token;
    this.tokenExpiresAt = Date.now() + token.expires_in * 1000 - 60000;

    const tokenToSave = {
      ...token,
      expiresAt: this.tokenExpiresAt,
    };

    await this.cache.set(EI_STORAGE_KEYS.TOKENS, tokenToSave);

    const user = await this.fetchUserInfo(token.access_token);

    this.store = {
      user,
      isAuthenticated: !!user,
    };
  }

  public async loadFromStorage() {
    const tokens = await this.cache.get(EI_STORAGE_KEYS.TOKENS);
    if (tokens) {
      this.tokenCache = tokens;

      this.tokenExpiresAt = tokens.expiresAt || 0;

      try {
        const accessToken = await this.getTokenSilently();

        const user = await this.fetchUserInfo(accessToken);
        this.store = {
          user,
          isAuthenticated: !!user,
        };
      } catch (e) {
        await this.logout();
      }
    }
  }

  public async getTokenSilently(): Promise<string> {
    if (!this.tokenCache) throw new Error('Login required');

    const now = Date.now();

    const isExpired =
      !this.tokenCache.access_token ||
      (this.tokenExpiresAt > 0 && now > this.tokenExpiresAt);

    const currentRefreshToken = this.tokenCache.refresh_token;

    if (isExpired && currentRefreshToken) {
      if (!this.refreshPromise) {
        this.refreshPromise = (async (): Promise<string> => {
          try {
            const newTokens = await this.refreshToken(currentRefreshToken);
            await this.setSession(newTokens);
            return newTokens.access_token;
          } catch (error) {
            await this.logout();
            throw error;
          } finally {
            this.refreshPromise = null;
          }
        })();
      }
      return this.refreshPromise;
    }

    if (!this.tokenCache.access_token)
      throw new Error('No access token available');

    return this.tokenCache.access_token;
  }

  public async getUser(): Promise<EdgeImpulseUser | null> {
    return this._store.user;
  }

  public async logout() {
    this.tokenCache = null;
    this.tokenExpiresAt = 0;
    await this.cache.remove(EI_STORAGE_KEYS.TOKENS);
    this.store = { user: null, isAuthenticated: false };
  }

  private async fetchUserInfo(
    accessToken: string,
  ): Promise<EdgeImpulseUser | null> {
    try {
      const response = await fetch(
        `${Config.EI_STUDIO_HOST}${Config.EI_USER_ENDPOINT}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!response.ok) return null;
      const data = await response.json();

      if (data && data.success) {
        return data;
      }
      return null;
    } catch (e) {
      console.error('Error fetching EI user', e);
      return null;
    }
  }

  public subscribe(callback: () => void) {
    this._subscribers.push(callback);
  }

  public unsubscribe(callback: () => void) {
    this._subscribers = this._subscribers.filter((sub) => sub !== callback);
  }

  private set store(value: typeof this._store) {
    if (deepEqual(this._store, value)) return;
    this._store = value;
    this._subscribers.forEach((cb) => cb());
  }

  get store() {
    return this._store;
  }
}
