import {
  connectToWiFi,
  getEthernetStatus,
  getInternetStatus,
  getNetworkList,
  getWiFiStatus,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  NetworkCredentials,
  NetworkItem,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useBoardLifecycleStore } from '../../store/boards/boards';
import { NetworkContextValue } from './networkContext';

export function useNetwork(): NetworkContextValue {
  const queryClient = useQueryClient();
  const {
    mutate: connectToWifiNetwork,
    isLoading: connectRequestIsLoading,
    isSuccess: connectRequestIsSuccess,
    isError: connectRequestIsError,
  } = useMutation({
    mutationFn: async ({ name, password }: NetworkCredentials) => {
      await connectToWiFi(name, password);
    },
    onMutate: () => {
      queryClient.setQueryData(['wifi-status'], 'connecting');
    },
    onSuccess: () => {
      queryClient.setQueryData(['wifi-status'], 'connected');
    },
    onError: () => {
      queryClient.setQueryData(['wifi-status'], 'disconnected');
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['wifi-status'],
      });
    },
  });

  const { boardIsReachable } = useBoardLifecycleStore();

  const {
    data: wiFiStatus,
    isLoading: isWiFiStatusLoading,
    isSuccess: wiFiStatusChecked,
  } = useQuery(['wifi-status'], async () => getWiFiStatus(), {
    refetchOnWindowFocus: false,
    retry: 3,
    refetchInterval: 3000,
    enabled: boardIsReachable && !connectRequestIsLoading,
  });

  const {
    data: ethernetStatus,
    isLoading: isEthernetStatusLoading,
    isSuccess: ethernetStatusChecked,
  } = useQuery(['ethernet-status'], async () => getEthernetStatus(), {
    refetchOnWindowFocus: false,
    retry: 3,
    refetchInterval: 3000,
    enabled: boardIsReachable && !connectRequestIsLoading,
  });

  const networkDeviceConnected =
    wiFiStatus === 'connected' || ethernetStatus === 'connected';

  const {
    data: internetIsReachable,
    isLoading: isInternetStatusLoading,
    isSuccess: internetStatusChecked,
  } = useQuery(['internet-status'], async () => getInternetStatus(), {
    refetchOnWindowFocus: false,
    retry: 3,
    refetchInterval: 3000,
    enabled: networkDeviceConnected,
  });

  const [scanCount, setScanCount] = useState(0);
  const {
    data: networkList,
    isFetching: isScanning,
    refetch: scanNetworkList,
  } = useQuery(['networkList'], getNetworkList, {
    enabled: boardIsReachable,
    refetchOnWindowFocus: false,
    onSuccess: (data) => {
      const list = data || [];
      setScanCount(list.length > 0 ? 2 : (c): number => c + 1);
    },
    refetchInterval: scanCount < 2 ? 1500 : false,
  });

  const isStatusConnecting =
    wiFiStatus === 'connecting' || ethernetStatus === 'connecting';

  const [selectedNetwork, setSelectedNetwork] = useState<NetworkItem>();
  const [manualNetworkSetup, setManualNetworkSetup] = useState(false);

  return {
    isScanning,
    networkList: networkList || [],
    isNetworkStatusLoading:
      isWiFiStatusLoading || isEthernetStatusLoading || isInternetStatusLoading,
    networkStatusChecked:
      wiFiStatusChecked &&
      ethernetStatusChecked &&
      (!networkDeviceConnected || internetStatusChecked), // internetStatusChecked only matters if there is a network connection
    scanNetworkList,
    connectToWifiNetwork,
    isConnected: networkDeviceConnected && internetIsReachable === true,
    isStatusConnecting,
    isConnecting:
      connectRequestIsLoading ||
      isStatusConnecting ||
      (connectRequestIsSuccess && !internetIsReachable),
    connectRequestIsSuccess,
    connectRequestIsError,
    selectedNetwork,
    setSelectedNetwork,
    manualNetworkSetup,
    setManualNetworkSetup,
  };
}
