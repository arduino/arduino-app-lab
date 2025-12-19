import { FileOpenerService } from './file-opener-service.type';

export let openFileExternal: (path: string) => Promise<void>;

export const setFileOpenerService = (service: FileOpenerService): void => {
  openFileExternal = service.openFileExternal;
};
