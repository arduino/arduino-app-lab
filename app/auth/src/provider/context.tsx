import { createContext, useContext } from 'react';

import type { AuthClient } from '../authClient';
import type { ArduinoUser, ArduinoUserEnrichedData } from '../types';

const unauthenticatedUser: ArduinoUser = {
  name: '',
  'http://arduino.cc/id': '',
  'http://arduino.cc/username': '',
  'http://arduino.cc/logins': 0,
  email: '',
  picture: '',
};

/**
 * @ignore
 */
const stub = (): never => {
  throw new Error('You forgot to wrap your component in <AuthProvider>.');
};

export type AuthContextType = {
  /**
   * The user profile, enriched with extra Arduino-specific data.
   */
  user: ArduinoUser & { settings?: Record<string, unknown> } & Omit<
      ArduinoUserEnrichedData,
      'private'
    > &
    ArduinoUserEnrichedData['private'];

  /** Whether the user is authenticated or not. */
  isAuthenticated: boolean;
  /**
   * Synchronise the authentication state with the Auth0 client.
   *
   * Useful if you're handling authentication outside of the AuthProvider,
   * or if you want to force a re-sync of the authentication state.
   */
  syncAuthState: () => Promise<ArduinoUser>;
  /** Retrieve the inner AuthClient instance. */
  client: AuthClient;
};

export const AuthContext = createContext<AuthContextType>({
  client: undefined as unknown as AuthClient, // Classic context hack to avoid providing a default value.
  user: unauthenticatedUser,
  isAuthenticated: false,
  syncAuthState: stub,
});

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a AuthProvider');
  }
  return context;
}
