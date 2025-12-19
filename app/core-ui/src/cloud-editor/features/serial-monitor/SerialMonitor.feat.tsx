import { SerialMonitor } from '@cloud-editor-mono/ui-components';
import { useContext } from 'react';

import { AuthContext } from '../../../common/providers/auth/authContext';
import { useSerialMonitorLogic } from './serialMonitor.logic';

const SerialMonitorFeat: React.FC = () => {
  const { userNotTargetAudience } = useContext(AuthContext);

  return !userNotTargetAudience ? (
    <SerialMonitor serialMonitorLogic={useSerialMonitorLogic} />
  ) : (
    <div>{'You do not have access to this page'}</div>
  );
};

export default SerialMonitorFeat;
