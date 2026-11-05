import { createFileRoute, redirect, useParams } from '@tanstack/react-router';

import AppDetailFeat from '../../features/app/app-detail/AppDetail.feat';
import { useAppScreenKey } from '../../hooks/useAppScreenKey';
import { takeAgentRename } from '../../openAppFile';

const UserAppDetail: React.FC = () => {
  const { appId } = useParams({ from: '/my-apps/$appId' });
  const screenKey = useAppScreenKey(appId);
  return <AppDetailFeat key={screenKey} appId={appId} section="my-apps" />;
};

export const Route = createFileRoute('/my-apps/$appId')({
  // Before the screen mounts: mounted on an id that no longer exists, it fires requests that fail.
  beforeLoad: ({ params }) => {
    const renamedTo = takeAgentRename(params.appId);
    if (renamedTo) {
      throw redirect({
        to: '/my-apps/$appId',
        params: { appId: renamedTo },
        replace: true,
      });
    }
  },
  component: UserAppDetail,
  gcTime: 0,
});
