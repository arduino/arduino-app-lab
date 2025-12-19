import Offline from '../cloud-editor/features/offline/Offline.feat';
import OfflineProvider from '../common/providers/OfflineProvider';
import { PageProps } from './page.type';

type OfflinePageProps = PageProps;

const OfflinePage: React.FC<OfflinePageProps> = (props: OfflinePageProps) => {
  const { profile, profileIsLoading } = props;

  return (
    <OfflineProvider profile={profile} profileIsLoading={profileIsLoading}>
      <Offline />
    </OfflineProvider>
  );
};

export default OfflinePage;
