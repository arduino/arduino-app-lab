import { FileOpenerService } from '@cloud-editor-mono/domain/src/services/file-opener-service';

import { OpenFile } from '../../wailsjs/go/app/App';

export const openFileExternal: FileOpenerService['openFileExternal'] =
  async function (path: string) {
    try {
      await OpenFile(path);
    } catch (error) {
      console.error('Error opening sketch file:', error);
      throw error;
    }
  };
