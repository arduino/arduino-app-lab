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
  isAuthenticated,
  login,
  NO_AUTH_TOKEN_PLACEHOLDER,
  retrieveAuth0User,
  retrieveUserRestrictionsRecap,
  setTokenNotRequired,
} from '@cloud-editor-mono/domain';
import { USER_CLAIM_ID } from '@cloud-editor-mono/infrastructure';
import { useQuery } from '@tanstack/react-query';
import { useContext } from 'react';

import { useSketchParams } from '../../../cloud-editor/features/main/hooks/sketch';
import { useObservable } from '../../../common/hooks/useObservable';
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

  const { data: client } = useQuery(['auth-init'], getAuthClient, {
    enabled: !isAuthInjected,
  });

  const { data: token } = useQuery(
    ['auth-token'],
    () =>
      getAccessToken(
        undefined,
        true,
        isReadOnlyAndAuthorized || doNotForceLogin,
      ),
    {
      enabled: !isAuthInjected && !!client,
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
    enabled:
      getTokenDone &&
      userIsAuthenticated === false &&
      !isReadOnlyAndAuthorized &&
      !doNotForceLogin,
  });

  const { data: profileResponse } = useQuery(['auth-user'], retrieveAuth0User, {
    enabled: getTokenDone && userIsAuthenticated === true,
  });

  const profile = injectedProfile || profileResponse || undefined;

  const { data: restrictionsResponse } = useQuery(
    ['user-restrictions-recap', profile?.[USER_CLAIM_ID]],
    () => retrieveUserRestrictionsRecap(profile?.[USER_CLAIM_ID]),
    {
      enabled: !!profile,
    },
  );

  useQuery(
    ['analytics', profile?.[USER_CLAIM_ID]],
    () => (profile ? analyticsBootstrap(profile) : Promise.reject()),
    {
      enabled: !!profile && !isIotComponent,
      onSuccess: async () => {
        if (profile && !initEventEmitted) {
          ga4Emitter({
            type: 'INIT',
          });
          initEventEmitted = true;
        }
      },
    },
  );

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
  };
}
