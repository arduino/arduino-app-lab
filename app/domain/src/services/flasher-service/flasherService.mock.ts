import { OSImageRelease } from '@cloud-editor-mono/infrastructure';

import { FlasherService } from './flasher-service.type';

const mockOSVersions: OSImageRelease[] = [
  {
    id: '1.1.0',
    version_label: 'Version 1.1.0',
    latest: true,
  },
  {
    id: '1.0.0',
    version_label: 'Version 1.0.0',
    latest: false,
  },
];

export const mockGetOSVersions = (): OSImageRelease[] => {
  // Not implemented yet, just return an empty array
  return [...mockOSVersions];
};

export const mockFlasherService: FlasherService = {
  boardNeedsOSUpdate: async () => false,
  getAvailableFreeSpace: async () => 10000000000,
  isUserPartitionPreservationSupported: async () => true,
  listAvailableOSImages: async () => mockGetOSVersions(),
  flash: async () => {},
  cancelFlash: () => {},
};
