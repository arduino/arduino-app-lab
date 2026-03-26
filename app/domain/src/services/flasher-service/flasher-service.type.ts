export interface OSImageRelease {
  version_label?: string;
  id?: string;
  latest?: boolean;
}

export interface FlashEvent {
  step: 'downloading' | 'extracting' | 'flashing';
  log?: string;
  progress?: number;
  total?: number;
}

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
}
