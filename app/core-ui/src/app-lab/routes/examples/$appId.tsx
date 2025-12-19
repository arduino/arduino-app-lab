import { createFileRoute, useParams } from '@tanstack/react-router';

import AppDetail from '../../features/app-detail/AppDetail.feat';

const ExampleAppDetail: React.FC = () => {
  const { appId } = useParams({ from: '/examples/$appId' });
  return <AppDetail appId={appId} section="examples" />;
};

export const Route = createFileRoute('/examples/$appId')({
  component: ExampleAppDetail,
});
