import {
  eventsEmit,
  eventsOn,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  EventSourceHandlers,
  UpdateCheckResult,
} from '@cloud-editor-mono/infrastructure';

import {
  ApplyBoardUpdate,
  CheckAndApplyUpdate,
  CheckBoardUpdate,
  GetBoardUpdateLogs,
  GetCurrentVersion,
  NewVersion,
} from '../../wailsjs/go/app/App';

/**
 * This function retrieves the current version of the application as defined in the Go backend
 * via LDFlags during the build process.
 *
 * @returns Promise<string> - Returns the current version of the application.
 */
export const getCurrentVersion = async (): Promise<string> =>
  GetCurrentVersion();

/**
 * This function checks for updates to the application and returns the version number if a new version is available.
 * If no new version is available, it returns an empty string.
 *
 * @returns Promise<string> - Returns the new version if available, otherwise an empty string.
 */
export const newVersion = async (): Promise<string> => {
  try {
    return await NewVersion();
  } catch (error) {
    console.error('Error checking for new version:', error);
    return '';
  }
};

/**
 * This function shows a confirmation dialog to the user to apply an update if available.
 * If the user confirms, it applies the update, using the Go function `CheckAndApplyUpdate`.
 * If an error occurs during the update process, it logs the error to the console.
 *
 * @returns Promise<void>
 */
export const checkAndApplyUpdate = async (
  showConfirm = false,
): Promise<void> => {
  await CheckAndApplyUpdate(showConfirm);
};

export const checkBoardUpdateWailsFallback = async (
  tunnelUrl: string,
): Promise<UpdateCheckResult> => {
  try {
    const response = await CheckBoardUpdate(true, tunnelUrl);
    if (response === '') {
      // No updatable packages found
      return { updates: null };
    }
    const parsedResponse = JSON.parse(response);
    return parsedResponse as UpdateCheckResult;
  } catch (err) {
    console.error('checkBoardUpdate wails fallback error', err);
    throw err;
  }
};

export const applyBoardUpdateWailsFallback = async (
  tunnelUrl: string,
): Promise<boolean | null> => {
  try {
    const response = await ApplyBoardUpdate(true, tunnelUrl);
    return Boolean(response) || null;
  } catch (err) {
    console.error('applyBoardUpdate wails fallback error', err);
    return false;
  }
};

export const getBoardUpdateLogsWailsFallback = async (
  boardUrl: string,
  handlers: EventSourceHandlers,
  abortController?: AbortController,
): Promise<void> => {
  eventsOn('board-update-log-onmessage', (obj) => {
    try {
      const base64 = obj.Data;
      const jsonStr = Buffer.from(base64, 'base64').toString('utf8');
      const parsedData = { id: obj.ID, event: obj.Event, data: jsonStr };
      handlers?.onmessage?.(parsedData);
    } catch (err) {
      console.debug('error parsing log:', obj, err);
    }
  });
  eventsOn('board-update-log-onerror', (err) => {
    handlers?.onerror?.(err);
  });
  abortController?.signal.addEventListener('abort', () => {
    eventsEmit('board-update-log-onclose');
  });
  return GetBoardUpdateLogs(boardUrl);
};
