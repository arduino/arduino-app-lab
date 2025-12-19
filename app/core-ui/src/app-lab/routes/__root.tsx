import { createRootRoute } from '@tanstack/react-router';

import Main from '../../app-lab/features/main/Main.feat';
import AppLabProvider from '../providers/AppLabProvider';

export type AppsSection = 'my-apps' | 'examples' | 'learn';

export const DETAIL_PATH_BY_SECTION = {
  examples: '/examples/$appId',
  'my-apps': '/my-apps/$appId',
  learn: '/learn/$resourceId',
} as const;

export const Route = createRootRoute({
  component: () => (
    <AppLabProvider>
      <Main />
    </AppLabProvider>
  ),
});
