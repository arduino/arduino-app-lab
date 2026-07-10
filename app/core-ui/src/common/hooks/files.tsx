import { FileIcon } from '@cloud-editor-mono/images/assets/file-icons';
import { BrickIcon } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { SelectableFileData } from '@cloud-editor-mono/ui-components/lib/components-by-app/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as IDB from 'idb-keyval';
import { sortBy } from 'lodash';
import {
  createElement,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useEvent } from 'react-use';

import { getFileIcon, getMainLibraryFile } from '../utils';
import { UseFiles } from './files.type';
import { useObservable } from './useObservable';

export const OPEN_FILES_KEY = 'arduino:editor:open-files';
export type OpenFilesStorePaneState = {
  items: string[];
  selected: string | null;
  /**
   * Per-file markdown render mode (true = Preview, false = Write).
   * Only present for panes that have had at least one md file toggled.
   */
  markdownByFileId?: Record<string, boolean>;
  /**
   * Per-brick selected sub-tab id (e.g. 'overview', 'examples').
   * Only present for panes that have had at least one brick tab changed.
   */
  brickTabByFileId?: Record<string, string>;
};
export type OpenFilesStoreItem = {
  /** Legacy mirror of panes.A — kept for backwards-compat / downgrade safety. */
  items: string[];
  /** Legacy mirror of panes.A.selected. */
  selected: string | null;
  /** Per-pane tabs/selection/markdown state. Optional for legacy records. */
  panes?: {
    A: OpenFilesStorePaneState;
    B?: OpenFilesStorePaneState;
  };
  /** Whether the editor is currently split (pane B visible). */
  isSplit?: boolean;
  /** Width of the left pane as a percentage (0-100). */
  splitProportionLeft?: number;
};
export type OpenFilesStore = { [key: string]: OpenFilesStoreItem };

/**
 * Shape patched onto an existing OpenFilesStoreItem. Any field set here
 * replaces that field on the stored record; everything else is preserved.
 * Pane sub-fields are merged at the pane level (so a patch to
 * `panes.A.markdownByFileId` doesn't clobber `panes.A.items`).
 */
export type OpenFilesStorePatch = Partial<Omit<OpenFilesStoreItem, 'panes'>> & {
  panes?: {
    A?: Partial<OpenFilesStorePaneState>;
    B?: Partial<OpenFilesStorePaneState> | null;
  };
};

function mergeStoreItem(
  prev: OpenFilesStoreItem | undefined,
  patch: OpenFilesStorePatch,
): OpenFilesStoreItem {
  const base: OpenFilesStoreItem = prev ?? { items: [], selected: null };
  const mergedPanes = ((): OpenFilesStoreItem['panes'] => {
    if (!patch.panes) return base.panes;
    // Pane B explicitly set to null means "clear pane B".
    const nextB =
      patch.panes.B === null
        ? undefined
        : patch.panes.B
        ? {
            items: patch.panes.B.items ?? base.panes?.B?.items ?? [],
            selected:
              patch.panes.B.selected !== undefined
                ? patch.panes.B.selected
                : base.panes?.B?.selected ?? null,
            markdownByFileId:
              patch.panes.B.markdownByFileId !== undefined
                ? patch.panes.B.markdownByFileId
                : base.panes?.B?.markdownByFileId,
            brickTabByFileId:
              patch.panes.B.brickTabByFileId !== undefined
                ? patch.panes.B.brickTabByFileId
                : base.panes?.B?.brickTabByFileId,
          }
        : base.panes?.B;
    const nextA: OpenFilesStorePaneState = {
      items: patch.panes.A?.items ?? base.panes?.A?.items ?? base.items,
      selected:
        patch.panes.A?.selected !== undefined
          ? patch.panes.A.selected
          : base.panes?.A?.selected ?? base.selected ?? null,
      markdownByFileId:
        patch.panes.A?.markdownByFileId !== undefined
          ? patch.panes.A.markdownByFileId
          : base.panes?.A?.markdownByFileId,
      brickTabByFileId:
        patch.panes.A?.brickTabByFileId !== undefined
          ? patch.panes.A.brickTabByFileId
          : base.panes?.A?.brickTabByFileId,
    };
    return { A: nextA, B: nextB };
  })();
  return {
    items: patch.items ?? base.items,
    selected:
      patch.selected !== undefined ? patch.selected : base.selected ?? null,
    panes: mergedPanes,
    isSplit: patch.isSplit !== undefined ? patch.isSplit : base.isSplit,
    splitProportionLeft:
      patch.splitProportionLeft !== undefined
        ? patch.splitProportionLeft
        : base.splitProportionLeft,
  };
}

export const SKETCH_SECRETS_FILE_ID = 'sketch.secrets';

export const useFiles: UseFiles = function ({
  mainFile,
  bricks,
  files,
  defaultFilePath,
  filesAreLoading = true,
  filesContentLoaded = false,
  isLibraryRoute = false,
  showSketchSecretsFile = false,
  storeEntityId = undefined,
  getUnsavedFilesSubject,
  autoOpenedFiles,
  isClassicSketch = true,
}): ReturnType<UseFiles> {
  const [selectedFileId, setSelectedFileId] = useState<string | undefined>(
    undefined,
  );
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [enableOpenFilesPersistence] = useState(true);
  const [previewFileId, _setPreviewFileId] = useState<string>();
  const previewFileIdRef = useRef<string>();

  const setPreviewFileId = useCallback((id: string | undefined) => {
    _setPreviewFileId(id);
    previewFileIdRef.current = id;
  }, []);

  const queryClient = useQueryClient();
  const { data: openFilesStore } = useQuery(
    ['get-stored-open-files', storeEntityId],
    async () => {
      if (!storeEntityId) {
        return null;
      }
      const store = await IDB.get<OpenFilesStore>(OPEN_FILES_KEY);
      return store?.[storeEntityId] || null;
    },
    {
      enabled: enableOpenFilesPersistence,
    },
  );

  const unsavedFileIds = useObservable(getUnsavedFilesSubject());

  useEvent('beforeunload', (e: Event) => {
    if ((unsavedFileIds ?? new Set()).size !== 0) {
      e.preventDefault();
    }
  });

  useEffect(() => {
    if (previewFileId && unsavedFileIds?.has(previewFileId)) {
      setPreviewFileId(undefined);
    }
  }, [unsavedFileIds, previewFileId, setPreviewFileId]);

  const renderFileIcon = useCallback(
    (fullName: string, extension: string): ReactNode => {
      if (isClassicSketch) {
        const LegacyIcon = getFileIcon(extension);
        return LegacyIcon ? createElement(LegacyIcon) : undefined;
      }
      return <FileIcon fileName={fullName} />;
    },
    [isClassicSketch],
  );

  const selectableMainFile: SelectableFileData | undefined = useMemo(() => {
    if (!mainFile) return undefined;
    return {
      fileId: mainFile.path,
      fileFullName: mainFile.fullName,
      fileName: mainFile.name,
      fileExtension: mainFile.extension,
      Icon: renderFileIcon(mainFile.fullName, mainFile.extension),
      tags: ['Main'],
      isFixed: isClassicSketch,
      isMetadataReadOnly: isClassicSketch,
    };
  }, [isClassicSketch, mainFile, renderFileIcon]);

  const mainLibraryFile = useMemo(() => {
    if (isLibraryRoute && !filesAreLoading && files) {
      const mainLibFile = getMainLibraryFile(files);
      if (mainLibFile) {
        return {
          fileId: mainLibFile.path,
          fileFullName: mainLibFile.fullName,
          fileName: mainLibFile.name,
          fileExtension: mainLibFile.extension,
          Icon: renderFileIcon(mainLibFile.fullName, mainLibFile.extension),
          tags: ['Main'],
          isFixed: isClassicSketch,
          isMetadataReadOnly: isClassicSketch,
        };
      }
    }
  }, [isLibraryRoute, filesAreLoading, files, isClassicSketch, renderFileIcon]);

  const bricksFiles = useMemo(
    () =>
      (bricks ?? []).map((brick) => ({
        fileId: brick.id,
        fileName: brick.name,
        fileFullName: brick.name,
        fileExtension: 'brick',
        Icon: <BrickIcon category={brick.category} size="xsmall" />,
        isMetadataReadOnly: true,
      })),
    [bricks],
  );

  const sketchSecretsFile = useMemo(() => {
    // NOTE: this is not real sketch file but it's used to manage the secrets file in the UI
    // Set it after `filesContentLoaded` to prevent instant load of the file for better UX
    if (
      filesContentLoaded &&
      (showSketchSecretsFile ||
        openFileIds.includes(SKETCH_SECRETS_FILE_ID) ||
        openFilesStore?.items?.includes(SKETCH_SECRETS_FILE_ID))
    ) {
      return {
        fileId: SKETCH_SECRETS_FILE_ID,
        fileName: 'Sketch Secrets',
        fileFullName: 'Sketch Secrets',
        fileExtension: 'secrets',
        Icon: renderFileIcon('Sketch Secrets', 'secrets'),
        tags: [],
        isMetadataReadOnly: true,
      };
    }
  }, [
    filesContentLoaded,
    openFileIds,
    openFilesStore?.items,
    renderFileIcon,
    showSketchSecretsFile,
  ]);

  const otherFiles = useMemo(() => {
    if (files === undefined) {
      return [];
    }
    return files
      .map((file) => ({
        fileId: file.path,
        fileFullName: file.fullName,
        fileName: file.name,
        fileExtension: file.extension,
        Icon: renderFileIcon(file.fullName, file.extension),
        isFixed: false,
        isMetadataReadOnly: false,
      }))
      .filter((f) =>
        isLibraryRoute ? f.fileId !== mainLibraryFile?.fileId : true,
      );
  }, [files, isLibraryRoute, mainLibraryFile?.fileId, renderFileIcon]);

  const editorFiles = useMemo(
    () =>
      [
        isLibraryRoute ? mainLibraryFile : selectableMainFile,
        ...sortBy(otherFiles, (f) => f.fileName.toLowerCase()),
        sketchSecretsFile,
        ...bricksFiles,
      ].filter((f): f is SelectableFileData => Boolean(f)),
    [
      bricksFiles,
      isLibraryRoute,
      selectableMainFile,
      mainLibraryFile,
      otherFiles,
      sketchSecretsFile,
    ],
  );

  // Generate ids and names indexed maps for editor files and open files
  // This can improve lookups, especially for large file lists
  const { editorFileIdsMap, editorFileNamesMap } = useMemo(() => {
    return editorFiles.reduce<{
      editorFileIdsMap: Record<string, SelectableFileData>;
      editorFileNamesMap: Record<string, SelectableFileData>;
    }>(
      (acc, data) => {
        return {
          editorFileIdsMap: { ...acc.editorFileIdsMap, [data.fileId]: data },
          editorFileNamesMap: {
            ...acc.editorFileNamesMap,
            [data.fileFullName]: data,
          },
        };
      },
      { editorFileIdsMap: {}, editorFileNamesMap: {} },
    );
  }, [editorFiles]);

  const { openFiles, selectedFile } = useMemo(
    () =>
      openFileIds.reduce<{
        openFiles: SelectableFileData[];
        selectedFile?: SelectableFileData | undefined;
      }>(
        (acc, id) => {
          const openFile = editorFileIdsMap[id];
          if (!openFile) {
            return acc;
          }
          return {
            openFiles: [...acc.openFiles, openFile],
            selectedFile: selectedFileId === id ? openFile : acc.selectedFile,
          };
        },
        { openFiles: [], selectedFile: undefined },
      ),
    [editorFileIdsMap, openFileIds, selectedFileId],
  );

  const openFilesInitComplete = useRef(false);

  useEffect(() => {
    const storedOpenFileNamesIsLoading = openFilesStore === undefined;
    if (storedOpenFileNamesIsLoading || openFilesInitComplete.current) {
      return;
    }

    if (filesContentLoaded) {
      // When first load is complete, lock the open files state
      // NOTE: `filesContentLoaded` is set atomically with `files` final value,
      // so we need to lock the open files state after the `firstLoadCompete` truthy value
      openFilesInitComplete.current = true;
    }

    const initOpenFiles = (): void => {
      let currOpenFilesIds: string[] = [];

      if (openFilesStore && openFilesStore.items.length > 0) {
        currOpenFilesIds = openFilesStore.items.reduce((acc, fileId) => {
          const file = editorFileIdsMap[fileId];
          return file ? [...acc, file.fileId] : acc;
        }, [] as string[]);
      } else {
        if (isClassicSketch) {
          // Open all files in classic sketch
          currOpenFilesIds = editorFiles.map((f) => f.fileId);
        } else {
          // If no stored open files, open default ones
          currOpenFilesIds = [defaultFilePath || 'app.yaml'];
        }
      }

      if (isClassicSketch) {
        // Always ensure main file is included in open files only in classic sketch
        // If the sketch is renamed outside of current session, the stored ino file name can be outdated
        const mainFileId =
          selectableMainFile?.fileId || mainLibraryFile?.fileId;
        if (
          isClassicSketch &&
          mainFileId &&
          editorFileIdsMap[mainFileId] &&
          !currOpenFilesIds.includes(mainFileId)
        ) {
          currOpenFilesIds = [mainFileId, ...currOpenFilesIds];
        }
      }

      setOpenFileIds(currOpenFilesIds);

      if (!isClassicSketch) {
        const lastSelectedFileId = openFilesStore?.selected;
        let currSelectedFileId: string | null = null;
        if (
          lastSelectedFileId &&
          currOpenFilesIds.includes(lastSelectedFileId)
        ) {
          currSelectedFileId = lastSelectedFileId;
        }

        if (openFilesInitComplete.current && !currSelectedFileId) {
          currSelectedFileId = currOpenFilesIds[0];
        }

        setSelectedFileId(currSelectedFileId ?? undefined);
      }

      const mainFileId = selectableMainFile?.fileId || mainLibraryFile?.fileId;
      if (
        isClassicSketch &&
        !selectedFileId &&
        mainFileId &&
        mainFileId !== selectedFileId &&
        currOpenFilesIds.includes(mainFileId)
      ) {
        setSelectedFileId(mainFileId);
      }
    };

    initOpenFiles();
  }, [
    bricks,
    editorFileIdsMap,
    editorFileNamesMap,
    editorFiles,
    filesContentLoaded,
    selectableMainFile,
    mainLibraryFile?.fileId,
    selectedFileId,
    sketchSecretsFile,
    isClassicSketch,
    autoOpenedFiles,
    openFilesStore,
    defaultFilePath,
  ]);

  useEffect(() => {
    // Clear selected file if new sketch/lib is loading
    if (openFilesInitComplete.current && !filesContentLoaded) {
      openFilesInitComplete.current = false;
      setSelectedFileId(undefined);
      setOpenFileIds([]);
    }
  }, [filesContentLoaded]);

  const storeOpenFiles = useCallback(
    async (fileIds: string[], selectedFileId: string | undefined) => {
      if (!storeEntityId || !enableOpenFilesPersistence) {
        return;
      }

      const uniqueFileIds = Array.from(new Set(fileIds));
      await IDB.update(OPEN_FILES_KEY, (prevValue?: OpenFilesStore) => {
        const prevStoreItem = prevValue?.[storeEntityId];
        const nextSelected = selectedFileId ?? prevStoreItem?.selected ?? null;
        return {
          ...prevValue,
          [storeEntityId]: mergeStoreItem(prevStoreItem, {
            items: uniqueFileIds,
            selected: nextSelected,
            panes: {
              A: { items: uniqueFileIds, selected: nextSelected },
            },
          }),
        };
      });
      queryClient.invalidateQueries(['get-stored-open-files', storeEntityId]);
    },
    [storeEntityId, enableOpenFilesPersistence, queryClient],
  );

  /**
   * Patch the split-related fields (pane B state, both panes' markdown maps,
   * isSplit, split width) on the per-app store record. Shallow-merges via
   * `mergeStoreItem` so it never clobbers pane A's `{items, selected}`
   * written by `storeOpenFiles`.
   */
  const storeSplitState = useCallback(
    async (patch: OpenFilesStorePatch) => {
      if (!storeEntityId || !enableOpenFilesPersistence) {
        return;
      }
      await IDB.update(OPEN_FILES_KEY, (prevValue?: OpenFilesStore) => {
        const prevStoreItem = prevValue?.[storeEntityId];
        return {
          ...prevValue,
          [storeEntityId]: mergeStoreItem(prevStoreItem, patch),
        };
      });
      queryClient.invalidateQueries(['get-stored-open-files', storeEntityId]);
    },
    [storeEntityId, enableOpenFilesPersistence, queryClient],
  );

  useEffect(() => {
    if (!openFilesInitComplete.current) {
      return;
    }
    // Store open files when openFileIds or files changes
    storeOpenFiles(openFileIds, selectedFileId);
  }, [openFilesInitComplete, openFileIds, selectedFileId, storeOpenFiles]);

  const selectFile = useCallback(
    (params: {
      fileId?: string;
      openAtIndex?: number;
      isPreview?: boolean;
    }) => {
      const { fileId, openAtIndex, isPreview = false } = params;

      if (!filesContentLoaded) {
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

        let newOpenFiles = prevOpenFiles;
        let targetIndex =
          typeof openAtIndex === 'number' && openAtIndex >= 0
            ? openAtIndex
            : -1;

        if (oldPreviewId && prevOpenFiles.includes(oldPreviewId)) {
          const indexOfOldPreview = prevOpenFiles.indexOf(oldPreviewId);

          if (oldPreviewId === oldSelectedId) {
            targetIndex = indexOfOldPreview;
          } else if (targetIndex > indexOfOldPreview) {
            targetIndex -= 1;
          }

          newOpenFiles = prevOpenFiles.filter((id) => id !== oldPreviewId);
        }

        if (
          targetIndex === -1 &&
          oldSelectedId &&
          newOpenFiles.includes(oldSelectedId)
        ) {
          targetIndex = newOpenFiles.indexOf(oldSelectedId) + 1;
        }

        if (isPreview) {
          setPreviewFileId(fileId);
        } else {
          setPreviewFileId(undefined);
        }

        if (targetIndex !== -1 && targetIndex <= newOpenFiles.length) {
          return [
            ...newOpenFiles.slice(0, targetIndex),
            fileId,
            ...newOpenFiles.slice(targetIndex),
          ];
        } else {
          return [...newOpenFiles, fileId];
        }
      });
    },
    [filesContentLoaded, setPreviewFileId, selectedFileId],
  );

  const closeFile = useCallback(
    (fileId: string) => {
      if (!filesContentLoaded) {
        return;
      }

      setOpenFileIds((prevOpenFileIds) => {
        if (
          !prevOpenFileIds.includes(fileId) ||
          fileId ===
            ((isClassicSketch && selectableMainFile?.fileId) ||
              mainLibraryFile?.fileId)
        ) {
          return prevOpenFileIds;
        }

        setSelectedFileId((prevSelectedFileId) => {
          if (fileId === prevSelectedFileId) {
            // Always select tab to the left if not closing the leftmost tab
            // NOTE: main .ino file cannot be closed so there is always a tab remaining
            const closedFileIndex = prevOpenFileIds.indexOf(fileId);
            return closedFileIndex === 0
              ? prevOpenFileIds[1]
              : prevOpenFileIds[closedFileIndex - 1];
          }
          return prevSelectedFileId;
        });
        const currOpenFileIds = prevOpenFileIds.filter((id) => id !== fileId);
        return currOpenFileIds;
      });
    },
    [
      filesContentLoaded,
      isClassicSketch,
      selectableMainFile?.fileId,
      mainLibraryFile?.fileId,
    ],
  );

  const updateOpenFile = useCallback(
    (currFileId: string, nextFileId: string) => {
      setSelectedFileId((prevSelectedFileId) => {
        if (currFileId === prevSelectedFileId) {
          return nextFileId;
        }
        return prevSelectedFileId;
      });
      setOpenFileIds((prevOpenFileIds) => {
        let currOpenFileIds = prevOpenFileIds;
        currOpenFileIds = prevOpenFileIds.map((id) =>
          currFileId === id ? nextFileId : id,
        );
        return currOpenFileIds;
      });
    },
    [],
  );

  const updateOpenFilesOrder = useCallback(
    (fileIds: string[], draggedFileId?: string) => {
      setOpenFileIds((prevOpenFileIds) => {
        if (
          fileIds.length !== prevOpenFileIds.length ||
          !fileIds.every(
            (id) => prevOpenFileIds.includes(id) && editorFileIdsMap[id],
          )
        ) {
          return prevOpenFileIds;
        }
        return fileIds;
      });

      if (draggedFileId && draggedFileId === previewFileIdRef.current) {
        setPreviewFileId(undefined);
      }
    },
    [editorFileIdsMap, setPreviewFileId],
  );
  const onSketchRename = useCallback(
    async (_newName: string) => {
      if (!storeEntityId || !selectableMainFile || !openFilesStore) {
        return;
      }

      // CHECK ME: this might restore open files when renaming classic sketch
      await IDB.update(OPEN_FILES_KEY, (prevValue?: OpenFilesStore) => {
        const storeItem = prevValue?.[storeEntityId] || {
          items: [selectableMainFile.fileId],
          selected: selectableMainFile.fileId,
        };
        return { ...prevValue, [storeEntityId]: storeItem };
      });
      queryClient.invalidateQueries(['get-stored-open-files', storeEntityId]);
    },
    [storeEntityId, selectableMainFile, openFilesStore, queryClient],
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

  return {
    mainFile: selectableMainFile,
    editorFiles,
    openFiles,
    unsavedFileIds,
    selectedFile,
    openFilesStore,
    previewFileId,
    selectFile,
    closeFile,
    updateOpenFile,
    updateOpenFilesOrder,
    onSketchRename,
    onAppRename,
    storeSplitState,
  };
};
