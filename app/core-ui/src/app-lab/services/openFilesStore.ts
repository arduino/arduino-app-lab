import {
  mergeStoreItem,
  OPEN_FILES_KEY,
  OpenFilesStore,
  OpenFilesStoreItem,
  OpenFilesStorePanelState,
  OpenFilesStorePatch,
} from '../../common/hooks/files';
import * as IDB from './persistentStore';

const EXAMPLE_SUFFIX = '-example';

export const entryKeyForApp = (appId: string, serial?: string): string =>
  serial ? `${appId}-${serial}` : appId;

// One queue for every access: patches and prunes can't clobber each other, and a read sees every write queued before it.
let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const result = queue.then(task, task);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};

const mutateStore = (
  mutator: (store: OpenFilesStore) => OpenFilesStore,
): Promise<void> =>
  enqueue(() =>
    IDB.update<OpenFilesStore>(OPEN_FILES_KEY, (prev) => mutator(prev ?? {})),
  );

export const getOpenFilesEntry = async (
  key: string,
): Promise<OpenFilesStoreItem | undefined> => {
  const store = await enqueue(() => IDB.get<OpenFilesStore>(OPEN_FILES_KEY));
  return store?.[key];
};

export const patchOpenFilesEntry = (
  key: string,
  buildPatch: (prev: OpenFilesStoreItem | undefined) => OpenFilesStorePatch,
  transform: (item: OpenFilesStoreItem) => OpenFilesStoreItem = (
    item,
  ): OpenFilesStoreItem => item,
): Promise<void> =>
  mutateStore((store) => {
    const prevItem = store[key];
    return {
      ...store,
      [key]: transform(mergeStoreItem(prevItem, buildPatch(prevItem))),
    };
  });

export const moveOpenFilesEntry = (
  fromKey: string,
  toKey: string,
): Promise<void> =>
  mutateStore((store) => {
    if (fromKey === toKey || !(fromKey in store)) return store;
    const { [fromKey]: item, ...rest } = store;
    return item ? { ...rest, [toKey]: item } : rest;
  });

export const moveOpenFilesForApp = (
  oldAppId: string,
  newAppId: string,
  serial?: string,
): Promise<void> =>
  moveOpenFilesEntry(
    entryKeyForApp(oldAppId, serial),
    entryKeyForApp(newAppId, serial),
  );

// Moves the stored tabs of a renamed file or folder, and the tabs under it: with no editor on screen nothing else does.
export const renameOpenFilesInApp = (
  appId: string,
  from: string,
  to: string,
  serial?: string,
): Promise<void> =>
  mutateStore((store) => {
    const key = entryKeyForApp(appId, serial);
    const item = store[key];
    if (!item) return store;
    const move = (id: string): string =>
      id === from || id.startsWith(`${from}/`)
        ? to + id.slice(from.length)
        : id;
    const moveKeys = <T>(
      byId?: Record<string, T>,
    ): Record<string, T> | undefined =>
      byId &&
      Object.fromEntries(
        Object.entries(byId).map(([id, value]) => [move(id), value]),
      );
    const movePane = (
      pane: OpenFilesStorePanelState,
    ): OpenFilesStorePanelState => ({
      ...pane,
      items: pane.items.map(move),
      selected: pane.selected && move(pane.selected),
      markdownByFileId: moveKeys(pane.markdownByFileId),
      brickTabByFileId: moveKeys(pane.brickTabByFileId),
    });
    return {
      ...store,
      [key]: {
        ...item,
        items: item.items.map(move),
        selected: item.selected && move(item.selected),
        panes: item.panes && {
          A: movePane(item.panes.A),
          B: item.panes.B && movePane(item.panes.B),
        },
        previewFileId: item.previewFileId && move(item.previewFileId),
      },
    };
  });

export const removeOpenFilesForApp = (
  appId: string,
  serial?: string,
): Promise<void> =>
  mutateStore((store) => {
    const key = entryKeyForApp(appId, serial);
    if (!(key in store)) return store;
    const { [key]: _removed, ...rest } = store;
    return rest;
  });

export const pruneOrphanedOpenFiles = (
  existingAppIds: string[],
  serial?: string,
): Promise<void> => {
  if (!serial || existingAppIds.length === 0) return Promise.resolve();

  const boardSuffix = `-${serial}`;
  const existing = new Set(existingAppIds);

  return mutateStore((store) => {
    let changed = false;
    const next: OpenFilesStore = {};
    for (const key of Object.keys(store)) {
      const isCurrentBoardKey =
        key.endsWith(boardSuffix) && !key.endsWith(EXAMPLE_SUFFIX);
      const appId = isCurrentBoardKey
        ? key.slice(0, -boardSuffix.length)
        : undefined;

      if (appId !== undefined && !existing.has(appId)) {
        changed = true;
        continue;
      }
      next[key] = store[key];
    }
    return changed ? next : store;
  });
};
