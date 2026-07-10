import {
  addAppBrick as addAppBrickRequest,
  addAppCustomBrick as addAppCustomBrickRequest,
  deleteAppBrick,
  getAppFiles,
  getBricks,
  getUnsavedFilesSubject,
  openFileExternal,
  openLinkExternal,
  renameAppCustomBrick as renameAppCustomBrickRequest,
  selectResourcePathToImport,
  updateAppBrick as updateAppBrickRequest,
  updateAppDetail,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { importResourceToAppFromPath } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { FileIcon } from '@cloud-editor-mono/images/assets/file-icons';
import {
  AppDetailedInfo,
  BrickCreateUpdateRequest,
  UpdateAppDetailRequest,
} from '@cloud-editor-mono/infrastructure';
import { BOARD_STORAGE_FULL_ERROR } from '@cloud-editor-mono/infrastructure';
import {
  AiModelRequiredDialogLogic,
  AppLabAppDetailLogic,
  AppLabEditorPanelLogic,
  AppLabEditSectionLogic,
  AppsSection,
  checkForDuplicates,
  isFileNode,
  isFolderNode,
  TreeNode,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import {
  DuplicateFileDialogLogic,
  OnDuplicateConflictParams,
} from '@cloud-editor-mono/ui-components/lib/dialogs/app-lab/duplicate-file-dialog/types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WretchError } from 'wretch/resolver';

import { resetModuleScopedState } from '../../../../../lib/app-components/app-lab/utils';
import { useFiles } from '../../../../common/hooks/files';
import { useKeywords } from '../../../../common/hooks/keywords';
import { queryClient } from '../../../../common/providers/data-fetching/QueryProvider';
import { useBoards } from '../../../hooks/useBoards';
import {
  makeAppBrickDetailLogic,
  useConfigureAppBrickDialog,
} from '../../../hooks/useBrickDetail';
import { useImportResource } from '../../../hooks/useImportResource';
import { useIsBoard } from '../../../hooks/useIsBoard';
import { useNotFound } from '../../../hooks/useNotFound';
import { DETAIL_PATH_BY_SECTION } from '../../../routes/__root';
import { createWebUIFiles } from '../../../utils/create-webui-files';
import { sendAppLabNotification } from '../../notifications';
import { useSketchLibraries } from './hooks/useSketchLibraries';
import { useAddSketchLibraryDialog } from './hooks/useSketchLibrariesDialogs';
import { messages } from './messages';
import { useCreateEditorPanelLogic } from './sub-components/editor-panel/appLabEditorPanel';
import { EditorPanelLogicParams } from './sub-components/editor-panel/appLabEditorPanel.type';
import { useAppDetailFiles } from './sub-components/files/appDetailFiles';
import { useAppDetailRuntimeLogic } from './sub-components/runtime/appDetailRuntime';
import { useCreateAppTitleLogic } from './sub-components/title/appDetailTitle';

const RENAME_MESSAGES = {
  file: {
    success: messages.successfullyRenamedFile,
    error: messages.failedRenameFile,
  },
  folder: {
    success: messages.successfullyRenamedFolder,
    error: messages.failedRenameFolder,
  },
} as const;

const DELETE_MESSAGES = {
  file: {
    success: messages.successfullyDeletedFile,
    error: messages.failedDeleteFile,
  },
  folder: {
    success: messages.successfullyDeletedFolder,
    error: messages.failedDeleteFolder,
  },
} as const;

const defaultOpenFoldersState = {};

export const useAppDetailLogic: AppLabAppDetailLogic = function (
  appId: string,
  section: AppsSection,
): ReturnType<AppLabAppDetailLogic> {
  const [deleteItemDialogOpen, setDeleteItemDialogOpen] = useState(false);
  const [deleteItemFileName, setDeleteItemFileName] = useState<string>('');
  const [deleteItemIsDirectory, setDeleteItemIsDirectory] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<
    (() => Promise<void>) | null
  >(null);
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
  const [selectedNode, setSelectedNode] = useState<TreeNode>();
  const [selectedFolder, setSelectedFolderState] = useState<TreeNode>();

  const [conflictQueue, setConflictQueue] = useState<
    Array<OnDuplicateConflictParams>
  >([]);

  const duplicateDialog = conflictQueue[0];

  const handleDuplicateConflict = useCallback(
    (params: OnDuplicateConflictParams) => {
      setConflictQueue((prev) => [...prev, params]);
    },
    [],
  );

  const { data: isBoard } = useIsBoard();

  const [updateOpenFile, setUpdateOpenFile] = useState<
    (currFileId: string, nextFileId: string) => void
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  >(() => () => {});

  const editorPaneSyncRef = useRef<{
    renameRightPaneTab?: (oldId: string, newId: string) => void;
    closeRightPaneTab?: (fileId: string) => void;
  }>({});

  const {
    appDetail: app,
    appDetailIsLoading,
    appBricks,
    filesList,
    defaultFile,
    filesContents,
    filesContentsAreLoading,
    allContentsRetrieved,
    fileTree,
    sketchDataIsLoading,
    addAppFile,
    renameAppFile,
    deleteAppFile,
    moveFileHandler,
    createAppFolder,
    refetchAppDetail,
    refetchAppYaml,
    refetchSketchYaml,
    refetchAppBricks,
    refetchAppFiles,
    removeFileFromPending,
  } = useAppDetailFiles(appId, updateOpenFile);

  // Redirect to the correct section if app is not found
  const isAppDetailLoaded = !appDetailIsLoading;
  const shouldRedirect = isAppDetailLoaded && !app?.id;
  useNotFound(shouldRedirect, section);

  const { selectedBoard } = useBoards();
  const storeEntityId = useMemo(() => {
    if (!app) return undefined;

    // For examples, keep same persistence across boards
    if (app.example) return `${app.id}-example`;

    if (selectedBoard?.serial) return `${app.id}-${selectedBoard.serial}`;
    // Fallback
    return app.id;
  }, [app, selectedBoard?.serial]);

  const useFilesPayload = useMemo(() => {
    return {
      bricks: appBricks?.map((brick) => ({
        id: brick.id ?? '',
        name: brick.name ?? '',
        category: brick.category ?? '',
      })),
      defaultFilePath: defaultFile?.path,
      files: filesContents,
      filesAreLoading: filesContentsAreLoading,
      filesContentLoaded: allContentsRetrieved,
      isClassicSketch: false,
      isLibraryRoute: false,
      showSketchSecretsFile: false,
      storeEntityId,
      getUnsavedFilesSubject,
    };
  }, [
    allContentsRetrieved,
    appBricks,
    defaultFile,
    filesContents,
    filesContentsAreLoading,
    storeEntityId,
  ]);

  const {
    mainFile: selectableMainFile,
    unsavedFileIds,
    openFiles,
    selectedFile,
    selectFile,
    updateOpenFile: actualUpdateOpenFile,
    updateOpenFilesOrder,
    closeFile,
    onAppRename,
    previewFileId,
    editorFiles,
    openFilesStore,
    storeSplitState,
  } = useFiles(useFilesPayload);

  useEffect(() => {
    setUpdateOpenFile(() => (currFileId: string, nextFileId: string) => {
      actualUpdateOpenFile(currFileId, nextFileId);
      editorPaneSyncRef.current.renameRightPaneTab?.(currFileId, nextFileId);
    });
  }, [actualUpdateOpenFile]);

  const duplicateFileDialogLogic: DuplicateFileDialogLogic = useCallback(
    () => ({
      open: conflictQueue.length > 0,
      fileName: duplicateDialog?.fileName || '',
      conflictType: duplicateDialog?.conflictType || null,

      onOverwrite: async (): Promise<boolean> => {
        if (!duplicateDialog) {
          return false;
        }
        try {
          if (!duplicateDialog.sourcePath || !duplicateDialog.targetPath) {
            console.error('Source or target path is missing');
            return false;
          }
          // For folder-folder conflicts, delete target folder first, then move source
          if (duplicateDialog.conflictType === 'folder-folder') {
            // Close all files in target folder
            const filesInTargetFolder = openFiles.filter((f) =>
              f.fileId.startsWith(duplicateDialog.targetPath + '/'),
            );
            filesInTargetFolder.forEach((f) => closeFile(f.fileId));

            // Delete target folder
            await deleteAppFile(duplicateDialog.targetPath, 'folder');
          } else {
            // For file-file conflicts, close target file if it's open
            if (
              openFiles.some((f) => f.fileId === duplicateDialog.targetPath)
            ) {
              closeFile(duplicateDialog.targetPath);
            }
          }

          if (duplicateDialog.isExternalImport) {
            const isFolder = duplicateDialog.conflictType?.startsWith('folder');
            const targetDir = duplicateDialog.targetPath.includes('/')
              ? duplicateDialog.targetPath.substring(
                  0,
                  duplicateDialog.targetPath.lastIndexOf('/'),
                )
              : '';
            const remoteDir = targetDir
              ? `${app?.path}/${targetDir}`
              : app?.path ?? '';

            await importResourceToAppFromPath(
              remoteDir,
              duplicateDialog.sourcePath,
              isFolder,
            );
            queryClient.invalidateQueries({ queryKey: ['app-files'] });
            queryClient.invalidateQueries({
              queryKey: ['get-batch-app-file-content'],
            });
          } else {
            await moveFileHandler(
              duplicateDialog.sourcePath,
              duplicateDialog.targetPath,
            );
          }
          const isLastItem = conflictQueue.length <= 1;
          setConflictQueue((prev) => prev.slice(1));

          return isLastItem;
        } catch (error) {
          console.error('Failed to overwrite duplicate:', error);
          return false;
        }
      },

      onKeepBoth: async (): Promise<boolean> => {
        try {
          if (!duplicateDialog.sourcePath || !duplicateDialog.targetPath) {
            console.error('Source or target path is missing');
            return false;
          }
          const targetPath = duplicateDialog.targetPath;
          const lastDotIndex = targetPath.lastIndexOf('.');
          const baseName =
            lastDotIndex !== -1
              ? targetPath.substring(0, lastDotIndex)
              : targetPath;
          const extension =
            lastDotIndex !== -1 ? targetPath.substring(lastDotIndex) : '';

          // Helper function to check if a path exists in fileTree
          const checkPathExists = (path: string): boolean => {
            const targetPathRelative = path.replace(app?.path + '/', '');
            const fileExists = filesList?.some(
              (file) => file.path === targetPathRelative,
            );

            const checkFolderExists = (
              nodes: TreeNode[] | undefined,
              target: string,
            ): boolean => {
              if (!nodes) return false;
              for (const node of nodes) {
                if (node.path === target) {
                  return true;
                }
                if (node.type === 'folder' && node.children) {
                  if (checkFolderExists(node.children, target)) {
                    return true;
                  }
                }
              }
              return false;
            };

            const folderExists = checkFolderExists(
              fileTree,
              targetPathRelative,
            );
            return fileExists || folderExists;
          };

          // Incremental naming logic
          let newPath = `${baseName}_copy${extension}`;
          let counter = 1;

          while (checkPathExists(newPath)) {
            newPath = `${baseName}_copy_${counter}${extension}`;
            counter++;
          }

          if (duplicateDialog.isExternalImport) {
            const isFolder = duplicateDialog.conflictType?.startsWith('folder');
            const targetDir = duplicateDialog.targetPath.includes('/')
              ? duplicateDialog.targetPath.substring(
                  0,
                  duplicateDialog.targetPath.lastIndexOf('/'),
                )
              : '';
            const remoteDir = targetDir
              ? `${app?.path}/${targetDir}`
              : app?.path ?? '';
            const newFileName = newPath.split('/').pop() || '';

            await importResourceToAppFromPath(
              remoteDir,
              duplicateDialog.sourcePath,
              isFolder,
              newFileName,
            );
            queryClient.invalidateQueries({ queryKey: ['app-files'] });
            queryClient.invalidateQueries({
              queryKey: ['get-batch-app-file-content'],
            });
          } else {
            await moveFileHandler(duplicateDialog.sourcePath, newPath);
          }

          const isLastItem = conflictQueue.length <= 1;
          setConflictQueue((prev) => prev.slice(1));
          return isLastItem;
        } catch (error) {
          console.error('Failed to keep both:', error);
          return false;
        }
      },

      onOpenChange: (open: boolean): void => {
        if (!open) {
          setConflictQueue([]);
        }
      },
    }),
    [
      conflictQueue,
      duplicateDialog,
      moveFileHandler,
      deleteAppFile,
      app?.path,
      filesList,
      fileTree,
      openFiles,
      closeFile,
    ],
  );

  useEffect(() => {
    if (selectedFile?.fileId) {
      removeFileFromPending(selectedFile.fileId);
    }
  }, [removeFileFromPending, selectedFile]);

  useEffect(() => {
    if (selectedFile?.fileId) {
      setSelectedFolderState(undefined);
    }
  }, [selectedFile?.fileId]);

  const addAppBrick = useCallback(
    async (
      brickId: string,
      params: BrickCreateUpdateRequest = {},
      isCustom = false,
    ): Promise<boolean> => {
      const response = await addAppBrickRequest(appId, brickId, params);

      if (response) {
        await refetchAppYaml();
        await refetchAppBricks();

        // Check if this is the WebUI brick and create required files automatically AFTER successful brick addition
        if (brickId === 'arduino:web_ui' && app?.name) {
          try {
            await createWebUIFiles(app.name, createAppFolder, addAppFile);
            await refetchAppFiles();
          } catch (error) {
            console.error('Failed to create WebUI files:', error);
            sendAppLabNotification({
              message: formatMessage(messages.webUIFileCreationFailed),
              variant: 'error',
            });
          }
        }

        setInitialAppBrickTab('examples');
        selectFile({ fileId: brickId });
        sendAppLabNotification({
          message: formatMessage(
            isCustom
              ? messages.successfullyAddedCustomBrick
              : messages.successfullyAddedBrick,
          ),
          variant: 'success',
        });
        return true;
      }

      sendAppLabNotification({
        message: formatMessage(messages.failedAddBrick),
        variant: 'error',
      });
      return false;
    },
    [
      appId,
      app,
      refetchAppYaml,
      refetchAppBricks,
      refetchAppFiles,
      createAppFolder,
      addAppFile,
      selectFile,
      formatMessage,
    ],
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

  const addAppCustomBrick = useCallback(
    async (
      appId: string,
      body: {
        name: string;
        description?: string;
      },
    ): Promise<{ id: string } | undefined> => {
      try {
        const response = await addAppCustomBrickRequest(appId, body);

        if (response && response.id) {
          selectFile({ fileId: response.id });
          await Promise.all([
            refetchAppBricks(),
            refetchAppFiles(),
            refetchAppYaml(),
          ]);
          return response;
        }

        sendAppLabNotification({
          message: formatMessage(messages.failedAddCustomBrick),
          variant: 'error',
        });
      } catch (error) {
        if ((error as WretchError).status === 405) {
          sendAppLabNotification({
            message: formatMessage(messages.updateAppLab),
            variant: 'info',
            actions: [
              {
                text: 'Go to settings',
                onClick: () => navigate({ to: '/settings' }),
              },
            ],
          });
        } else if ((error as WretchError).status === 409) {
          addAppBrick(body.name, undefined, true);
        } else {
          sendAppLabNotification({
            message: formatMessage(messages.failedAddCustomBrick),
            variant: 'error',
          });
        }
      }
    },
    [
      formatMessage,
      selectFile,
      refetchAppBricks,
      refetchAppFiles,
      refetchAppYaml,
      navigate,
      addAppBrick,
    ],
  );

  const renameAppCustomBrick = useCallback(
    async (brickId: string, params: { name: string }): Promise<boolean> => {
      const response = await renameAppCustomBrickRequest(
        appId,
        brickId,
        params,
      );
      if (response) {
        await Promise.all([
          refetchAppBricks(),
          refetchAppFiles(),
          refetchAppYaml(),
        ]);
        sendAppLabNotification({
          message: formatMessage(messages.successfullyRenamedBrick),
          variant: 'success',
        });
      } else {
        sendAppLabNotification({
          message: formatMessage(messages.failedRenameBrick),
          variant: 'error',
        });
      }
      return response;
    },
    [appId, formatMessage, refetchAppBricks, refetchAppFiles, refetchAppYaml],
  );

  const addFileHandler = useCallback(
    async (path: string) => {
      const fullName = path.split('/').pop();
      if (!fullName) {
        console.error('Invalid file name');
        return;
      }
      const [fileName, fileExtension] = fullName.split('.');
      const prevSelectedFileId = selectedFile?.fileId;

      // Check for conflicts using checkForDuplicates
      try {
        const { fileTree } = await getAppFiles(app?.path || '');
        const { hasDuplicate, conflictType } = checkForDuplicates(
          fileTree,
          path,
          'file',
        );

        if (hasDuplicate) {
          // Show notification for all conflict types during creation
          const message =
            conflictType === 'file-folder'
              ? formatMessage(messages.fileAlreadyExistsFolder)
              : formatMessage(messages.fileAlreadyExists);
          sendAppLabNotification({
            message,
            variant: 'error',
          });
          return;
        }
      } catch (error) {
        console.error('Failed to check file existence:', error);
      }

      // this row auto-open newly created files in editor
      selectFile({ fileId: path });
      try {
        await addAppFile(path, fileName, fileExtension);
        sendAppLabNotification({
          message: formatMessage(messages.successfullyCreatedFile),
          variant: 'success',
        });
      } catch (error) {
        if (prevSelectedFileId) {
          selectFile({ fileId: prevSelectedFileId });
        }
        const message =
          error instanceof Error && error.message === BOARD_STORAGE_FULL_ERROR
            ? formatMessage(messages.failedCreateFileStorageFull)
            : formatMessage(messages.failedCreateFile);
        sendAppLabNotification({
          message,
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

      // Check for conflicts using checkForDuplicates
      try {
        const { fileTree } = await getAppFiles(app?.path || '');
        const { hasDuplicate, conflictType } = checkForDuplicates(
          fileTree,
          path,
          'folder',
        );

        if (hasDuplicate) {
          // Show notification for all conflict types during creation
          const message =
            conflictType === 'folder-file'
              ? formatMessage(messages.folderAlreadyExistsFile)
              : formatMessage(messages.folderAlreadyExists);
          sendAppLabNotification({
            message,
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
      } catch (error) {
        const message =
          error instanceof Error && error.message === BOARD_STORAGE_FULL_ERROR
            ? formatMessage(messages.failedCreateFolderStorageFull)
            : formatMessage(messages.failedCreateFolder);
        sendAppLabNotification({
          message,
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
        const messages = RENAME_MESSAGES[nodeType || 'file'];
        sendAppLabNotification({
          message: formatMessage(messages.success),
          variant: 'success',
        });
      } catch (error) {
        updateOpenFile(newPath, path);
        const messages = RENAME_MESSAGES[nodeType || 'file'];
        sendAppLabNotification({
          message: formatMessage(messages.error),
          variant: 'error',
        });
      }
    },
    [filesContents, app?.path, formatMessage, updateOpenFile, renameAppFile],
  );

  const deleteFileHandler = useCallback(
    async (path: string, nodeType?: 'file' | 'folder') => {
      const fileName = path.split('/').pop() || '';
      const isDir = nodeType === 'folder';

      const performDelete = async (): Promise<void> => {
        const fileIndex = openFiles.findIndex((f) => f.fileId === path);
        try {
          closeFile(path);
          editorPaneSyncRef.current.closeRightPaneTab?.(path);
          await deleteAppFile(path);
          const messages = DELETE_MESSAGES[nodeType || 'file'];
          sendAppLabNotification({
            message: formatMessage(messages.success),
            variant: 'success',
          });
        } catch {
          selectFile({ fileId: path, openAtIndex: fileIndex });
          const messages = DELETE_MESSAGES[nodeType || 'file'];
          sendAppLabNotification({
            message: formatMessage(messages.error),
            variant: 'error',
          });
        }
      };

      setDeleteItemFileName(fileName);
      setDeleteItemIsDirectory(isDir);
      setPendingDeleteAction(() => performDelete);
      setDeleteItemDialogOpen(true);
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
    (params: {
      fileId?: string;
      openAtIndex?: number;
      isPreview?: boolean;
    }): void => {
      const { fileId, openAtIndex, isPreview } = params;

      if (fileId) {
        removeFileFromPending(fileId);
      }
      selectFile({ fileId, openAtIndex, isPreview });
    },
    [removeFileFromPending, selectFile],
  );

  const renameFileFromEditor = useCallback(
    (path: string, newName: string, nodeType?: 'file' | 'folder') =>
      renameFileHandler(path, newName, true, nodeType),
    [renameFileHandler],
  );

  const editorPanelLogicParams: EditorPanelLogicParams = useMemo(() => {
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
      addAppFolder: createAppFolder,
      updateAppBrick,
      initialAppBrickTab,
      sketchDataIsLoading,
      openFiles,
      allFiles: editorFiles,
      readOnly: section === 'examples',
      removeFileFromPending,
      previewFileId,
      openFilesStore,
      filesContentLoaded: allContentsRetrieved,
      storeSplitState,
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
    createAppFolder,
    updateAppBrick,
    initialAppBrickTab,
    sketchDataIsLoading,
    openFiles,
    editorFiles,
    section,
    removeFileFromPending,
    previewFileId,
    openFilesStore,
    allContentsRetrieved,
    storeSplitState,
  ]);

  // Single owner of the editor-panel/split state machine. Instantiated
  // once here (rather than inside `useAppLabEditorPanelLogic`) so that
  // every consumer of `appLabEditorPanelLogic` shares the same instance,
  // and so the file-tree/brick drop handler below can route files into
  // pane B by calling `openFileInPane` directly.
  const {
    editorPanelLogic,
    openFileInPane,
    getActivePane,
    activePane,
    rightPaneSelectedFile,
    renameRightPaneTab,
    closeRightPaneTab,
    openBrickAiModelsTab,
  } = useCreateEditorPanelLogic(editorPanelLogicParams);

  useEffect(() => {
    editorPaneSyncRef.current = { renameRightPaneTab, closeRightPaneTab };
  }, [renameRightPaneTab, closeRightPaneTab]);

  const activeSelectedFile =
    activePane === 'B' ? rightPaneSelectedFile : selectedFile;

  useEffect(() => {
    if (activeSelectedFile?.fileId) {
      const foundFile = filesList?.find(
        (file) => file.path === activeSelectedFile.fileId,
      );

      if (
        foundFile &&
        isFileNode(foundFile) &&
        activeSelectedFile.fileExtension !== 'brick'
      ) {
        // Keep selectedNode as the open file, regardless of folder selection
        setSelectedNode(foundFile);
      }
    } else if (
      !activeSelectedFile &&
      selectedNode &&
      isFileNode(selectedNode)
    ) {
      // Clear selectedNode when no file is open, but only if it's a file
      setSelectedNode(undefined);
      // Note: if selectedNode is a folder, keep it for file creation operations
    }
  }, [activeSelectedFile, filesList, selectedNode]);

  const openExternal = useCallback(() => {
    if (!selectedNode) {
      console.warn('No file selected to open externally');
      return;
    }
    openFileExternal(selectedNode.path);
  }, [selectedNode]);

  const openFilesFolder = useCallback((): void => {
    throw new Error('openFilesFolder not implemented');
  }, []);

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
        onAppRename(result || '');
        navigate({
          to: `/${section}/${result}`,
        });
      }
      return result !== undefined;
    },
  });

  const { data: bricks } = useQuery(['list-bricks'], () => getBricks());

  const setSelectedFile = useCallback(
    (
      node: string | TreeNode | undefined,
      isPreview = false,
      targetPane?: 'A' | 'B',
    ) => {
      if (!node) return;
      setInitialAppBrickTab(undefined);
      const path = typeof node === 'string' ? node : node.path;

      // Route to the pane the user last focused when the caller doesn't
      // pin a target (file-tree clicks). Explicit callers (drag-and-drop)
      // still win. Pane-B routing falls back to default A behaviour while
      // nothing is open in A: the split editor only renders alongside a
      // populated pane A, so routing the first-ever file into B would
      // leave it invisible.
      const resolvedPane = targetPane ?? getActivePane();
      if (resolvedPane === 'B' && openFiles.length > 0) {
        openFileInPane(path, 'B');
        removeFileFromPending(path);
        setSelectedFolderState(undefined);
        return;
      }

      const prevSelectedFileIndex = openFiles.findIndex(
        (f) => f.fileId === selectedFile?.fileId,
      );

      selectFile({
        fileId: path,
        openAtIndex: prevSelectedFileIndex + 1,
        isPreview,
      });
      removeFileFromPending(path);

      // Reset selectedFolder when a file is selected
      setSelectedFolderState(undefined);
    },
    [
      openFiles,
      openFileInPane,
      getActivePane,
      removeFileFromPending,
      selectFile,
      selectedFile,
    ],
  );

  const setSelectedFolder = useCallback((node: TreeNode | undefined) => {
    // For folders, use separate state for visual selection only
    // This doesn't affect file selection or open files
    setSelectedFolderState(node);
  }, []);

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

  // Pure closure over the single state-machine instance created above —
  // consumers (AppLabEditorPanel, FilesManagerSection) may invoke this
  // freely without instantiating duplicate editor-panel state.
  const useAppLabEditorPanelLogic: AppLabEditorPanelLogic =
    (): ReturnType<AppLabEditorPanelLogic> => {
      const onCopyCode = useCallback(() => {
        (): void =>
          sendAppLabNotification({
            message: formatMessage(messages.codeCopied),
            variant: 'success',
          });
      }, []);
      return {
        editorPanelLogic,
        getKeywords: useKeywords,
        onCopyCode,
        openFiles: editorPanelLogicParams.openFiles,
        readOnly: editorPanelLogicParams.readOnly,
      };
    };

  const appLabEditorPanelLogic = useCallback(useAppLabEditorPanelLogic, [
    editorPanelLogic,
    editorPanelLogicParams,
    formatMessage,
  ]);

  const deleteTreeItemDialogLogic = useCallback(
    () => ({
      open: deleteItemDialogOpen,
      fileName: deleteItemFileName,
      isDirectory: deleteItemIsDirectory,
      confirmAction: async (): Promise<boolean> => {
        if (pendingDeleteAction) {
          await pendingDeleteAction();
          return true;
        }
        // no pending action -> error
        return false;
      },
      onOpenChange: (open: boolean): void => {
        setDeleteItemDialogOpen(open);
        if (!open) {
          setPendingDeleteAction(null);
          setDeleteItemFileName('');
          setDeleteItemIsDirectory(false);
        }
      },
    }),
    [
      deleteItemDialogOpen,
      deleteItemFileName,
      deleteItemIsDirectory,
      pendingDeleteAction,
    ],
  );

  const configureAppBrickDialogLogic = useCallback(
    useConfigureAppBrickDialog,
    [],
  );

  const brickDetailLogic = useMemo(
    () => makeAppBrickDetailLogic(appId),
    [appId],
  );

  const handleMoveBlocked = useCallback(() => {
    sendAppLabNotification({
      message: formatMessage(messages.fileCannotBeMoved),
      variant: 'info',
    });
  }, [formatMessage]);

  const {
    activePanel,
    defaultApp,
    setAsDefaultApp,
    configureAppBricksDialogLogic,
    swapRunningAppDialogLogic,
    multipleConsolePanelLogic,
    runtimeActionsLogic,
    aiModelRequiredDialog,
  } = useAppDetailRuntimeLogic(
    app,
    appBricks,
    fileTree,
    openApp,
    updateApp,
    updateAppBricks,
  );

  const aiModelRequiredDialogLogic: AiModelRequiredDialogLogic =
    useCallback(() => {
      const { brickId, modelId } = aiModelRequiredDialog;
      const { models, downloadGenericModel, downloadEIModel } =
        brickDetailLogic(brickId ?? '');

      const isExample = section === 'examples';
      const eiProjectId = modelId?.match(/^ei-model-(\d+)-\d+$/)?.[1];
      const modelName =
        models?.find((m) =>
          eiProjectId
            ? // Account-linked EI model: the id encodes the project id.
              m.edgeImpulseProps?.projectId === eiProjectId
            : // Generic/built-in match by id, or an unlinked EI model whose card
              // id is its project id — match it by the impulse's board model id.
              m.id === modelId ||
              m.edgeImpulseProps?.impulses.some(
                (i) => i.downloadModelId === modelId,
              ),
        )?.name ?? '';

      return {
        open: aiModelRequiredDialog.open,
        isExample,
        modelName,
        onOpenChange: (nextOpen: boolean): void => {
          if (!nextOpen) aiModelRequiredDialog.close();
        },
        onDownloadModel: (): void => {
          if (brickId) {
            openBrickAiModelsTab(brickId);
            // In examples the model is fixed and the CTA is "Download Model",
            // so start the download (navigating lets the user watch progress).
            // Mirror the card's own download so progress is reported where the
            // card reads it: an unlinked EI model is a card keyed by project id,
            // so route it through downloadEIModel (progress under project id);
            // everything else downloads by id. An example never requires a
            // linked EI model, so the impulse-install path is never hit.
            if (isExample && modelId) {
              const eiModel = models?.find((m) =>
                m.edgeImpulseProps?.impulses.some(
                  (i) => i.downloadModelId === modelId,
                ),
              );
              const eiImpulse = eiModel?.edgeImpulseProps?.impulses.find(
                (i) => i.downloadModelId === modelId,
              );

              if (eiModel?.edgeImpulseProps && eiImpulse) {
                downloadEIModel?.(
                  eiModel.edgeImpulseProps.projectId,
                  eiImpulse.id,
                );
              } else {
                downloadGenericModel?.(modelId);
              }
            }
          }
          aiModelRequiredDialog.close();
        },
      };
    }, [
      aiModelRequiredDialog,
      brickDetailLogic,
      section,
      openBrickAiModelsTab,
    ]);

  const useAppLabEditSectionLogic: AppLabEditSectionLogic =
    (): ReturnType<AppLabEditSectionLogic> => {
      const [importFileDialogOpen, setImportFileDialogOpen] = useState(false);
      const [_importedFileId, setImportedFileId] = useState<
        string | undefined
      >();
      const [importTarget, setImportTarget] = useState({
        path: '',
        isFolder: false,
      });

      const handleDragOverFolderChange = useCallback((path: string) => {
        setImportTarget((prev) => {
          if (prev.path !== path) {
            return { path, isFolder: false };
          }
          return prev;
        });
      }, []);

      const renderIcon = useCallback((node: TreeNode): JSX.Element => {
        if (isFolderNode(node)) {
          return <></>; // No icon for folders, only caret will be shown
        }

        return <FileIcon fileName={node.name} />;
      }, []);

      const handleOpenImportFileDialog = useCallback(
        ({ path = '', isFolder = false }) => {
          setImportTarget({ path, isFolder });
          setImportFileDialogOpen(true);
        },
        [],
      );

      const importFileDialogLogic = useImportResource({
        importResourceDialogOpen: importFileDialogOpen,
        setImportResourceDialogOpen: setImportFileDialogOpen,
        setImportedResourceId: setImportedFileId,
        selectResourcePath: () =>
          selectResourcePathToImport(
            importTarget.path
              ? `${app?.path}/${importTarget.path}`
              : app?.path ?? '',
            importTarget.isFolder,
          ),
        importResourceFromPath: (
          filePath: string,
          isFolder: boolean,
          newFileName?: string,
        ) =>
          importResourceToAppFromPath(
            importTarget.path
              ? `${app?.path}/${importTarget.path}`
              : app?.path ?? '',
            filePath,
            isFolder,
            newFileName,
          ),
        type: importTarget.isFolder ? 'folder' : 'file',
        invalidateQueries: () => {
          queryClient.invalidateQueries({ queryKey: ['app-files'] });
          queryClient.invalidateQueries({
            queryKey: ['get-batch-app-file-content'],
          });
        },
        nodes: fileTree,
        targetFolderPath: importTarget.path,
        onDuplicateConflict: handleDuplicateConflict,
      });

      return {
        app,
        multipleConsolePanelLogic,
        section,
        appBricks,
        bricks,
        appLibraries,
        fileTree,
        selectedFile: activeSelectedFile,
        selectedFolder,
        selectedNode,
        defaultOpenFoldersState,
        setSelectedFile,
        setSelectedFolder,
        openFilesFolder,
        openExternal,
        openExternalLink,
        addAppBrick,
        deleteAppBrick: removeAppBrick,
        updateAppBrick,
        addAppCustomBrick,
        addFileHandler,
        renameFileHandler,
        deleteFileHandler,
        moveFileHandler,
        addSketchLibraryDialogLogic,
        openAddSketchLibraryDialog,
        deleteSketchLibrary,
        addFolderHandler,
        appLabEditorPanelLogic,
        renderIcon,
        brickDetailLogic,
        configureAppBrickDialogLogic,
        updateOpenFile,
        renameAppCustomBrick,
        onDuplicateConflict: handleDuplicateConflict,
        duplicateFileDialogLogic,
        importFileDialogLogic,
        openImportFileDialog: handleOpenImportFileDialog,
        onMoveBlocked: handleMoveBlocked,
        onDragOverFolderChange: handleDragOverFolderChange,
      };
    };

  const appLabEditSectionLogic = useCallback(useAppLabEditSectionLogic, [
    app,
    multipleConsolePanelLogic,
    section,
    appBricks,
    bricks,
    appLibraries,
    fileTree,
    activeSelectedFile,
    selectedFolder,
    selectedNode,
    setSelectedFile,
    setSelectedFolder,
    openFilesFolder,
    openExternal,
    openExternalLink,
    addAppBrick,
    removeAppBrick,
    updateAppBrick,
    addAppCustomBrick,
    addFileHandler,
    renameFileHandler,
    deleteFileHandler,
    moveFileHandler,
    addSketchLibraryDialogLogic,
    openAddSketchLibraryDialog,
    deleteSketchLibrary,
    addFolderHandler,
    appLabEditorPanelLogic,
    brickDetailLogic,
    configureAppBrickDialogLogic,
    updateOpenFile,
    renameAppCustomBrick,
    handleDuplicateConflict,
    duplicateFileDialogLogic,
    handleMoveBlocked,
  ]);

  const { appStatus } = runtimeActionsLogic();

  const appTitleLogic = useCreateAppTitleLogic(
    app,
    appStatus,
    section,
    defaultApp,
    setAsDefaultApp,
    updateApp,
    openApp,
  );
  const { onAppAction } = appTitleLogic();

  return {
    app,
    fileTree,
    activePanel,
    configureAppBricksDialogLogic,
    swapRunningAppDialogLogic,
    aiModelRequiredDialogLogic,
    onAppAction,
    appTitleLogic,
    appLabEditSectionLogic,
    runtimeActionsLogic,
    updateOpenFile,
    deleteTreeItemDialogLogic,
  };
};
