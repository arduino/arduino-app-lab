import { createFileRoute } from '@tanstack/react-router';

import AppList from '../../features/app/app-list/AppList.feat';

// The former Examples page (Inspirational Apps). Reuses the generic AppList
// with the examples filter; only the breadcrumb label differs. Example apps
// share the /examples/$appId detail route (derived from app.example).
export const Route = createFileRoute('/inspirations/')({
  component: () => {
    return <AppList section="examples" breadcrumbId="inspirations" />;
  },
  beforeLoad: () => {
    return {
      section: 'examples',
    };
  },
});
