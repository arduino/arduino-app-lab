import { TerminalService } from './terminal-service.type';

export let listTerminals: TerminalService['listTerminals'] = async function () {
  throw new Error('listTerminals service not implemented');
};

export let getTerminalPreference: TerminalService['getTerminalPreference'] =
  async function () {
    throw new Error('getTerminalPreference service not implemented');
  };

export let setTerminalPreference: TerminalService['setTerminalPreference'] =
  async function (_value: string) {
    throw new Error('setTerminalPreference service not implemented');
  };

export const setTerminalService = (service: TerminalService): void => {
  listTerminals = service.listTerminals;
  getTerminalPreference = service.getTerminalPreference;
  setTerminalPreference = service.setTerminalPreference;
};
