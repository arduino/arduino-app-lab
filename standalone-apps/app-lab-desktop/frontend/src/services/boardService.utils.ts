import { Board } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { get, set } from 'idb-keyval';

const LAST_SEEN_USB_BOARD_KEY = 'last-seen-usb-board';
const IGNORE_NETWORK_BOARD_AFTER_USB_DISCOVER_MS = 70_000;

export const filterBoards = async (boards: Board[]): Promise<Board[]> => {
  // deduplicate boards by serial number
  const deduplicated = Object.values(
    boards.reduce<Record<string, Board>>((acc, board) => {
      if (
        !acc[board.serial] ||
        // when board is available in both 'USB' and 'Network' mode, keep only 'USB'
        board.connectionType === 'USB' ||
        // when board is available in 'Network' mode and has both 'IPv4' and 'IPv6' addresses, keep only 'IPv4'
        (board.connectionType === 'Network' &&
          acc[board.serial].connectionType === 'Network' &&
          !board.address.includes(':'))
      ) {
        acc[board.serial] = board;
      }
      return acc;
    }, {}),
  );

  // store last-seen timestamp for each USB-connected board
  const usbConnectedBoards = boards.filter(
    (board) => board.connectionType === 'USB',
  );
  for (const board of usbConnectedBoards) {
    await set(`${LAST_SEEN_USB_BOARD_KEY}-${board.serial}`, Date.now());
  }

  // filter out Network-connected board when board has been USB-connected in the last NETWORK_IGNORE_AFTER_USB_MS
  const filtered: Board[] = [];
  for (const board of deduplicated) {
    if (board.connectionType === 'Network') {
      const lastSeenUsbBoard = await get(
        `${LAST_SEEN_USB_BOARD_KEY}-${board.serial}`,
      );
      if (
        !lastSeenUsbBoard ||
        Date.now() - lastSeenUsbBoard >
          IGNORE_NETWORK_BOARD_AFTER_USB_DISCOVER_MS
      ) {
        filtered.push(board);
      }
    } else {
      filtered.push(board);
    }
  }

  return filtered;
};
