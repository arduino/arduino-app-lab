import { useEffect, useState } from 'react';

import {
  UseCoreEndpointsStatus,
  useCoreEndpointsStatus,
} from './endpointsStatus';
import { UseNetworkStatus, useNetworkStatus } from './networkStatus';

const STATUS_CHECK_INTERVAL_MS = 5000;
type UseStatus = () => {
  coreEndpoints: ReturnType<UseCoreEndpointsStatus>;
  network: ReturnType<UseNetworkStatus>;
};

export function useStatus(
  enabled: boolean,
  intervalMS = STATUS_CHECK_INTERVAL_MS,
): ReturnType<UseStatus> {
  const [start, setStart] = useState(false);
  const coreEndpoints = useCoreEndpointsStatus(enabled && start, intervalMS);
  const network = useNetworkStatus();

  useEffect(() => {
    if (start) return;

    setTimeout(() => {
      setStart(true);
    }, STATUS_CHECK_INTERVAL_MS);
  }, [start]);

  return {
    coreEndpoints,
    network,
  };
}
