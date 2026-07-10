import { FlashEvent, OSImageRelease } from '@cloud-editor-mono/infrastructure';

export type FlasherLogic = () => {
  loading: boolean;
  succeeded: boolean | null;
  setFlashing: (value: boolean) => void;
  setSucceeded: (value: boolean | null) => void;
  close: () => void;
  listAvailableImages: () => Promise<OSImageRelease[]>;
  getAvailableFreeSpace: () => Promise<number>;
  getUserPartitionPreservationSupported: (id: string) => Promise<boolean>;
  flashBoard: (
    image: OSImageRelease,
    preserveUserPartition: boolean,
    onFlashEvent: (event: FlashEvent) => void,
  ) => Promise<void>;
  openArduinoSupport: () => void;
  clearBoardAsUsed: (serial: string) => Promise<void>;
  flashingBoard: {
    id: string;
    name: string;
    type: string;
    connectionType: 'USB' | 'Network' | 'Local';
    protocol: string;
    serial: string;
    address: string;
  };
};
