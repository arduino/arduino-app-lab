import { BrowserService } from '@cloud-editor-mono/domain/src/services/browser-service';

import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';

export const openLinkExternal: BrowserService['openLinkExternal'] =
  async function (url: string) {
    try {
      BrowserOpenURL(url);
    } catch (error) {
      console.error('Error opening external link:', error);
      throw error;
    }
  };
