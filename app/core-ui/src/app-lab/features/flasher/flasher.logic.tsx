import {
  cancelFlash,
  flash,
  getAvailableFreeSpace,
  getBoards,
  isUserPartitionPreservationSupported,
  listAvailableOSImages,
  openLinkExternal,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { useBoardSerialTracker } from '@cloud-editor-mono/ui-components/lib/common/utils';
import { FlasherLogic } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery } from '@tanstack/react-query';
import { get, set } from 'idb-keyval';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { BOARD_APP_MAPPING } from '../../constants';
import { BoardAppInfo } from '../../hooks/useBoards';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';

const clearBoardAppMapping = async (boardSerial: string): Promise<void> => {
  const mapping =
    (await get<Record<string, BoardAppInfo>>(BOARD_APP_MAPPING)) || {};
  delete mapping[boardSerial];
  await set(BOARD_APP_MAPPING, mapping);
};

const ARDUINO_SUPPORT_URL = 'https://www.arduino.cc/en/contact-us/';

type CreateFlasherLogic = (
  selectBoard: (boardId: string) => Promise<void>,
) => FlasherLogic;

export const createFlasherLogic: CreateFlasherLogic = function (
  selectBoard: (boardId: string) => Promise<void>,
): FlasherLogic {
  return function useFlasherLogic() {
    const { selectedConnectedBoard, setBoardIsFlashing } =
      useBoardLifecycleStore(
        useShallow((state) => ({
          selectedConnectedBoard: state.selectedConnectedBoard,
          setBoardIsFlashing: state.setBoardIsFlashing,
        })),
      );
    const [flashing, setFlashing] = useState(false);
    const [succeeded, setSucceeded] = useState<boolean | null>(null);
    const { clearBoardAsUsed } = useBoardSerialTracker();
    const [flashingBoard] = useState(selectedConnectedBoard!);

    const { data: boards } = useQuery(['list-boards'], getBoards, {
      enabled: !flashing,
      refetchInterval: 1000,
    });

    return {
      loading: boards?.every((b) => b.serial !== flashingBoard.serial) ?? true,
      succeeded,
      setFlashing,
      setSucceeded,
      close: (): void => {
        cancelFlash();
        if (succeeded) {
          selectBoard(flashingBoard.serial);
          // Clear app mapping when board is flashed to prevent old app info from causing issues
          clearBoardAppMapping(flashingBoard.serial);
        } else {
          setBoardIsFlashing(false);
        }
      },
      listAvailableImages: listAvailableOSImages,
      getAvailableFreeSpace,
      getUserPartitionPreservationSupported:
        isUserPartitionPreservationSupported,
      flashBoard: flash,
      openArduinoSupport: (): void => {
        openLinkExternal(ARDUINO_SUPPORT_URL);
      },
      clearBoardAsUsed,
      flashingBoard,
    };
  };
};
