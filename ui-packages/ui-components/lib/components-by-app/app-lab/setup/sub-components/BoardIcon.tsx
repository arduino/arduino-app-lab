import { BOARD_FQBN } from '@cloud-editor-mono/common';
import {
  Board as BoardGenericIcon,
  BoardUnoQ,
  BoardVentunoQ,
} from '@cloud-editor-mono/images/assets/icons';

import { Board } from '../setup.type';

interface BoardIconProps {
  board: Board;
}

const BoardIcon: React.FC<BoardIconProps> = (props: BoardIconProps) => {
  const { board } = props;

  switch (board.fqbn) {
    case BOARD_FQBN.UNO_Q:
      return <BoardUnoQ />;
    case BOARD_FQBN.VENTUNO_Q:
      return <BoardVentunoQ />;
    default:
      return <BoardGenericIcon />;
  }
};

export default BoardIcon;
