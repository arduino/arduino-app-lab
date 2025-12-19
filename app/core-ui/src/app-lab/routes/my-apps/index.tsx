import { createFileRoute } from '@tanstack/react-router';

import AppList from '../../features/app-list/AppList.feat';

export const Route = createFileRoute('/my-apps/')({
  component: () => {
    return <AppList section="my-apps" />;
  },
});
