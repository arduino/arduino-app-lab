import { LspService } from './lspService.type';

export let isLspEnabled: LspService['isLspEnabled'] = async function () {
  throw new Error('isLspEnabled method not implemented');
};

export let initLspWorkspace: LspService['initLspWorkspace'] =
  async function () {
    throw new Error('initLspWorkspace method not implemented');
  };

export let startLSP: LspService['startLSP'] = async function () {
  throw new Error('startLSP method not implemented');
};

export let stopAllLSP: LspService['stopAllLSP'] = async function () {
  throw new Error('stopAllLSP method not implemented');
};

export let sendLspMessage: LspService['sendLspMessage'] = async function () {
  throw new Error('sendLspMessage method not implemented');
};

export let getLspTempWorkspaceAppDir: LspService['getLspTempWorkspaceAppDir'] =
  async function () {
    throw new Error('getLspTempWorkspaceAppDir method not implemented');
  };

export let getLspWorkspaceFile: LspService['getLspWorkspaceFile'] =
  async function () {
    throw new Error('getLspWorkspaceFile method not implemented');
  };

export const setLspService = (service: LspService): void => {
  isLspEnabled = service.isLspEnabled;
  initLspWorkspace = service.initLspWorkspace;
  startLSP = service.startLSP;
  stopAllLSP = service.stopAllLSP;
  sendLspMessage = service.sendLspMessage;
  getLspTempWorkspaceAppDir = service.getLspTempWorkspaceAppDir;
  getLspWorkspaceFile = service.getLspWorkspaceFile;
};
