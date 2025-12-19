import {
  ArduinoUser,
  AuthProvider as ArtAuthProvider,
} from '@bcmi-labs/art-auth';
import { Config } from '@cloud-editor-mono/common';
import { Suspense } from 'react';

import { AuthContext } from './authContext';
import { useAuth } from './authContextProvider.logic';

interface AuthContextProviderProps {
  doNotForceLogin?: boolean;
  profile?: ArduinoUser;
  profileIsLoading?: boolean;
  children?: React.ReactNode;
}

const AuthContextProvider: React.FC<AuthContextProviderProps> = ({
  doNotForceLogin,
  profile,
  profileIsLoading,
  children,
}: AuthContextProviderProps) => {
  const { client, isAuthInjected, ...rest } = useAuth(
    doNotForceLogin,
    profile,
    profileIsLoading,
  );

  if (isAuthInjected) {
    return (
      <AuthContext.Provider value={{ ...rest, isAuthInjected: true }}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <Suspense>
      {client ? (
        <AuthContext.Provider value={{ ...rest, isAuthInjected: false }}>
          <ArtAuthProvider
            env={{ API_URL: Config.API_URL }}
            authClient={client}
            skipRedirectCallback
          >
            {children}
          </ArtAuthProvider>
        </AuthContext.Provider>
      ) : null}
    </Suspense>
  );
  // TODO add arduino page loader here
};

export default AuthContextProvider;
