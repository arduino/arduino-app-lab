import { statAppPath } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { SelectableFileData } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { QueryKey, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEvent } from 'react-use';

import {
  OpenFilesStoreItem,
  OpenFilesStorePatch,
} from '../../../../../common/hooks/files';
import { useObservableRef } from '../../../../../common/hooks/useObservable';
import {
  getOpenFilesEntry,
  moveOpenFilesEntry,
  patchOpenFilesEntry,
} from '../../../../services/openFilesStore';
import {
  isAbsoluteId,
  resolveAbsPath,
  withoutHostLocalIds,
  withoutIds,
} from './filePaths';
import { resolveNewTabInsertion } from './tabInsertion';
import { useEditorFileMeta } from './useEditorFileMeta';
import {
  UseEditorFilesParams,
  UseEditorFilesReturn,
} from './useEditorFiles.type';
import { usePreviewFileId } from './usePreviewFileId';

export const openFilesQueryKey = (storeEntityId?: string): QueryKey => [
  'get-stored-open-files',
  storeEntityId,
];

// `items` mirrors panel A: it is what panel A is restored from, and all a record from before the panels holds.
const storedTabIds = (record: OpenFilesStoreItem): string[] => [
  ...(record.items ?? []),
  ...(record.panes?.A?.items ?? []),
  ...(record.panes?.B?.items ?? []),
];

// A stat that fails cannot tell, so its id is not reported as gone.
const findGoneIds = async (
  ids: string[],
  appPath: string,
): Promise<Set<string>> => {
  const gone = await Promise.all(
    ids.map((id) =>
      statAppPath(resolveAbsPath(id, appPath)).then(
        (node) => (node ? undefined : id),
        () => undefined,
      ),
    ),
  );
  return new Set(gone.filter((id): id is string => id !== undefined));
};

export function useEditorFiles({
  storeEntityId,
  boardId,
  appPath,
  defaultFilePath,
  appDirListed,
  appBricks,
  appBricksFailed,
  getUnsavedFilesSubject,
}: UseEditorFilesParams): UseEditorFilesReturn {
  const enabled = appDirListed && defaultFilePath !== undefined;
  const [selectedFileId, setSelectedFileId] = useState<string | undefined>(
    undefined,
  );
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);

  const openFilesInitComplete = useRef(false);
  // The same, as state: the ref alone re-renders nothing when it flips.
  const [tabsHydrated, setTabsHydrated] = useState(false);
  // The board the tabs on screen were restored on. A board switch gives the entity the next board's serial before the tabs reset, so a write then would store this board's tabs as the next one's.
  const restoredOn = useRef<{ board?: string }>();

  const queryClient = useQueryClient();
  const { data: storedRecord } = useQuery({
    queryKey: openFilesQueryKey(storeEntityId),
    queryFn: async () => {
      if (!storeEntityId) {
        return null;
      }
      const storeItem = await getOpenFilesEntry(storeEntityId);
      return storeItem ? withoutHostLocalIds(storeItem) : null;
    },
    // Without a store entity the record is unknown: an answer of none would restore the default file and store it as the next board's tabs.
    enabled: !!storeEntityId,
  });

  // The record and the board a check read, and that record without the tabs whose file is gone (deleted while this screen was unmounted, as in Agent Mode).
  const [checked, setChecked] = useState<{
    record: OpenFilesStoreItem;
    board?: string;
    bricksFailed: boolean;
    withoutGone: OpenFilesStoreItem;
  }>();
  // A check holds only for what it saw: after a board switch an example app has the same record, and the first render still shows the last board's brick list.
  const checkedNow =
    !!checked &&
    checked.record === storedRecord &&
    checked.board === boardId &&
    checked.bricksFailed === !!appBricksFailed;
  useEffect(() => {
    if (tabsHydrated || !storedRecord || !appPath || checkedNow) {
      return undefined;
    }
    if (!appBricks) {
      if (appBricksFailed) {
        setChecked({
          record: storedRecord,
          board: boardId,
          bricksFailed: true,
          withoutGone: storedRecord,
        });
      }
      return undefined;
    }
    // A brick tab is named by the brick's id, which a stat would not find in the app folder.
    const brickIds = new Set(appBricks.map((brick) => brick.id));
    const ids = Array.from(new Set(storedTabIds(storedRecord))).filter(
      (id) => !brickIds.has(id),
    );
    let cancelled = false;
    void findGoneIds(ids, appPath).then((gone) => {
      if (cancelled) return;
      setChecked({
        record: storedRecord,
        board: boardId,
        bricksFailed: false,
        withoutGone: gone.size
          ? withoutIds(storedRecord, (id) => gone.has(id))
          : storedRecord,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [
    checkedNow,
    tabsHydrated,
    storedRecord,
    appPath,
    appBricks,
    appBricksFailed,
    boardId,
  ]);

  // Undefined until this record is checked, so neither panel restores a gone tab; once the tabs are restored, a newer record is used as it is.
  const openFilesStore = useMemo(() => {
    if (!storedRecord) return storedRecord;
    if (checkedNow && checked) return checked.withoutGone;
    return tabsHydrated ? storedRecord : undefined;
  }, [storedRecord, checkedNow, checked, tabsHydrated]);

  const externalPaths = useMemo(
    () => openFileIds.filter(isAbsoluteId),
    [openFileIds],
  );

  // Panel B is hydrated by the editor panel from this same record, so its tabs
  // are never in `openFileIds` — but they still resolve through the catalogue
  // below.
  const storedFileIds = useMemo(
    () => (openFilesStore ? storedTabIds(openFilesStore) : []),
    [openFilesStore],
  );

  // Meta is derived from the id, so only ids that can reach a tab need one.
  const appFilePaths = useMemo(
    () =>
      Array.from(new Set([...openFileIds, ...storedFileIds])).filter(
        (id) => !isAbsoluteId(id),
      ),
    [openFileIds, storedFileIds],
  );

  const editorFileMap = useEditorFileMeta(
    appFilePaths,
    appBricks,
    externalPaths,
  );

  // Latest catalogue, read by `closeFile` to pick a next selection that
  // actually renders. Mirrored into a ref so the callback keeps a stable
  // identity — the map is rebuilt on every tab change.
  const editorFileMapRef = useRef(editorFileMap);
  editorFileMapRef.current = editorFileMap;

  const editorFiles = useMemo<SelectableFileData[]>(
    () => Array.from(editorFileMap.values()),
    [editorFileMap],
  );

  // Only the `beforeunload` guard reads the set here; the tabs bars subscribe where they render.
  const unsavedFiles$ = getUnsavedFilesSubject();
  const unsavedFileIdsRef = useObservableRef(unsavedFiles$);

  const [previewFileId, setPreviewFileId, previewFileIdRef] =
    usePreviewFileId(unsavedFiles$);

  useEvent('beforeunload', (e: Event) => {
    if ((unsavedFileIdsRef.current?.size ?? 0) !== 0) {
      e.preventDefault();
    }
  });

  useEffect(() => {
    const storedOpenFileNamesIsLoading = openFilesStore === undefined;
    if (
      storedOpenFileNamesIsLoading ||
      openFilesInitComplete.current ||
      !enabled
    ) {
      return;
    }

    openFilesInitComplete.current = true;
    restoredOn.current = { board: boardId };
    setTabsHydrated(true);

    const storedIds = openFilesStore?.items ?? [];
    const currOpenFilesIds =
      storedIds.length > 0
        ? storedIds
        : defaultFilePath
        ? [defaultFilePath]
        : [];

    // A file opened while the stored tabs were checked stays open and selected.
    setOpenFileIds((openedBefore) =>
      Array.from(new Set([...currOpenFilesIds, ...openedBefore])),
    );

    const lastSelectedFileId = openFilesStore?.selected;
    const currSelectedFileId =
      lastSelectedFileId && currOpenFilesIds.includes(lastSelectedFileId)
        ? lastSelectedFileId
        : currOpenFilesIds[0];

    setSelectedFileId(
      (selectedBefore) => selectedBefore ?? currSelectedFileId ?? undefined,
    );
  }, [enabled, openFilesStore, defaultFilePath, boardId]);

  useEffect(() => {
    // Reset when the data source becomes unavailable so a new app's
    // hydration starts from a clean slate.
    if (enabled) {
      return;
    }
    openFilesInitComplete.current = false;
    restoredOn.current = undefined;
    setTabsHydrated(false);
    // Also before a restore: a file opened during the check belongs to the board or app that went.
    setSelectedFileId(undefined);
    setOpenFileIds((ids) => (ids.length ? [] : ids));
    setChecked(undefined);
  }, [enabled]);

  // Single write path for the record, so host-local ids are dropped no matter
  // which caller is patching it.
  const patchStoreItem = useCallback(
    async (
      buildPatch: (
        prevStoreItem: OpenFilesStoreItem | undefined,
      ) => OpenFilesStorePatch,
    ) => {
      if (
        !storeEntityId ||
        !restoredOn.current ||
        restoredOn.current.board !== boardId
      ) {
        return;
      }
      await patchOpenFilesEntry(storeEntityId, buildPatch, withoutHostLocalIds);
      queryClient.invalidateQueries({
        queryKey: openFilesQueryKey(storeEntityId),
      });
    },
    [storeEntityId, boardId, queryClient],
  );

  const storeOpenFiles = useCallback(
    async (fileIds: string[], nextSelectedFileId: string | undefined) => {
      const uniqueFileIds = Array.from(new Set(fileIds));
      await patchStoreItem((prevStoreItem) => {
        const nextSelected =
          nextSelectedFileId ?? prevStoreItem?.selected ?? null;
        return {
          items: uniqueFileIds,
          selected: nextSelected,
          panes: {
            A: { items: uniqueFileIds, selected: nextSelected },
          },
        };
      });
    },
    [patchStoreItem],
  );

  const storeSplitState = useCallback(
    async (patch: OpenFilesStorePatch) => {
      await patchStoreItem(() => patch);
    },
    [patchStoreItem],
  );

  useEffect(() => {
    if (!openFilesInitComplete.current) {
      return;
    }
    storeOpenFiles(openFileIds, selectedFileId);
  }, [openFileIds, selectedFileId, storeOpenFiles]);

  /**
   * UI-only selection: sets the active tab and inserts the id into the
   * open-tabs strip if missing. Does NOT fetch content — callers must
   * ensure the file's code subject is (or will be) hydrated.
   *
   * For user-intent file opens (file-tree click, search jump, AI assist
   * "open this"), prefer `openFile` from `useFileOperations`, which
   * composes `fetchFile + selectFile` into one call. Use `selectFile`
   * directly only when re-selecting an already-cached tab (boot
   * restoration, tab-strip clicks, panel split/merge logic).
   */
  const selectFile = useCallback(
    (params: {
      fileId?: string;
      openAtIndex?: number;
      isPreview?: boolean;
    }) => {
      const { fileId, openAtIndex, isPreview = false } = params;

      if (!enabled) {
        return;
      }

      if (!fileId) {
        setSelectedFileId(undefined);
        return;
      }

      const oldPreviewId = previewFileIdRef.current;
      const oldSelectedId = selectedFileId;

      setSelectedFileId(fileId);

      setOpenFileIds((prevOpenFiles) => {
        if (prevOpenFiles.includes(fileId)) {
          if (!isPreview && oldPreviewId === fileId) {
            setPreviewFileId(undefined);
          }
          return prevOpenFiles;
        }

        const { ids, previewId } = resolveNewTabInsertion({
          ids: prevOpenFiles,
          targetId: fileId,
          insertIndex: openAtIndex,
          isPreview,
          oldPreviewId,
          oldSelectedId,
        });
        setPreviewFileId(previewId);
        return ids;
      });
    },
    [enabled, setPreviewFileId, selectedFileId, previewFileIdRef],
  );

  const closeFile = useCallback(
    (fileId: string) => {
      if (!enabled) {
        return;
      }
      // Release the preview slot with the tab, mirroring panel B's
      // `closeRightPanelTab`. Otherwise the slot keeps naming a closed file and
      // the next preview open resolves its insertion against a ghost id.
      if (previewFileIdRef.current === fileId) {
        setPreviewFileId(undefined);
      }
      setOpenFileIds((prevOpenFileIds) => {
        if (!prevOpenFileIds.includes(fileId)) {
          return prevOpenFileIds;
        }
        setSelectedFileId((prevSelectedFileId) => {
          if (fileId !== prevSelectedFileId) {
            return prevSelectedFileId;
          }
          // Select the nearest id that actually renders a tab — left first,
          // then right (so closing index 0 still moves right, as before).
          //
          // Indexing straight into `openFileIds` is wrong because the list
          // legitimately holds ids with no meta: a lazily-loading external
          // file, or one persisted under a path that no longer exists. Those
          // render nothing, so selecting one leaves the editor blank with a
          // tab strip that still has tabs in it.
          const closedFileIndex = prevOpenFileIds.indexOf(fileId);
          const meta = editorFileMapRef.current;
          for (let i = closedFileIndex - 1; i >= 0; i -= 1) {
            if (meta.has(prevOpenFileIds[i])) return prevOpenFileIds[i];
          }
          for (
            let i = closedFileIndex + 1;
            i < prevOpenFileIds.length;
            i += 1
          ) {
            if (meta.has(prevOpenFileIds[i])) return prevOpenFileIds[i];
          }
          // Nothing left that renders: an empty editor is the honest state.
          return undefined;
        });
        return prevOpenFileIds.filter((id) => id !== fileId);
      });
    },
    [enabled, setPreviewFileId, previewFileIdRef],
  );

  const updateOpenFile = useCallback(
    (currFileId: string, nextFileId: string) => {
      setSelectedFileId((prevSelectedFileId) =>
        currFileId === prevSelectedFileId ? nextFileId : prevSelectedFileId,
      );
      setOpenFileIds((prevOpenFileIds) =>
        prevOpenFileIds.map((id) => (currFileId === id ? nextFileId : id)),
      );
    },
    [],
  );

  const updateOpenFilesOrder = useCallback(
    (fileIds: string[], draggedFileId?: string) => {
      setOpenFileIds((prevOpenFileIds) => {
        // Accept only a true permutation. Checking `every(includes)` alone
        // lets a list with a repeated id through (eg. ['b','b'] against
        // ['a','b']), and since `closeFile` drops *every* occurrence of an id
        // one close would then take two tabs with it.
        if (
          fileIds.length !== prevOpenFileIds.length ||
          new Set(fileIds).size !== fileIds.length ||
          !fileIds.every((id) => prevOpenFileIds.includes(id))
        ) {
          return prevOpenFileIds;
        }
        return fileIds;
      });

      if (draggedFileId && draggedFileId === previewFileIdRef.current) {
        setPreviewFileId(undefined);
      }
    },
    [setPreviewFileId, previewFileIdRef],
  );

  const onAppRename = useCallback(
    async (newAppId: string) => {
      if (!storeEntityId || !storedRecord) {
        return;
      }
      const prevAppId = storeEntityId.split('-')[0];
      if (!prevAppId || prevAppId === newAppId) return;

      const newStoreEntityId = storeEntityId.replace(prevAppId, newAppId);

      await moveOpenFilesEntry(storeEntityId, newStoreEntityId);
      queryClient.invalidateQueries({
        queryKey: openFilesQueryKey(storeEntityId),
      });
    },
    [storedRecord, queryClient, storeEntityId],
  );

  // Resolve ids → SelectableFileData via the meta catalogue. Ids whose
  // meta isn't (yet) in the map are filtered out of render but kept in
  // `openFileIds` state — they reappear when their meta lands (eg. Step 5
  // external files load lazily).
  const openFiles = useMemo<SelectableFileData[]>(
    () =>
      openFileIds
        .map((id) => editorFileMap.get(id))
        .filter((f): f is SelectableFileData => Boolean(f)),
    [openFileIds, editorFileMap],
  );

  const selectedFile = useMemo<SelectableFileData | undefined>(
    () => (selectedFileId ? editorFileMap.get(selectedFileId) : undefined),
    [selectedFileId, editorFileMap],
  );

  return {
    editorFiles,
    openFiles,
    openFileIds,
    selectedFile,
    previewFileId,
    openFilesStore,
    tabsHydrated,
    selectFile,
    closeFile,
    updateOpenFile,
    updateOpenFilesOrder,
    onAppRename,
    storeSplitState,
  };
}
