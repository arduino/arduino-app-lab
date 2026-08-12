import { Board } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

// Stable identity for the connected board, used to scope board-scoped query
// caches so switching boards doesn't surface the previous board's data.
// In network mode the `serial` is unreliable (and often empty), so prefer the
// IP `address`; fall back to `serial` for USB boards and as a safety net.
export const getBoardCacheId = (
  board: Board | undefined,
): string | undefined => {
  if (!board) {
    return undefined;
  }
  if (board.connectionType === 'Network') {
    return board.address || board.serial || undefined;
  }
  return board.serial || undefined;
};
