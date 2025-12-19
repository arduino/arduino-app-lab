import { Config } from '@cloud-editor-mono/common';
import {
  AUTH_REDIRECT_TO_STORAGE_KEY,
  getAuthState,
} from '@cloud-editor-mono/domain';
import { useNavigate, useSearch } from '@tanstack/react-location';
import { del, get } from 'idb-keyval';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useHash } from 'react-use';

import { useShowUserSettings } from '../../../../common/hooks/queries/user';
import { AuthContext } from '../../../../common/providers/auth/authContext';
import { MAIN_PATH } from '../../../../routing/Router';
import {
  HIGHLIGHT_PARAM,
  NotFoundType,
} from '../../../../routing/routing.type';
import { useNavigateToNotFound, useNavigateToPreview } from './routingUtils';
import { useIsNotFoundRoute } from './sketch';

type UseNavigateToInitialRoute = () => {
  navigateToInitialRoute: () => void;
};

export const useNavigateToInitialRoute: UseNavigateToInitialRoute =
  function (): ReturnType<UseNavigateToInitialRoute> {
    const navigate = useNavigate();

    const navigateToInitialRoute = useCallback(() => {
      navigate({
        to: MAIN_PATH,
        from: { pathname: MAIN_PATH !== '/' ? '/' : Config.ROUTING_BASE_URL },
        fromCurrent: false,
      });
    }, [navigate]);

    return { navigateToInitialRoute };
  };

type UseRedirectToInitialRoute = (shouldRedirect: boolean) => void;

export const useRedirectToInitialRoute: UseRedirectToInitialRoute = function (
  shouldRedirect: boolean,
): ReturnType<UseRedirectToInitialRoute> {
  const { navigateToInitialRoute } = useNavigateToInitialRoute();

  useEffect(() => {
    if (shouldRedirect) {
      navigateToInitialRoute();
    }
  }, [navigateToInitialRoute, shouldRedirect]);
};

type UseNavigateToSketchRouteWOUsername = (id: string) => {
  navigateToRoute: () => void;
};

export const useNavigateToSketchRouteWOUsername: UseNavigateToSketchRouteWOUsername =
  function (id: string): ReturnType<UseNavigateToSketchRouteWOUsername> {
    const navigate = useNavigate();

    const navigateToRoute = useCallback(() => {
      navigate({
        to: `${MAIN_PATH}${id}`,
        from: { pathname: MAIN_PATH !== '/' ? '/' : Config.ROUTING_BASE_URL },
        fromCurrent: false,
      });
    }, [navigate, id]);

    return { navigateToRoute };
  };

type UseRedirectToSketchRouteWOUsername = (
  shouldRedirect: boolean,
  id: string,
  usernameToRemoveFromUrl: string,
) => { usernameRemoved?: string };

export const useRedirectToSketchRouteWOUsername: UseRedirectToSketchRouteWOUsername =
  function (
    shouldRedirect: boolean,
    id: string,
    usernameToRemoveFromUrl: string,
  ): ReturnType<UseRedirectToSketchRouteWOUsername> {
    const { navigateToRoute } = useNavigateToSketchRouteWOUsername(id);
    const [usernameRemoved, setUsernameRemoved] = useState<string>();

    useEffect(() => {
      if (shouldRedirect) {
        navigateToRoute();
        setUsernameRemoved(usernameToRemoveFromUrl);
      }
    }, [navigateToRoute, shouldRedirect, usernameToRemoveFromUrl]);

    return { usernameRemoved };
  };

type UseTranslateHashToHighlightParam = (shouldTranslate: boolean) => void;

export const useTranslateHashToHighlightParam: UseTranslateHashToHighlightParam =
  function (
    shouldTranslate: boolean,
  ): ReturnType<UseTranslateHashToHighlightParam> {
    const [hash] = useHash();

    const navigate = useNavigate();
    const search = useSearch();

    useEffect(() => {
      if (shouldTranslate && hash) {
        const values = hash.slice(1).split(',').filter(Boolean);
        if (values.length > 0) {
          const highlight = values.join(',');

          navigate({
            search: {
              ...search,
              [HIGHLIGHT_PARAM]: highlight,
            },
            hash: '',
          });
        }
      }
    }, [hash, navigate, search, shouldTranslate]);
  };

type UseRedirectToWebIDE = (
  shouldRedirect: boolean,
  handleOptOut: () => Promise<void>,
) => void;

export const useRedirectToWebIDE: UseRedirectToWebIDE = function (
  shouldRedirect: boolean,
  redirect: () => Promise<void>,
): ReturnType<UseRedirectToWebIDE> {
  const { user } = useContext(AuthContext);
  const { data: userSettings, isLoading: settingsAreLoading } =
    useShowUserSettings(!!user);

  useEffect(() => {
    if (
      userSettings?.optin === false &&
      !settingsAreLoading &&
      shouldRedirect
    ) {
      redirect();
    }
  }, [redirect, settingsAreLoading, shouldRedirect, userSettings?.optin]);
};

type UseRedirectToIoT = (
  shouldRedirect: boolean,
  thingId: string | undefined,
) => void;

export const useRedirectToIoT: UseRedirectToIoT = function (
  shouldRedirect: boolean,
  thingId: string | undefined,
): ReturnType<UseRedirectToIoT> {
  useEffect(() => {
    if (shouldRedirect && thingId) {
      window.location.replace(`/things/${thingId}/sketch`);
    }
  }, [shouldRedirect, thingId]);
};

export function useNotFound(shouldRedirect: boolean, type: NotFoundType): void {
  const { navigateToNotFound } = useNavigateToNotFound();
  const isNotFoundRoute = useIsNotFoundRoute();

  useEffect(() => {
    if (shouldRedirect && !isNotFoundRoute) {
      navigateToNotFound(type);
    }
  }, [isNotFoundRoute, navigateToNotFound, shouldRedirect, type]);
}

export function useRedirectAfterLogin(): void {
  const navigate = useNavigate();

  const redirectWithAuthState = useCallback(async () => {
    const redirectInfo = await get(AUTH_REDIRECT_TO_STORAGE_KEY);

    if (!redirectInfo) {
      return;
    }

    await del(AUTH_REDIRECT_TO_STORAGE_KEY);

    const state = await getAuthState();

    if (state && redirectInfo.previousState === state.previousState) {
      navigate({ to: redirectInfo.redirectTo });
    }
  }, [navigate]);

  useEffect(() => {
    redirectWithAuthState();
  }, [redirectWithAuthState]);
}

export function useRedirectToPreview(shouldRedirect: boolean): void {
  const { navigateToPreview } = useNavigateToPreview();

  useEffect(() => {
    if (shouldRedirect) {
      navigateToPreview();
    }
  }, [navigateToPreview, shouldRedirect]);
}
