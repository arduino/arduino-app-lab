import {
  importAppFromPath,
  selectAppPathToImport,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { ImportResourceLogic } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { queryClient } from '../../../../common/providers/data-fetching/QueryProvider';
import { BoardScopedQuery } from '../../../boardScopedQuery';
import { useImportResource } from '../../../hooks/useImportResource';

export const useImportAppDialogLogic = (
  importAppDialogOpen: boolean,
  setImportAppDialogOpen: (open: boolean) => void,
  setImportedAppId: (id: string | undefined) => void,
): ImportResourceLogic =>
  useImportResource({
    importResourceDialogOpen: importAppDialogOpen,
    setImportResourceDialogOpen: setImportAppDialogOpen,
    setImportedResourceId: setImportedAppId,
    selectResourcePath: selectAppPathToImport,
    importResourceFromPath: (filePath: string) => importAppFromPath(filePath),
    type: 'app',
    invalidateQueries: () => {
      queryClient.invalidateQueries([BoardScopedQuery.LIST_MY_APPS]);
    },
  });
