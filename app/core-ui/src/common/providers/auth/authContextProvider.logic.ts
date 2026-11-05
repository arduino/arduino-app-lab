import { ArduinoUser, AuthClient } from '@bcmi-labs/art-auth';
import {
  analyticsBootstrap,
  ga4Emitter,
  getAccessToken,
  getAiUserPlan,
  getAuthClient,
  getCanShareToClassroom,
  getCanUseOta,
  getCompileUsageExceeded,
  getGenAiInteractions,
  getIsUnauthorizedEvents$,
  getSpace,
  isAuthenticated,
  login,
  NO_AUTH_TOKEN_PLACEHOLDER,
  retrieveAuth0User,
  retrieveUserPolicies,
  retrieveUserRestrictionsRecap,
  setTokenNotRequired,
} from '@cloud-editor-mono/domain';
import { USER_CLAIM_ID } from '@cloud-editor-mono/infrastructure';
import { useQuery } from '@tanstack/react-query';
import { useContext, useEffect } from 'react';

import { useSketchParams } from '../../../cloud-editor/features/main/hooks/sketch';
import { useObservable } from '../../hooks/useObservable';
import { ComponentContext } from '../component/componentContext';
import { AuthContextValue } from './authContext';

let initEventEmitted = false;

export function useAuth(
  doNotForceLogin?: boolean,
  injectedProfile?: ArduinoUser,
  injectedProfileLoading?: boolean,
): AuthContextValue & {
  client?: AuthClient;
  token?: string;
} {
  const { isIotComponent } = useContext(ComponentContext);

  const { viewMode } = useSketchParams();

  const isNotAuthorizedEvents$ = getIsUnauthorizedEvents$();
  const isNotAuthorizedEvent = useObservable(isNotAuthorizedEvents$);

  // ** this is truthy when a request for a supposedly public sketch
  // ** actually returns a 401
  const isReadOnlyAndAuthorized = Boolean(viewMode && !isNotAuthorizedEvent);
  setTokenNotRequired(isReadOnlyAndAuthorized);

  const isAuthInjected = Boolean(
    injectedProfile || (!injectedProfile && injectedProfileLoading),
  );

  const { data: client } = useQuery<AuthClient | undefined>({
    queryKey: ['auth-init'],
    queryFn: getAuthClient,
    enabled: !isAuthInjected,
  });

  const { data: token } = useQuery({
    queryKey: ['auth-token'],

    queryFn: () =>
      getAccessToken(
        undefined,
        true,
        isReadOnlyAndAuthorized || doNotForceLogin,
      ),

    enabled: !isAuthInjected && !!client,
  });
  const getTokenDone = Boolean(token || token === '');

  const { data: userIsAuthenticated } = useQuery({
    queryKey: ['auth-check'],
    queryFn: isAuthenticated,
    enabled: getTokenDone,
  });

  useQuery({
    queryKey: ['auth-login'],
    queryFn: login,
    enabled:
      getTokenDone &&
      userIsAuthenticated === false &&
      !isReadOnlyAndAuthorized &&
      !doNotForceLogin,
  });

  const { data: profileResponse } = useQuery({
    queryKey: ['auth-user'],
    queryFn: () => retrieveAuth0User(),
    enabled: getTokenDone && userIsAuthenticated === true,
  });

  const profile = injectedProfile || profileResponse || undefined;

  const { data: restrictionsResponse } = useQuery({
    queryKey: [
      'user-restrictions-recap',
      (profile as ArduinoUser)?.[USER_CLAIM_ID],
    ],
    queryFn: () =>
      retrieveUserRestrictionsRecap((profile as ArduinoUser)?.[USER_CLAIM_ID]),
    enabled: !!profile,
  });

  const space = getSpace();

  const { data: policiesResponse, isLoading: policiesAreLoading } = useQuery({
    queryKey: [
      'user-policies',
      (profile as ArduinoUser)?.[USER_CLAIM_ID],
      space,
    ],
    queryFn: retrieveUserPolicies,
    enabled: !!profile && !!space,
    // A role change takes effect on the next session.
    staleTime: Infinity,
  });

  const { isSuccess: analyticsSuccess } = useQuery({
    queryKey: ['analytics', (profile as ArduinoUser)?.[USER_CLAIM_ID]],
    queryFn: () => (profile ? analyticsBootstrap(profile) : Promise.reject()),
    enabled: !!profile && !isIotComponent,
  });

  // Handle successful analytics bootstrap
  useEffect(() => {
    if (analyticsSuccess && profile && !initEventEmitted) {
      ga4Emitter({
        type: 'INIT',
      });
      initEventEmitted = true;
    }
  }, [analyticsSuccess, profile]);

  return {
    client,
    token,
    user: isReadOnlyAndAuthorized
      ? token === NO_AUTH_TOKEN_PLACEHOLDER
        ? null
        : profile
      : profile,
    isAuthInjected,
    userNotTargetAudience: false,
    compileUsageExceeded:
      restrictionsResponse && getCompileUsageExceeded(restrictionsResponse),
    canUseOta: restrictionsResponse && getCanUseOta(restrictionsResponse),
    canUseGenAi: true,
    canShareToClassroom:
      restrictionsResponse && getCanShareToClassroom(restrictionsResponse),
    aiUserPlan: restrictionsResponse && getAiUserPlan(restrictionsResponse),
    genAiInteractions:
      restrictionsResponse && getGenAiInteractions(restrictionsResponse),
    isViewMode: !!viewMode,
    isOrganizationSpace: !!space,
    policies: policiesResponse?.policies,
    policiesAreLoading,
  };
}
