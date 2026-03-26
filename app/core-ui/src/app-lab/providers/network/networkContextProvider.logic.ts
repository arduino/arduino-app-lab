import {
  connectToWiFi,
  disconnectWiFi,
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
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { NetworkContextValue } from './networkContext';

export function useNetwork(): NetworkContextValue {
  const queryClient = useQueryClient();

  const {
    mutate: connectToWifiNetwork,
    isLoading: connectRequestIsLoading,
    isSuccess: connectRequestIsSuccess,
    isError: connectRequestIsError,
    reset: resetConnectRequest,
  } = useMutation({
    mutationKey: ['connect-to-wifi-network'],
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

  const { boardIsFlashing, boardIsReachable } = useBoardLifecycleStore(
    useShallow((state) => ({
      boardIsFlashing: state.boardIsFlashing,
      boardIsReachable: state.boardIsReachable,
    })),
  );

  const {
    mutateAsync: disconnectFromNetwork,
    isLoading: disconnectRequestIsLoading,
  } = useMutation({
    mutationFn: async () => {
      return disconnectWiFi();
    },
    onMutate: () => {
      resetConnectRequest();
      queryClient.setQueryData(['wifi-status'], 'disconnected');
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['wifi-status'],
      });
      queryClient.invalidateQueries({
        queryKey: ['internet-status'],
      });
    },
  });

  const {
    data: wiFiStatus,
    isLoading: isWiFiStatusLoading,
    isSuccess: wiFiStatusChecked,
  } = useQuery(['wifi-status'], async () => getWiFiStatus(), {
    retry: 3,
    refetchInterval: 3000,
    enabled:
      !boardIsFlashing &&
      boardIsReachable &&
      !connectRequestIsLoading &&
      !disconnectRequestIsLoading,
  });

  const {
    data: ethernetStatus,
    isLoading: isEthernetStatusLoading,
    isSuccess: ethernetStatusChecked,
  } = useQuery(['ethernet-status'], async () => getEthernetStatus(), {
    retry: 3,
    refetchInterval: 3000,
    enabled:
      !boardIsFlashing &&
      boardIsReachable &&
      !connectRequestIsLoading &&
      !disconnectRequestIsLoading,
  });

  const networkDeviceConnected =
    wiFiStatus === 'connected' || ethernetStatus === 'connected';

  const {
    data: internetIsReachable,
    isLoading: isInternetStatusLoading,
    isSuccess: internetStatusChecked,
  } = useQuery(['internet-status'], async () => getInternetStatus(), {
    retry: 3,
    refetchInterval: 3000,
    enabled: !boardIsFlashing && networkDeviceConnected,
  });

  const [scanCount, setScanCount] = useState(0);
  const [scanningIsEnabled, setScanningIsEnabled] = useState(false);
  const isConnected = networkDeviceConnected && internetIsReachable === true;
  const {
    data: networkList,
    isFetching: isScanning,
    refetch: scanNetworkList,
  } = useQuery(['networkList'], getNetworkList, {
    onSuccess: (data) => {
      const list = data || [];
      setScanCount(list.length > 0 ? 8 : (c): number => c + 1);
    },
    enabled: scanningIsEnabled,
    refetchInterval: scanningIsEnabled && scanCount < 8 ? 1500 : false,
  });

  const isStatusConnecting =
    wiFiStatus === 'connecting' || ethernetStatus === 'connecting';

  const [selectedNetwork, setSelectedNetwork] = useState<NetworkItem>();
  const [manualNetworkSetup, setManualNetworkSetup] = useState(false);

  useEffect(() => {
    resetConnectRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNetwork, manualNetworkSetup]);

  return {
    isScanning: isScanning || (scanningIsEnabled && scanCount < 8),
    setScanningIsEnabled,
    networkList: networkList || [],
    isNetworkStatusLoading:
      isWiFiStatusLoading || isEthernetStatusLoading || isInternetStatusLoading,
    networkStatusChecked:
      wiFiStatusChecked &&
      ethernetStatusChecked &&
      (!networkDeviceConnected || internetStatusChecked), // internetStatusChecked only matters if there is a network connection
    scanNetworkList,
    connectToWifiNetwork,
    disconnectFromNetwork,
    isConnected,
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
