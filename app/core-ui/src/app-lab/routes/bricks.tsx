import { createFileRoute } from '@tanstack/react-router';

import BrickList from '../features/brick-list/BrickList.feat';

export const Route = createFileRoute('/bricks')({
  component: BrickList,
});
