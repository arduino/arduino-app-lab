import { LinuxCredentialsDialogLogic } from '../../../../../dialogs';
import { Board } from '../../../setup';
import { BoardItem } from '../../BoardSection.type';

export interface BoardSelectionProps {
  boardItem?: BoardItem;
  isBoard?: boolean;
  boards: Board[];
  selectedBoard: Board | undefined;
  selectBoard: (board: Board) => Promise<void>;
  linuxCredentialsDialog?: LinuxCredentialsDialogLogic;
}
