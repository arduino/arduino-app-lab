import { createFileRoute } from '@tanstack/react-router';

import AppList from '../../features/app-list/AppList.feat';

export const Route = createFileRoute('/examples/')({
  component: () => {
    return <AppList section="examples" />;
  },
  beforeLoad: () => {
    return {
      section: 'examples',
    };
  },
});
