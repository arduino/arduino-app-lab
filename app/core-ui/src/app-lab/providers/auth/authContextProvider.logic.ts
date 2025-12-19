import { ArduinoUser, AuthClient } from '@bcmi-labs/art-auth';
import {
  getAccessToken,
  getAuthClient,
  isAuthenticated,
  login,
  retrieveAuth0User,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { useQuery } from '@tanstack/react-query';
import { useContext } from 'react';

import { NetworkContext } from '../network/networkContext';
import { AuthContextValue } from './authContext';

export function useAuth(
  doNotForceLogin?: boolean,
  injectedProfile?: ArduinoUser,
  injectedProfileLoading?: boolean,
): AuthContextValue & {
  client?: AuthClient;
  token?: string;
} {
  const { isConnected } = useContext(NetworkContext);

  const isAuthInjected = Boolean(
    injectedProfile || (!injectedProfile && injectedProfileLoading),
  );

  const { data: client } = useQuery(['auth-init'], getAuthClient, {
    enabled: !isAuthInjected,
  });

  const { data: token } = useQuery(
    ['auth-token'],
    () => getAccessToken(undefined, true, doNotForceLogin),
    {
      enabled: isConnected && !isAuthInjected && !!client,
    },
  );
  const getTokenDone = Boolean(token || token === '');

  const { data: userIsAuthenticated } = useQuery(
    ['auth-check'],
    isAuthenticated,
    {
      enabled: getTokenDone,
    },
  );

  useQuery(['auth-login'], login, {
    enabled: getTokenDone && userIsAuthenticated === false && !doNotForceLogin,
  });

  const { data: profileResponse } = useQuery(['auth-user'], retrieveAuth0User, {
    enabled: getTokenDone && userIsAuthenticated === true,
  });

  const profile = injectedProfile || profileResponse || undefined;

  return {
    client,
    token,
    user: profile,
    isAuthInjected,
  };
}
