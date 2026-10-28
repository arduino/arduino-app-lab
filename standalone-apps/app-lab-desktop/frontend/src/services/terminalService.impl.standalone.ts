import { TerminalService } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';

import {
  GetTerminalPreference,
  ListTerminals,
  SetTerminalPreference,
} from '../../wailsjs/go/app/App';

export const listTerminals: TerminalService['listTerminals'] =
  async function () {
    try {
      return await ListTerminals();
    } catch (e) {
      console.error('Error listing the available terminals:', e);
      return { supported: false, terminals: [] };
    }
  };

export const getTerminalPreference: TerminalService['getTerminalPreference'] =
  async function () {
    try {
      return await GetTerminalPreference();
    } catch (e) {
      console.error('Error getting the terminal preference:', e);
      return '';
    }
  };

export const setTerminalPreference: TerminalService['setTerminalPreference'] =
  async function (value: string) {
    try {
      await SetTerminalPreference(value);
    } catch (e) {
      throw new Error(`${e}`);
    }
  };
