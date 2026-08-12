import {
  LspId,
  LspMessage,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface LspService {
  isLspEnabled: () => Promise<boolean>;
  initLspWorkspace: (appPath: string) => Promise<void>;
  startLSP: (lspId: LspId, workspaceDir: string) => Promise<void>;
  stopAllLSP: () => Promise<void>;
  sendLspMessage: (lspId: LspId, message: LspMessage) => Promise<void>;
  getLspTempWorkspaceAppDir: () => Promise<string>;
  getLspWorkspaceFile: (fileUri: string) => Promise<string>;
}
