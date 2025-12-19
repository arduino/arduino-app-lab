import {
  getApps,
  getAppStatus,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AppDetailedInfo,
  StreamEvent,
  StreamEventType,
} from '@cloud-editor-mono/infrastructure';
import { EventSourceMessage } from '@microsoft/fetch-event-source';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import { useAppSSE } from '../../../features/app-detail/hooks/useAppSSE';
import { useBoardLifecycleStore } from '../../../store/boards/boards';

type UseAppsStatus = () => {
  defaultApp?: AppDetailedInfo;
  failedApp?: AppDetailedInfo;
  runningApp?: AppDetailedInfo;
  getAppStatusById: (appId: string) => AppDetailedInfo['status'];
};

const useAppsStatus: UseAppsStatus = function (): ReturnType<UseAppsStatus> {
  const { boardIsReachable } = useBoardLifecycleStore();
  const queryClient = useQueryClient();

  const { data: defaultApps } = useQuery(
    ['get-default-app'],
    () => {
      return getApps({ query: { filter: 'default' } });
    },
    {
      enabled: boardIsReachable,
      refetchOnWindowFocus: false,
    },
  );

  const { data: apps } = useQuery(
    ['list-my-apps'],
    () => {
      return getApps({});
    },
    {
      enabled: boardIsReachable,
      refetchOnWindowFocus: false,
    },
  );

  const defaultApp = useMemo(() => {
    return defaultApps?.find((app) => app.default) as AppDetailedInfo;
  }, [defaultApps]);

  const runningApp = useMemo(() => {
    return apps?.find((app) => app.status === 'running') as AppDetailedInfo;
  }, [apps]);

  const failedApp = useMemo(() => {
    return apps?.find((app) => app.status === 'failed') as AppDetailedInfo;
  }, [apps]);

  const getAppStatusById = useCallback(
    (id: string): AppDetailedInfo['status'] => {
      return apps?.find((app) => app.id === id)?.status || 'stopped';
    },
    [apps],
  );

  const handleOnStatusMessage = useCallback(
    (message: EventSourceMessage): void => {
      let normalizedEvent: StreamEvent;
      try {
        const parsedData = JSON.parse(message.data);
        normalizedEvent = {
          event: message.event as StreamEventType,
          data: parsedData,
        };
      } catch (parseError) {
        console.warn(parseError);
        return;
      }

      //Save the normalizeEvent app
      if (normalizedEvent.event === StreamEventType.App) {
        queryClient.invalidateQueries({ queryKey: ['list-my-apps'] });

        if (normalizedEvent.data?.default) {
          queryClient.invalidateQueries({ queryKey: ['get-default-app'] });
        }
      }
    },
    [queryClient],
  );

  const {
    isConnected,
    isConnecting,
    connect: connectToAppStatusSSE,
    abort: getAppStatusAbort,
  } = useAppSSE({
    appSSE: getAppStatus,
    handlers: {
      onmessage: handleOnStatusMessage,
    },
  });

  useEffect(() => {
    if (!isConnected && !isConnecting && boardIsReachable) {
      connectToAppStatusSSE();
    }
  }, [boardIsReachable, connectToAppStatusSSE, isConnected, isConnecting]);

  useEffect(() => {
    return () => {
      getAppStatusAbort();
    };
  }, [getAppStatusAbort]);

  return { defaultApp, failedApp, runningApp, getAppStatusById };
};

export default useAppsStatus;
