import SerialMonitor from '../cloud-editor/features/serial-monitor/SerialMonitor.feat';
import { useHotjarTracking } from '../common/providers/hotjar/hotjar';
import SerialMonitorProvider from '../common/providers/SerialMonitorProvider';
import { PageProps } from './page.type';

export type SerialMonitorPageProps = PageProps;

const SerialMonitorPage: React.FC<SerialMonitorPageProps> = ({
  profile,
  profileIsLoading,
}: SerialMonitorPageProps) => {
  const { ready: hotjarReady } = useHotjarTracking();
  return hotjarReady ? (
    <SerialMonitorProvider
      profile={profile}
      profileIsLoading={profileIsLoading}
    >
      <SerialMonitor />
    </SerialMonitorProvider>
  ) : null;
};

export default SerialMonitorPage;
