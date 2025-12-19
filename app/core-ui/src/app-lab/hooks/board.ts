import { isBoard } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { useQuery, UseQueryResult } from '@tanstack/react-query';

export const useIsBoard = (): UseQueryResult<boolean, unknown> => {
  return useQuery({
    queryKey: ['isBoard'],
    queryFn: isBoard,
    staleTime: Infinity,
    cacheTime: Infinity,
  });
};
