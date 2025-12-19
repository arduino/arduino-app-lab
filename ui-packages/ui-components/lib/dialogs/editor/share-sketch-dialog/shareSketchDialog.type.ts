import { ModalLogic } from '../../../essential/dialog';

export enum ShareSketchRadioValue {
  Public = 'true',
  Private = 'false',
}

export type BaseShareSketchDialogLogicReturn = ReturnType<ModalLogic> & {
  handleDismiss: () => void;
  handleClose: () => void;
  onToggleVisibility: (isPublic: boolean) => void;
  targetUrl: string;
  embedMarkup: string;
  organizationId?: string;
};

interface OwnedSketchVisibilityProps {
  isOwned: true;
  isPublic: boolean;
}

type OwnedSketchDialogLogicReturn = BaseShareSketchDialogLogicReturn &
  OwnedSketchVisibilityProps;

interface NotOwnedSketchVisibilityProps {
  isOwned: false;
  isPublic: true;
}

type NotOwnedSketchDialogLogicReturn = BaseShareSketchDialogLogicReturn &
  NotOwnedSketchVisibilityProps;

export type ShareSketchDialogLogic = () =>
  | OwnedSketchDialogLogicReturn
  | NotOwnedSketchDialogLogicReturn;
