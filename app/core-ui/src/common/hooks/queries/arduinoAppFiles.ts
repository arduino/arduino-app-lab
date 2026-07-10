import {
  createAppFile,
  createAppFolder,
  getAppFileContent,
  getCodeSubjects,
  getUnsavedFilesSubjectNext,
  moveAppFile,
  removeAppFile,
  removeCodeSubject,
  renameAppFile,
  setCodeSubjects,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { FileNode } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import {
  QueryKey,
  UseMutateAsyncFunction,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { getDefaultFileContent } from '../../utils';

export type FileWithContent = FileNode & {
  id: string;
  content: string;
  fullName: string;
  contentIsPending?: boolean;
};

type UseRetrieveArduinoAppFileContents = (
  enabled: boolean,
  path?: string,
  node?: FileNode,
) => {
  fileData?: FileWithContent;
  isLoading: boolean;
  refetch: UseQueryResult['refetch'];
};

export const useRetrieveArduinoAppFileContents: UseRetrieveArduinoAppFileContents =
  function (
    enabled: boolean,
    path?: string,
    node?: FileNode,
  ): ReturnType<UseRetrieveArduinoAppFileContents> {
    const {
      data: fileData,
      isLoading,
      refetch,
    } = useQuery(
      ['get-app-file-content', path, node?.path],
      async () => {
        if (!path || !node) {
          throw new Error('No file/data path provided');
        }
        const content = await getAppFileContent(path + '/' + node.path);

        return {
          id: path + '/' + node.path,
          content,
          fullName: node.name,
          ...node,
          path: node.path,
          extension: node.extension.replace('.', ''),
        };
      },
      {
        onSuccess: (data: FileWithContent) => {
          setCodeSubjects(data);
          getUnsavedFilesSubjectNext(data.path, false);
        },
        enabled,
        staleTime: 0,
        cacheTime: 0,
      },
    );

    return {
      fileData,
      isLoading,
      refetch,
    };
  };

type UseRetrieveBatchArduinoAppFileContents = (
  enabled: boolean,
  filesListKey: QueryKey,
  files?: FileNode[],
  appPath?: string,
  pendingFileIds?: string[],
  pendingFileIdWasRemoved?: boolean,
  updateOpenFile?: (currFileId: string, nextFileId: string) => void,
) => {
  filesContents?: FileWithContent[];
  fileIsDeleting: boolean;
  refreshFileContents: (filePaths: string[]) => void;
  deleteAppFile: (path?: string, nodeType?: 'file' | 'folder') => Promise<void>;
  renameAppFile: (
    from?: string,
    to?: string,
    nodeType?: 'file' | 'folder',
  ) => Promise<void>;
  addAppFile: (
    fileId: string,
    fileName: string,
    fileExtension: string,
  ) => Promise<void>;
  createAppFolder: (path: string) => Promise<void>;
  moveFileHandler: (
    fromPath: string,
    toPath: string,
    filesToUpdate?: Array<{ oldPath: string; newPath: string }>,
  ) => Promise<void>;
  isLoading: boolean;
  allContentsRetrieved: boolean;
};

export const GET_BATCH_FILE_CONTENT_QUERY_KEY = 'get-batch-app-file-content';

export const useRetrieveBatchArduinoAppFileContents: UseRetrieveBatchArduinoAppFileContents =
  function (
    enabled,
    filesListKey: QueryKey,
    files?: FileNode[],
    appPath?: string,
    pendingFileIds: string[] = [],
    pendingFileIdWasRemoved: boolean = false,
    updateOpenFile?: (currFileId: string, nextFileId: string) => void,
  ): ReturnType<UseRetrieveBatchArduinoAppFileContents> {
    const queryClient = useQueryClient();

    const [filesContents, setFilesContents] = useState<{
      items: FileWithContent[];
      fetchCount: number;
      fetchComplete: boolean;
    }>({ items: [], fetchCount: 0, fetchComplete: false });

    useEffect(() => {
      setFilesContents({ items: [], fetchCount: 0, fetchComplete: false });
    }, []);

    useEffect(() => {
      const _files = files || [];
      const filePaths = _files.map((f) => f.path);

      setFilesContents((prev) => {
        const items = prev.items.filter((fc) => {
          const isInFiles = filePaths.includes(fc.path);

          if (!isInFiles && [...getCodeSubjects().keys()].includes(fc.path)) {
            removeCodeSubject(fc.path);
          }

          return isInFiles;
        });

        return { ...prev, items };
      });
    }, [files]);

    const { renameAppFileMutate } = useRenameArduinoAppFile(
      filesListKey,
      appPath,
    );

    const { createAppFileMutate } = useCreateArduinoAppFile(
      enabled,
      filesListKey,
      appPath,
    );

    const { deleteAppFileMutate, isLoading: isDeleting } =
      useDeleteArduinoAppFile(filesListKey, appPath);

    const { createAppFolderMutate } = useCreateArduinoAppFolder(
      enabled,
      filesListKey,
      appPath,
    );

    const { moveAppFileMutate } = useMoveArduinoAppFile(filesListKey, appPath);

    const results = useQueries({
      queries: (files ?? []).map((file) => ({
        queryKey: [
          GET_BATCH_FILE_CONTENT_QUERY_KEY,
          appPath + '/' + file.path,
          pendingFileIds.find((id) => id === file.path),
        ],
        queryFn: async (): Promise<FileWithContent> => {
          if (!appPath || !file.path) {
            throw new Error('No file path provided');
          }
          const isPending = pendingFileIds.includes(file.path);
          const content = !isPending
            ? await getAppFileContent(appPath + '/' + file.path)
            : '';

          const parts = file.name.split('.');
          const name =
            parts.length > 1 ? parts.slice(0, -1).join('.') : file.name;

          return {
            id: appPath + '/' + file.path,
            content,
            ...file,
            name,
            path: file.path,
            extension: file.extension.replace('.', ''),
            fullName: file.name,
            contentIsPending: isPending,
          };
        },
        onSuccess: (data: FileWithContent): void => {
          if (!data.contentIsPending) {
            setCodeSubjects(data);
          }

          setFilesContents((prev) => {
            const items = prev.items
              .filter((f) => f.path !== data.path)
              .concat(data);

            return {
              items,
              fetchCount: prev.fetchComplete
                ? prev.fetchCount
                : prev.fetchCount + 1,
              fetchComplete: prev.fetchComplete
                ? prev.fetchComplete
                : prev.fetchCount + 1 === files?.length,
            };
          });
        },
        // Only enable the query once `pendingFileIds` has been seeded
        // from `files` (or a removal has occurred). Without this gate,
        // queries fire during the initial render with `pendingFileIds=[]`
        // and cache an empty `contentIsPending: true` result under the
        // same key that `removeFileFromPending` later transitions back
        // to, preventing the real content from ever being fetched.
        enabled:
          enabled &&
          !!files &&
          (pendingFileIds.length === files.length || pendingFileIdWasRemoved),
        staleTime: 0,
        cacheTime: 0,
      })),
    });

    const refreshAppFileContents = (paths: string[] = []): void => {
      if (paths.length === 0) {
        // Invalidate all files
        queryClient.invalidateQueries([GET_BATCH_FILE_CONTENT_QUERY_KEY]);
        return;
      }

      paths.forEach((path) => {
        const queryKey = [
          GET_BATCH_FILE_CONTENT_QUERY_KEY,
          appPath + '/' + path,
        ];
        queryClient.invalidateQueries({ queryKey });
      });
    };

    const renameAppFile = useCallback(
      async (
        prevName?: string,
        newName?: string,
        nodeType?: 'file' | 'folder',
      ): Promise<void> => {
        function renameFile(prevName?: string, newName?: string): void {
          setFilesContents((prev) => {
            const items = prev.items.map((file) => {
              if (newName !== undefined && file.path === prevName) {
                file.path = newName;

                const fullName = newName.split('/').pop() ?? '';
                file.fullName = fullName;
                file.name = fullName.split('.')[0];
              }
              return file;
            });
            return { ...prev, items };
          });
        }

        // For folders, track files that will need path updates after the rename
        const filesToUpdate: Array<{ oldPath: string; newPath: string }> = [];
        if (nodeType === 'folder' && prevName && newName) {
          filesContents.items.forEach((file) => {
            if (file.path.startsWith(prevName + '/')) {
              // This file was inside the renamed folder, calculate its new path
              const relativePath = file.path.substring(prevName.length);
              const newFilePath = newName + relativePath;

              filesToUpdate.push({
                oldPath: file.path,
                newPath: newFilePath,
              });
            }
          });
        }

        // Update filesContents paths immediately for the renamed folder/file
        renameFile(prevName, newName);

        // Update paths for files inside renamed folder
        if (filesToUpdate.length > 0) {
          setFilesContents((prev) => {
            const updatedItems = prev.items.map((item) => {
              const update = filesToUpdate.find((u) => u.oldPath === item.path);
              return update ? { ...item, path: update.newPath } : item;
            });
            return { ...prev, items: updatedItems };
          });
        }

        // Update open file paths - handle both single file and multiple files
        if (updateOpenFile) {
          if (filesToUpdate.length > 0) {
            // Handle folder rename with multiple files inside
            filesToUpdate.forEach(({ oldPath, newPath }) => {
              updateOpenFile(oldPath, newPath);
            });
          } else {
            // Handle single file/folder rename
            if (prevName && newName) {
              updateOpenFile(prevName, newName);
            }
          }
        }

        try {
          await renameAppFileMutate({ from: prevName, to: newName, nodeType });
        } catch (error) {
          // Rollback file path updates if rename failed
          renameFile(newName, prevName);

          // Rollback paths for files inside renamed folder
          if (filesToUpdate.length > 0) {
            setFilesContents((prev) => {
              const updatedItems = prev.items.map((item) => {
                const update = filesToUpdate.find(
                  (u) => u.newPath === item.path,
                );
                return update ? { ...item, path: update.oldPath } : item;
              });
              return { ...prev, items: updatedItems };
            });
          }

          // Rollback open file paths
          if (updateOpenFile) {
            if (filesToUpdate.length > 0) {
              // Handle folder rename rollback with multiple files inside
              filesToUpdate.forEach(({ oldPath, newPath }) => {
                updateOpenFile(newPath, oldPath);
              });
            } else {
              // Handle single file/folder rename rollback
              if (prevName && newName) {
                updateOpenFile(newName, prevName);
              }
            }
          }

          throw error;
        }
      },
      [renameAppFileMutate, updateOpenFile, filesContents.items],
    );

    const addAppFile = useCallback(
      async (
        fileId: string,
        fileName: string,
        fileExtension: string,
        content?: string,
      ) => {
        const defaultContent = getDefaultFileContent(fileExtension);

        const newFile: FileWithContent = {
          id: fileId,
          fullName: `${fileName}.${fileExtension}`,
          name: fileName,
          content: content ?? defaultContent,
          path: fileId,
          extension: fileExtension ?? '',
          type: 'file',
          mimeType: '',
        };
        setFilesContents((prev) => ({
          ...prev,
          items: prev.items.concat(newFile),
        }));
        try {
          return await createAppFileMutate({
            path: fileId,
            content,
          });
        } catch (error) {
          setFilesContents((prev) => ({
            ...prev,
            items: prev.items.filter((f) => f.path !== fileId),
          }));
          throw error;
        }
      },
      [createAppFileMutate],
    );

    const deleteAppFile = useCallback(
      async (path?: string | undefined) => {
        const fileIndex = filesContents.items.findIndex((f) => f.path === path);
        const file = filesContents.items[fileIndex];
        setFilesContents((prev) => ({
          ...prev,
          items: prev.items.filter((item) => item.path !== path),
        }));
        try {
          return await deleteAppFileMutate(path);
        } catch (error) {
          const err = error as Error;
          if (err.cause !== 404 && file) {
            setFilesContents((prev) => {
              const items = [
                ...prev.items.slice(0, fileIndex),
                file,
                ...prev.items.slice(fileIndex),
              ];

              return { ...prev, items };
            });
          }

          throw error;
        }
      },
      [deleteAppFileMutate, filesContents],
    );

    const moveFileHandler = useCallback(
      async (
        fromPath: string,
        toPath: string,
        filesToUpdate?: Array<{ oldPath: string; newPath: string }>,
      ): Promise<void> => {
        // Prepare path updates to apply immediately after move
        const pathUpdates = filesToUpdate || [
          { oldPath: fromPath, newPath: toPath },
        ];

        await moveAppFileMutate({ fromPath, toPath });

        // Update filesContents paths immediately to prevent filtering
        setFilesContents((prev) => {
          const updatedItems = prev.items.map((item) => {
            const update = pathUpdates.find((u) => u.oldPath === item.path);
            return update ? { ...item, path: update.newPath } : item;
          });
          return { ...prev, items: updatedItems };
        });

        // Update open file paths - handle both single file and multiple files
        if (updateOpenFile) {
          if (filesToUpdate && filesToUpdate.length > 0) {
            // Handle folder move with multiple files
            filesToUpdate.forEach(({ oldPath, newPath }) => {
              updateOpenFile(oldPath, newPath);
            });
          } else {
            // Handle single file move
            updateOpenFile(fromPath, toPath);
          }
        }
      },
      [moveAppFileMutate, updateOpenFile],
    );

    return {
      filesContents:
        filesContents.items.length > 0 ? filesContents.items : undefined,
      refreshFileContents: refreshAppFileContents,
      deleteAppFile,
      fileIsDeleting: isDeleting,
      renameAppFile: renameAppFile,
      createAppFolder: createAppFolderMutate,
      addAppFile,
      moveFileHandler,
      isLoading:
        filesContents.items.length > 0
          ? results.some((result) => result.isLoading)
          : false,
      allContentsRetrieved: filesContents.fetchComplete,
    };
  };

type UseCreateArduinoAppFile = (
  enabled: boolean,
  keyToInvalidate: QueryKey,
  appPath?: string,
) => {
  createAppFileMutate: UseMutateAsyncFunction<
    void,
    unknown,
    {
      path: string;
      content?: string | undefined;
    },
    unknown
  >;
  isLoading: boolean;
};

export const useCreateArduinoAppFile: UseCreateArduinoAppFile = function (
  enabled: boolean,
  keyToInvalidate: QueryKey,
  appPath?: string,
): ReturnType<UseCreateArduinoAppFile> {
  const queryClient = useQueryClient();

  const { isLoading, mutateAsync: createAppFileMutate } = useMutation({
    mutationFn: (payload: { path: string; content?: string }) =>
      enabled
        ? createAppFile(appPath + '/' + payload.path, payload.content)
        : Promise.reject(new Error('Creating app files is disabled')),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: keyToInvalidate,
        exact: true,
      });
    },
  });

  return {
    createAppFileMutate,
    isLoading,
  };
};

type UseDeleteArduinoAppFile = (
  keyToInvalidate: QueryKey,
  appPath?: string,
) => {
  deleteAppFileMutate: UseMutateAsyncFunction<
    void,
    unknown,
    string | undefined,
    unknown
  >;
  isLoading: boolean;
};

export const useDeleteArduinoAppFile: UseDeleteArduinoAppFile = function (
  keyToInvalidate: QueryKey,
  appPath?: string,
): ReturnType<UseDeleteArduinoAppFile> {
  const queryClient = useQueryClient();
  const { isLoading, mutateAsync: deleteAppFileMutate } = useMutation({
    mutationFn: (path?: string) =>
      path
        ? removeAppFile(appPath + '/' + path)
        : Promise.reject(new Error('Tried to delete app file without path')),
    onSuccess: (_, path) => {
      if (path) {
        try {
          removeCodeSubject(path);
        } catch (error) {
          console.error(
            'Error removing code subject for path ' + path + ':',
            error,
          );
        }
      }
      queryClient.invalidateQueries({
        queryKey: keyToInvalidate,
        exact: true,
      });
      // Invalidate app-bricks query to update brick status when files are deleted
      const appId = Array.isArray(keyToInvalidate)
        ? keyToInvalidate[1]
        : undefined;
      if (appId) {
        queryClient.invalidateQueries(['app-bricks', appId]);
      }
    },
  });

  return {
    isLoading,
    deleteAppFileMutate,
  };
};

type UseRenameArduinoAppFile = (
  keyToInvalidate: QueryKey,
  appPath?: string,
) => {
  renameAppFileMutate: UseMutateAsyncFunction<
    void,
    unknown,
    { from?: string; to?: string; nodeType?: 'file' | 'folder' },
    unknown
  >;
  isLoading: boolean;
};

export const useRenameArduinoAppFile: UseRenameArduinoAppFile = function (
  keyToInvalidate: QueryKey,
  appPath?: string,
): ReturnType<UseRenameArduinoAppFile> {
  const queryClient = useQueryClient();

  const { isLoading, mutateAsync: renameAppFileMutate } = useMutation({
    mutationFn: (content: {
      from?: string;
      to?: string;
      nodeType?: 'file' | 'folder';
    }) => {
      return content.from !== undefined && content.to !== undefined
        ? renameAppFile(
            appPath + '/' + content.from,
            appPath + '/' + content.to,
            content.nodeType,
          )
        : Promise.reject(
            new Error('Tried to rename app file without from/to paths'),
          );
    },
    onSuccess: (_, variables) => {
      if (variables.from) {
        try {
          // Only remove code subject for files, not folders
          // Folders don't have code subjects and will throw an error
          if (variables.nodeType !== 'folder') {
            removeCodeSubject(variables.from);
          }
        } catch (error) {
          console.error(
            'Error removing code subject for path ' + variables.from + ':',
            error,
          );
        }
      }
      queryClient.invalidateQueries({
        queryKey: keyToInvalidate,
        exact: true,
      });
    },
  });

  return {
    renameAppFileMutate,
    isLoading,
  };
};

type UseCreateArduinoAppFolder = (
  enabled: boolean,
  keyToInvalidate: QueryKey,
  appPath?: string,
) => {
  createAppFolderMutate: UseMutateAsyncFunction<void, unknown, string, unknown>;
  isLoading: boolean;
};

export const useCreateArduinoAppFolder: UseCreateArduinoAppFolder = function (
  enabled: boolean,
  keyToInvalidate: QueryKey,
  appPath?: string,
): ReturnType<UseCreateArduinoAppFolder> {
  const queryClient = useQueryClient();

  const { isLoading, mutateAsync: createAppFolderMutate } = useMutation({
    mutationFn: (path: string) =>
      enabled
        ? createAppFolder(appPath + '/' + path)
        : Promise.reject(new Error('Creating app folder is disabled')),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: keyToInvalidate,
        exact: true,
      });
    },
  });

  return {
    createAppFolderMutate,
    isLoading,
  };
};

type UseMoveArduinoAppFile = (
  keyToInvalidate: QueryKey,
  appPath?: string,
) => {
  moveAppFileMutate: UseMutateAsyncFunction<
    void,
    unknown,
    { fromPath: string; toPath: string },
    unknown
  >;
  isLoading: boolean;
};

export const useMoveArduinoAppFile: UseMoveArduinoAppFile = function (
  keyToInvalidate: QueryKey,
  appPath?: string,
): ReturnType<UseMoveArduinoAppFile> {
  const queryClient = useQueryClient();

  const { isLoading, mutateAsync: moveAppFileMutate } = useMutation({
    mutationFn: (payload: { fromPath: string; toPath: string }) =>
      moveAppFile(
        appPath + '/' + payload.fromPath,
        appPath + '/' + payload.toPath,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: keyToInvalidate,
        exact: true,
      });
    },
  });

  return {
    moveAppFileMutate,
    isLoading,
  };
};
