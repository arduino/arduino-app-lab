import { useMemo } from 'react';

import { VisibilityFromUrl } from '../main.type';
import { useSketchParams } from './sketch';

export const useUIVisibilityFromUrl = function (): VisibilityFromUrl {
  const { viewMode } = useSketchParams();

  const visibilityFromUrl = useMemo(() => {
    const visibility: VisibilityFromUrl = {
      header: true,
      sidenav: true,
      toolbarAndConsole: true,
      infoBar: false,
      tabs: true,
    };

    const setPreviewModeHiddenItems = (): void => {
      visibility.sidenav = false;
      visibility.toolbarAndConsole = false;
    };

    const setEmbedModeHiddenItems = (): void => {
      visibility.header = false;
    };

    if (viewMode === 'preview') {
      setPreviewModeHiddenItems();
      visibility.infoBar = true;
    }

    if (viewMode === 'embed') {
      setPreviewModeHiddenItems();
      setEmbedModeHiddenItems();
      visibility.infoBar = true;
    }

    if (viewMode === 'snippet') {
      setPreviewModeHiddenItems();
      setEmbedModeHiddenItems();
      visibility.tabs = false;
    }

    return visibility;
  }, [viewMode]);

  return visibilityFromUrl;
};
