import { FlasherService } from './flasher-service.type';

export let boardNeedsOSUpdate: FlasherService['boardNeedsOSUpdate'] =
  async function () {
    throw new Error('boardNeedsOSUpdate service not implemented');
  };

export let getAvailableFreeSpace: FlasherService['getAvailableFreeSpace'] =
  function () {
    throw new Error('getAvailableFreeSpace service not implemented');
  };

export let isUserPartitionPreservationSupported: FlasherService['isUserPartitionPreservationSupported'] =
  async function () {
    throw new Error(
      'isUserPartitionPreservationSupported service not implemented',
    );
  };

export let listAvailableOSImages: FlasherService['listAvailableOSImages'] =
  async function () {
    throw new Error('listAvailableOSImages service not implemented');
  };

export let flash: FlasherService['flash'] = async function () {
  throw new Error('flash service not implemented');
};

export const setFlasherService = (service: FlasherService): void => {
  boardNeedsOSUpdate = service.boardNeedsOSUpdate;
  getAvailableFreeSpace = service.getAvailableFreeSpace;
  isUserPartitionPreservationSupported =
    service.isUserPartitionPreservationSupported;
  listAvailableOSImages = service.listAvailableOSImages;
  flash = service.flash;
};
