import {
  addAppBrick as addAppBrickRequest,
  deleteAppBrick,
  getAppBrickInstance,
  getBricks,
  getUnsavedFilesSubject,
  openFileExternal,
  openLinkExternal,
  updateAppBrick as updateAppBrickRequest,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  BrickCreateUpdateRequest,
  BrickInstance,
} from '@cloud-editor-mono/infrastructure';
import {
  FileNode,
  isFileNode,
  TreeNode,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { resetModuleScopedState } from '../../../../lib/app-components/app-lab/utils';
import { useFiles } from '../../../common/hooks/files';
import { useIsBoard } from '../../hooks/board';
import { AppsSection } from '../../routes/__root';
import { EditorLogicParams } from '../editor/editor.type';
import { UseAppDetailLogic } from './appDetail.type';
import {
  APP_YAML_PATH,
  MAIN_PYTHON_PATH,
  MAIN_SKETCH_PATH,
  README_PATH,
  useAppDetailFiles,
} from './appDetailFiles';
import { useSketchLibraries } from './hooks/useSketchLibraries';
import { useAddSketchLibraryDialog } from './hooks/useSketchLibrariesDialogs';

const defaultOpenFoldersState = {};

export const useAppDetailLogic = function (
  appId: string,
  section: AppsSection,
): UseAppDetailLogic {
  useEffect(() => {
    return () => resetModuleScopedState();
  }, []);

  const [initialAppBrickTab, setInitialAppBrickTab] = useState<string>();
  const [selectedNode, setSelectedNode] = useState<FileNode>();
  const [firstSelectedFile, setFirstSelectedFile] = useState<FileNode>();

  const {
    appDetail: app,
    appDetailIsLoading,
    appBricks,
    appBricksAreLoading,
    mainFile,
    filesList,
    filesListIsLoading,
    filesListIsLoaded,
    filesContents,
    filesContentsAreLoading,
    allContentsRetrieved,
    fileTree,
    sketchDataIsLoading,
    addAppFile,
    renameAppFile,
    deleteAppFile,
    createAppFolder,
    refetchAppDetail,
    refetchAppYaml,
    refetchAppBricks,
    removeFileFromPending,
  } = useAppDetailFiles(appId, firstSelectedFile);

  const useFilesPayload = useMemo(() => {
    return {
      bricks: appBricks?.map((brick) => ({
        id: brick.id ?? '',
        name: brick.name ?? '',
      })),
      mainFile,
      files: filesContents,
      filesAreLoading: filesContentsAreLoading,
      filesContentLoaded: allContentsRetrieved,
      autoOpenedFiles: firstSelectedFile ? [firstSelectedFile.path] : [],
      isClassicSketch: false,
      isLibraryRoute: false,
      showSketchSecretsFile: false,
      getUnsavedFilesSubject,
    };
  }, [
    allContentsRetrieved,
    appBricks,
    filesContents,
    filesContentsAreLoading,
    firstSelectedFile,
    mainFile,
  ]);

  const { data: isBoard } = useIsBoard();

  const {
    mainFile: selectableMainFile,
    unsavedFileIds,
    openFiles,
    selectedFile,
    selectFile,
    updateOpenFile,
    updateOpenFilesOrder,
    closeFile,
  } = useFiles(useFilesPayload);

  useEffect(() => {
    if (firstSelectedFile) {
      selectFile(firstSelectedFile.path);
    }
  }, [firstSelectedFile, selectFile]);

  useEffect(() => {
    if (selectedFile?.fileId) {
      removeFileFromPending(selectedFile.fileId);
    }
  }, [removeFileFromPending, selectedFile]);

  const addFileHandler = useCallback(
    async (path: string) => {
      const fullName = path.split('/').pop();
      if (!fullName) {
        console.error('Invalid file name');
        return;
      }
      const [fileName, fileExtension] = fullName.split('.');
      const prevSelectedFileId = selectedFile?.fileId;
      selectFile(path);
      try {
        await addAppFile(path, fileName, fileExtension);
      } catch {
        if (prevSelectedFileId) {
          selectFile(prevSelectedFileId);
        }
      }
    },
    [addAppFile, selectFile, selectedFile?.fileId],
  );

  const renameFileHandler = useCallback(
    async (
      path: string,
      newName: string,
      appendExt?: boolean,
    ): Promise<void> => {
      const folder = path.split('/').slice(0, -1).join('/');
      let newPath = folder ? `${folder}/${newName}` : newName;
      if (appendExt) {
        const file = filesContents?.find(
          (f) => f.id === `${app?.path}/${path}`,
        );
        newPath += file?.extension ? `.${file.extension}` : '';
      }
      try {
        updateOpenFile(path, newPath);
        await renameAppFile(path, newPath);
      } catch {
        updateOpenFile(newPath, path);
      }
    },
    [app?.path, filesContents, renameAppFile, updateOpenFile],
  );

  const deleteFileHandler = useCallback(
    async (path: string) => {
      const fileIndex = openFiles.findIndex((f) => f.fileId === path);
      try {
        closeFile(path);
        await deleteAppFile(path);
      } catch {
        selectFile(path, fileIndex);
      }
    },
    [closeFile, deleteAppFile, openFiles, selectFile],
  );

  const updateAppBrick = useCallback(
    async (
      brickId: string,
      params: BrickCreateUpdateRequest,
    ): Promise<boolean> => {
      const response = await updateAppBrickRequest(appId, brickId, params);
      if (response) {
        await refetchAppYaml();
        await refetchAppBricks();
      }
      return response;
    },
    [appId, refetchAppBricks, refetchAppYaml],
  );

  const updateAppBricks = useCallback(
    async (
      bricks: Record<string, BrickCreateUpdateRequest>,
    ): Promise<boolean> => {
      const responses = await Promise.all(
        Object.entries(bricks).map(([brickId, params]) =>
          updateAppBrickRequest(appId, brickId, params),
        ),
      );
      const response = responses.every((res) => res);
      if (response) {
        await refetchAppYaml();
        await refetchAppBricks();
      }
      return response;
    },
    [appId, refetchAppBricks, refetchAppYaml],
  );

  const selectFileFromEditor = useCallback(
    (fileId?: string): void => {
      if (fileId) {
        removeFileFromPending(fileId);
      }
      selectFile(fileId);
    },
    [removeFileFromPending, selectFile],
  );

  const renameFileFromEditor = useCallback(
    (path: string, newName: string) => renameFileHandler(path, newName, true),
    [renameFileHandler],
  );

  const editorLogicParams: EditorLogicParams = useMemo(() => {
    return {
      appPath: app?.path,
      appBricks,
      selectedFile,
      selectFile: selectFileFromEditor,
      selectableMainFile,
      unsavedFileIds,
      closeFile,
      updateOpenFilesOrder,
      deleteAppFile: deleteFileHandler,
      renameAppFile: renameFileFromEditor,
      addAppFile: addFileHandler,
      updateAppBrick,
      initialAppBrickTab,
      sketchDataIsLoading,
      openFiles,
      readOnly: section === 'examples',
    };
  }, [
    addFileHandler,
    app?.path,
    appBricks,
    closeFile,
    deleteFileHandler,
    openFiles,
    renameFileFromEditor,
    section,
    selectFileFromEditor,
    selectableMainFile,
    selectedFile,
    initialAppBrickTab,
    sketchDataIsLoading,
    unsavedFileIds,
    updateAppBrick,
    updateOpenFilesOrder,
  ]);

  useEffect(() => {
    if (selectedFile?.fileId !== selectedNode?.path) {
      const foundFile = filesList?.find(
        (file) => file.path === selectedFile?.fileId,
      );

      if (
        foundFile &&
        isFileNode(foundFile) &&
        selectedFile?.fileExtension !== 'brick'
      ) {
        setSelectedNode(foundFile);
      }
    }
  }, [selectedFile, filesList, app?.path, selectedNode?.path]);

  useEffect(() => {
    if (
      !firstSelectedFile &&
      !selectedFile &&
      !selectedNode &&
      filesListIsLoaded &&
      filesList
    ) {
      const priorityFiles = [
        README_PATH,
        MAIN_PYTHON_PATH,
        MAIN_SKETCH_PATH,
        APP_YAML_PATH,
      ];
      let nodeToSelect = filesList[0];

      for (const fileName of priorityFiles) {
        const foundNode = filesList.find((file) => file.path === fileName);
        if (foundNode) {
          nodeToSelect = foundNode;
          break;
        }
      }

      setFirstSelectedFile(nodeToSelect);
      setSelectedNode(nodeToSelect);
    }
  }, [
    filesList,
    filesListIsLoaded,
    firstSelectedFile,
    selectedFile,
    selectedNode,
  ]);

  const openExternal = useCallback(() => {
    if (!selectedNode) {
      console.warn('No file selected to open externally');
      return;
    }
    openFileExternal(selectedNode.path);
  }, [selectedNode]);

  const openFilesFolder = (): void => {
    throw new Error('openFilesFolder not implemented');
  };

  const openExternalLink = useCallback((url: string) => {
    if (!url) {
      console.warn('No URL provided to open externally');
      return;
    }
    openLinkExternal(url);
  }, []);

  const { data: bricks, isLoading: bricksAreLoading } = useQuery(
    ['list-bricks'],
    () => getBricks(),
    {
      refetchOnWindowFocus: false,
    },
  );

  const addAppBrick = useCallback(
    async (brickId: string): Promise<boolean> => {
      const response = await addAppBrickRequest(appId, brickId, {});
      if (response) {
        await refetchAppYaml();
        await refetchAppBricks();
        setInitialAppBrickTab('examples');
        selectFile(brickId);
      }
      return response;
    },
    [appId, refetchAppYaml, refetchAppBricks, selectFile],
  );

  const loadAppBrick = useCallback(
    (brickId: string): Promise<BrickInstance> =>
      getAppBrickInstance(appId, brickId),
    [appId],
  );

  const removeAppBrick = useCallback(
    async (brickId: string): Promise<boolean> => {
      const response = await deleteAppBrick(appId, brickId);
      if (response) {
        await refetchAppYaml();
        await refetchAppBricks();
        closeFile(brickId);
      }
      return response;
    },
    [appId, closeFile, refetchAppBricks, refetchAppYaml],
  );

  const setSelectedFile = useCallback(
    (node: string | TreeNode | undefined) => {
      if (!node) return;
      setInitialAppBrickTab(undefined);
      const path = typeof node === 'string' ? node : node.path;
      selectFile(path);
      removeFileFromPending(path);
    },
    [removeFileFromPending, selectFile],
  );

  const {
    libraries,
    librarySearchIsLoading,
    searchSketchLibraries,
    appLibraries,
    appLibrariesById,
    installingLibraryId,
    addSketchLibrary,
    deletingLibraryId,
    deleteSketchLibrary,
    addSketchLibraryError,
  } = useSketchLibraries({ appId });

  const {
    openDialog: openAddSketchLibraryDialog,
    dialogLogic: addSketchLibraryDialogLogic,
  } = useAddSketchLibraryDialog({
    libraries,
    librarySearchIsLoading,
    searchSketchLibraries,
    appLibrariesById,
    installingLibraryId,
    addSketchLibrary,
    deletingLibraryId,
    deleteSketchLibrary,
    openExternalLink,
    isBoard,
    addSketchLibraryError,
  });

  return {
    appId,
    app,
    appBricks,
    bricks,
    appLibraries,
    fileTree,
    appIsLoading: appDetailIsLoading,
    appBricksAreLoading,
    bricksAreLoading,
    filesAreLoading: filesListIsLoading,
    selectedFile,
    selectedNode,
    defaultOpenFoldersState,
    editorLogicParams,
    reloadApp: refetchAppDetail,
    setSelectedFile,
    openFilesFolder,
    openExternal,
    openExternalLink,
    addAppBrick,
    loadAppBrick,
    removeAppBrick,
    updateAppBrick,
    updateAppBricks,
    addFileHandler,
    renameFileHandler,
    deleteFileHandler,
    addSketchLibraryDialogLogic,
    openAddSketchLibraryDialog,
    deleteSketchLibrary,
    addFolderHandler: createAppFolder,
  };
};
