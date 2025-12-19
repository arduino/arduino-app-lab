import Main from '../cloud-editor/features/main/Main.feat';
import { useHotjarTracking } from '../common/providers/hotjar/hotjar';
import MainProvider from '../common/providers/MainProvider';
import { PageProps } from './page.type';

export type MainPageProps = PageProps;

const MainPage: React.FC<MainPageProps> = ({
  profile,
  profileIsLoading,
}: MainPageProps) => {
  const { ready: hotjarReady } = useHotjarTracking();
  return hotjarReady ? (
    <MainProvider profile={profile} profileIsLoading={profileIsLoading}>
      <Main />
    </MainProvider>
  ) : null;
};

export default MainPage;
