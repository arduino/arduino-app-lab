import {
  getBrickDetails,
  getBricks,
  getFileContent,
  openLinkExternal,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { BrickListItem } from '@cloud-editor-mono/infrastructure';
import { BrickDetailLogic } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { UseBrickListLogic } from './brickList.type';

export const useBrickListLogic = function (): UseBrickListLogic {
  const [selectedBrick, setSelectedBrick] = useState<BrickListItem | null>(
    null,
  );

  const { data: bricks, isLoading: bricksAreLoading } = useQuery(
    ['list-bricks'],
    () => getBricks(),
    {
      refetchOnWindowFocus: false,
      onSuccess: (data) => {
        if (data.length > 0) {
          setSelectedBrick(data[0]);
        }
      },
    },
  );

  const openExternalLink = useCallback((url: string) => {
    if (!url) {
      console.warn('No URL provided to open externally');
      return;
    }
    openLinkExternal(url);
  }, []);

  const useBrickDetailLogic = (): ReturnType<BrickDetailLogic> => ({
    loadBrickDetails: getBrickDetails,
    loadFileContent: getFileContent,
    onOpenExternalLink: openExternalLink,
  });

  const brickDetailLogic = useCallback(useBrickDetailLogic, [openExternalLink]);

  return {
    bricks: bricks || [],
    isLoading: bricksAreLoading,
    selectedBrick,
    brickDetailLogic,
    setSelectedBrick,
  };
};
