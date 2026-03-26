import {
  flash,
  getAvailableFreeSpace,
  getBoards,
  isUserPartitionPreservationSupported,
  listAvailableOSImages,
  openLinkExternal,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { useBoardSerialTracker } from '@cloud-editor-mono/ui-components/lib/common/utils';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { UseFlasherLogic } from './flasher.type';

const ARDUINO_SUPPORT_URL = 'https://www.arduino.cc/en/contact-us/';

export const useFlasherLogic: UseFlasherLogic = function (
  selectBoard: (boardId: string) => Promise<void>,
): ReturnType<UseFlasherLogic> {
  const { selectedConnectedBoard, setBoardIsFlashing } = useBoardLifecycleStore(
    useShallow((state) => ({
      selectedConnectedBoard: state.selectedConnectedBoard,
      setBoardIsFlashing: state.setBoardIsFlashing,
    })),
  );

  const [succeeded, setSucceeded] = useState<boolean | null>(null);
  const { clearBoardAsUsed } = useBoardSerialTracker();
  const [flashingBoard] = useState(selectedConnectedBoard!);

  const { data: boards } = useQuery(['list-boards'], getBoards, {
    refetchInterval: 1000,
  });

  return {
    loading: boards?.every((b) => b.serial !== flashingBoard.serial) ?? true,
    succeeded,
    setSucceeded,
    close: (): void => {
      if (succeeded) {
        selectBoard(flashingBoard.id);
      } else {
        setBoardIsFlashing(false);
      }
    },
    listAvailableImages: listAvailableOSImages,
    getAvailableFreeSpace: getAvailableFreeSpace,
    getUserPartitionPreservationSupported: isUserPartitionPreservationSupported,
    flashBoard: flash,
    openArduinoSupport: (): void => {
      openLinkExternal(ARDUINO_SUPPORT_URL);
    },
    clearBoardAsUsed,
    flashingBoard,
  };
};
