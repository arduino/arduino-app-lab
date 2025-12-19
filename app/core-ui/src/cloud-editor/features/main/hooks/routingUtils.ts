import { Config } from '@cloud-editor-mono/common';
import { useNavigate, useSearch } from '@tanstack/react-location';
import { useCallback } from 'react';

import { notFoundRouteMap } from '../../../../routing/Router';
import {
  NotFoundType,
  SearchGenerics,
  VIEW_MODE_PARAM,
} from '../../../../routing/routing.type';

type UseNavigateToNotFound = () => {
  navigateToNotFound: (type: NotFoundType) => void;
};

export const useNavigateToNotFound: UseNavigateToNotFound =
  function (): ReturnType<UseNavigateToNotFound> {
    const navigate = useNavigate();
    const search = useSearch<SearchGenerics>();

    const navigateToNotFound = useCallback(
      (type: NotFoundType) => {
        const to = `${
          Config.ROUTING_BASE_URL ? `/${Config.ROUTING_BASE_URL}` : ''
        }${notFoundRouteMap[type]}${
          search[VIEW_MODE_PARAM]
            ? `?${VIEW_MODE_PARAM}=${search[VIEW_MODE_PARAM]}`
            : ''
        }`;

        navigate({
          to,
        });
      },
      [navigate, search],
    );

    return { navigateToNotFound };
  };

type UseNavigateToPreview = () => {
  navigateToPreview: () => void;
};

export const useNavigateToPreview =
  function (): ReturnType<UseNavigateToPreview> {
    const navigate = useNavigate();
    const search = useSearch<SearchGenerics>();

    const navigateToPreview = useCallback(() => {
      navigate({
        search: {
          ...search,
          [VIEW_MODE_PARAM]: 'preview',
        },
      });
    }, [navigate, search]);

    return { navigateToPreview };
  };
