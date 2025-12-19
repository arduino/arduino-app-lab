import { useNavigate, useSearch } from '@tanstack/react-location';
import { useCallback } from 'react';

import {
  SearchGenerics,
  UI_MODE_PARAM,
  UIMode,
} from '../../../../routing/routing.type';

type UseFullscreenState = () => {
  onCloseFullscreen: () => void;
  onOpenFullscreen: () => void;
  isFullscreen: boolean;
};

export const useFullscreenState: UseFullscreenState =
  function (): ReturnType<UseFullscreenState> {
    const navigate = useNavigate();
    const search = useSearch<SearchGenerics>();

    const onCloseFullscreen = useCallback(() => {
      navigate({ search: { ...search, [UI_MODE_PARAM]: undefined } });
    }, [navigate, search]);

    const onOpenFullscreen = useCallback(() => {
      navigate({ search: { ...search, [UI_MODE_PARAM]: UIMode.Fullscreen } });
    }, [navigate, search]);

    const uiMode = search[UI_MODE_PARAM];

    const isFullscreen = uiMode === UIMode.Fullscreen;

    return {
      onCloseFullscreen,
      onOpenFullscreen,
      isFullscreen,
    };
  };
