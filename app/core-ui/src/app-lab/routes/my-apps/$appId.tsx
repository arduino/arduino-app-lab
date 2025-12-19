import { createFileRoute, useParams } from '@tanstack/react-router';

import AppDetail from '../../features/app-detail/AppDetail.feat';

const UserAppDetail: React.FC = () => {
  const { appId } = useParams({ from: '/my-apps/$appId' });
  return <AppDetail appId={appId} section="my-apps" />;
};

export const Route = createFileRoute('/my-apps/$appId')({
  component: UserAppDetail,
});
