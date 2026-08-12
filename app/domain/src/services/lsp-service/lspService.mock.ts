import { LspService } from './lspService.type';

export const MockLspService: LspService = {
  async isLspEnabled(): Promise<boolean> {
    return true;
  },

  async initLspWorkspace(): Promise<void> {
    return;
  },

  async startLSP(): Promise<void> {
    return;
  },

  async stopAllLSP(): Promise<void> {
    return;
  },

  async sendLspMessage(): Promise<void> {
    return;
  },

  async getLspTempWorkspaceAppDir(): Promise<string> {
    return '';
  },

  async getLspWorkspaceFile(): Promise<string> {
    return '';
  },
};
