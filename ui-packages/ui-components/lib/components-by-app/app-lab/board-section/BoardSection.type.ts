import { Board } from '../setup';

export type BoardItem =
  | {
      label: string;
      state: 'default';
      icon?: React.ReactNode;
    }
  | {
      label?: never;
      state: 'inactive';
      icon?: React.ReactNode;
    };

export interface BoardSectionProps {
  boardItem?: BoardItem;
  isBoard?: boolean;
  boards: Board[];
  selectedBoard: Board | undefined;
  autoSelectBoard: (boardId: string) => void;
  onOpenTerminal: () => Promise<void>;
  terminalError: string | null;
}
