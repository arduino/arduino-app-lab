import { getSystemResources } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { SystemResourcesStreamMessageType } from '@cloud-editor-mono/infrastructure';
import { BoardResources } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { BoardResourcesContextValue } from './boardResourcesContext';

export const bytesToGiB = (bytes: unknown): string =>
  ((bytes as number) / 1024 / 1024 / 1024).toFixed(2);

export const getUsedPercent = (used: unknown, total: unknown): number =>
  ((used as number) / (total as number)) * 100;

export function useBoardResourcesLogic(): BoardResourcesContextValue {
  const streamAbortController = useRef<AbortController>();
  const streamIsConnecting = useRef(false);

  const [resources, setResources] = useState<BoardResources | undefined>(
    undefined,
  );

  const { boardIsFlashing, boardIsReachable, selectedConnectedBoard } =
    useBoardLifecycleStore(
      useShallow((state) => ({
        boardIsFlashing: state.boardIsFlashing,
        boardIsReachable: state.boardIsReachable,
        selectedConnectedBoard: state.selectedConnectedBoard,
      })),
    );

  const isVentunoQ = selectedConnectedBoard?.fqbn === 'arduino:zephyr:ventunoq';

  const openStream = useCallback(() => {
    if (streamIsConnecting.current) {
      return;
    }
    streamIsConnecting.current = true;

    streamAbortController.current?.abort();
    const controller = new AbortController();
    streamAbortController.current = controller;

    return getSystemResources(
      {
        onopen: async () => {
          streamIsConnecting.current = false;
        },
        onclose: () => {
          streamIsConnecting.current = false;
          if (!controller?.signal.aborted) {
            streamAbortController.current?.abort();
            setTimeout(openStream, 3000);
          }
        },
        onerror: undefined,
        onmessage: (event) => {
          const messageType = event.event;
          const data = JSON.parse(event.data);

          setResources((prev) => {
            if (messageType === SystemResourcesStreamMessageType.Cpu) {
              return { ...prev, cpuPercentage: data.used_percent };
            }
            if (
              messageType === SystemResourcesStreamMessageType.Npu &&
              isVentunoQ
            ) {
              return { ...prev, npuPercentage: data.max_percent };
            }
            if (messageType === SystemResourcesStreamMessageType.Memory) {
              return { ...prev, ram: { used: data.used, total: data.total } };
            }
            if (
              messageType === SystemResourcesStreamMessageType.Disk &&
              data.path === '/home/arduino' // return only home directory disk usage
            ) {
              return {
                ...prev,
                homeDisk: { used: data.used, total: data.total },
              };
            }
            if (
              messageType === SystemResourcesStreamMessageType.Disk &&
              data.path === '/'
            ) {
              return {
                ...prev,
                rootDisk: { used: data.used, total: data.total },
              };
            }

            return prev;
          });
        },
      },
      streamAbortController.current,
    );
  }, [setResources, isVentunoQ]);

  useEffect(() => {
    if (boardIsFlashing || !boardIsReachable) {
      streamAbortController.current?.abort();
      return;
    }

    openStream();

    return () => {
      streamAbortController.current?.abort();
      streamIsConnecting.current = false;
    };
  }, [
    openStream,
    boardIsFlashing,
    boardIsReachable,
    selectedConnectedBoard?.serial,
    selectedConnectedBoard?.address,
  ]);

  useEffect(() => {
    const currentBoardSerial = selectedConnectedBoard?.serial;
    const currentBoardAddress = selectedConnectedBoard?.address;
    const currentBoardKey = currentBoardSerial
      ? `${currentBoardSerial}-${currentBoardAddress}`
      : undefined;

    if (currentBoardKey) {
      setResources(undefined);
    }
  }, [selectedConnectedBoard?.serial, selectedConnectedBoard?.address]);

  const singleValuesInGB = useMemo(
    () => ({
      ramUsedGB: bytesToGiB(resources?.ram?.used),
      ramTotalGB: bytesToGiB(resources?.ram?.total),
      homeDiskUsedGB: bytesToGiB(resources?.homeDisk?.used),
      homeDiskTotalGB: bytesToGiB(resources?.homeDisk?.total),
      rootDiskUsedGB: bytesToGiB(resources?.rootDisk?.used),
      rootDiskTotalGB: bytesToGiB(resources?.rootDisk?.total),
    }),
    [resources],
  );

  return { resources, ...singleValuesInGB };
}
