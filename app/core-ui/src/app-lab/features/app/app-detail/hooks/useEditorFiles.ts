import { SelectableFileData } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as IDB from 'idb-keyval';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEvent } from 'react-use';

import {
  mergeStoreItem,
  OPEN_FILES_KEY,
  OpenFilesStore,
  OpenFilesStoreItem,
  OpenFilesStorePatch,
} from '../../../../../common/hooks/files';
import { useObservable } from '../../../../../common/hooks/useObservable';
import { withoutHostLocalIds } from './filePaths';
import { resolveNewTabInsertion } from './tabInsertion';
import { useEditorFileMeta } from './useEditorFileMeta';
import {
  UseEditorFilesParams,
  UseEditorFilesReturn,
} from './useEditorFiles.type';
import { usePreviewFileId } from './usePreviewFileId';

export function useEditorFiles({
  storeEntityId,
  defaultFileId,
  filesList,
  appBricks,
  getUnsavedFilesSubject,
}: UseEditorFilesParams): UseEditorFilesReturn {
  const enabled = !!filesList;
  const [selectedFileId, setSelectedFileId] = useState<string | undefined>(
    undefined,
  );
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);

  const externalPaths = useMemo(
    () =>
      openFileIds.filter(
        (id) => id.startsWith('/') || id.startsWith('file://'),
      ),
    [openFileIds],
  );

  const editorFileMap = useEditorFileMeta(filesList, appBricks, externalPaths);

  // Latest catalogue, read by `closeFile` to pick a next selection that
  // actually renders. Mirrored into a ref so the callback keeps a stable
  // identity — the map is rebuilt on every tab change.
  const editorFileMapRef = useRef(editorFileMap);
  editorFileMapRef.current = editorFileMap;

  const editorFiles = useMemo<SelectableFileData[]>(
    () => Array.from(editorFileMap.values()),
    [editorFileMap],
  );

  const queryClient = useQueryClient();
  const { data: openFilesStore } = useQuery(
    ['get-stored-open-files', storeEntityId],
    async () => {
      if (!storeEntityId) {
        return null;
      }
      const store = await IDB.get<OpenFilesStore>(OPEN_FILES_KEY);
      const storeItem = store?.[storeEntityId];
      return storeItem ? withoutHostLocalIds(storeItem) : null;
    },
  );

  const unsavedFileIds = useObservable(getUnsavedFilesSubject());

  const [previewFileId, setPreviewFileId, previewFileIdRef] =
    usePreviewFileId(unsavedFileIds);

  useEvent('beforeunload', (e: Event) => {
    if ((unsavedFileIds ?? new Set()).size !== 0) {
      e.preventDefault();
    }
  });

  const openFilesInitComplete = useRef(false);

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

    const storedIds = openFilesStore?.items ?? [];
    const currOpenFilesIds =
      storedIds.length > 0 ? storedIds : defaultFileId ? [defaultFileId] : [];

    setOpenFileIds(currOpenFilesIds);

    const lastSelectedFileId = openFilesStore?.selected;
    const currSelectedFileId =
      lastSelectedFileId && currOpenFilesIds.includes(lastSelectedFileId)
        ? lastSelectedFileId
        : currOpenFilesIds[0];

    setSelectedFileId(currSelectedFileId ?? undefined);
  }, [enabled, openFilesStore, defaultFileId]);

  useEffect(() => {
    // Reset when the data source becomes unavailable so a new app's
    // hydration starts from a clean slate.
    if (openFilesInitComplete.current && !enabled) {
      openFilesInitComplete.current = false;
      setSelectedFileId(undefined);
      setOpenFileIds([]);
    }
  }, [enabled]);

  // Single write path for the record, so host-local ids are dropped no matter
  // which caller is patching it.
  const patchStoreItem = useCallback(
    async (
      buildPatch: (
        prevStoreItem: OpenFilesStoreItem | undefined,
      ) => OpenFilesStorePatch,
    ) => {
      if (!storeEntityId) {
        return;
      }
      await IDB.update(OPEN_FILES_KEY, (prevValue?: OpenFilesStore) => {
        const prevStoreItem = prevValue?.[storeEntityId];
        return {
          ...prevValue,
          [storeEntityId]: withoutHostLocalIds(
            mergeStoreItem(prevStoreItem, buildPatch(prevStoreItem)),
          ),
        };
      });
      queryClient.invalidateQueries(['get-stored-open-files', storeEntityId]);
    },
    [storeEntityId, queryClient],
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
   * restoration, tab-strip clicks, pane split/merge logic).
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
      // Release the preview slot with the tab, mirroring pane B's
      // `closeRightPaneTab`. Otherwise the slot keeps naming a closed file and
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
      if (!storeEntityId || !openFilesStore) {
        return;
      }
      const prevAppId = storeEntityId.split('-')[0];
      if (!prevAppId || prevAppId === newAppId) return;

      const newStoreEntityId = storeEntityId.replace(prevAppId, newAppId);

      await IDB.update(OPEN_FILES_KEY, (prevValue?: OpenFilesStore) => {
        if (!prevValue) return {};
        const storeItem = prevValue?.[storeEntityId];
        delete prevValue?.[storeEntityId];
        return { ...prevValue, [newStoreEntityId]: storeItem };
      });
      queryClient.invalidateQueries(['get-stored-open-files', storeEntityId]);
    },
    [openFilesStore, queryClient, storeEntityId],
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
    unsavedFileIds,
    previewFileId,
    openFilesStore,
    selectFile,
    closeFile,
    updateOpenFile,
    updateOpenFilesOrder,
    onAppRename,
    storeSplitState,
  };
}
