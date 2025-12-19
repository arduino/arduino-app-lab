import { Config, FileLineScope } from '@cloud-editor-mono/common';
import {
  associateSketchWithDevice,
  AssociateSketchWithDevicePayload,
  associateSketchWithLibraries,
  AssociateSketchWithLibrariesPayload,
  createSketch,
  createSketchFile,
  DEFAULT_SKETCH_NAME,
  deleteCustomLibrary,
  deleteSketch,
  deleteSketchFile,
  exportZipFolder,
  getCodeSubjects,
  GetSketchesResult,
  GetSketchResult,
  getUnsavedFilesSubjectNext,
  getUser,
  isHiddenFile,
  isPrivateResourceRequestWithOrgIdError,
  isUnauthorizedEventsNext,
  markSketchVisibility,
  MarkSketchVisibilityPayload,
  removeCodeSubject,
  removeCodeSubjectBySketchPath,
  renameSketch,
  retrieveCustomLibraries,
  retrieveCustomLibraryCode,
  RetrieveExampleFileContentsResult,
  retrieveFileContents,
  RetrieveFileContentsResult,
  retrieveFilesList,
  RetrieveFilesListResult,
  RetrieveLibraryFileContentsResult,
  retrieveSketch,
  saveCustomLibrary,
  saveSketchFile,
  setCodeSubjects,
  tokenNotRequired,
  updateSketchSecrets,
  uploadCustomLibrary,
} from '@cloud-editor-mono/domain';
import {
  CreateUser_Response,
  DeleteSketchFile_Response,
  FileChange_Params,
  GetFilesList_Response,
  GetLibrariesList_Response,
  GetLibrary_Response,
  GetLibraryCode_Response,
  GetSketch_Params,
  PostSketchFile_Response,
  SketchData,
  SketchSecrets,
} from '@cloud-editor-mono/infrastructure';
import {
  CustomLibraryExampleItem,
  SidenavItemId,
} from '@cloud-editor-mono/ui-components';
import { useNavigate } from '@tanstack/react-location';
import {
  QueryKey,
  UseMutateAsyncFunction,
  UseMutateFunction,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WretchError } from 'wretch/types';

import {
  CREATE_EXAMPLE_PARAM,
  CREATE_SKETCH_PARAM,
  CUSTOM_LIBRARY_ID_PARAM,
  EXAMPLE_ID_PARAM,
  LIBRARY_ID_PARAM,
  NAV_PARAM,
  SOURCE_LIBRARY_ID_PARAM,
} from '../../../routing/routing.type';
import { queryClient } from '../../providers/data-fetching/QueryProvider';
import {
  SaveSketchFileMutation,
  SketchDataBaseQueryKey,
  UseCreateSketchFromExisting,
} from './create.type';
import { refreshCustomLibraries } from './createUtils';
import { timeElapsedFromNowMs } from './utils/timestamps';

export type SketchDataQueryKey =
  | [SketchDataBaseQueryKey.GET_SKETCH_BY_ID_QUERY_KEY, string | undefined]
  | [SketchDataBaseQueryKey.CREATE_DEFAULT_KEY_QUERY_KEY]
  | [SketchDataBaseQueryKey.GET_SKETCHES_QUERY_KEY, string | undefined];

export const updateSketchDataMap = {
  [SketchDataBaseQueryKey.GET_SKETCH_BY_ID_QUERY_KEY]: (
    sketchData: GetSketchResult,
    newData: Partial<SketchData>,
  ): GetSketchResult => {
    return { ...sketchData, ...newData };
  },
  [SketchDataBaseQueryKey.CREATE_DEFAULT_KEY_QUERY_KEY]: (
    sketchData: GetSketchResult,
    newData: Partial<SketchData>,
  ): GetSketchResult => {
    return { ...sketchData, ...newData };
  },
  [SketchDataBaseQueryKey.GET_SKETCHES_QUERY_KEY]: (
    sketchesData: GetSketchesResult,
    sketchData: GetSketchResult,
    newData: Partial<SketchData>,
  ): GetSketchesResult => {
    return sketchesData.map((s) => {
      if (s.id === sketchData?.id) {
        return { ...sketchData, ...newData };
      }
      return s;
    });
  },
};

type UseRetrieveSketch = (
  enabled: boolean,
  sketchID?: string,
) => {
  data?: GetSketchResult | null;
  isError: boolean;
  isLoading: boolean;
};

export const useRetrieveSketch: UseRetrieveSketch = function (
  enabled,
  sketchID,
): ReturnType<UseRetrieveSketch> {
  const { data, isLoading, isError } = useQuery(
    [SketchDataBaseQueryKey.GET_SKETCH_BY_ID_QUERY_KEY, sketchID],
    () =>
      sketchID
        ? retrieveSketch(sketchID)
        : Promise.reject(
            'Tried to obtain a sketch by ID without providing a specific sketch ID',
          ),
    {
      refetchOnWindowFocus: false,
      enabled,
    },
  );

  return {
    data,
    isLoading,
    isError,
  };
};

type UseCreateSketch = () => {
  create: UseMutateFunction<
    GetSketchResult,
    unknown,
    string | undefined,
    unknown
  >;
  isLoading: boolean;
  createdSketch?: GetSketchResult;
};

export const useCreateSketch: UseCreateSketch =
  function (): ReturnType<UseCreateSketch> {
    const {
      data: createdSketch,
      isLoading,
      mutate: create,
    } = useMutation({
      mutationFn: createSketch,
    });

    return {
      create,
      isLoading,
      createdSketch,
    };
  };

type UseDeleteSketch = () => {
  deleteSketchMutate: UseMutateAsyncFunction<void, unknown, string, unknown>;
  isLoading: boolean;
};

export const useDeleteSketch: UseDeleteSketch =
  function (): ReturnType<UseDeleteSketch> {
    const { isLoading, mutateAsync: deleteSketchMutate } = useMutation({
      mutationFn: deleteSketch,
    });
    return {
      isLoading,
      deleteSketchMutate,
    };
  };

type UseRenameSketch = () => {
  renameSketchMutate: UseMutateAsyncFunction<
    void,
    unknown,
    { from: string; to: string },
    unknown
  >;
  isLoading: boolean;
};

export const useRenameSketch: UseRenameSketch =
  function (): ReturnType<UseRenameSketch> {
    const { isLoading, mutateAsync: renameSketchMutate } = useMutation({
      mutationFn: (content: { from: string; to: string }) => {
        return renameSketch(content.from, content.to);
      },
    });

    return {
      renameSketchMutate,
      isLoading,
    };
  };

export const useCreateSketchFromExisting: UseCreateSketchFromExisting =
  function (
    onSuccess?: (sketch: GetSketchResult) => void,
  ): ReturnType<UseCreateSketchFromExisting> {
    const navigate = useNavigate();

    const errorCount = useRef(0);

    const navigateToSketch = useCallback(
      (sketchID: string) => {
        const sketchUrl = `${
          Config.ROUTING_BASE_URL ? `/${Config.ROUTING_BASE_URL}` : ''
        }/${sketchID}`;

        if (!sketchID) return;

        navigate({
          to: sketchUrl,
          search: {
            [EXAMPLE_ID_PARAM]: undefined,
            [SOURCE_LIBRARY_ID_PARAM]: undefined,
            [CREATE_SKETCH_PARAM]: undefined,
            [CREATE_EXAMPLE_PARAM]: undefined,
            [CUSTOM_LIBRARY_ID_PARAM]: undefined,
          },
          replace: true,
        });
      },
      [navigate],
    );

    const {
      data: createdSketch,
      isLoading,
      mutate: create,
    } = useMutation({
      mutationFn: (content?: {
        sketchName?: string;
        sketchContent?: string;
        files?:
          | RetrieveFileContentsResult[]
          | RetrieveExampleFileContentsResult[];
      }) =>
        content
          ? createSketch(
              content.sketchName,
              content.sketchContent,
              undefined,
              content.files ?? [],
            )
          : Promise.reject('Content undefined'),

      onSuccess: async (sketch: GetSketchResult) => {
        onSuccess?.(sketch);

        navigateToSketch(sketch.id);
      },
      onError: (_, variables) => {
        errorCount.current = errorCount.current + 1;

        if (errorCount.current > 1) {
          // on multiple errors, remove the "create qs params" to avoid
          // repeated calls to the `create-api`
          navigate({
            search: {
              [CREATE_SKETCH_PARAM]: undefined,
              [CREATE_EXAMPLE_PARAM]: undefined,
            },
          });
          return;
        }

        // TODO make this more precise by checking the error cause,
        // ensuring it's actually a name conflict error
        create({
          ...variables,
          sketchName: `${
            variables?.sketchName || 'Existing_Sketch_Copy'
          }_${new Date().valueOf()}`,
        });
      },
    });

    return {
      create,
      isLoading,
      createdSketch,
    };
  };

type UseCreateDefaultSketch = (enabled: boolean) => {
  createdSketch?: GetSketchResult;
};

export const useCreateDefaultSketch: UseCreateDefaultSketch = function (
  enabled: boolean,
): ReturnType<UseCreateDefaultSketch> {
  const [name, setName] = useState<string>(DEFAULT_SKETCH_NAME);

  const errorCount = useRef(0);

  const { data: createdSketch } = useQuery(
    [SketchDataBaseQueryKey.CREATE_DEFAULT_KEY_QUERY_KEY, name],
    () => createSketch(name),
    {
      onError: () => {
        if (errorCount.current === 0) {
          setName(`${DEFAULT_SKETCH_NAME}_${new Date().valueOf()}`);
        }

        errorCount.current = errorCount.current + 1;
      },
      refetchOnWindowFocus: false,
      enabled,
    },
  );

  return {
    createdSketch,
  };
};

export function refreshSketch(): Promise<void> {
  return queryClient.invalidateQueries(
    [SketchDataBaseQueryKey.GET_SKETCH_BY_ID_QUERY_KEY],
    {},
  );
}

export function refreshFilesContents(filePaths: string[]): void {
  filePaths.forEach((path) => {
    queryClient.invalidateQueries(['get-file-content', path]);
    queryClient.invalidateQueries(['get-batch-file-content', path]);
  });
}

type UseRetrieveFileContents = (
  enabled: boolean,
  bypassOrgHeader: boolean,
  onError?: (error: unknown) => { errorIsManaged: boolean },
  path?: string,
  name?: string,
  scope?: FileLineScope,
) => {
  fileData?: RetrieveFileContentsResult;
};

export const useRetrieveFileContents: UseRetrieveFileContents = function (
  enabled: boolean,
  bypassOrgHeader: boolean,
  onError,
  path?: string,
  name?: string,
  scope?: FileLineScope,
): ReturnType<UseRetrieveFileContents> {
  const { data: fileData } = useQuery(
    ['get-file-content', path, scope, String(bypassOrgHeader)],
    () => {
      return path && name
        ? retrieveFileContents(path, name, bypassOrgHeader, scope)
        : Promise.reject(
            new Error('Tried to get file without path or sketch name'),
          );
    },
    {
      onSuccess: (data: RetrieveFileContentsResult) => {
        setCodeSubjects(data);
        getUnsavedFilesSubjectNext(data.path, false);
      },
      onError: (error) => {
        if (!tokenNotRequired) return;

        // if we happen to get a 401 error when `tokenNotRequired`, we need to redirect to
        // login
        if (error && ((error as Error).cause as WretchError).status === 401) {
          const result = onError?.(error);
          if (result?.errorIsManaged) return;

          isUnauthorizedEventsNext(true);
        }
      },
      refetchOnWindowFocus: false,
      enabled,
    },
  );

  return {
    fileData,
  };
};

type File = {
  path: string;
  name: string;
  type: 'file' | 'sketch' | 'folder';
  contents?: RetrieveFileContentsResult;
};

async function retrieveFiles(
  file: File,
  bypassOrgHeader: boolean,
  scope?: FileLineScope,
  scopedFilePath?: string,
  areLibraryFiles?: boolean,
): Promise<File[]> {
  if (file.type === 'file') {
    return [
      {
        ...file,
        contents: await retrieveFileContents(
          file.path,
          file.name,
          bypassOrgHeader,
          scopedFilePath === file.path ? scope : undefined,
          areLibraryFiles,
        ),
      },
    ];
  } else if (file.type === 'folder' || file.type === 'sketch') {
    const children = await retrieveFilesList(file.path, bypassOrgHeader);

    const filesArrays = await Promise.all(
      children
        .filter((file) => !isHiddenFile(file))
        .map((child) => retrieveFiles(child, bypassOrgHeader)),
    );

    return [file, ...filesArrays.flat()];
  } else {
    return [];
  }
}

export interface BatchFile {
  path: string;
  name: string;
  type: 'file' | 'sketch' | 'folder';
}

type UseRetrieveBatchFileContents = <T extends BatchFile>(
  enabled: boolean,
  bypassOrgHeader: boolean,
  filesListKey: QueryKey,
  onError?: (error: unknown) => { errorIsManaged: boolean },
  mainInoFilePath?: string,
  files?: T[],
  basePath?: string,
  usePathNames?: boolean,
  scope?: FileLineScope,
  scopedFilePath?: string,
  areLibraryFiles?: boolean,
) => {
  filesContents?: RetrieveFileContentsResult[];
  fileIsDeleting: boolean;
  refreshFileContents: (filePaths: string[]) => void;
  deleteSketchFile: (path?: string) => Promise<DeleteSketchFile_Response>;
  renameSketchFile: (from?: string, to?: string) => Promise<void>;
  addSketchFile: (
    fileId: string,
    fileName: string,
    fileExtension: string,
  ) => Promise<PostSketchFile_Response>;
  mainInoIsRenaming: boolean;
  isLoading: boolean;
  allContentsRetrieved: boolean;
};

export const GET_BATCH_FILE_CONTENT_QUERY_KEY = 'get-batch-file-content';

export const useRetrieveBatchFileContents: UseRetrieveBatchFileContents =
  function (
    enabled,
    bypassOrgHeader,
    filesListKey: QueryKey,
    onError,
    mainInoFilePath?: string,
    files?,
    basePath?,
    usePathNames = false,
    scope?,
    scopedFilePath?,
    areLibraryFiles = false,
  ): ReturnType<UseRetrieveBatchFileContents> {
    const [filesContents, setFilesContents] = useState<{
      items: RetrieveFileContentsResult[];
      fetchCount: number;
      fetchComplete: boolean;
    }>({ items: [], fetchCount: 0, fetchComplete: false });

    useEffect(() => {
      setFilesContents({ items: [], fetchCount: 0, fetchComplete: false });
    }, [mainInoFilePath, filesListKey]);

    useEffect(() => {
      const _files = files || [];
      setFilesContents((prev) => {
        const items = prev.items.filter((fc) => {
          const isInFiles = _files.map((f) => f.path).includes(fc.path);

          if (!isInFiles && [...getCodeSubjects().keys()].includes(fc.path)) {
            removeCodeSubject(fc.path);
          }

          return isInFiles;
        });

        return { ...prev, ...items };
      });
    }, [files]);

    const [isMainInoRenaming, setIsMainInoRenaming] = useState(false);

    const { renameSketchFileMutate, isLoading: sketchIsRenaming } =
      useRenameSketchFile(filesListKey);
    const { createSketchFileMutate } = useCreateSketchFile(
      enabled,
      filesListKey,
    );

    const { deleteSketchFileQuery, isDeleting } =
      useDeleteSketchFile(filesListKey);

    const results = useQueries({
      queries: (files ?? []).map((file) => ({
        queryKey:
          scopedFilePath === file.path
            ? [
                GET_BATCH_FILE_CONTENT_QUERY_KEY,
                file.path,
                scope,
                String(bypassOrgHeader),
              ]
            : [
                GET_BATCH_FILE_CONTENT_QUERY_KEY,
                file.path,
                String(bypassOrgHeader),
              ],
        queryFn: () =>
          retrieveFiles(
            file,
            bypassOrgHeader,
            scope,
            scopedFilePath,
            areLibraryFiles,
          ),
        onSuccess: (result: File[]): void => {
          const newContentsMap = new Map<string, RetrieveFileContentsResult>();

          for (const file of result) {
            if (!file.contents) continue;
            if (file.type === 'file') {
              let contents: RetrieveFileContentsResult;
              if (usePathNames) {
                const fullName = file.contents?.path.replace(
                  (basePath ?? '') + '/',
                  '',
                );
                contents = {
                  ...file.contents,
                  name: file.contents?.extension
                    ? fullName.replace(`.${file.contents.extension}`, '')
                    : fullName,
                  fullName,
                };
              } else {
                contents = file.contents;
              }

              newContentsMap.set(file.path, contents);
              setCodeSubjects(contents);
            }
          }

          setFilesContents((prev) => {
            const items = prev.items
              .filter((f) => !newContentsMap.has(f.path))
              .concat(Array.from(newContentsMap.values()));

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
        onError,
        refetchOnWindowFocus: false,
        enabled,
      })),
    });

    const refreshFileContents = (paths?: string[]): void => {
      const queries = paths
        ? paths.map((path) => [GET_BATCH_FILE_CONTENT_QUERY_KEY, path])
        : [GET_BATCH_FILE_CONTENT_QUERY_KEY];
      queryClient.invalidateQueries(queries);
    };

    const renameSketchFile = useCallback(
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
        setIsMainInoRenaming(prevName === mainInoFilePath);
        try {
          await renameSketchFileMutate({ from: prevName, to: newName });
        } catch (error) {
          renameFile(newName, prevName);
          throw error;
        }
      },
      [mainInoFilePath, renameSketchFileMutate],
    );

    const addSketchFile = useCallback(
      async (
        fileId: string,
        fileName: string,
        fileExtension: string,
        code?: string,
      ) => {
        const newFile: RetrieveFileContentsResult = {
          fullName: `${fileName}.${fileExtension}`,
          name: fileName,
          data: '',
          path: fileId,
          href: '',
          content: '',
          extension: fileExtension ?? '',
          mimetype: '',
        };
        setFilesContents((prev) => ({
          ...prev,
          items: prev.items.concat(newFile),
        }));
        try {
          return await createSketchFileMutate({
            filePath: { path: fileId },
            extension: fileExtension,
            code,
          });
        } catch (error) {
          setFilesContents((prev) => ({
            ...prev,
            items: prev.items.filter((f) => f.path !== fileId),
          }));
          throw error;
        }
      },
      [createSketchFileMutate],
    );

    const deleteSketchFile = useCallback(
      async (path?: string | undefined) => {
        const fileIndex = filesContents.items.findIndex((f) => f.path === path);
        const file = filesContents.items[fileIndex];
        setFilesContents((prev) => ({
          ...prev,
          items: prev.items.filter((item) => item.path !== path),
        }));
        try {
          return await deleteSketchFileQuery(path);
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
      [deleteSketchFileQuery, filesContents],
    );

    return {
      filesContents:
        filesContents.items.length > 0 ? filesContents.items : undefined,
      refreshFileContents,
      deleteSketchFile,
      fileIsDeleting: isDeleting,
      renameSketchFile,
      addSketchFile,
      mainInoIsRenaming: sketchIsRenaming && isMainInoRenaming,
      isLoading:
        filesContents.items.length > 0
          ? results.some((result) => result.isLoading)
          : true,
      allContentsRetrieved: filesContents.fetchComplete,
    };
  };

type UseRetrieveFilesList = (
  queryKey: QueryKey,
  enabled: boolean,
  bypassOrgHeader: boolean,
  onError?: (error: unknown) => void,
  path?: string,
  isLibrary?: boolean,
) => {
  filesList?: RetrieveFilesListResult;
  getFilesIsLoading: boolean;
  getFilesIsError: boolean;
  refetch: () => void;
  invalidateFilesList: () => void;
};

export const useRetrieveFilesList: UseRetrieveFilesList = function (
  queryKey,
  enabled,
  bypassOrgHeader,
  onError,
  path,
  isLibrary = false,
): ReturnType<UseRetrieveFilesList> {
  const queryClient = useQueryClient();

  const {
    data: filesList,
    isLoading: getFilesIsLoading,
    isError: getFilesIsError,
    refetch,
  } = useQuery(
    queryKey,
    () =>
      path
        ? retrieveFilesList(path, bypassOrgHeader, isLibrary)
        : Promise.reject(
            new Error(
              'Tried to obtain sketch files without providing a valid sketch path',
            ),
          ),
    {
      onError,
      refetchOnWindowFocus: false,
      enabled,
    },
  );

  const invalidateFilesList = useCallback(() => {
    queryClient.invalidateQueries(queryKey);
  }, [queryKey, queryClient]);

  return {
    filesList,
    getFilesIsLoading,
    getFilesIsError,
    refetch,
    invalidateFilesList,
  };
};

type UseSaveSketchFile = (userWasAuthenticated: boolean) => {
  saveSketchFileQuery: SaveSketchFileMutation;
};

export const useSaveSketchFile: UseSaveSketchFile = function (
  enabled: boolean,
): ReturnType<UseSaveSketchFile> {
  const { mutateAsync: saveSketchFileQuery } = useMutation({
    mutationFn: (content?: {
      code?: string;
      fileId?: string;
      hash?: string;
    }) => {
      return enabled &&
        typeof content !== 'undefined' &&
        typeof content.code !== 'undefined' &&
        typeof content.fileId !== 'undefined'
        ? saveSketchFile({ path: content.fileId }, content.code, content.hash)
        : Promise.reject(
            new Error(
              'Tried to save sketch without auth, path, sketch name, hash,  or content',
            ),
          );
    },
  });

  return {
    saveSketchFileQuery,
  };
};

type UseDeleteSketchFile = (keyToInvalidate: QueryKey) => {
  deleteSketchFileQuery: DeleteSketchFileMutation;
  isDeleting: boolean;
};

export type DeleteSketchFileMutation = UseMutateAsyncFunction<
  DeleteSketchFile_Response,
  unknown,
  string | undefined,
  unknown
>;

export const useDeleteSketchFile: UseDeleteSketchFile = function (
  keyToInvalidate: QueryKey,
): ReturnType<UseDeleteSketchFile> {
  const { mutateAsync: deleteSketchFileQuery, isLoading: isDeleting } =
    useMutation({
      mutationFn: (path?: string) => {
        return typeof path !== 'undefined'
          ? deleteSketchFile({ path })
          : Promise.reject(new Error('Tried to delete sketch without path'));
      },
      onSuccess: (_, path) => {
        if (path) removeCodeSubject(path);
        queryClient.invalidateQueries({
          queryKey: keyToInvalidate,
          exact: true,
        });
      },
    });

  return {
    deleteSketchFileQuery,
    isDeleting,
  };
};

type UseCreateSketchFile = (
  enabled: boolean,
  keyToInvalidate: QueryKey,
) => {
  createdSketchFile?: PostSketchFile_Response;
  isLoading: boolean;
  createSketchFileMutate: CreateSketchFileMutation;
};

export const useCreateSketchFile: UseCreateSketchFile = function (
  enabled: boolean,
  keyToInvalidate: QueryKey,
): ReturnType<UseCreateSketchFile> {
  const {
    data: createdSketchFile,
    isLoading,
    mutateAsync: createSketchFileMutate,
  } = useMutation({
    mutationFn: (content: {
      filePath: FileChange_Params;
      extension: string;
      code?: string;
    }) =>
      enabled
        ? createSketchFile(content.filePath, content.extension, content.code)
        : Promise.reject(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: keyToInvalidate,
        exact: true,
      });
    },
  });

  return {
    createdSketchFile,
    isLoading,
    createSketchFileMutate,
  };
};

export type CreateSketchFileMutation = UseMutateAsyncFunction<
  PostSketchFile_Response,
  unknown,
  { filePath: FileChange_Params; extension: string; code?: string },
  unknown
>;

type UseRenameSketchFile = (keyToInvalidate: QueryKey) => {
  renameSketchFileMutate: UseMutateAsyncFunction<
    void,
    unknown,
    { from?: string; to?: string },
    unknown
  >;
  isLoading: boolean;
};

export const useRenameSketchFile: UseRenameSketchFile = function (
  keyToInvalidate: QueryKey,
): ReturnType<UseRenameSketchFile> {
  const { mutateAsync: renameSketchFileMutate, isLoading } = useMutation({
    mutationFn: (content: { from?: string; to?: string }) => {
      return typeof content !== 'undefined' &&
        typeof content.from !== 'undefined' &&
        typeof content.to !== 'undefined'
        ? renameSketch(content.from, content.to)
        : Promise.reject(
            new Error('Tried to rename sketch without path or sketch name'),
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
    renameSketchFileMutate,
    isLoading,
  };
};

type UseUpdateSketchSecrets = () => {
  mutateSketchWithSecrets: UseMutateAsyncFunction<
    GetSketchResult,
    unknown,
    GetSketch_Params & { secrets?: SketchSecrets },
    unknown
  >;
  isLoading: boolean;
  isError: boolean;
};

export const useUpdateSketchSecrets: UseUpdateSketchSecrets =
  function (): ReturnType<UseUpdateSketchSecrets> {
    const {
      mutateAsync: mutateSketchWithSecrets,
      isLoading,
      isError,
    } = useMutation({
      mutationFn: updateSketchSecrets,
    });

    return {
      mutateSketchWithSecrets,
      isError,
      isLoading,
    };
  };

type UseAssociateSketchToDevice = () => {
  mutateSketchWithDevice: UseMutateAsyncFunction<
    GetSketchResult,
    unknown,
    GetSketch_Params & AssociateSketchWithDevicePayload,
    unknown
  >;
  isLoading: boolean;
};

export const useAssociateSketchToDevice: UseAssociateSketchToDevice =
  function (): ReturnType<UseAssociateSketchToDevice> {
    const { mutateAsync: mutateSketchWithDevice, isLoading } = useMutation({
      mutationFn: associateSketchWithDevice,
    });

    return {
      mutateSketchWithDevice,
      isLoading,
    };
  };

type UseMarkSketchVisibility = () => {
  mutateSketchVisibility: UseMutateAsyncFunction<
    GetSketchResult,
    unknown,
    GetSketch_Params & MarkSketchVisibilityPayload,
    unknown
  >;
  isLoading: boolean;
};

export const useMarkSketchVisibility: UseMarkSketchVisibility =
  function (): ReturnType<UseMarkSketchVisibility> {
    const { mutateAsync: mutateSketchVisibility, isLoading } = useMutation({
      mutationFn: markSketchVisibility,
    });

    return {
      mutateSketchVisibility,
      isLoading,
    };
  };

type UseAssociateSketchToLibraries = () => {
  mutateSketchWithLibraries: UseMutateAsyncFunction<
    GetSketchResult,
    unknown,
    GetSketch_Params & AssociateSketchWithLibrariesPayload,
    unknown
  >;
  isLoading: boolean;
};

export const useAssociateSketchToLibraries: UseAssociateSketchToLibraries =
  function (): ReturnType<UseAssociateSketchToLibraries> {
    const { mutateAsync: mutateSketchWithLibraries, isLoading } = useMutation({
      mutationFn: associateSketchWithLibraries,
    });

    return {
      mutateSketchWithLibraries,
      isLoading,
    };
  };

function getCustomLibCodeKey(path?: string): QueryKey {
  if (!path) throw new Error('Tried to get custom library code without path');
  return ['get-custom-library-code', path];
}

type UseGetCustomLibraries = (
  enabled: boolean,
  codeEnabled?: boolean,
) => {
  customLibraries?: GetLibrariesList_Response;
  customLibrariesAreLoading: boolean;
};

export const useGetCustomLibraries: UseGetCustomLibraries = function (
  enabled: boolean,
  codeEnabled = false,
): ReturnType<UseGetCustomLibraries> {
  const [customLibraries, setCustomLibraries] =
    useState<GetLibrariesList_Response>();

  const { data, isLoading: customLibrariesAreLoading } = useQuery(
    ['get-custom-libraries'],
    retrieveCustomLibraries,
    {
      refetchOnWindowFocus: false,
      enabled,
      staleTime: Infinity,
      onSuccess(data) {
        for (const customLibrary of data) {
          queryClient.invalidateQueries(
            getCustomLibCodeKey(customLibrary.path),
          );
        }
      },
    },
  );

  useQueries({
    queries: (customLibraries ?? []).map((customLibrary) => ({
      queryKey: getCustomLibCodeKey(customLibrary.path),
      queryFn: () => retrieveCustomLibraryCode({ id: customLibrary.id }),
      enabled: codeEnabled,
      staleTime: Infinity,
      onSuccess: ({ code }: GetLibraryCode_Response): void => {
        setCustomLibraries((prev) =>
          prev?.map((l) => (l.id === customLibrary.id ? { ...l, code } : l)),
        );
      },
      refetchOnWindowFocus: false,
    })),
  });

  useEffect(() => {
    setCustomLibraries(data);
  }, [data]);

  return {
    customLibraries,
    customLibrariesAreLoading,
  };
};

export function isCustomLibrary(
  data: GetLibrary_Response | null,
): data is GetLibrary_Response {
  return data ? !('version' in data) && !('downloadUrl' in data) : false;
}
type UseSaveCustomLibrary = (
  libraryName: string | undefined,
  enabled: boolean,
  sourceReleaseId?: string,
) => {
  saveLibraryQuery: UseMutateAsyncFunction<
    GetLibrary_Response | null,
    unknown,
    RetrieveLibraryFileContentsResult[],
    unknown
  >;
};

export const useSaveCustomLibrary: UseSaveCustomLibrary = function (
  libraryName: string | undefined,
  enabled: boolean,
  sourceReleaseId?: string,
): ReturnType<UseSaveCustomLibrary> {
  const navigate = useNavigate();

  const { mutateAsync: saveLibraryQuery } = useMutation({
    mutationFn(files: RetrieveLibraryFileContentsResult[]) {
      if (!enabled) return Promise.resolve(null);
      if (!libraryName)
        return Promise.reject('Tried to save library without library name');
      return saveCustomLibrary(libraryName, files, { sourceReleaseId });
    },
    onSuccess: (data) => {
      if (isCustomLibrary(data)) {
        navigate({
          search: {
            [LIBRARY_ID_PARAM]: data.id,
            [SOURCE_LIBRARY_ID_PARAM]: undefined,
            [NAV_PARAM]: SidenavItemId.Libraries,
          },
          replace: true,
        });
        refreshCustomLibraries();
      }
    },
  });

  return { saveLibraryQuery };
};

type UseDeleteCustomLibrary = () => {
  deleteCustomLibraryMutate: UseMutateAsyncFunction<
    void,
    unknown,
    string,
    unknown
  >;
  isLoading: boolean;
};

export const useDeleteCustomLibrary: UseDeleteCustomLibrary =
  function (): ReturnType<UseDeleteCustomLibrary> {
    const { isLoading, mutateAsync: deleteCustomLibraryMutate } = useMutation({
      mutationFn: deleteCustomLibrary,
    });
    return {
      isLoading,
      deleteCustomLibraryMutate,
    };
  };

type UseImportLibrary = () => {
  importLibraryQuery: UseMutateAsyncFunction<
    GetLibrary_Response,
    unknown,
    globalThis.File,
    unknown
  >;
  isLoading: boolean;
};

export const useImportLibrary: UseImportLibrary = () => {
  const { mutateAsync: importLibraryQuery, isLoading } = useMutation({
    mutationFn: uploadCustomLibrary,
    onSuccess: (data) => {
      if (isCustomLibrary(data)) {
        refreshCustomLibraries();
      }
    },
  });

  return {
    importLibraryQuery,
    isLoading,
  };
};

export async function downloadLibrary(id: string): Promise<void> {
  const library = (await retrieveCustomLibraries()).find((l) => l.id === id);
  if (!library) throw new Error('Library not found');

  let files;
  try {
    files = await retrieveFiles(
      {
        path: library.path as string,
        name: library.name as string,
        type: 'folder',
      },
      false,
    );
  } catch (error) {
    if (isPrivateResourceRequestWithOrgIdError(error)) {
      files = await retrieveFiles(
        {
          path: library.path as string,
          name: library.name as string,
          type: 'folder',
        },
        true,
      );
    }
  }

  if (!files) throw new Error('Failed to retrieve library files');

  const normalizedFiles = files.map((f) => ({
    ...f,
    path: f.path.replace(library.path as string, ''),
  }));

  exportZipFolder(
    library.name as string,
    normalizedFiles.map((f) => ({
      nameWithExt: f.path.replace(/\//, ''),
      base64Content: f.contents?.data,
      isDirectory: f.type === 'folder' || f.type === 'sketch',
    })),
    library.name,
  );
}
type UseGetFileHash = (
  enabled: boolean,
  refetchSketchFiles: () => void,
  onConcurrentEditingDetected: () => void,
  sketchPath?: string,
  selectedFilePath?: string,
  username?: string,
) => {
  isConcurrent: boolean;
};

const BANNER_PERSISTENCE = 120000; // 2 minutes

export const useGetFileHash: UseGetFileHash = function (
  enabled: boolean,
  refetchSketchFiles: () => void,
  onConcurrentEditingDetected: () => void,
  sketchPath?: string,
  selectedFilePath?: string,
  username?: string,
): ReturnType<UseGetFileHash> {
  const [concurrentEditing, setConcurrentEditing] = useState<boolean>(false);

  const managed404ErrorCount = useRef(0);
  const timeoutRef = useRef<number | undefined>(undefined);

  const setConcurrentEditingBannerTimeout = (): void => {
    // Clear the previous timeout if it exists
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set a new timeout to reset concurrentEditing to false after 10 seconds
    timeoutRef.current = window.setTimeout(() => {
      setConcurrentEditing(false);
    }, BANNER_PERSISTENCE);
  };

  useQuery(
    ['retrieve-files-hash-poll', sketchPath, username, selectedFilePath],
    () =>
      sketchPath
        ? retrieveFilesList(sketchPath, false)
        : Promise.reject('No sketch path while polling the file hash.'),
    {
      refetchOnWindowFocus: false,
      enabled,
      refetchInterval: 3000,
      refetchIntervalInBackground: true,
      onSuccess(data) {
        const fileListResponse = data?.filter((file) => !isHiddenFile(file));
        const fileListSubjects = getCodeSubjects();

        if (fileListSubjects.size === 0) return; //If no files to compare

        let isConcurrentEditing = false;
        for (const fileIndex of fileListResponse.keys()) {
          const file = fileListResponse[fileIndex];
          const fileSubjectValue = fileListSubjects.get(file.path)?.getValue();

          if (!fileSubjectValue) {
            continue;
          }

          // Check if the current subject hash is the one retrieve from the DB (The latest one)
          const isFileOutdated =
            !!fileSubjectValue.meta.hash &&
            !!file.revision?.hash &&
            fileSubjectValue.meta.hash !== file.revision?.hash;

          // If the file is outdated fires the query to update the data
          if (isFileOutdated) {
            queryClient.invalidateQueries(['get-file-content', file.path], {
              exact: false,
            });
            queryClient.invalidateQueries(
              ['get-batch-file-content', file.path],
              { exact: false },
            );
          }

          isConcurrentEditing =
            isFileOutdated ||
            (!!file.revision?.username &&
              username !== file.revision?.username &&
              !!file.modifiedAt &&
              timeElapsedFromNowMs(file.modifiedAt) < BANNER_PERSISTENCE);
          // ! The concurrent editing flag is visible for double the time,
          // ! after this is false the banner persists for 2 minutes
          // ! The persistence is not present if the component unmount L1475
          if (isConcurrentEditing) {
            break;
          }
        }

        const newFilesFromResponse = fileListResponse.filter(
          (file) => !fileListSubjects.has(file.path),
        );

        if (
          newFilesFromResponse.length ||
          fileListSubjects.size !== fileListResponse.length
        ) {
          isConcurrentEditing = true;
          refetchSketchFiles();
        }

        if (isConcurrentEditing) {
          setConcurrentEditing(true);
          onConcurrentEditingDetected();
          setConcurrentEditingBannerTimeout();
        }

        // Reset error count
        managed404ErrorCount.current = 0;
      },
      onError(err: Error) {
        if (!sketchPath) {
          throw new Error('Missing sketchPath');
        }

        // Refresh the sketch if the error is 404 and the 404 error count is 0
        type CustomCause = { path: string; status: number };
        if (
          (err.cause as CustomCause).path === sketchPath &&
          (err.cause as CustomCause).status === 404 &&
          managed404ErrorCount.current === 0
        ) {
          // increments count of "managed" errors to avoid this block re-executing
          // infinitely on a 404 error caused by a bad sketch id
          managed404ErrorCount.current = managed404ErrorCount.current + 1;

          setConcurrentEditing(true);
          setConcurrentEditingBannerTimeout();
          queryClient.invalidateQueries(
            [SketchDataBaseQueryKey.GET_SKETCH_BY_ID_QUERY_KEY],
            {
              exact: false,
            },
          );
          removeCodeSubjectBySketchPath(sketchPath);
        }
      },
    },
  );

  // Clear the timeout when the component is unmounted
  useEffect(() => {
    let timeout: number;
    if (timeoutRef.current) {
      timeout = timeoutRef.current;
    }

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  return {
    isConcurrent: concurrentEditing,
  };
};
type UseGetUser = (
  enabled: boolean,
  id?: string,
) => { data?: CreateUser_Response };

export const useGetUser: UseGetUser = function (
  enabled: boolean,
  id?: string,
): ReturnType<UseGetUser> {
  const { data } = useQuery(
    ['get-user', id],
    () => (id ? getUser({ id }) : Promise.reject()),
    {
      enabled,
    },
  );

  return { data };
};

export function getCustomLibraryExamplesByFolder(
  examples: GetFilesList_Response,
): CustomLibraryExampleItem[] {
  const examplesByFolder: CustomLibraryExampleItem[] = [];

  examples.forEach((example) => {
    const currentFolder: CustomLibraryExampleItem[] = examplesByFolder;

    if (example.type === 'folder') {
      currentFolder.push({
        name: example.name,
        path: example.path,
        examplesNumber: example.children ?? 0,
      });
    }

    if (example.type === 'sketch') {
      currentFolder.push({
        name: example.name,
        path: example.path,
        folder: example.name,
        ino: {
          path: `${example.path}/${example.name}.ino`,
          name: `${example.name}.ino`,
        },
        types: [],
      });
    }

    if (example.type === 'file' && example.name.split('.').pop() === 'ino') {
      const files = examples?.filter(
        (file) => file.type === 'file' && file.name !== example.name,
      );
      const path = example.path.slice(0, example.path.lastIndexOf('/'));

      currentFolder.push({
        name: example.name,
        path,
        folder: path.split('/').pop() ?? '',
        ino: {
          path: example.path,
          name: example.name,
        },
        types: [],
        files: files.length > 0 ? files : undefined,
      });
    }
  });

  return examplesByFolder;
}
