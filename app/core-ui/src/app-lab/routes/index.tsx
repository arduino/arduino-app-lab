import { createFileRoute, redirect } from '@tanstack/react-router';
import { get } from 'idb-keyval';

import { AUTO_SELECT_BOARD_SERIAL, BOARD_APP_MAPPING } from '../constants';

export const Route = createFileRoute('/')({
  loader: async () => {
    // Check if there's an auto-selection in progress or a saved app to navigate to
    const boardSerial = await get<string>(AUTO_SELECT_BOARD_SERIAL);
    const boardAppMapping = await get<
      Record<string, { appId: string; section: string }>
    >(BOARD_APP_MAPPING);

    // If there's a saved board serial or app mapping, don't redirect
    // Let useReloadApp handle the navigation
    if (
      boardSerial ||
      (boardAppMapping && Object.keys(boardAppMapping).length > 0)
    ) {
      return null;
    }

    // Otherwise open Inspirations, the landing page for a board with no apps
    throw redirect({
      to: '/inspirations',
    });
  },
});
