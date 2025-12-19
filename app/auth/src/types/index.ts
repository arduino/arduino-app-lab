import type { User } from '@auth0/auth0-spa-js';

// Re-export types from auth0-spa-js
export type { GenericError } from '@auth0/auth0-spa-js';

export type Customization = {
  auth0_id: string;
  url: string;
  url_enabled: boolean;
  custom_tos: string;
  organization_id: string;
  organization_name: string;
  organization_logo: string;
  organization_second_logo: string;
  policy_url: string;
  user_id: string;
  cus_date: string;
  social_logins?: Array<'AppleID' | 'Gsuite' | 'GitHub'>;
  colors?: Array<string>;
};

export type ArduinoUser = User & {
  'http://arduino.cc/is_teen'?: boolean;
  'http://arduino.cc/is_minor'?: boolean;
  'http://arduino.cc/id': string;
  'http://arduino.cc/username': string;
  ['http://arduino.cc/logins']: number;
  email: string;
  name: string;
  picture: string;
};

/**
 * Grouped type for the enriched user data. You'll never get all of these fields at once.
 */
export type ArduinoUserEnrichedData = Partial<{
  id: string;
  username: string;
  private: {
    birth_date?: string;
    birth_place?: string;
    country?: string;
    gender?: string;
    location?: string;
    name?: string;
    timezone?: string;
  };
  // These will only be available if the user is a minor
  avatar: string;
  birthday: string;
  confirmed: string;
  created: string;
  name: string;
}>;

/* eslint-disable @typescript-eslint/no-unnecessary-type-constraint */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type AuthClientOptions = {
  config: any;
};

type Auth0ClientOptions = any;
type AuthorizationParams = any;

type GetTokenSilentlyOptions = any;
type LogoutOptions = any;
type RedirectLoginOptions<T extends any> = T;

export type {
  Auth0ClientOptions,
  AuthorizationParams,
  GetTokenSilentlyOptions,
  LogoutOptions,
  RedirectLoginOptions,
};
