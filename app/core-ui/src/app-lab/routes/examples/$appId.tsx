import { createFileRoute, useParams, useSearch } from '@tanstack/react-router';

import AppDetailFeat from '../../features/app/app-detail/AppDetail.feat';

// Example apps are reachable from two nav sections: Examples (/examples) and
// Inspirations (/inspirations). Both open this detail route, so the origin
// travels in the `from` search param and only drives the breadcrumb.
interface ExampleAppDetailSearch {
  from?: 'inspirations';
}

const ExampleAppDetail: React.FC = () => {
  const { appId } = useParams({ from: '/examples/$appId' });
  const { from } = useSearch({ from: '/examples/$appId' });
  return (
    <AppDetailFeat
      key={appId}
      appId={appId}
      section="examples"
      breadcrumbId={from}
    />
  );
};

export const Route = createFileRoute('/examples/$appId')({
  component: ExampleAppDetail,
  gcTime: 0,
  validateSearch: (
    search: Record<string, unknown>,
  ): ExampleAppDetailSearch => ({
    from: search.from === 'inspirations' ? 'inspirations' : undefined,
  }),
});
