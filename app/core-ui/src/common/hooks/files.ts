import { SelectableFileData } from '@cloud-editor-mono/ui-components/lib/components-by-app/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as IDB from 'idb-keyval';
import { sortBy } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEvent } from 'react-use';

import {
  createSelectableFileData,
  getAppLabFileIcon,
  getFileIcon,
  getMainLibraryFile,
} from '../utils';
import { UseFiles } from './files.type';
import { useObservable } from './useObservable';

export const OPEN_FILES_KEY = 'arduino:editor:open-files';
export type OpenFilesStoreItem = { items: string[] };
export type OpenFilesStore = { [key: string]: OpenFilesStoreItem };

export const SKETCH_SECRETS_FILE_ID = 'sketch.secrets';

export const useFiles: UseFiles = function ({
  mainFile,
  bricks,
  files,
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

  const queryClient = useQueryClient();
  const { data: storedOpenFileNames } = useQuery(
    ['get-stored-open-files', storeEntityId],
    async () => {
      if (!storeEntityId) {
        return null;
      }
      const store = await IDB.get<OpenFilesStore>(OPEN_FILES_KEY);
      return store?.[storeEntityId]?.items ?? null;
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

  const selectableMainFile = useMemo(
    () =>
      mainFile &&
      createSelectableFileData({
        fileData: mainFile,
        isFixed: isClassicSketch,
        isMetadataReadOnly: isClassicSketch,
        tags: ['Main'],
        isClassicSketch,
      }),
    [isClassicSketch, mainFile],
  );

  const mainLibraryFile = useMemo(() => {
    if (isLibraryRoute && !filesAreLoading && files) {
      const result = getMainLibraryFile(files);
      if (result) {
        return createSelectableFileData({
          fileData: result,
          isFixed: true,
          isMetadataReadOnly: true,
          tags: ['Main'],
          isClassicSketch,
        });
      }
    }
  }, [isLibraryRoute, filesAreLoading, files, isClassicSketch]);

  const bricksFiles = useMemo(
    () =>
      (bricks ?? []).map((brick) => ({
        fileId: brick.id,
        fileName: brick.name,
        fileFullName: brick.name,
        fileExtension: 'brick',
        Icon: getAppLabFileIcon('brick'),
        tags: [],
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
        storedOpenFileNames?.includes(SKETCH_SECRETS_FILE_ID))
    ) {
      return {
        fileId: SKETCH_SECRETS_FILE_ID,
        fileName: 'Sketch Secrets',
        fileFullName: 'Sketch Secrets',
        fileExtension: 'secrets',
        Icon: getFileIcon('secrets'),
        tags: [],
        isMetadataReadOnly: true,
      };
    }
  }, [
    filesContentLoaded,
    openFileIds,
    showSketchSecretsFile,
    storedOpenFileNames,
  ]);

  const otherFiles = useMemo(
    () =>
      files !== undefined
        ? files
            .map((file) =>
              createSelectableFileData({
                fileData: file,
                isClassicSketch,
              }),
            )
            .filter((f) =>
              isLibraryRoute ? f.fileId !== mainLibraryFile?.fileId : true,
            )
        : [],
    [files, isClassicSketch, isLibraryRoute, mainLibraryFile?.fileId],
  );

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
    const storedOpenFileNamesIsLoading = storedOpenFileNames === undefined;
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
      let currOpenFilesIds: string[];

      if (storedOpenFileNames) {
        currOpenFilesIds = storedOpenFileNames.reduce((acc, fileName) => {
          const file =
            fileName === SKETCH_SECRETS_FILE_ID
              ? sketchSecretsFile
              : editorFileNamesMap[fileName];
          return file ? [...acc, file.fileId] : acc;
        }, [] as string[]);

        // Always ensure main file is included in open files
        // If the sketch is renamed outside of current session, the stored ino file name can be outdated
        const mainFileId =
          selectableMainFile?.fileId || mainLibraryFile?.fileId;
        if (
          mainFileId &&
          editorFileIdsMap[mainFileId] &&
          !currOpenFilesIds.includes(mainFileId)
        ) {
          currOpenFilesIds = [mainFileId, ...currOpenFilesIds];
        }
      } else {
        if (autoOpenedFiles) {
          currOpenFilesIds = editorFiles
            .filter((f) => autoOpenedFiles.includes(f.fileId))
            .map((f) => f.fileId);
        } else {
          currOpenFilesIds = bricks
            ? editorFiles.reduce<string[]>(
                (acc, f) =>
                  f.fileExtension === 'brick' ? acc : [...acc, f.fileId],
                [],
              )
            : editorFiles.map((f) => f.fileId);
        }
      }
      setOpenFileIds(currOpenFilesIds);

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
    storedOpenFileNames,
    isClassicSketch,
    autoOpenedFiles,
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
    async (fileIds: string[]) => {
      if (!storeEntityId || !enableOpenFilesPersistence) {
        return;
      }

      const uniqueFileIds = Array.from(new Set(fileIds));
      const fileNames = uniqueFileIds.reduce((acc, id) => {
        if (id === SKETCH_SECRETS_FILE_ID) {
          // Used fileId instead for fileFullName for secrets tab (sketch.secrets)
          return [...acc, SKETCH_SECRETS_FILE_ID];
        }
        const file = editorFileIdsMap[id];
        return file ? [...acc, file.fileFullName] : acc;
      }, [] as string[]);

      await IDB.update(OPEN_FILES_KEY, (prevValue?: OpenFilesStore) => {
        return { ...prevValue, [storeEntityId]: { items: fileNames } };
      });
      queryClient.invalidateQueries(['get-stored-open-files', storeEntityId]);
    },
    [storeEntityId, enableOpenFilesPersistence, queryClient, editorFileIdsMap],
  );

  useEffect(() => {
    if (!openFilesInitComplete.current) {
      return;
    }
    // Store open files when openFileIds or files changes
    storeOpenFiles(openFileIds);
  }, [openFilesInitComplete, openFileIds, storeOpenFiles]);

  const selectFile = useCallback(
    (fileId?: string, openAtIndex?: number) => {
      if (!filesContentLoaded) {
        return;
      }

      setSelectedFileId((prevSelectedFileId) => {
        if (prevSelectedFileId === fileId) {
          return prevSelectedFileId;
        }

        if (!fileId) {
          return undefined;
        }

        setOpenFileIds((prevOpenFileIds) => {
          if (fileId && prevOpenFileIds.includes(fileId)) {
            return prevOpenFileIds;
          }
          let currOpenFileIds: string[];
          if (
            typeof openAtIndex === 'number' &&
            Number.isInteger(openAtIndex) &&
            openAtIndex >= 0 &&
            openAtIndex < prevOpenFileIds.length
          ) {
            currOpenFileIds = [
              ...prevOpenFileIds.slice(0, openAtIndex),
              fileId,
              ...prevOpenFileIds.slice(openAtIndex),
            ];
          } else {
            currOpenFileIds = [...prevOpenFileIds, fileId];
          }
          return currOpenFileIds;
        });

        return fileId;
      });
    },
    [filesContentLoaded],
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
            // TODO: consider this is no longer true with AL
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
    (fileIds: string[]) => {
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
    },
    [editorFileIdsMap],
  );

  const onSketchRename = useCallback(
    async (newName: string) => {
      if (
        !storeEntityId ||
        !selectableMainFile ||
        !storedOpenFileNames?.length
      ) {
        return;
      }

      // Update stored main ino file name
      const newInoFileName = `${newName}.ino`;
      await IDB.update(OPEN_FILES_KEY, (prevValue?: OpenFilesStore) => {
        const storeItem = prevValue?.[storeEntityId] || {
          items: [selectableMainFile.fileFullName],
        };
        storeItem.items = storeItem.items.map((fileName) =>
          selectableMainFile.fileFullName === fileName
            ? newInoFileName
            : fileName,
        );
        return { ...prevValue, [storeEntityId]: storeItem };
      });
      queryClient.invalidateQueries(['get-stored-open-files', storeEntityId]);
    },
    [
      selectableMainFile,
      queryClient,
      storeEntityId,
      storedOpenFileNames?.length,
    ],
  );

  return {
    mainFile: selectableMainFile,
    editorFiles,
    openFiles,
    unsavedFileIds,
    selectedFile,
    storedOpenFileNames,
    selectFile,
    closeFile,
    updateOpenFile,
    updateOpenFilesOrder,
    onSketchRename,
  };
};
