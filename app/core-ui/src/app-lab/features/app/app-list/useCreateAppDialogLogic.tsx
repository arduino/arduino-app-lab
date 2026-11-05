import { createApp } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { CreateAppRequest } from '@cloud-editor-mono/infrastructure';
import { CreateAppDialogLogic } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { BoardScopedQuery } from '../../../boardScopedQuery';
import { sendAppLabNotification } from '../../notifications';

export const useCreateAppDialogLogic = (
  createAppDialogOpen: boolean,
  setCreateAppDialogOpen: (open: boolean) => void,
): CreateAppDialogLogic => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { mutateAsync: handleCreateApp } = useMutation({
    mutationFn: async (request: CreateAppRequest): Promise<boolean> => {
      const result = await createApp(request);
      if (result) {
        navigate({
          to: `/my-apps/${result}`,
        });
      }
      return result !== undefined;
    },
    // The app lists, the agent's workspace picker among them, are read once and kept.
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [BoardScopedQuery.LIST_MY_APPS],
      });
    },
  });

  return () => ({
    open: createAppDialogOpen,
    confirmAction: handleCreateApp,
    onOpenChange: setCreateAppDialogOpen,
    sendNotification: sendAppLabNotification,
  });
};
