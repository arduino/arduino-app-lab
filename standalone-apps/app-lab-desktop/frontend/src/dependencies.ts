import {
  setAppUIService,
  setArduinoAppFilesService,
  setBoardService,
  setBrowserService,
  setFeatureFlagService,
  setFileOpenerService,
  setLearnService,
  setOrchestratorService,
  setSettingsService,
  setUpdaterService,
  setWailsService,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';

import * as StandaloneAppUIService from './services/appUIService.impl.standalone';
import * as StandaloneArduinoAppFilesService from './services/arduinoAppFilesService.impl.standalone';
import * as StandaloneBoardService from './services/boardService.impl.standalone';
import * as StandaloneBrowserService from './services/browserService.impl.standalone';
import * as FeatureFlagService from './services/featureFlagsService.impl.standalone';
import * as StandaloneFileOpenerService from './services/fileOpenerService.impl.standalone';
import * as StandaloneLearnService from './services/learnService.impl.standalone';
import * as StandaloneOrchestratorService from './services/orchestratorService.impl.standalone';
import * as StandaloneSettingsService from './services/settingsService.impl.standalone';
import * as StandaloneUpdaterService from './services/updaterService.impl.standalone';
import * as StandaloneWailsService from './services/wailsService.impl.standalone';

export const injectDependencies = (): void => {
  setAppUIService(StandaloneAppUIService);
  setArduinoAppFilesService(StandaloneArduinoAppFilesService);
  setLearnService(StandaloneLearnService);
  setBoardService(StandaloneBoardService);
  setBrowserService(StandaloneBrowserService);
  setFeatureFlagService(FeatureFlagService);
  setFileOpenerService(StandaloneFileOpenerService);
  setOrchestratorService(StandaloneOrchestratorService);
  setSettingsService(StandaloneSettingsService);
  setUpdaterService(StandaloneUpdaterService);
  setWailsService(StandaloneWailsService);
};
