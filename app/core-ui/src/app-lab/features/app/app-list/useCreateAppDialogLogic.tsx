import { createApp } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { CreateAppRequest } from '@cloud-editor-mono/infrastructure';
import { CreateAppDialogLogic } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { sendAppLabNotification } from '../../notifications';

export const useCreateAppDialogLogic = (
  createAppDialogOpen: boolean,
  setCreateAppDialogOpen: (open: boolean) => void,
): CreateAppDialogLogic => {
  const navigate = useNavigate({ from: '/my-apps' });

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
  });

  return () => ({
    open: createAppDialogOpen,
    confirmAction: handleCreateApp,
    onOpenChange: setCreateAppDialogOpen,
    sendNotification: sendAppLabNotification,
  });
};
