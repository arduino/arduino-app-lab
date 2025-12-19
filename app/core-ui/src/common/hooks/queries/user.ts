import { showUserSettings } from '@cloud-editor-mono/domain';
import { GetSettings_Response } from '@cloud-editor-mono/infrastructure';
import { useQuery } from '@tanstack/react-query';

type UseShowUserSettings = (enabled: boolean) => {
  data?: GetSettings_Response;
  isLoading: boolean;
};

export const useShowUserSettings: UseShowUserSettings = function (
  enabled: boolean,
): ReturnType<UseShowUserSettings> {
  const { data, isLoading } = useQuery(
    ['show-user-settings'],
    showUserSettings,
    {
      enabled,
    },
  );

  return { data, isLoading };
};
