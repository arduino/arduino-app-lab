import {
  eventsOff,
  eventsOn,
  FlasherService,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { FlashEvent, OSImageRelease } from '@cloud-editor-mono/infrastructure';

import {
  CancelFlash as CancelFlashGo,
  Flash,
  GetAvailableFreeSpace,
  GetOSImageVersion,
  IsUserPartitionPreservationSupported,
  ListAvailableOSImages,
} from '../../wailsjs/go/app/App';
import {
  mapListAvailableOSImages,
  mapOSImageRelease,
} from './flasherService.mapper';

export const getAvailableFreeSpace: FlasherService['getAvailableFreeSpace'] =
  async function () {
    return GetAvailableFreeSpace();
  };

export const isUserPartitionPreservationSupported: FlasherService['isUserPartitionPreservationSupported'] =
  async function (targetImageVersion: string) {
    const currentImageVersion = await GetOSImageVersion();
    return IsUserPartitionPreservationSupported(
      currentImageVersion,
      targetImageVersion,
    );
  };

export const listAvailableOSImages: FlasherService['listAvailableOSImages'] =
  async function () {
    try {
      const result = await ListAvailableOSImages();
      return mapListAvailableOSImages(result);
    } catch (e) {
      console.error('Error fetching available os images:', e);
      return [];
    }
  };

export const boardNeedsOSUpdate: FlasherService['boardNeedsOSUpdate'] =
  async function () {
    const currentImageVersion = await GetOSImageVersion();
    const availableOSVersions = await listAvailableOSImages();

    if (availableOSVersions && availableOSVersions.length > 0) {
      const latest = availableOSVersions.find((v) => v.latest);
      if (latest && latest.version_label !== currentImageVersion) {
        return true;
      }
    }

    return false;
  };

export const cancelFlash: FlasherService['cancelFlash'] = function () {
  eventsOff('flash-progress');
  CancelFlashGo();
};

export const flash: FlasherService['flash'] = async function (
  image: OSImageRelease,
  preserveUserPartition: boolean,
  onFlashEvent: (event: FlashEvent) => void,
) {
  eventsOn('flash-progress', onFlashEvent);
  try {
    return await Flash(mapOSImageRelease(image), preserveUserPartition);
  } finally {
    eventsOff('flash-progress');
  }
};
