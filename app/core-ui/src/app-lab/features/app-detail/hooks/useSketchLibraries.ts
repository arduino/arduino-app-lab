import { assertNonNull } from '@cloud-editor-mono/common';
import {
  addAppSketchLibrary,
  deleteAppSketchLibrary,
  getAppSketchLibraries,
  getSketchLibraries,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  LibraryListResponse,
  ListLibrariesParams,
  SketchLibrary,
} from '@cloud-editor-mono/infrastructure';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

export interface UseSketchLibraries {
  libraries?: SketchLibrary[];
  librarySearchIsLoading: boolean;
  searchSketchLibraries: (query: ListLibrariesParams['query']) => void;
  appLibraries?: Array<{ id: string; version: string }>;
  appLibrariesById: Record<string, string>;
  appLibrariesAreLoading: boolean;
  installingLibraryId?: string;
  addSketchLibrary: (libRef: string) => void;
  addSketchLibraryError?: boolean;
  deletingLibraryId?: string;
  deleteSketchLibrary: (libRef: string) => Promise<void>;
}

interface UseSketchLibrariesParams {
  appId?: string;
}

export const useSketchLibraries = ({
  appId,
}: UseSketchLibrariesParams): UseSketchLibraries => {
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useState<
    ListLibrariesParams['query'] | null
  >(null);

  const { data, isLoading: librarySearchIsLoading } = useInfiniteQuery<
    LibraryListResponse,
    Error,
    LibraryListResponse,
    [string, ListLibrariesParams['query'] | null]
  >({
    queryKey: ['list-sketch-libraries', searchParams],
    queryFn: async ({ pageParam = 1, queryKey }) => {
      const [, query] = queryKey;
      // Pass both the core search params and the current page to your API
      return getSketchLibraries({
        query: {
          ...query,
          page: pageParam,
          limit: 50,
        },
      });
    },
    getNextPageParam: (response) => {
      const { page = 1, total_pages = 1 } = response.pagination || {};
      return page < total_pages ? +1 : undefined;
    },
    enabled: searchParams !== null,
    refetchOnWindowFocus: false,
  });

  const searchSketchLibraries = useCallback(
    (params: ListLibrariesParams['query']): void => {
      setSearchParams(params);
    },
    [],
  );

  const libraries = useMemo(
    () =>
      data?.pages.flatMap((page) =>
        page.libraries ? page.libraries.filter(Boolean) : [],
      ),
    [data?.pages],
  );

  const { data: appLibraries, isLoading: appLibrariesAreLoading } = useQuery(
    ['app-sketch-libraries', appId],
    async () => {
      if (appId) {
        const resp = await getAppSketchLibraries(appId);
        return resp.libraries.map((libRef) => {
          const [id, version] = libRef.split('@');
          return { id, version };
        });
      }
    },
    {
      refetchOnWindowFocus: false,
      enabled: !!appId,
    },
  );

  const appLibrariesById = useMemo(
    () =>
      (appLibraries || []).reduce((obj, { id, version }) => {
        return { ...obj, [id]: version };
      }, {} as Record<string, string>),
    [appLibraries],
  );

  const {
    mutate: addSketchLibrary,
    isError: addSketchLibraryError,
    isLoading: isAddingSketchLibrary,
    variables: libRef,
  } = useMutation({
    mutationFn: async (libRef: string): Promise<void> => {
      assertNonNull(appId);
      await addAppSketchLibrary(appId, libRef);
    },
    onSuccess: async () => {
      assertNonNull(appId);
      await queryClient.invalidateQueries(['app-sketch-libraries', appId]);
    },
  });

  const [deletingLibraryId, setDeletingLibraryId] = useState<
    string | undefined
  >(undefined);

  const deleteSketchLibrary = useCallback(
    async (libRef: string): Promise<void> => {
      assertNonNull(appId);
      const id = libRef.split('@')[0];
      setDeletingLibraryId(id);
      try {
        await deleteAppSketchLibrary(appId, libRef);
        await queryClient.invalidateQueries(['app-sketch-libraries', appId]);
      } finally {
        setDeletingLibraryId(undefined);
      }
    },
    [appId, queryClient],
  );

  return {
    libraries,
    librarySearchIsLoading,
    searchSketchLibraries,
    appLibraries,
    appLibrariesById,
    appLibrariesAreLoading,
    installingLibraryId:
      isAddingSketchLibrary && libRef ? libRef.split('@')[0] : undefined,
    addSketchLibrary,
    addSketchLibraryError,
    deletingLibraryId,
    deleteSketchLibrary,
  };
};
