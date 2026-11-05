import { ModalLogic } from '../../../essential/dialog';
import { RbacValue } from '../../../rbac';

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
  organizationName?: string;
  // Without sketch edit the role can see the sharing state but not change it.
  rbac?: RbacValue;
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
