import {
  AppLabWelcomeDialogLogic,
  BoardUpdateDialogLogic,
  FlashBoardDialogLogic,
  SidePanelLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { UseBoards } from '../../hooks/useBoards';

export type UseMainLogic = () => {
  sidePanelLogic: SidePanelLogic;
  boardUpdateDialogLogic: BoardUpdateDialogLogic;
  flashBoardDialogLogic: FlashBoardDialogLogic;
  appLabWelcomeDialogLogic: AppLabWelcomeDialogLogic;
  boardsProps: ReturnType<UseBoards>;
  boardIsFlashing: boolean | undefined;
  showRoutes: boolean;
};
