import { getBrickDetails } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  BrickCreateUpdateRequest,
  BrickInstance,
  BrickListItem,
} from '@cloud-editor-mono/infrastructure';
import {
  AddAppBrickDialogLogic,
  DeleteAppBrickDialogLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback, useMemo, useState } from 'react';

import {
  makeAppBrickDetailLogic,
  useConfigureAppBrickDialog,
} from '../../../../hooks/useBrickDetail';

interface UseAppFilesSectionLogicProps {
  appId: string;
  appBricks: BrickInstance[] | undefined;
  bricks: BrickListItem[] | undefined;
  addAppBrick(
    brickId: string,
    params?: BrickCreateUpdateRequest,
  ): Promise<boolean>;
  deleteAppBrick(brickId: string): Promise<boolean>;
  updateAppBrick(
    brickId: string,
    params: BrickCreateUpdateRequest,
  ): Promise<boolean>;
  openExternalLink: (url: string) => void;
}

interface UseAppFilesSectionLogicReturn {
  addAppBrickDialogLogic: AddAppBrickDialogLogic;
  openAddAppBrickDialog: () => void;
  deleteAppBrickDialogLogic: DeleteAppBrickDialogLogic;
  openDeleteAppBrickDialog: (brick: BrickInstance) => void;
}

export const useAppFilesSectionLogic = function (
  props: UseAppFilesSectionLogicProps,
): UseAppFilesSectionLogicReturn {
  const { appId, appBricks, bricks, addAppBrick, deleteAppBrick } = props;

  const [addAppBrickDialogOpen, setAddAppBrickDialogOpen] = useState(false);
  const [deleteAppBrickDialogOpen, setDeleteAppBrickDialogOpen] =
    useState(false);
  const [deletingAppBrick, setDeletingAppBrick] =
    useState<BrickInstance | null>(null);

  const configureAppBrickDialogLogic = useCallback(
    useConfigureAppBrickDialog,
    [],
  );

  const brickDetailLogic = useMemo(
    () => makeAppBrickDetailLogic(appId),
    [appId],
  );

  const useAddAppBrickDialogLogic = (): ReturnType<AddAppBrickDialogLogic> => {
    return {
      open: addAppBrickDialogOpen,
      appId,
      appBricks: appBricks || [],
      bricks: bricks || [],
      onOpenChange: setAddAppBrickDialogOpen,
      brickDetailLogic,
      configureDialogLogic: configureAppBrickDialogLogic,
      loadBrickDetails: getBrickDetails,
      confirmAction: (brickId: string, modelId?: string): Promise<boolean> => {
        return addAppBrick(brickId, modelId ? { model: modelId } : undefined);
      },
    };
  };
  const addAppBrickDialogLogic = useCallback(useAddAppBrickDialogLogic, [
    addAppBrick,
    addAppBrickDialogOpen,
    appBricks,
    appId,
    brickDetailLogic,
    bricks,
    configureAppBrickDialogLogic,
  ]);

  const openAddAppBrickDialog = useCallback(() => {
    setAddAppBrickDialogOpen(true);
  }, []);

  const useDeleteAppBrickDialogLogic =
    (): ReturnType<DeleteAppBrickDialogLogic> => {
      return {
        brick: deletingAppBrick,
        open: deleteAppBrickDialogOpen,
        onOpenChange: setDeleteAppBrickDialogOpen,
        confirmAction: (brickId): Promise<boolean> => {
          if (!deleteAppBrickDialogOpen) return Promise.resolve(false);
          return deleteAppBrick(brickId);
        },
      };
    };

  const deleteAppBrickDialogLogic = useCallback(useDeleteAppBrickDialogLogic, [
    deletingAppBrick,
    deleteAppBrickDialogOpen,
    setDeleteAppBrickDialogOpen,
    deleteAppBrick,
  ]);

  const openDeleteAppBrickDialog = useCallback((brick: BrickInstance) => {
    setDeletingAppBrick(brick);
    setDeleteAppBrickDialogOpen(true);
  }, []);

  return {
    addAppBrickDialogLogic,
    openAddAppBrickDialog,
    deleteAppBrickDialogLogic,
    openDeleteAppBrickDialog,
  };
};
