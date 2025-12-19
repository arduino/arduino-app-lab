import { SidenavItemId } from '@cloud-editor-mono/ui-components';
import { useNavigate, useSearch } from '@tanstack/react-location';
import { useMutation, useQuery } from '@tanstack/react-query';
import { get, set } from 'idb-keyval';

import { queryClient } from '../../../../common/providers/data-fetching/QueryProvider';
import { NAV_PARAM, SearchGenerics } from '../../../../routing/routing.type';

const GEN_AI_BANNER_KEY = 'arduino:gen-ai-banner';

type UseGenAiBanner = () => {
  dismissGenAiBanner: (tryGenAi?: boolean) => void;
  isGenAiBannerDismissed: boolean;
};

export const useGenAiBanner = (): ReturnType<UseGenAiBanner> => {
  const navigate = useNavigate();
  const search = useSearch<SearchGenerics>();

  const { mutate: dismissGenAiBanner } = useMutation({
    mutationFn: (tryGenAi?: boolean) => {
      if (tryGenAi) {
        navigate({ search: { ...search, [NAV_PARAM]: SidenavItemId.GenAI } });
      }
      return set(GEN_AI_BANNER_KEY, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries([GEN_AI_BANNER_KEY]);
    },
  });

  const { data: genAiBannerDismissValue, isLoading } = useQuery(
    [GEN_AI_BANNER_KEY],
    async () => {
      const data = await get(GEN_AI_BANNER_KEY);
      return data ?? null;
    },

    { refetchOnWindowFocus: false },
  );

  return {
    dismissGenAiBanner,
    isGenAiBannerDismissed: isLoading ? true : genAiBannerDismissValue ?? false,
  };
};
