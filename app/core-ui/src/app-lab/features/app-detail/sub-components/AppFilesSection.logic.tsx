import {
  getBrickDetails,
  getFileContent,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  BrickCreateUpdateRequest,
  BrickInstance,
  BrickListItem,
} from '@cloud-editor-mono/infrastructure';
import {
  AddAppBrickDialogLogic,
  BrickDetailLogic,
  DeleteAppBrickDialogLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback, useState } from 'react';

interface UseAppFilesSectionLogicProps {
  appBricks: BrickInstance[] | undefined;
  bricks: BrickListItem[] | undefined;
  addAppBrick(brickId: string): Promise<boolean>;
  deleteAppBrick(brickId: string): Promise<boolean>;
  loadAppBrick(brickId: string): Promise<BrickInstance>;
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
  const {
    appBricks,
    bricks,
    addAppBrick,
    deleteAppBrick,
    loadAppBrick,
    updateAppBrick,
    openExternalLink,
  } = props;

  const [addAppBrickDialogOpen, setAddAppBrickDialogOpen] = useState(false);
  const [deleteAppBrickDialogOpen, setDeleteAppBrickDialogOpen] =
    useState(false);
  const [deletingAppBrick, setDeletingAppBrick] =
    useState<BrickInstance | null>(null);

  const useBrickDetailLogic = (): ReturnType<BrickDetailLogic> => ({
    showConfigure: false,
    loadBrickDetails: getBrickDetails,
    loadBrickInstance: loadAppBrick,
    loadFileContent: getFileContent,
    onOpenExternalLink: openExternalLink,
    updateBrickDetails: updateAppBrick,
  });

  const brickDetailLogic = useCallback(useBrickDetailLogic, [
    loadAppBrick,
    openExternalLink,
    updateAppBrick,
  ]);

  const useAddAppBrickDialogLogic = (): ReturnType<AddAppBrickDialogLogic> => {
    return {
      open: addAppBrickDialogOpen,
      appBricks: appBricks || [],
      bricks: bricks || [],
      onOpenChange: setAddAppBrickDialogOpen,
      brickDetailLogic,
      confirmAction: (brick: BrickListItem): Promise<boolean> => {
        if (!brick.id) return Promise.resolve(false);
        return addAppBrick(brick.id);
      },
    };
  };
  const addAppBrickDialogLogic = useCallback(useAddAppBrickDialogLogic, [
    addAppBrickDialogOpen,
    appBricks,
    bricks,
    brickDetailLogic,
    addAppBrick,
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
