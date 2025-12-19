import { OnboardingLogic } from '@cloud-editor-mono/ui-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import { get, set } from 'idb-keyval';

import { queryClient } from '../../../../common/providers/data-fetching/QueryProvider';
import { useSketchParams } from './sketch';

const ONBOARDING_KEY = 'arduino:onboarding';

type UseOnboardingFlag = () => {
  setOnboardingDone: ReturnType<OnboardingLogic>['setOnboardingDone'];
  onboardingDone: ReturnType<OnboardingLogic>['onboardingDone'];
};

export const useOnboardingFlag: UseOnboardingFlag =
  function (): ReturnType<UseOnboardingFlag> {
    const { viewMode } = useSketchParams();

    const { mutate: setOnboardingDone } = useMutation({
      mutationFn: (status: boolean) => set(ONBOARDING_KEY, status),
      onSuccess: () => {
        queryClient.invalidateQueries([ONBOARDING_KEY]);
      },
    });

    const { data: onboardingDone, isLoading } = useQuery(
      [ONBOARDING_KEY],
      async () => {
        const data = await get(ONBOARDING_KEY);
        return data ?? null;
      },
      { refetchOnWindowFocus: false },
    );

    return {
      setOnboardingDone,
      onboardingDone: isLoading || !!viewMode ? true : onboardingDone ?? false,
    };
  };
