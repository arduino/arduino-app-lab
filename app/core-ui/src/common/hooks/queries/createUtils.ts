import { queryClient } from '../../providers/data-fetching/QueryProvider';

export function refreshCustomLibraries(): void {
  queryClient.invalidateQueries(['get-custom-libraries']);
}
