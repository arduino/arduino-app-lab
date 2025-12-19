import { FeatureFlagService } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';

import { GetFeatureFlags } from '../../wailsjs/go/app/App';

export const getFeatureFlags: FeatureFlagService['getFeatureFlags'] =
  function () {
    return GetFeatureFlags();
  };
