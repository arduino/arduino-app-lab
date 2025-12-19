import {
  BoardUpdateDialogLogic,
  ImageWarningDialogLogic,
  SidePanelLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export type UseMainLogic = () => {
  sidePanelLogic: SidePanelLogic;
  boardUpdateDialogLogic: BoardUpdateDialogLogic;
  imageWarningDialogLogic: ImageWarningDialogLogic;
};
