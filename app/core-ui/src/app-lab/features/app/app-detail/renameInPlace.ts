import { AppDetailedInfo } from '@cloud-editor-mono/infrastructure';
import { QueryClient } from '@tanstack/react-query';

import { BoardScopedQuery } from '../../../boardScopedQuery';
import { openFilesQueryKey } from './hooks/useEditorFiles';

const USER_APP_ID_PREFIX = 'user:';

// arduino-app-cli builds a user app's id as base64url("user:" + its folder under the apps dir).
const userAppFolder = (appId: string): string | undefined => {
  try {
    const binary = atob(appId.replace(/-/g, '+').replace(/_/g, '/'));
    const decoded = new TextDecoder().decode(
      Uint8Array.from(binary, (char) => char.charCodeAt(0)),
    );
    return decoded.startsWith(USER_APP_ID_PREFIX)
      ? decoded.slice(USER_APP_ID_PREFIX.length)
      : undefined;
  } catch {
    return undefined;
  }
};

// Where a rename moved the app, read from the two ids; undefined when either is not a user app's id.
export const renamedAppPath = (
  oldPath: string,
  oldId: string,
  newId: string,
): string | undefined => {
  const oldFolder = userAppFolder(oldId);
  const newFolder = userAppFolder(newId);
  if (!oldFolder || !newFolder || !oldPath.endsWith(`/${oldFolder}`)) {
    return undefined;
  }
  return `${oldPath.slice(0, -oldFolder.length)}${newFolder}`;
};

// Copies what is cached under the old id onto the new one, so the screen re-renders on the data it already shows.
export const moveAppQueries = (
  queryClient: QueryClient,
  oldId: string,
  renamedApp: AppDetailedInfo,
  storeEntityId?: string,
): void => {
  queryClient
    .getQueriesData({ predicate: ({ queryKey }) => queryKey.includes(oldId) })
    .forEach(([queryKey, data]) => {
      if (data === undefined) return;
      const movedKey = queryKey.map((part) =>
        part === oldId ? renamedApp.id : part,
      );
      queryClient.setQueryData(
        movedKey,
        movedKey[0] === BoardScopedQuery.LIST_MY_APPS ? renamedApp : data,
      );
    });
  if (storeEntityId?.startsWith(oldId)) {
    queryClient.setQueryData(
      openFilesQueryKey(renamedApp.id + storeEntityId.slice(oldId.length)),
      queryClient.getQueryData(openFilesQueryKey(storeEntityId)),
    );
  }
};
