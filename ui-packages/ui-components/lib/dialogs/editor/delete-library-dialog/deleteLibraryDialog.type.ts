import { ConfirmActionDialogLogic } from '../../../essential/confirm-action-dialog';

export type DeleteLibraryDialogLogic = ConfirmActionDialogLogic;

export type DeleteLibraryDialogData = {
  libraryId: string;
  libraryName?: string;
};
