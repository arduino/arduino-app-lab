import { GetSketchesResult } from '@cloud-editor-mono/domain/src/services/services-by-app/shared';
import { QueryObserverResult, useQuery } from '@tanstack/react-query';

import { SketchDataBaseQueryKey } from './create.type';

type UseRetrieveSketches = (
  enabled: boolean,
  retrieveSketches: (search?: string) => Promise<GetSketchesResult>,
  sketchID?: string,
  cacheTime?: number,
  search?: string,
) => {
  sketchesData?: GetSketchesResult;
  getSketchesIsLoading: boolean;
  refetch: () => Promise<QueryObserverResult<GetSketchesResult, unknown>>;
};

export const useRetrieveSketches: UseRetrieveSketches = function (
  enabled: boolean,
  retrieveSketches: (search?: string) => Promise<GetSketchesResult>,
  queryKey?: string,
  cacheTime?: number,
  search?: string,
): ReturnType<UseRetrieveSketches> {
  const {
    data: sketchesData,
    isLoading: getSketchesIsLoading,
    refetch,
  } = useQuery(
    [SketchDataBaseQueryKey.GET_SKETCHES_QUERY_KEY, queryKey],
    () => retrieveSketches(search),
    {
      refetchOnWindowFocus: false,
      enabled,
      cacheTime,
    },
  );

  return {
    refetch,
    sketchesData,
    getSketchesIsLoading,
  };
};
