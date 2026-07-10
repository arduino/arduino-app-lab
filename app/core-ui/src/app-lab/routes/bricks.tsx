import { createFileRoute } from '@tanstack/react-router';

import BrickList from '../features/brick-list/BrickList.feat';

export type BricksSearch = {
  brickId?: string;
  tab?: string;
};

export const Route = createFileRoute('/bricks')({
  component: BrickList,
  validateSearch: (search: Record<string, unknown>): BricksSearch => ({
    brickId: typeof search.brickId === 'string' ? search.brickId : undefined,
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
});
