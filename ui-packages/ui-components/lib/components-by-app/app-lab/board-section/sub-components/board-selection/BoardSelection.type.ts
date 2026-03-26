import { Board } from '../../../setup';
import { BoardItem } from '../../BoardSection.type';

export interface BoardSelectionProps {
  boardItem?: BoardItem;
  isBoard?: boolean;
  boards: Board[];
  selectedBoard: Board | undefined;
  autoSelectBoard: (boardId: string) => void;
}
