import type { AgentSidePanelProps } from '@cloud-editor-mono/ai-assistant/panel';
import {
  AppLabWelcomeDialogLogic,
  BoardUpdateDialogLogic,
  CreateAppDialogLogic,
  FlashBoardDialogLogic,
  ImportResourceLogic,
  NetworkSettingsDialogLogic,
  OfflineWarningDialogLogic,
  SidePanelLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { UseBoards } from '../../hooks/useBoards';

export type UseMainLogic = () => {
  sidePanelLogic: SidePanelLogic;
  agentSidePanelLogic: AgentSidePanelProps;
  createAppDialogLogic: CreateAppDialogLogic;
  importAppDialogLogic: ImportResourceLogic;
  boardUpdateDialogLogic: BoardUpdateDialogLogic;
  flashBoardDialogLogic: FlashBoardDialogLogic;
  appLabWelcomeDialogLogic: AppLabWelcomeDialogLogic;
  offlineWarningDialogLogic: OfflineWarningDialogLogic;
  networkSettingsDialogLogic: NetworkSettingsDialogLogic;
  boardsProps: ReturnType<UseBoards>;
  boardIsFlashing: boolean | undefined;
  showRoutes: boolean;
};
