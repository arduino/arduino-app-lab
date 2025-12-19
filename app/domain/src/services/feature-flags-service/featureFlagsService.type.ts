export interface FeatureFlagService {
  getFeatureFlags: () => Promise<string[]>;
  getFeatureFlagsSync: () => string[];
  isFFEnabled: (ff: string) => boolean;
}
