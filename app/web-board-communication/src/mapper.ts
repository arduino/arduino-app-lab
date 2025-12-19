import { UNKNOWN_BOARD_NAME } from '@bcmi-labs/arduino-chromeos-uploader';
import supportedBoards from '@bcmi-labs/arduino-chromeos-uploader/dist/types/supported-boards';
import { BoardDescriptor } from '@bcmi-labs/arduino-chromeos-uploader/dist/types/types';

import { WebSerialPort } from './ports.type';

export function mapPortsListMessage(
  boards: BoardDescriptor[],
): WebSerialPort[] {
  const ports = boards.map((board) => {
    return {
      serialNumber: '',
      vendorId: board.vendorId,
      productId: board.productId,
      id: board.fqbn.split(':')[2],
      name: supportedBoards[board.fqbn]
        ? supportedBoards[board.fqbn].name
        : UNKNOWN_BOARD_NAME,
      portBoardId: board.name,
      fqbn: board.fqbn,
      portName: `${board.vendorId}/${board.productId}`,
      isOpen: board.isOpen,
      architecture: board.fqbn.split(':')[1],
    };
  });

  return ports;
}
