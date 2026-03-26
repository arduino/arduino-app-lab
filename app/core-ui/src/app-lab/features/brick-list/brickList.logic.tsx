import { getBricks } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { BrickListItem } from '@cloud-editor-mono/infrastructure';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useBrickDetailLogic } from '../../hooks/useBrickDetail';
import { UseBrickListLogic } from './brickList.type';

export const useBrickListLogic = function (): UseBrickListLogic {
  const [selectedBrick, setSelectedBrick] = useState<BrickListItem | null>(
    null,
  );

  const { data: bricks, isLoading: bricksAreLoading } = useQuery(
    ['list-bricks'],
    () => getBricks(),
    {
      onSuccess: (data) => {
        if (data.length > 0) {
          setSelectedBrick(data[0]);
        }
      },
    },
  );

  const brickDetailLogic = useCallback(useBrickDetailLogic, []);

  return {
    bricks: bricks || [],
    isLoading: bricksAreLoading,
    selectedBrick,
    brickDetailLogic,
    setSelectedBrick,
  };
};
