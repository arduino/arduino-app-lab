import {
  FlashEvent,
  OSImageRelease,
} from '@cloud-editor-mono/domain/src/services/flasher-service';

export type UseFlasherLogic = (
  selectBoard: (boardId: string) => Promise<void>,
) => {
  loading: boolean;
  succeeded: boolean | null;
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
