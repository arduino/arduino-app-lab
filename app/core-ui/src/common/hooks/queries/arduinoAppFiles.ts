import {
  createAppFile,
  createAppFolder,
  getAppFileContent,
  getCodeSubjects,
  getUnsavedFilesSubjectNext,
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
        refetchOnWindowFocus: false,
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
) => {
  filesContents?: FileWithContent[];
  fileIsDeleting: boolean;
  refreshFileContents: (filePaths: string[]) => void;
  deleteAppFile: (path?: string) => Promise<void>;
  renameAppFile: (from?: string, to?: string) => Promise<void>;
  addAppFile: (
    fileId: string,
    fileName: string,
    fileExtension: string,
  ) => Promise<void>;
  createAppFolder: (path: string) => Promise<void>;
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
        refetchOnWindowFocus: false,
        enabled,
        staleTime: 0,
        cacheTime: 0,
      })),
    });

    const refreshAppFileContents = (paths?: string[]): void => {
      const queries = paths
        ? paths.map((path) => [GET_BATCH_FILE_CONTENT_QUERY_KEY, path])
        : [GET_BATCH_FILE_CONTENT_QUERY_KEY];
      queryClient.invalidateQueries(queries);
    };

    const renameAppFile = useCallback(
      async (prevName?: string, newName?: string): Promise<void> => {
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

        renameFile(prevName, newName);
        try {
          await renameAppFileMutate({ from: prevName, to: newName });
        } catch (error) {
          renameFile(newName, prevName);
          throw error;
        }
      },
      [renameAppFileMutate],
    );

    const addAppFile = useCallback(
      async (
        fileId: string,
        fileName: string,
        fileExtension: string,
        content?: string,
      ) => {
        const newFile: FileWithContent = {
          id: fileId,
          fullName: `${fileName}.${fileExtension}`,
          name: fileName,
          content: '',
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
          if (err.cause !== 404) {
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

    return {
      filesContents:
        filesContents.items.length > 0 ? filesContents.items : undefined,
      refreshFileContents: refreshAppFileContents,
      deleteAppFile,
      fileIsDeleting: isDeleting,
      renameAppFile: renameAppFile,
      createAppFolder: createAppFolderMutate,
      addAppFile,
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
          console.error(`Error removing code subject for path ${path}:`, error);
        }
      }
      queryClient.invalidateQueries({
        queryKey: keyToInvalidate,
        exact: true,
      });
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
    { from?: string; to?: string },
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
    mutationFn: (content: { from?: string; to?: string }) => {
      return content.from !== undefined && content.to !== undefined
        ? renameAppFile(
            appPath + '/' + content.from,
            appPath + '/' + content.to,
          )
        : Promise.reject(
            new Error('Tried to rename app file without from/to paths'),
          );
    },
    onSuccess: (_, variables) => {
      if (variables.from) removeCodeSubject(variables.from);
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
