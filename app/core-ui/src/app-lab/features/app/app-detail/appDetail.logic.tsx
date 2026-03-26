import {
  addAppBrick as addAppBrickRequest,
  deleteAppBrick,
  getAppFiles,
  getBricks,
  getUnsavedFilesSubject,
  openFileExternal,
  openLinkExternal,
  updateAppBrick as updateAppBrickRequest,
  updateAppDetail,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AppDetailedInfo,
  BrickCreateUpdateRequest,
  UpdateAppDetailRequest,
} from '@cloud-editor-mono/infrastructure';
import {
  FileNode,
  isFileNode,
  TreeNode,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { resetModuleScopedState } from '../../../../../lib/app-components/app-lab/utils';
import { useFiles } from '../../../../common/hooks/files';
import { queryClient } from '../../../../common/providers/data-fetching/QueryProvider';
import { useIsBoard } from '../../../hooks/useIsBoard';
import { DETAIL_PATH_BY_SECTION } from '../../../routes/__root';
import { EditorLogicParams } from '../../editor/editor.type';
import { sendAppLabNotification } from '../../notifications';
import { AppsSection } from '../app.type';
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
import { appDetailMessages as messages } from './messages';

const defaultOpenFoldersState = {};

export const useAppDetailLogic = function (
  appId: string,
  section: AppsSection,
): UseAppDetailLogic {
  const navigate = useNavigate({
    from: DETAIL_PATH_BY_SECTION[section || 'examples'],
  });

  const openApp = useCallback(
    (app: AppDetailedInfo) => {
      navigate({
        to: `/${app.example ? 'examples' : 'my-apps'}/${app.id}`,
      });
    },
    [navigate],
  );

  useEffect(() => {
    return () => resetModuleScopedState();
  }, []);

  const { formatMessage } = useI18n();

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
    refetchSketchYaml,
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

      // Check if file already exists
      try {
        const { filesList } = await getAppFiles(app?.path || '');
        const filePath = path.replace(app?.path + '/', '');
        const fileExists = filesList.some((file) => file.path === filePath);

        if (fileExists) {
          sendAppLabNotification({
            message: formatMessage(messages.fileAlreadyExists),
            variant: 'error',
          });
          return;
        }
      } catch (error) {
        console.error('Failed to check file existence:', error);
      }

      selectFile(path);
      try {
        await addAppFile(path, fileName, fileExtension);
        sendAppLabNotification({
          message: formatMessage(messages.successfullyCreatedFile),
          variant: 'success',
        });
      } catch {
        if (prevSelectedFileId) {
          selectFile(prevSelectedFileId);
        }
        sendAppLabNotification({
          message: formatMessage(messages.failedCreateFile),
          variant: 'error',
        });
      }
    },
    [addAppFile, app?.path, formatMessage, selectFile, selectedFile?.fileId],
  );

  const addFolderHandler = useCallback(
    async (path: string) => {
      const folderName = path.split('/').pop();
      if (!folderName) {
        console.error('Invalid folder name');
        return;
      }

      // Check if folder already exists by checking file tree
      try {
        const { fileTree } = await getAppFiles(app?.path || '');
        const checkFolderExists = (
          nodes: TreeNode[],
          targetPath: string,
        ): boolean => {
          for (const node of nodes) {
            if (node.type === 'folder' && node.path === targetPath) {
              return true;
            }
            if (node.type === 'folder' && node.children) {
              if (checkFolderExists(node.children, targetPath)) {
                return true;
              }
            }
          }
          return false;
        };

        if (checkFolderExists(fileTree, path)) {
          sendAppLabNotification({
            message: formatMessage(messages.folderAlreadyExists),
            variant: 'error',
          });
          return;
        }
      } catch (error) {
        console.error('Failed to check folder existence:', error);
      }

      try {
        await createAppFolder(path);
        sendAppLabNotification({
          message: formatMessage(messages.successfullyCreatedFolder),
          variant: 'success',
        });
      } catch {
        sendAppLabNotification({
          message: formatMessage(messages.failedCreateFolder),
          variant: 'error',
        });
      }
    },
    [app?.path, createAppFolder, formatMessage],
  );

  const renameFileHandler = useCallback(
    async (
      path: string,
      newName: string,
      appendExt?: boolean,
      nodeType?: 'file' | 'folder',
    ): Promise<void> => {
      const folder = path.split('/').slice(0, -1).join('/');
      let newPath = folder ? `${folder}/${newName}` : newName;
      if (appendExt) {
        const file = filesContents?.find(
          (f) => f.id === `${app?.path}/${path}`,
        );
        newPath += file?.extension ? `.${file.extension}` : '';
      }

      // Check if target name already exists
      try {
        const { filesList, fileTree } = await getAppFiles(app?.path || '');
        const targetPath = newPath.replace(app?.path + '/', '');

        // Check files
        const fileExists = filesList.some((file) => file.path === targetPath);

        // Check folders by traversing the tree
        const checkFolderExists = (
          nodes: TreeNode[],
          targetPath: string,
        ): boolean => {
          for (const node of nodes) {
            if (node.type === 'folder' && node.path === targetPath) {
              return true;
            }
            if (node.type === 'folder' && node.children) {
              if (checkFolderExists(node.children, targetPath)) {
                return true;
              }
            }
          }
          return false;
        };

        const folderExists = checkFolderExists(fileTree, targetPath);

        if (fileExists || folderExists) {
          sendAppLabNotification({
            message: formatMessage(
              fileExists
                ? messages.fileAlreadyExistsRename
                : messages.folderAlreadyExistsRename,
            ),
            variant: 'error',
          });
          return;
        }
      } catch (error) {
        console.error('Failed to check rename conflict:', error);
      }

      try {
        updateOpenFile(path, newPath);
        await renameAppFile(path, newPath, nodeType);
        sendAppLabNotification({
          message: formatMessage(messages.successfullyRenamedFile),
          variant: 'success',
        });
      } catch (error) {
        updateOpenFile(newPath, path);
        sendAppLabNotification({
          message: formatMessage(messages.failedRenameFile),
          variant: 'error',
        });
      }
    },
    [app?.path, filesContents, renameAppFile, updateOpenFile, formatMessage],
  );

  const deleteFileHandler = useCallback(
    async (path: string) => {
      const fileIndex = openFiles.findIndex((f) => f.fileId === path);
      try {
        closeFile(path);
        await deleteAppFile(path);
        sendAppLabNotification({
          message: formatMessage(messages.successfullyDeletedFile),
          variant: 'success',
        });
      } catch {
        selectFile(path, fileIndex);
        sendAppLabNotification({
          message: formatMessage(messages.failedDeleteFile),
          variant: 'error',
        });
      }
    },
    [closeFile, deleteAppFile, formatMessage, openFiles, selectFile],
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
    (path: string, newName: string, nodeType?: 'file' | 'folder') =>
      renameFileHandler(path, newName, true, nodeType),
    [renameFileHandler],
  );

  const editorLogicParams: EditorLogicParams = useMemo(() => {
    return {
      appId: app?.id,
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
    app?.id,
    app?.path,
    appBricks,
    selectedFile,
    selectFileFromEditor,
    selectableMainFile,
    unsavedFileIds,
    closeFile,
    updateOpenFilesOrder,
    deleteFileHandler,
    renameFileFromEditor,
    addFileHandler,
    updateAppBrick,
    initialAppBrickTab,
    sketchDataIsLoading,
    openFiles,
    section,
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

  const { mutateAsync: updateApp } = useMutation({
    mutationFn: async (request: UpdateAppDetailRequest): Promise<boolean> => {
      if (!app) return false;
      const result = await updateAppDetail(app.id, request);
      if (result === app.id) {
        refetchAppDetail();

        if (Object.hasOwn(request, 'default')) {
          queryClient.invalidateQueries({
            queryKey: ['get-default-app'],
            exact: true,
          });
        }
      } else if (result !== undefined) {
        navigate({
          to: `/${section}/${result}`,
        });
      }
      return result !== undefined;
    },
  });

  const { data: bricks, isLoading: bricksAreLoading } = useQuery(
    ['list-bricks'],
    () => getBricks(),
  );

  const addAppBrick = useCallback(
    async (
      brickId: string,
      params: BrickCreateUpdateRequest = {},
    ): Promise<boolean> => {
      const response = await addAppBrickRequest(appId, brickId, params);
      if (response) {
        await refetchAppYaml();
        await refetchAppBricks();
        setInitialAppBrickTab('examples');
        selectFile(brickId);
        sendAppLabNotification({
          message: formatMessage(messages.successfullyAddedBrick),
          variant: 'success',
        });
      } else {
        sendAppLabNotification({
          message: formatMessage(messages.failedAddBrick),
          variant: 'error',
        });
      }
      return response;
    },
    [appId, refetchAppYaml, refetchAppBricks, selectFile, formatMessage],
  );

  const removeAppBrick = useCallback(
    async (brickId: string): Promise<boolean> => {
      const response = await deleteAppBrick(appId, brickId);
      if (response) {
        await refetchAppYaml();
        await refetchAppBricks();
        closeFile(brickId);
        sendAppLabNotification({
          message: formatMessage(messages.successfullyDeletedBrick),
          variant: 'success',
        });
      } else {
        sendAppLabNotification({
          message: formatMessage(messages.failedDeleteBrick),
          variant: 'error',
        });
      }
      return response;
    },
    [appId, closeFile, formatMessage, refetchAppBricks, refetchAppYaml],
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
  } = useSketchLibraries({
    appId,
    refetchSketchYaml,
    onAddSuccess: () =>
      sendAppLabNotification({
        message: formatMessage(messages.successfullyAddedLibrary),
        variant: 'success',
      }),
    onAddError: () =>
      sendAppLabNotification({
        message: formatMessage(messages.failedAddLibrary),
        variant: 'error',
      }),
    onDeleteSuccess: () =>
      sendAppLabNotification({
        message: formatMessage(messages.successfullyDeletedLibrary),
        variant: 'success',
      }),
    onDeleteError: () =>
      sendAppLabNotification({
        message: formatMessage(messages.failedDeleteLibrary),
        variant: 'error',
      }),
  });

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
    openApp,
    reloadApp: refetchAppDetail,
    updateApp,
    setSelectedFile,
    openFilesFolder,
    openExternal,
    openExternalLink,
    addAppBrick,
    removeAppBrick,
    updateAppBrick,
    updateAppBricks,
    addFileHandler,
    renameFileHandler,
    deleteFileHandler,
    addSketchLibraryDialogLogic,
    openAddSketchLibraryDialog,
    deleteSketchLibrary,
    addFolderHandler: addFolderHandler,
  };
};
