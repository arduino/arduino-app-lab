import { FeatureFlagService } from './featureFlagsService.type';

export let getFeatureFlags: FeatureFlagService['getFeatureFlags'] =
  function () {
    throw new Error('getFeatureFlags service not implemented');
  };

const flags: string[] = [];

export const setFeatureFlagService = (
  service: Omit<FeatureFlagService, 'getFeatureFlagsSync' | 'isFFEnabled'>,
): void => {
  getFeatureFlags = service.getFeatureFlags;
  // init();
  getFeatureFlags().then((fetchedFlags) => {
    fetchedFlags.forEach((flag) => {
      flags.push(flag);
    });
  });
};

export const getFeatureFlagsSync: FeatureFlagService['getFeatureFlagsSync'] =
  function () {
    return flags;
  };

export const isFFEnabled: FeatureFlagService['isFFEnabled'] = function (ff) {
  return flags.includes(ff);
};
