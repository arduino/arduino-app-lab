import {
  setAiRuntimeService,
  setCodingAgentService,
} from '@cloud-editor-mono/ai-assistant';
import {
  setAppUIService,
  setArduinoAppFilesService,
  setArduinoAuthService,
  setBoardService,
  setBrowserService,
  setClipboardService,
  setCloudConnectorService,
  setEdgeImpulseService,
  setFeatureFlagService,
  setFileOpenerService,
  setFlasherService,
  setLearnService,
  setLspService,
  setOrchestratorService,
  setSettingsService,
  setUpdaterService,
  setWailsService,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';

import * as StandaloneAiRuntimeService from './services/aiRuntimeService.impl.standalone';
import * as StandaloneAppUIService from './services/appUIService.impl.standalone';
import * as StandaloneArduinoAppFilesService from './services/arduinoAppFilesService.impl.standalone';
import * as StandaloneAuthService from './services/authService.impl.standalone';
import * as StandaloneBoardService from './services/boardService.impl.standalone';
import * as StandaloneBrowserService from './services/browserService.impl.standalone';
import * as StandaloneClipboardService from './services/clipboardService.impl.standalone';
import * as StandaloneCloudConnectorService from './services/cloudConnectorService.impl.standalone';
import * as StandaloneCodingAgentService from './services/codingAgentService.impl.standalone';
import * as StandaloneEdgeImpulseService from './services/edgeImpulseService.impl.standalone';
import * as FeatureFlagService from './services/featureFlagsService.impl.standalone';
import * as StandaloneFileOpenerService from './services/fileOpenerService.impl.standalone';
import * as StandaloneFlasherService from './services/flasherService.impl.standalone';
import * as StandaloneLearnService from './services/learnService.impl.standalone';
import * as StandaloneLspService from './services/lspService.impl.standalone';
import * as StandaloneOrchestratorService from './services/orchestratorService.impl.standalone';
import * as StandaloneSettingsService from './services/settingsService.impl.standalone';
import * as StandaloneUpdaterService from './services/updaterService.impl.standalone';
import * as StandaloneWailsService from './services/wailsService.impl.standalone';

export const injectDependencies = (): void => {
  setCloudConnectorService(StandaloneCloudConnectorService);
  setAppUIService(StandaloneAppUIService);
  setArduinoAppFilesService(StandaloneArduinoAppFilesService);
  setArduinoAuthService(StandaloneAuthService);
  setBoardService(StandaloneBoardService);
  setBrowserService(StandaloneBrowserService);
  setClipboardService(StandaloneClipboardService);
  setEdgeImpulseService(StandaloneEdgeImpulseService);
  setFeatureFlagService(FeatureFlagService);
  setFileOpenerService(StandaloneFileOpenerService);
  setFlasherService(StandaloneFlasherService);
  setLearnService(StandaloneLearnService);
  setLspService(StandaloneLspService);
  setOrchestratorService(StandaloneOrchestratorService);
  setSettingsService(StandaloneSettingsService);
  setUpdaterService(StandaloneUpdaterService);
  setWailsService(StandaloneWailsService);
  // AI Assistant: Wails-backed runtime + agent (ACP).
  setCodingAgentService(StandaloneCodingAgentService);
  setAiRuntimeService(StandaloneAiRuntimeService);
};
