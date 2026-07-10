import {
  UsbPort,
  UsbPortDisconnected,
  Wifi,
} from '@cloud-editor-mono/images/assets/icons';
import { BoardItem } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useBoardLifecycleStore } from '../store/boardLifecycle';

export interface UseBoardItem {
  boardItem?: BoardItem;
}

export const useBoardItem = (): UseBoardItem => {
  const { boardIsReachable, selectedBoard } = useBoardLifecycleStore(
    useShallow((state) => ({
      boardIsReachable: state.boardIsReachable,
      selectedBoard: state.selectedConnectedBoard,
    })),
  );

  const boardItem = useMemo<BoardItem>(
    () =>
      boardIsReachable
        ? {
            label: selectedBoard?.name
              ? `${selectedBoard.name} (${selectedBoard?.type})`
              : selectedBoard?.type ?? '',
            state: 'default',
            icon:
              selectedBoard?.connectionType === 'Network' ? (
                <Wifi />
              ) : (
                <UsbPort />
              ),
          }
        : {
            state: 'inactive',
            icon: <UsbPortDisconnected />,
          },
    [boardIsReachable, selectedBoard],
  );

  return { boardItem };
};
