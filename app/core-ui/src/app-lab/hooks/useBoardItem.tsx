import {
  UsbPort,
  UsbPortDisconnected,
  Wifi,
} from '@cloud-editor-mono/images/assets/icons';
import { BoardItem } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useContext, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { BoardConfigurationContext } from '../providers/board-configuration/boardConfigurationContext';
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

  const { boardConfigurationIsSet, boardName } = useContext(
    BoardConfigurationContext,
  );

  // use 'boardName' instead of 'selectedConnectedBoard.name', cause 'boardName' is re-fetched when board name is changed during setup
  const boardItem = useMemo<BoardItem>(
    () =>
      boardIsReachable
        ? {
            label: boardConfigurationIsSet
              ? `${boardName} (${selectedBoard?.type})`
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
    [boardConfigurationIsSet, boardIsReachable, boardName, selectedBoard],
  );

  return { boardItem };
};
