import {
  Board,
  ConnectionType,
} from '@cloud-editor-mono/ui-components/lib/app-lab-setup';

import { board } from '../../wailsjs/go/models';

function mapProtocol(protocol: string): ConnectionType {
  switch (protocol) {
    case 'serial':
      return 'USB';
    case 'network':
      return 'Network';
    case 'local':
      return 'Local';
    default:
      throw new Error('Unknown protocol');
  }
}

function mapBoard(board: board.Board): Board {
  return {
    id: board.id,
    type: board.info.BoardName,
    name: board.info.CustomName,
    connectionType: mapProtocol(board.info.Protocol),
    protocol: board.info.Protocol,
    serial: board.info.Serial,
    address: board.info.Address,
  };
}

export function mapGetBoards(boards: board.Board[]): Board[] {
  return boards.map(mapBoard);
}
