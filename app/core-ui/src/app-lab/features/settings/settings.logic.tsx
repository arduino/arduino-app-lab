import {
  applyBoardUpdate,
  checkBoardUpdate,
  getBoardUpdateLogs,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  BoardUpdateLog,
  BoardUpdateLogEvent,
} from '@cloud-editor-mono/infrastructure';
import {
  AppLabSettingsItemId,
  UseBoardUpdateLogic,
  UseDocumentationLogic,
  UseNetworkLogic,
  UseSettingsLogic,
  UseStorageLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { NetworkContext } from '../../providers/network/networkContext';

const createUseStorageLogic = function (): UseStorageLogic {
  return function useStorageLogic(): ReturnType<UseStorageLogic> {
    console.log('Creating storage logic');
    return {
      storageInfo: 'Storage information logic not implemented yet',
    };
  };
};

const createUseNetworkLogic = function (): UseNetworkLogic {
  return function useNetworkLogic(): ReturnType<UseNetworkLogic> {
    return useContext(NetworkContext);
  };
};

export const createUseBoardUpdateLogic = function (): UseBoardUpdateLogic {
  return function useBoardUpdateLogic(): ReturnType<UseBoardUpdateLogic> {
    const [onlyArduino, setOnlyArduino] = useState(false);

    const [isGettingLogs, setIsGettingLogs] = useState<boolean>(false);
    const [boardUpdateLogs, setBoardUpdateLogs] = useState<BoardUpdateLog[]>(
      [],
    );

    const logsStreamAbortController = useRef<AbortController>();

    useEffect(() => {
      return () => {
        if (logsStreamAbortController.current) {
          // eslint-disable-next-line react-hooks/exhaustive-deps
          logsStreamAbortController.current?.abort();
          logsStreamAbortController.current = undefined;
        }
      };
    }, []);

    const {
      data: updateCheckResult,
      isFetching: isCheckingBoardUpdate,
      remove: removeCheckBoardUpdateQuery,
      ...checkBoardUpdateQuery
    } = useQuery(
      ['board-update-check', `only-arduino-${onlyArduino}`],
      () => checkBoardUpdate(onlyArduino),
      {
        enabled: false,
        cacheTime: 0,
      },
    );

    const checkBoardUpdateInner = async (): Promise<void> => {
      await checkBoardUpdateQuery.refetch();
    };

    const { isLoading: isStartingBoardUpdate, ...applyBoardUpdateQuery } =
      useMutation(['board-update-apply', `only-arduino-${onlyArduino}`], () =>
        applyBoardUpdate(onlyArduino),
      );

    const applyBoardUpdateInner = async (): ReturnType<
      typeof applyBoardUpdate
    > => {
      listenBoardUpdateLogs();
      const result = await applyBoardUpdateQuery.mutateAsync();
      return result;
    };

    const listenBoardUpdateLogs = (): Promise<void> => {
      return getBoardUpdateLogs(
        {
          onopen: async (_) => {
            setIsGettingLogs(true);
          },
          onmessage: (resp) => {
            console.log('onmessage', resp);
            const data = resp.data;
            const event = resp.event as BoardUpdateLogEvent;

            try {
              const parsed = JSON.parse(data);
              if (!parsed) {
                return;
              }
              if (typeof parsed !== 'string') {
                console.warn(
                  'BoardUpdateLog: parsed data is not a string:',
                  parsed,
                );
                return;
              }
            } catch (e) {
              console.warn('BoardUpdateLog: failed to parse log data:', data);
              return;
            }

            setBoardUpdateLogs((prev) => [...prev, { event, data }]);
          },
          onclose: () => {
            console.log('onclose');
            setIsGettingLogs(false);
          },
          onerror: (resp) => {
            console.log('onerror', resp);
            setIsGettingLogs(false);
          },
        },
        logsStreamAbortController.current,
      );
    };

    const cleanup = useCallback((): void => {
      if (logsStreamAbortController.current) {
        logsStreamAbortController.current.abort();
        logsStreamAbortController.current = undefined;
      }
      setBoardUpdateLogs([]);
      setIsGettingLogs(false);
      removeCheckBoardUpdateQuery();
    }, [removeCheckBoardUpdateQuery]);

    return {
      onlyArduino,
      setOnlyArduino,
      boardUpdateLogs,
      isGettingLogs,
      updateCheckResult,
      isCheckingBoardUpdate,
      isStartingBoardUpdate,
      checkBoardUpdate: checkBoardUpdateInner,
      applyBoardUpdate: applyBoardUpdateInner,
      cleanup,
    };
  };
};

const createUseDocumentationLogic = function (): UseDocumentationLogic {
  return function useDocumentationLogic(): ReturnType<UseDocumentationLogic> {
    console.log('Creating documentation logic');
    return {
      documentationInfo: 'Documentation information logic not implemented yet',
    };
  };
};

export const createUseSettingsLogic = function (): UseSettingsLogic {
  return function useSettingsLogic(): ReturnType<UseSettingsLogic> {
    return {
      contentLogicMap: {
        [AppLabSettingsItemId.Storage]: createUseStorageLogic(),
        [AppLabSettingsItemId.Network]: createUseNetworkLogic(),
        [AppLabSettingsItemId.BoardUpdate]: createUseBoardUpdateLogic(),
        [AppLabSettingsItemId.Documentation]: createUseDocumentationLogic(),
      },
    };
  };
};
