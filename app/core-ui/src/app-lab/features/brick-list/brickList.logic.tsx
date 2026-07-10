import { getBricks } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { BrickListItem } from '@cloud-editor-mono/infrastructure';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useBrickDetailLogic } from '../../hooks/useBrickDetail';
import { UseBrickListLogic, UseBrickListLogicParams } from './brickList.type';

export const useBrickListLogic = function (
  params: UseBrickListLogicParams = {},
): UseBrickListLogic {
  const { brickId, tab } = params;

  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState<string | undefined>(tab);

  const { data: bricks, isLoading: bricksAreLoading } = useQuery(
    ['list-bricks'],
    () => getBricks(),
  );

  // The selected brick is derived from the `brickId` search param so that
  // navigating to the page (e.g. from a footer notification) always selects
  // the requested brick, even when another brick is already selected. Falls
  // back to the first brick when no match is found.
  const selectedBrick = useMemo<BrickListItem | null>(() => {
    if (!bricks || bricks.length === 0) {
      return null;
    }

    const requestedBrick = brickId
      ? bricks.find((brick) => brick.id === brickId)
      : undefined;

    return requestedBrick ?? bricks[0];
  }, [bricks, brickId]);

  // Manual selection updates the search param so it stays the source of truth.
  const setSelectedBrick = useCallback(
    (brick: BrickListItem | null): void => {
      navigate({
        to: '/bricks',
        search: (prev) => ({ ...prev, brickId: brick?.id }),
      });
    },
    [navigate],
  );

  // Honour the tab requested via the search params whenever it changes.
  useEffect(() => {
    if (tab) {
      setSelectedTab(tab);
    }
  }, [tab]);

  const brickDetailLogic = useCallback(useBrickDetailLogic, []);

  return {
    bricks: bricks || [],
    isLoading: bricksAreLoading,
    selectedBrick,
    brickDetailLogic,
    setSelectedBrick,
    selectedTab,
    setSelectedTab,
  };
};
