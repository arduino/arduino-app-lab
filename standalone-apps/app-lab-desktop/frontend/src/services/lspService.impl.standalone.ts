import { LspService } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  LspId,
  LspMessage,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import {
  GetLspTempWorkspaceAppDir,
  GetLspWorkspaceFile,
  InitLspWorkspace,
  IsLspEnabled,
  SendLSPMessage,
  StartLSP,
  StopAllLSP,
} from '../../wailsjs/go/app/App';

export const isLspEnabled: LspService['isLspEnabled'] = async function () {
  return IsLspEnabled();
};

export const initLspWorkspace: LspService['initLspWorkspace'] = async function (
  appPath: string,
) {
  return InitLspWorkspace(appPath);
};

export const startLSP: LspService['startLSP'] = async function (
  lspId: LspId,
  workspaceDir: string,
) {
  return StartLSP(lspId, workspaceDir);
};

export const stopAllLSP: LspService['stopAllLSP'] = async function () {
  return StopAllLSP();
};

export const getLspTempWorkspaceAppDir: LspService['getLspTempWorkspaceAppDir'] =
  async function () {
    return GetLspTempWorkspaceAppDir();
  };

export const getLspWorkspaceFile: LspService['getLspWorkspaceFile'] =
  async function (fileUri: string) {
    return GetLspWorkspaceFile(fileUri);
  };

export const sendLspMessage: LspService['sendLspMessage'] = async function (
  lspId: LspId,
  message: LspMessage,
) {
  return SendLSPMessage(lspId, message);
};
