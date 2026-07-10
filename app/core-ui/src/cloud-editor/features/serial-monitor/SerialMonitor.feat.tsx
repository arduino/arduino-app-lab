import {
  SerialMonitor,
  SerialMonitorLogic,
} from '@cloud-editor-mono/ui-components';
import { useCallback, useContext } from 'react';

import { AuthContext } from '../../../common/providers/auth/authContext';
import { useSerialMonitorLogic } from './serialMonitor.logic';

const SerialMonitorFeat: React.FC = () => {
  const { userNotTargetAudience } = useContext(AuthContext);
  const serialMonitorLogicResult = useSerialMonitorLogic();

  const serialMonitorLogic: SerialMonitorLogic = useCallback(
    () => serialMonitorLogicResult,
    [serialMonitorLogicResult],
  );

  return !userNotTargetAudience ? (
    <SerialMonitor serialMonitorLogic={serialMonitorLogic} />
  ) : (
    <div>{'You do not have access to this page'}</div>
  );
};

export default SerialMonitorFeat;
