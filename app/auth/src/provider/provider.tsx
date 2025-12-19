import { GenericError } from '@auth0/auth0-spa-js';
import { useState } from 'react';

import type { AuthClient } from '../authClient';
import type { ArduinoUser } from '../types';
import type { AuthContextType } from './context';
import { AuthContext } from './context';

const fakeUser: ArduinoUser = {
  name: 'John Smith',
  'http://arduino.cc/id': '',
  'http://arduino.cc/username': '',
  'http://arduino.cc/logins': 0,
  email: 'johh.smith@fakedomain.cc',
  picture: '',
};

/** Light wrapper of auth0 provider */
export function AuthProvider(props: {
  children: React.ReactNode;
  authClient: AuthClient;
  forceLogin?: boolean;
  env: {
    API_URL: string;
  };
  onRedirectCallback?: (appState: URLSearchParams) => void;
  skipRedirectCallback?: boolean;
  onAuthenticated?: (user: ArduinoUser) => void;
  onAuthenticationError?: (error: Error | GenericError) => void | Promise<void>;
}):
  | ((error: Error | GenericError) => void | Promise<void>)
  | JSX.Element
  | undefined {
  const [client] = useState(props.authClient);

  const syncAuthState = async (): Promise<ArduinoUser> => fakeUser;

  // Memoized context value to avoid unnecessary re-renders
  const contextValue: AuthContextType = {
    client,
    user: fakeUser,
    isAuthenticated: true,
    syncAuthState,
  };
  return (
    <AuthContext.Provider value={contextValue}>
      {props.children}
    </AuthContext.Provider>
  );
}
