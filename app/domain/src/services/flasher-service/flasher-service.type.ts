import { FlashEvent, OSImageRelease } from '@cloud-editor-mono/infrastructure';

export interface FlasherService {
  boardNeedsOSUpdate: () => Promise<boolean>;
  getAvailableFreeSpace(): Promise<number>;
  isUserPartitionPreservationSupported(
    targetImageVersion: string,
  ): Promise<boolean>;
  listAvailableOSImages(): Promise<OSImageRelease[]>;
  flash(
    image: OSImageRelease,
    preserveUserPartition: boolean,
    onFlashEvent: (event: FlashEvent) => void,
  ): Promise<void>;
  cancelFlash: () => void;
}
