import { loginWithBrowser } from '@cloud-editor-mono/domain/src/services/services-by-app/shared';
import {
  AUTH_ACTION_ATTEMPTED,
  getAccessToken,
  getAuthClientSync,
  getAuthState,
  isAuthenticated,
  logout as _logout,
  NO_AUTH_TOKEN_PLACEHOLDER,
  retrieveAuth0User,
} from '@cloud-editor-mono/domain/src/services/services-by-app/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { get, set } from 'idb-keyval';
import { useCallback, useContext, useState } from 'react';
import { useCopyToClipboard } from 'react-use';

import { sendAppLabNotification } from '../../features/notifications';
import { EdgeImpulseContext } from '../edge-impulse/edgeImpulseContext';
import { AuthContextValue } from './authContext';

const client = getAuthClientSync();

export function useAuth(): AuthContextValue {
  const { logout: edgeImpulseLogout, user: edgeImpulseUser } =
    useContext(EdgeImpulseContext);

  const queryClient = useQueryClient();
  const [skipped, setSkipped] = useState<boolean>(false);

  const [_, copyToClipboard] = useCopyToClipboard();

  const isAuthRoute = useRouterState({
    select: (s) => s.location.pathname === '/examples',
  });

  const enableAuthStateQuery = isAuthRoute && !skipped && !!client;
  const { data: authState } = useQuery(
    ['auth-state', isAuthRoute],
    () => {
      return getAuthState();
    },
    {
      enabled: enableAuthStateQuery,
    },
  );

  const enableTokenQuery = !skipped && !!client;
  const { data: token } = useQuery(
    ['auth-token', isAuthRoute, authState],
    () => {
      return getAccessToken(undefined, true, true);
    },
    {
      enabled: enableTokenQuery,
    },
  );
  const getTokenDone = Boolean(token && token !== NO_AUTH_TOKEN_PLACEHOLDER);

  const enableAuthCheckQuery = !skipped && !!client && getTokenDone;
  const { data: userIsAuthenticated } = useQuery(
    ['auth-check', isAuthRoute, token],
    () => {
      return isAuthenticated();
    },
    {
      enabled: enableAuthCheckQuery,
    },
  );

  const enableAutoFetchProfileQuery =
    getTokenDone && userIsAuthenticated === true;
  const { data: autoFetchedProfile } = useQuery(
    ['auth-user', isAuthRoute, token],
    () => {
      return retrieveAuth0User();
    },
    {
      enabled: enableAutoFetchProfileQuery,
    },
  );

  const {
    mutateAsync: login,
    isLoading: isLoginLoading,
    isError: isLoginError,
  } = useMutation({
    mutationFn: async (_params?: { isFromAccount: boolean }) => {
      await loginWithBrowser(false);
    },
    onSuccess: async (_, params) => {
      queryClient.invalidateQueries(['auth-token']);
      queryClient.invalidateQueries(['auth-check']);
      queryClient.invalidateQueries(['auth-user']);
      queryClient.invalidateQueries(['auth-state']);

      if (params && params.isFromAccount) {
        sendAppLabNotification({
          message: `You're logged in with your Arduino account`,
          variant: 'success',
        });
      }
    },
    onError: (error) => {
      sendAppLabNotification({
        message: `${error}`,
        variant: 'error',
        actions: [
          {
            text: 'Copy to Clipboard',
            onClick: () => copyToClipboard(`${error}`),
          },
        ],
      });
    },
  });

  const {
    mutateAsync: logout,
    isLoading: isLogoutLoading,
    isError: isLogoutError,
  } = useMutation({
    mutationFn: async () => {
      return _logout();
    },
    onSuccess: async () => {
      queryClient.resetQueries(['auth-token'], { exact: false });
      queryClient.resetQueries(['auth-check'], { exact: false });
      queryClient.resetQueries(['auth-user'], { exact: false });
      queryClient.resetQueries(['auth-state'], { exact: false });

      if (edgeImpulseUser) {
        await edgeImpulseLogout();
      }
    },
  });

  const { mutate: dismissWelcomePage } = useMutation({
    mutationFn: () => set('welcome-page-dismissed', true),
    onSuccess: () => {
      queryClient.invalidateQueries(['welcome-page-dismissed']);
    },
  });

  const { data: isWelcomePageDismissed } = useQuery(
    ['welcome-page-dismissed'],
    async () => {
      const data = await get('welcome-page-dismissed');
      return data ?? null;
    },
  );

  const skip = useCallback(async (): Promise<void> => {
    await set(AUTH_ACTION_ATTEMPTED, true);
    setSkipped(true);
  }, []);

  return {
    user: autoFetchedProfile,
    login,
    isLoginLoading,
    isLoginError,
    logout,
    isLogoutLoading,
    isLogoutError,
    skip,
    skipped,
    dismissWelcomePage,
    isWelcomePageDismissed,
  };
}
