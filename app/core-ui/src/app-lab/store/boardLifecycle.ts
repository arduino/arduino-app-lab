import { Board } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { create } from 'zustand';

type BoardLifecycleStore = {
  boardIsReachable: boolean;
  setBoardIsReachable: (isReachable: boolean) => void;
  selectedConnectedBoard?: Board;
  setSelectedConnectedBoard: (board: Board | undefined) => void;
  needsImageUpdate?: boolean;
  setNeedsImageUpdate: (value: boolean) => void;
  boardIsFlashing?: boolean;
  setBoardIsFlashing: (value: boolean) => void;
};

export const useBoardLifecycleStore = create<BoardLifecycleStore>((set) => ({
  boardIsReachable: false,
  setBoardIsReachable: (isReachable: boolean): void =>
    set({ boardIsReachable: isReachable }),
  selectedConnectedBoard: undefined,
  setSelectedConnectedBoard: (board: Board | undefined): void =>
    set({ selectedConnectedBoard: board }),
  needsImageUpdate: undefined,
  setNeedsImageUpdate: (needsImageUpdate: boolean): void =>
    set({ needsImageUpdate }),
  boardIsFlashing: undefined,
  setBoardIsFlashing: (boardIsFlashing: boolean): void =>
    set({ boardIsFlashing }),
}));
