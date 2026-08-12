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
import { debounce } from 'lodash-es';
import { useCallback, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { BoardScopedQuery } from '../../../boardScopedQuery';
import { useAppSSE } from '../../../features/app/app-detail/hooks/useAppSSE';
import { useBoardLifecycleStore } from '../../../store/boardLifecycle';

type UseAppsStatus = () => {
  apps?: AppDetailedInfo[];
  defaultApp?: AppDetailedInfo;
  failedApp?: AppDetailedInfo;
  runningApp?: AppDetailedInfo;
};

const useAppsStatus: UseAppsStatus = function (): ReturnType<UseAppsStatus> {
  const { boardIsFlashing, boardIsReachable } = useBoardLifecycleStore(
    useShallow((state) => ({
      boardIsFlashing: state.boardIsFlashing,
      boardIsReachable: state.boardIsReachable,
    })),
  );

  const queryClient = useQueryClient();

  const { data: defaultApps } = useQuery(
    [BoardScopedQuery.GET_DEFAULT_APP],
    () => {
      return getApps({ query: { filter: 'default' } });
    },
    {
      enabled: boardIsReachable,
    },
  );

  const { data: apps } = useQuery(
    [BoardScopedQuery.LIST_MY_APPS],
    () => {
      //This query retrieves all the apps (examples/myapps) and sync the status of the apps with the server.
      return getApps({ query: {} });
    },
    {
      enabled: boardIsReachable,
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

  //Debounce the invalidate of the query to avoid multiple invalidations in a short period of time when multiple events are received from the SSE
  const debouncedInvalidate = useMemo(
    () =>
      debounce(() => {
        queryClient.invalidateQueries({
          queryKey: [BoardScopedQuery.LIST_MY_APPS],
        });
      }, 300),
    [queryClient],
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
        debouncedInvalidate();

        if (normalizedEvent.data?.default) {
          queryClient.invalidateQueries({
            queryKey: [BoardScopedQuery.GET_DEFAULT_APP],
          });
        }
      }
    },
    [debouncedInvalidate, queryClient],
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
    if (!isConnected && !isConnecting && !boardIsFlashing && boardIsReachable) {
      connectToAppStatusSSE();
    } else if (boardIsFlashing && (isConnected || isConnecting)) {
      getAppStatusAbort();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardIsFlashing, boardIsReachable, isConnected, isConnecting]);

  useEffect(() => {
    return () => {
      getAppStatusAbort();
    };
  }, [getAppStatusAbort]);

  // Refreshing app queries on board switch is handled centrally by
  // useBoardScopedQueryReset (keyed on the reliable board cache id rather than
  // the raw serial, which is empty/unstable for network boards).

  const filteredApps = useMemo(() => {
    return apps?.filter((app) => app.id) as AppDetailedInfo[];
  }, [apps]);

  return { apps: filteredApps, defaultApp, failedApp, runningApp };
};

export default useAppsStatus;
